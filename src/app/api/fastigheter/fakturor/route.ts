// Migrerad från käll-appens src/app/api/fakturor/route.ts (Prisma → Supabase).
//
// Detta är den TYNGSTA routen — hyres-fakturagenerering med kvartals-/månadslogik,
// KPI-indextillägg, öresavrundning, dublettspärr och samfakturerings-merge.
//
// Datalager-port:
//  * prisma.faktura → f_faktura, faktura.rader → f_fakturarad (faktura_id).
//  * prisma.hyresavtal → f_hyresavtal; include lokaler(junction f_hyresavtal_lokal)
//    → lokal → fastighet → bolag; hyresgast; avtalsrader(f_avtalsrad).
//  * camelCase-fält → snake_case (hyresavtalId→hyresavtal_id, bashyra, basindexVarde
//    →basindex_varde, anvandIndex→anvand_index, faktureringsfrekvens, forfallotyp,
//    forfallodagar osv.).
//  * KPI: hyresindex mot OKTOBER-KPI via fetchIndexKpi() ur src/lib/fastigheter/kpi.ts
//    (ej senaste månad; kommersiella avtal indexeras oktober-mot-oktober).
//
// ATOMICITET: käll-appen skapade fakturor + rader + samfaktura-merge transaktionslöst.
// Här beräknas all affärslogik i JS (som källan) men PERSISTERINGEN sker atomärt via
// Postgres-RPC:er f_skapa_fakturor / f_merge_samfaktura (se migration
// 016_fastigheter_fakturor_rpc.sql) → ingen halvskapad state om något fel inträffar.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchIndexKpi } from '@/lib/fastigheter/kpi'

function generateFakturanummer(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const random = Math.floor(Math.random() * 9000) + 1000
  return `F${year}${month}-${random}`
}

function forfalloForPeriod(period: string, typ: string, dagar: number): Date {
  const [year, month] = period.split('-').map(Number)
  if (typ === 'fore_period') {
    // Sista dagen i månaden FÖRE perioden
    return new Date(year, month - 1, 0)
  }
  // Dagar efter fakturadatum (idag)
  const d = new Date()
  d.setDate(d.getDate() + dagar)
  return d
}

function kvartalMonths(period: string): string[] {
  const [year, month] = period.split('-').map(Number)
  const q = Math.ceil(month / 3)
  const startMonth = (q - 1) * 3 + 1
  return [startMonth, startMonth + 1, startMonth + 2].map(
    (m) => `${year}-${String(m).padStart(2, '0')}`
  )
}

function isFirstMonthOfKvartal(period: string): boolean {
  const month = parseInt(period.split('-')[1])
  return month % 3 === 1
}

// ---- Typer för de nästlade Supabase-svaren (snake_case) ----
interface AvtalsradRow {
  artikelkod: string
  beskrivning: string
  belopp: number
  moms: number
}
interface BolagRow {
  id: string
}
interface FastighetRow {
  bolag: BolagRow | null
}
interface LokalRow {
  namn: string
  yta: number
  moms: number
  fastighet: FastighetRow | null
}
interface AvtalLokalRow {
  lokal: LokalRow | null
}
interface HyresgastRow {
  id: string
  namn: string
}
interface AvtalRow {
  id: string
  hyresgast_id: string
  bashyra: number
  anvand_index: boolean
  basindex_varde: number | null
  faktureringsfrekvens: string
  forfallotyp: string
  forfallodagar: number
  status: string
  lokaler: AvtalLokalRow[] | null
  hyresgast: HyresgastRow | null
  avtalsrader: AvtalsradRow[] | null
}

interface FakturaRadInput {
  artikelkod: string
  beskrivning: string
  antal: number
  apris: number
  belopp: number
  moms: number
}
interface FakturaInput {
  fakturanummer: string
  hyresavtal_id: string
  belopp: number
  period: string
  forfallodag: string
  status: string
  rader: FakturaRadInput[]
}

