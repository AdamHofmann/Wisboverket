// El-debiteringsomgångar — slå ihop nät + handel för en fastighet+period och
// debitera hyresgästerna via ett blandpris (total_kostnad / total_kwh).
//
// Prisma→Supabase-mönster (samma som el-leverantor/[id]/route.ts):
//  * f_el_debiteringsomgang = omgången, f_el_omgang_faktura = junction (vilka
//    leverantörsfakturor som ingår), f_eldebitering = hyresgästdebitering
//    (nu med omgang_id, leverantor_id null).
//  * camelCase-body (fastighetId/periodFran/periodTill/fakturaIds) → snake_case.
//  * förbruknings- + hyresgäst-logik kopieras troget från el-leverantor/[id]:
//    schablon_kwh × antal månader, annars slutavläsning − startavläsning;
//    hyresgäst via f_lokal → f_hyresavtal_lokal → f_hyresavtal(status='aktiv')
//    → f_hyresgast, filtrerat i JS (PostgREST kan inte villkora nästlad relation).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withLogg } from '@/lib/withLogg'

// GET — lista omgångar med nästlad fastighet, inkluderade fakturor och debiteringar.
async function getHandler() {
  try {
    const sb = await createClient()

    const { data: omgangar, error } = await sb
      .from('f_el_debiteringsomgang')
      .select(`
        *,
        fastighet:f_fastighet ( id, namn ),
        omgang_fakturor:f_el_omgang_faktura (
          faktura:f_el_leverantorsfaktura (*)
        ),
        debiteringar:f_eldebitering (*)
      `)
      .order('period_fran', { ascending: false })
    if (error) throw error

    // Platta ut junction → fakturor[] (behåll debiteringar/fastighet som de är).
    const rows = (omgangar ?? []).map((o: Record<string, unknown>) => {
      const junction = Array.isArray(o.omgang_fakturor) ? o.omgang_fakturor : []
      const fakturor = junction
        .map((j: { faktura?: unknown }) => j.faktura)
        .filter((f: unknown) => f != null)
      const { omgang_fakturor: _omit, ...rest } = o
      return { ...rest, fakturor }
    })

    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET el-omgang:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

// POST — skapa en omgång: beräkna blandpris och debitera varje aktiv mätare.
async function postHandler(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    const fastighetId: string = body.fastighetId ?? body.fastighet_id
    const periodFranRaw = body.periodFran ?? body.period_fran
    const periodTillRaw = body.periodTill ?? body.period_till
    const fakturaIds: string[] = body.fakturaIds ?? body.faktura_ids ?? []

    if (!fastighetId || !periodFranRaw || !periodTillRaw) {
      return NextResponse.json({ error: 'fastighetId, periodFran och periodTill krävs' }, { status: 400 })
    }
    if (!Array.isArray(fakturaIds) || fakturaIds.length === 0) {
      return NextResponse.json({ error: 'Minst en faktura krävs' }, { status: 400 })
    }

    const periodFranIso = new Date(periodFranRaw).toISOString()
    const periodTillIso = new Date(periodTillRaw).toISOString()
    const periodFran = new Date(periodFranIso).getTime()
    const periodTill = new Date(periodTillIso).getTime()

    // Hämta de inkluderade leverantörsfakturorna (typ + total_belopp + total_kwh).
    const { data: fakturor, error: fakturaErr } = await sb
      .from('f_el_leverantorsfaktura')
      .select('id, typ, total_belopp, total_kwh, period_fran, period_till')
      .in('id', fakturaIds)
    if (fakturaErr) throw fakturaErr
    if (!fakturor || fakturor.length === 0) {
      return NextResponse.json({ error: 'Inga fakturor hittades' }, { status: 400 })
    }

    // (a) total_kostnad = summan av total_belopp för ALLA inkluderade fakturor.
    const totalKostnad =
      Math.round(
        fakturor.reduce((s: number, f: { total_belopp: number | null }) => s + Number(f.total_belopp ?? 0), 0) * 100,
      ) / 100

    // (b) total_kwh = summan av kWh PER MÅNAD/PERIOD. Inom en period räknas kWh en
    //     gång (nätets, annars största) så nät+handel för samma månad inte
    //     dubbelräknas — men olika månader plussas ihop.
    type KwhRad = { typ: string | null; total_kwh: number | null; period_fran: string; period_till: string }
    const perPeriod = new Map<string, KwhRad[]>()
    for (const f of fakturor as KwhRad[]) {
      const key = `${f.period_fran}|${f.period_till}`
      perPeriod.set(key, [...(perPeriod.get(key) ?? []), f])
    }
    let totalKwh = 0
    for (const grupp of perPeriod.values()) {
      const nat = grupp.filter((f) => f.typ === 'nat')
      totalKwh += nat.length > 0
        ? nat.reduce((s, f) => s + Number(f.total_kwh ?? 0), 0)
        : grupp.reduce((max, f) => Math.max(max, Number(f.total_kwh ?? 0)), 0)
    }

    // (c) blandpris = total_kostnad / total_kwh (0 om total_kwh saknas).
    const blandpris = totalKwh > 0 ? Math.round((totalKostnad / totalKwh) * 10000) / 10000 : 0

    // (d) för varje AKTIV mätare i fastigheten — samma logik som el-leverantor/[id].
    const { data: fastighet, error: fastighetErr } = await sb
      .from('f_fastighet')
      .select(`
        id,
        elmatare:f_elmatare (
          *,
          avlasningar:f_elavlasning (*)
        )
      `)
      .eq('id', fastighetId)
      .order('datum', { ascending: true, foreignTable: 'f_elmatare.f_elavlasning' })
      .single()
    if (fastighetErr && fastighetErr.code === 'PGRST116') {
      return NextResponse.json({ error: 'Fastighet hittades inte' }, { status: 404 })
    }
    if (fastighetErr) throw fastighetErr

    // Prisma-filtret elmatare.where({ aktiv: true }) → JS-filter.
    const matare = (fastighet?.elmatare ?? []).filter((m: { aktiv: boolean }) => m.aktiv)

    const debiteringar: {
      omgang_id: string | null
      leverantor_id: null
      matare_id: string
      lokal_id: string | null
      hyresgast_namn: string
      forbrukning: number | null
      pris_per_kwh: number
      belopp: number
      status: string
      start_varde: number | null
      slut_varde: number | null
      avlast_fran: string | null
      avlast_till: string | null
      matare_beskrivning: string | null
    }[] = []

    for (const m of matare) {
      // Hitta hyresgäst via lokal (aktivt avtal via junction f_hyresavtal_lokal).
      let hyresgastNamn: string = m.beskrivning || m.matarnummer
      if (m.lokal_id) {
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
        const avtalen = avtalRader
          .map((row) => (Array.isArray(row.hyresavtal) ? row.hyresavtal[0] : row.hyresavtal))
          .filter((ha): ha is NonNullable<typeof ha> => !!ha)
        // Föredra aktivt avtal, annars valfritt avtal på lokalen (som frontend-vyn).
        const valt = avtalen.find((ha) => ha?.status === 'aktiv') || avtalen[0]
        const valtHg = valt?.hyresgast
        const namn = Array.isArray(valtHg) ? valtHg[0]?.namn : valtHg?.namn
        if (namn) {
          hyresgastNamn = namn
        }
      }

      let forbrukning: number | null = null
      let startVarde: number | null = null
      let slutVarde: number | null = null
      let avlastFran: string | null = null
      let avlastTill: string | null = null

      if (m.schablon_kwh) {
        // Schablon: fast kWh/mån × antal månader i perioden.
        const manader = Math.round((periodTill - periodFran) / (1000 * 60 * 60 * 24 * 30.44))
        forbrukning = m.schablon_kwh * Math.max(manader, 1)
      } else {
        // Avläsningar (redan ordnade datum asc via foreignTable-order ovan).
        type AvlRad = { id: string; datum: number; varde: number }
        const avl: AvlRad[] = ((m.avlasningar ?? []) as { id: string; datum: string; varde: number }[]).map((a) => ({
          id: a.id,
          datum: new Date(a.datum).getTime(),
          varde: Number(a.varde),
        }))
        // Avläsning görs vid/EFTER periodslut (t.ex. 7/4 stänger Q1). Förbrukningen
        // för en period = avläsningen som STÄNGER perioden (första ≥ periodslut) minus
        // den NÄRMAST FÖREGÅENDE avläsningen (som stängde föregående period). Samma
        // avläsning blir alltså slut för ett kvartal och start för nästa → inga glapp,
        // ingen dubbelräkning. Krävs både en stängande avläsning och en föregående —
        // annars kan perioden inte debiteras (mätaren hoppas över, "Avläsning saknas").
        const slutIdx = avl.findIndex((a: AvlRad) => a.datum >= periodTill)
        const startAvl = slutIdx > 0 ? avl[slutIdx - 1] : undefined
        const slutAvl = slutIdx > 0 ? avl[slutIdx] : undefined

        if (startAvl && slutAvl && slutAvl.varde >= startAvl.varde) {
          forbrukning = Math.round((slutAvl.varde - startAvl.varde) * 100) / 100
          startVarde = startAvl.varde
          slutVarde = slutAvl.varde
          avlastFran = new Date(startAvl.datum).toISOString().slice(0, 10)
          avlastTill = new Date(slutAvl.datum).toISOString().slice(0, 10)
        }
      }

      // Avrunda FÖRBRUKNINGEN (kWh) UPPÅT till hel kWh; beloppet räknas sedan på den.
      if (forbrukning != null) forbrukning = Math.ceil(forbrukning)
      const belopp = forbrukning != null ? Math.round(forbrukning * blandpris * 100) / 100 : 0

      debiteringar.push({
        omgang_id: null, // sätts efter att omgången skapats
        leverantor_id: null,
        matare_id: m.id,
        lokal_id: m.lokal_id ?? null,
        hyresgast_namn: hyresgastNamn,
        forbrukning,
        pris_per_kwh: blandpris,
        belopp,
        status: 'ej_fakturerad',
        start_varde: startVarde,
        slut_varde: slutVarde,
        avlast_fran: avlastFran,
        avlast_till: avlastTill,
        matare_beskrivning: m.beskrivning ?? null,
      })
    }

    // (e) spara omgången, kopplingarna och debiteringarna.
    const { data: omgang, error: omgangErr } = await sb
      .from('f_el_debiteringsomgang')
      .insert({
        fastighet_id: fastighetId,
        period_fran: periodFranIso,
        period_till: periodTillIso,
        total_kwh: totalKwh > 0 ? totalKwh : null,
        total_kostnad: totalKostnad,
        blandpris: totalKwh > 0 ? blandpris : null,
        status: 'utkast',
      })
      .select()
      .single()
    if (omgangErr) throw omgangErr

    // Kopplingar omgång ↔ faktura (bara de som faktiskt hittades).
    const kopplingar = fakturor.map((f: { id: string }) => ({
      omgang_id: omgang.id,
      faktura_id: f.id,
    }))
    const { error: kopplingErr } = await sb.from('f_el_omgang_faktura').insert(kopplingar)
    if (kopplingErr) {
      // Städa upp omgången om kopplingarna failar (cascade tar ev. debiteringar).
      await sb.from('f_el_debiteringsomgang').delete().eq('id', omgang.id)
      throw kopplingErr
    }

    // Debiteringsrader med omgang_id satt.
    if (debiteringar.length > 0) {
      const rader = debiteringar.map((d) => ({ ...d, omgang_id: omgang.id }))
      const { error: debErr } = await sb.from('f_eldebitering').insert(rader)
      if (debErr) {
        await sb.from('f_el_debiteringsomgang').delete().eq('id', omgang.id)
        throw debErr
      }
    }

    // Returnera skapad omgång i samma form som GET (fakturor + debiteringar nästlat).
    const { data: skapad, error: hamtaErr } = await sb
      .from('f_el_debiteringsomgang')
      .select(`
        *,
        fastighet:f_fastighet ( id, namn ),
        omgang_fakturor:f_el_omgang_faktura (
          faktura:f_el_leverantorsfaktura (*)
        ),
        debiteringar:f_eldebitering (*)
      `)
      .eq('id', omgang.id)
      .single()
    if (hamtaErr) throw hamtaErr

    const junction = Array.isArray(skapad.omgang_fakturor) ? skapad.omgang_fakturor : []
    const fakturorOut = junction
      .map((j: { faktura?: unknown }) => j.faktura)
      .filter((f: unknown) => f != null)
    const { omgang_fakturor: _omit, ...rest } = skapad as Record<string, unknown>

    return NextResponse.json({ ...rest, fakturor: fakturorOut }, { status: 201 })
  } catch (e) {
    console.error('POST el-omgang:', e)
    const msg = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Kunde inte skapa')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withLogg('api/fastigheter/el-omgang', getHandler)
export const POST = withLogg('api/fastigheter/el-omgang', postHandler)
