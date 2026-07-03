// Migrerad från src/app/api/el-leverantor/[id]/route.ts (Prisma) → Supabase server-klient.
//
// POST — beräkna el-debitering per hyresgäst utifrån avläsningar/schablon.
// DELETE — ta bort en leverantörsfaktura.
//
// Prisma→Supabase-mönster som används här:
//  * elLeverantorsfaktura → f_el_leverantorsfaktura, elDebitering → f_eldebitering,
//    elmatare → f_elmatare, avlasningar → f_elavlasning, lokal → f_lokal,
//    hyresavtal(junction) → f_hyresavtal_lokal, hyresgast → f_hyresgast.
//  * camelCase → snake_case: prisPerKwh→pris_per_kwh, periodFran→period_fran,
//    periodTill→period_till, schablonKwh→schablon_kwh, leverantorId→leverantor_id,
//    matareId→matare_id, lokalId→lokal_id, hyresgastNamn→hyresgast_namn.
//  * djup include (fastighet→elmatare(aktiv)→avlasningar) → nested select + JS-filter.
//  * villkorligt junction-filter (hyresavtal.status='aktiv') gör PostgREST inte
//    tillförlitligt i samma select → hämtas nästlat och filtreras i JS.
//  * deleteMany + createMany → .delete().eq(...) följt av .insert([...]).
//    TODO(atomicitet): källan var transaktionslös men PLAN.md §2/R5 föreslår att
//    detta görs atomärt via Postgres-RPC (f_apply_el_debitering) så att en gammal
//    debitering inte raderas utan att en ny hinner skapas. Läggs till i migration.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST — Beräkna debitering per hyresgäst baserat på avläsningar
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()

    // include: { fastighet: { elmatare(aktiv) → avlasningar(order datum asc) } }
    const { data: faktura, error: fakturaErr } = await sb
      .from('f_el_leverantorsfaktura')
      .select(`
        *,
        fastighet:f_fastighet (
          id,
          elmatare:f_elmatare (
            *,
            avlasningar:f_elavlasning (*)
          )
        )
      `)
      .eq('id', id)
      .order('datum', { ascending: true, foreignTable: 'f_elmatare.f_elavlasning' })
      .single()

    if (fakturaErr && fakturaErr.code === 'PGRST116') {
      return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })
    }
    if (fakturaErr) throw fakturaErr
    if (!faktura) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })

    // Prisma-filtret elmatare.where({ aktiv: true }) → JS-filter (PostgREST-nested
    // select stödjer inte where på nästlad relation direkt).
    const matare = (faktura.fastighet?.elmatare ?? []).filter((m: { aktiv: boolean }) => m.aktiv)

    // Ta bort gamla debiteringar (deleteMany)
    const { error: delErr } = await sb.from('f_eldebitering').delete().eq('leverantor_id', id)
    if (delErr) throw delErr

    const prisPerKwh = faktura.pris_per_kwh ?? 0
    const periodFran = new Date(faktura.period_fran).getTime()
    const periodTill = new Date(faktura.period_till).getTime()

    const debiteringar: {
      leverantor_id: string
      matare_id: string
      lokal_id: string | null
      hyresgast_namn: string
      forbrukning: number | null
      pris_per_kwh: number
      belopp: number
    }[] = []

    for (const m of matare) {
      // Hitta hyresgäst via lokal (aktivt avtal via junction f_hyresavtal_lokal)
      let hyresgastNamn: string = m.beskrivning || m.matarnummer
      if (m.lokal_id) {
        // Prisma: lokal.include.hyresavtal(where hyresavtal.status='aktiv', take 1)
        //   → hämta junction-rader nästlat, filtrera status i JS.
        const { data: lokal } = await sb
          .from('f_lokal')
          .select(`
            id,
            avtal:f_hyresavtal_lokal (
              hyresavtal:f_hyresavtal (
                status,
                hyresgast:f_hyresgast ( namn )
              )
            )
          `)
          .eq('id', m.lokal_id)
          .single()

        // PostgREST returnerar nästlade relationer som arrayer; normalisera i JS.
        type AvtalRad = {
          hyresavtal?:
            | { status?: string; hyresgast?: { namn?: string } | { namn?: string }[] }
            | { status?: string; hyresgast?: { namn?: string } | { namn?: string }[] }[]
            | null
        }
        const avtalRader = ((lokal?.avtal ?? []) as unknown as AvtalRad[])
        const aktivt = avtalRader
          .map((row) => (Array.isArray(row.hyresavtal) ? row.hyresavtal[0] : row.hyresavtal))
          .find((ha) => ha?.status === 'aktiv')
        const aktivHg = aktivt?.hyresgast
        const namn = Array.isArray(aktivHg) ? aktivHg[0]?.namn : aktivHg?.namn
        if (namn) {
          hyresgastNamn = namn
        }
      }

      let forbrukning: number | null = null

      if (m.schablon_kwh) {
        // Schablon: fast kWh/mån × antal månader i perioden
        const manader = Math.round((periodTill - periodFran) / (1000 * 60 * 60 * 24 * 30.44))
        forbrukning = m.schablon_kwh * Math.max(manader, 1)
      } else {
        // Avläsningar (redan ordnade datum asc via foreignTable-order ovan)
        type AvlRad = { id: string; datum: number; varde: number }
        const avl: AvlRad[] = ((m.avlasningar ?? []) as { id: string; datum: string; varde: number }[]).map((a) => ({
          id: a.id,
          datum: new Date(a.datum).getTime(),
          varde: Number(a.varde),
        }))
        const startAvl =
          avl.filter((a: AvlRad) => a.datum <= periodTill).reverse().find((a: AvlRad) => a.datum <= periodFran) ||
          avl.find((a: AvlRad) => a.datum >= periodFran)
        const slutAvl = [...avl].reverse().find((a: AvlRad) => a.datum <= periodTill)

        if (startAvl && slutAvl && startAvl.id !== slutAvl.id) {
          forbrukning = Math.round((slutAvl.varde - startAvl.varde) * 100) / 100
        }
      }

      const belopp = forbrukning != null ? Math.round(forbrukning * prisPerKwh * 100) / 100 : 0

      debiteringar.push({
        leverantor_id: id,
        matare_id: m.id,
        lokal_id: m.lokal_id ?? null,
        hyresgast_namn: hyresgastNamn,
        forbrukning,
        pris_per_kwh: prisPerKwh,
        belopp,
      })
    }

    // Spara debiteringar (createMany)
    if (debiteringar.length > 0) {
      const { error: insErr } = await sb.from('f_eldebitering').insert(debiteringar)
      if (insErr) throw insErr
    }

    return NextResponse.json({ debiteringar: debiteringar.length })
  } catch (e) {
    console.error('POST el-leverantor debitering:', e)
    return NextResponse.json({ error: 'Kunde inte beräkna' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const { error } = await sb.from('f_el_leverantorsfaktura').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}