export async function GET(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')

    // include: rader, hyresavtal { lokaler { lokal { fastighet } }, hyresgast }
    // → nested select. Junction f_hyresavtal_lokal aliasas till "lokaler",
    //   lokal → f_lokal, fastighet → f_fastighet.
    let query = sb
      .from('f_faktura')
      .select(`
        *,
        rader:f_fakturarad (*),
        handelser:f_faktura_handelse (*),
        hyresgast:f_hyresgast (*),
        hyresavtal:f_hyresavtal (
          *,
          lokaler:f_hyresavtal_lokal (
            lokal:f_lokal (
              *,
              fastighet:f_fastighet (*)
            )
          ),
          hyresgast:f_hyresgast (*)
        )
      `)
      .order('created_at', { ascending: false })

    if (period) query = query.eq('period', period)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('fakturor GET error:', e)
    return NextResponse.json({ error: 'Serverfel', detail: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()
    const { period } = body
    // Engångsmeddelande för denna omgång — bakas in som en TEXT-rad högst upp på varje faktura.
    const omgangMeddelande: string = typeof body.meddelande === 'string' ? body.meddelande.trim() : ''

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'Period saknas eller felaktig (YYYY-MM)' }, { status: 400 })
    }

    // Genererar alltid vid kvartalets start
    if (!isFirstMonthOfKvartal(period)) {
      return NextResponse.json({ message: 'Välj kvartalets startmånad (Jan/Apr/Jul/Okt)', count: 0 })
    }

    // Aktiva/uppsagda avtal med nästlade relationer.
    // include lokaler.lokal.fastighet.bolag → junction f_hyresavtal_lokal → f_lokal
    //   → f_fastighet → f_bolag; hyresgast; avtalsrader (f_avtalsrad).
    const { data: aktivaAvtalRaw, error: avtalErr } = await sb
      .from('f_hyresavtal')
      .select(`
        id, hyresgast_id, bashyra, anvand_index, basindex_varde,
        faktureringsfrekvens, forfallotyp, forfallodagar, status,
        lokaler:f_hyresavtal_lokal (
          lokal:f_lokal (
            namn, yta, moms,
            fastighet:f_fastighet ( bolag:f_bolag (*) )
          )
        ),
        hyresgast:f_hyresgast ( id, namn ),
        avtalsrader:f_avtalsrad ( artikelkod, beskrivning, belopp, moms )
      `)
      .in('status', ['aktiv', 'uppsagd'])
    if (avtalErr) throw avtalErr

    const allaAvtal = (aktivaAvtalRaw ?? []) as unknown as AvtalRow[]

    // Respektera bolagsväljaren: skickas bolagId med genereras bara det bolagets avtal
    // (avtal → lokal → fastighet → bolag). Utan bolagId genereras alla bolag.
    const bolagId: string | null = body.bolagId ?? body.bolag_id ?? null
    const aktivaAvtal = bolagId
      ? allaAvtal.filter((a) => (a.lokaler ?? []).some((l) => l.lokal?.fastighet?.bolag?.id === bolagId))
      : allaAvtal

    // Hämta samfakturering-flagga per hyresgäst
    const hyresgastIds = [...new Set(aktivaAvtal.map((a) => a.hyresgast_id))]
    const samfaktureringMap = new Map<string, boolean>()
    if (hyresgastIds.length > 0) {
      const { data: hyresgaster, error: hgErr } = await sb
        .from('f_hyresgast')
        .select('id, samfakturering')
        .in('id', hyresgastIds)
      if (hgErr) throw hgErr
      for (const h of hyresgaster ?? []) {
        samfaktureringMap.set(h.id as string, h.samfakturering as boolean)
      }
    }

    const aktuelltKpi = await fetchIndexKpi()

    const r2 = (n: number) => Math.round(n * 100) / 100

    // Gruppera avtal per hyresgäst för samfakturering
    const avtalPerHyresgast: Record<string, AvtalRow[]> = {}
    for (const avtal of aktivaAvtal) {
      const key = avtal.hyresgast_id
      if (!avtalPerHyresgast[key]) avtalPerHyresgast[key] = []
      avtalPerHyresgast[key].push(avtal)
    }

    // Dublettspärr: hämta befintliga (hyresavtal_id, period) för dessa avtal.
    const allaIds = aktivaAvtal.map((a) => a.id)
    const existingSet = new Set<string>()
    if (allaIds.length > 0) {
      const { data: befintliga, error: bErr } = await sb
        .from('f_faktura')
        .select('hyresavtal_id, period')
        .in('hyresavtal_id', allaIds)
      if (bErr) throw bErr
      for (const f of befintliga ?? []) {
        existingSet.add(`${f.hyresavtal_id}::${f.period}`)
      }
    }

    // Bygg alla fakturor i JS (samma affärslogik som källan) → persistera atomärt via RPC.
    const fakturorAttSkapa: FakturaInput[] = []
    const skippadePgaDublett: string[] = []

    for (const [, avtalLista] of Object.entries(avtalPerHyresgast)) {
      for (const avtal of avtalLista) {
        const isKvartalsvis = avtal.faktureringsfrekvens === 'kvartalsvis'
        const kvartalsPerioder = kvartalMonths(period)

        // Beräkna index
        let indextillagg = 0
        if (avtal.anvand_index && avtal.basindex_varde && avtal.basindex_varde > 0 && aktuelltKpi) {
          indextillagg = Math.max(0, avtal.bashyra * (aktuelltKpi / avtal.basindex_varde) - avtal.bashyra)
        }

        // Kvartalsvis: 1 faktura antal=3. Månadsvis: 3 fakturor antal=1.
        const fakturaBatcher: { periodLabel: string; antalManader: number; forfalloperiod: string }[] = []
        if (isKvartalsvis) {
          fakturaBatcher.push({
            periodLabel: `${kvartalsPerioder[0]} – ${kvartalsPerioder[2]}`,
            antalManader: 3,
            forfalloperiod: kvartalsPerioder[0],
          })
        } else {
          for (const mp of kvartalsPerioder) {
            fakturaBatcher.push({ periodLabel: mp, antalManader: 1, forfalloperiod: mp })
          }
        }

        // Nästlade relationer (kan vara null från Supabase)
        const lokaler = (avtal.lokaler ?? []).map((l) => l.lokal).filter((l): l is LokalRow => !!l)
        const avtalsrader = avtal.avtalsrader ?? []
        const hyresgastNamn = avtal.hyresgast?.namn ?? ''

        for (const batch of fakturaBatcher) {
          // Dublettkontroll (mot befintliga i DB)
          if (existingSet.has(`${avtal.id}::${batch.periodLabel}`)) {
            skippadePgaDublett.push(`${hyresgastNamn} – ${batch.periodLabel}`)
            continue
          }

          const fakturaRader: FakturaRadInput[] = []

          // Engångsmeddelande högst upp (TEXT-rad, ingen kostnad) om ett angavs för omgången.
          if (omgangMeddelande) {
            fakturaRader.push({ artikelkod: 'TEXT', beskrivning: omgangMeddelande, antal: 0, apris: 0, belopp: 0, moms: 0 })
          }

          const lokalNamn = lokaler.map((l) => l.namn).join(', ')
          const totalYta = lokaler.reduce((s, l) => s + l.yta, 0)
          const momsRate = lokaler[0]?.moms ?? 0

          fakturaRader.push({
            artikelkod: 'HYR',
            beskrivning: `Hyra ${lokalNamn} (${totalYta} kvm) – ${batch.periodLabel}`,
            antal: batch.antalManader,
            apris: r2(avtal.bashyra),
            belopp: r2(avtal.bashyra * batch.antalManader),
            moms: momsRate,
          })

          if (indextillagg !== 0) {
            fakturaRader.push({
              artikelkod: 'IDX',
              beskrivning: `Indextillägg KPI (bas ${avtal.basindex_varde?.toFixed(2)} → ${aktuelltKpi?.toFixed(2)})`,
              antal: batch.antalManader,
              apris: r2(indextillagg),
              belopp: r2(indextillagg * batch.antalManader),
              moms: momsRate,
            })
          }

          for (const rad of avtalsrader) {
            fakturaRader.push({
              artikelkod: rad.artikelkod,
              beskrivning: `${rad.beskrivning} – ${batch.periodLabel}`,
              antal: batch.antalManader,
              apris: r2(rad.belopp),
              belopp: r2(rad.belopp * batch.antalManader),
              moms: rad.moms,
            })
          }

          // Avrunda fakturans TOTAL inkl. moms till hel krona (som hyressystemen gör),
          // inte exkl-summan — annars blir slutbeloppet kunden betalar t.ex. 10 937,50.
          const subtotalExkl = fakturaRader.reduce((s, row) => s + row.belopp, 0)
          const momsBelopp = fakturaRader.reduce((s, row) => s + row.belopp * ((row.moms || 0) / 100), 0)
          const totalInkl = subtotalExkl + momsBelopp
          const oreavrundning = r2(Math.round(totalInkl) - totalInkl)

          if (oreavrundning !== 0) {
            fakturaRader.push({
              artikelkod: 'ORE',
              beskrivning: 'Öreutjämning',
              antal: 1,
              apris: oreavrundning,
              belopp: oreavrundning,
              moms: 0,
            })
          }

          const totalBelopp = fakturaRader.reduce((s, row) => s + row.belopp, 0)
          const forfallodag = forfalloForPeriod(batch.forfalloperiod, avtal.forfallotyp, avtal.forfallodagar)

          fakturorAttSkapa.push({
            fakturanummer: generateFakturanummer(),
            hyresavtal_id: avtal.id,
            belopp: totalBelopp,
            period: batch.periodLabel,
            forfallodag: forfallodag.toISOString(),
            status: 'ej_skickad',
            rader: fakturaRader,
          })
        }
      }
    }

    // Persistera alla fakturor + rader ATOMÄRT via RPC.
    if (fakturorAttSkapa.length > 0) {
      const { error: rpcErr } = await sb.rpc('f_skapa_fakturor', {
        p_fakturor: fakturorAttSkapa,
      })
      if (rpcErr) throw rpcErr
    }

    // Samfakturering: slå ihop fakturor per hyresgäst+period (atomärt via RPC).
    for (const [hyresgastId, avtalLista] of Object.entries(avtalPerHyresgast)) {
      if (!samfaktureringMap.get(hyresgastId)) continue
      const avtalIds = avtalLista.map((a) => a.id)
      if (avtalIds.length < 2) continue
      const { error: mergeErr } = await sb.rpc('f_merge_samfaktura', {
        p_avtal_ids: avtalIds,
      })
      if (mergeErr) throw mergeErr
    }

    const msg = [
      fakturorAttSkapa.length > 0 ? `${fakturorAttSkapa.length} fakturor skapade` : null,
      skippadePgaDublett.length > 0 ? `${skippadePgaDublett.length} hoppades över (redan fakturerad)` : null,
    ]
      .filter(Boolean)
      .join('. ')

    return NextResponse.json({
      message: msg || 'Inga fakturor att skapa',
      count: fakturorAttSkapa.length,
      skippade: skippadePgaDublett,
    })
  } catch (e) {
    console.error('fakturor POST error:', e)
    return NextResponse.json({ error: 'Serverfel', detail: String(e) }, { status: 500 })
  }
}
