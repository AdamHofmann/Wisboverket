// Migrerad route: src/app/api/dashboard/route.ts (Prisma) → Supabase server-klient.
// Dashboard-aggregat: lokal-/avtals-/faktura-/driftskostnads-nyckeltal + vakans per fastighet.
//
// Mönster som demonstreras här:
//  * Prisma count/aggregate/_sum → Supabase count-queries + JS-summering.
//  * Djupt nästlade bolagId-filter (hyresavtal via junction f_hyresavtal_lokal →
//    f_lokal → f_fastighet.bolag_id) kan PostgREST inte filtrera enkelt i samma
//    query → hämta nästlat och FILTRERA I JS (samma mönster som PLAN.md §2 lokaler).
//  * Prisma-modeller → f_-tabeller, camelCase → snake_case-kolumner.
//  * Svarskontraktet mot UI:t är oförändrat (samma nycklar/former).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Hjälpare: matchar ett avtal (med nästlade lokaler→fastighet) mot valt bolag.
// Prisma-motsvarighet: lokaler: { some: { lokal: { fastighet: { bolagId } } } }
function avtalMatchesBolag(avtal: any, bolagId: string | null): boolean {
  if (!bolagId) return true
  const kopplingar = avtal.lokaler ?? []
  return kopplingar.some(
    (k: any) => k.lokal?.fastighet?.bolag_id === bolagId
  )
}

export async function GET(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const bolagId = searchParams.get('bolagId')

    // --- Lokal-count (totalt + uthyrda), exkl. mark ---
    // Prisma: prisma.lokal.count({ where: { fastighet: { bolagId }, typ != 'mark' } })
    // PostgREST kan inte count:exact filtrera på nästlad fastighet.bolag_id via head-query.
    // Vi hämtar lokalernas status/typ/yta/bashyra + fastighet.bolag_id och räknar i JS.
    let lokalQuery = sb
      .from('f_lokal')
      .select('yta, status, typ, bashyra, fastighet:f_fastighet!inner ( bolag_id )')
      .neq('typ', 'mark')
    if (bolagId) lokalQuery = lokalQuery.eq('f_fastighet.bolag_id', bolagId)

    // --- Aktiva/uppsagda avtal (bashyra) med nästlad koppling för bolag-filter ---
    // Prisma: hyresavtal.findMany({ where: { status in [...], lokaler.some... }, select: { bashyra } })
    const avtalQuery = sb
      .from('f_hyresavtal')
      .select(`
        bashyra,
        lokaler:f_hyresavtal_lokal (
          lokal:f_lokal ( fastighet:f_fastighet ( bolag_id ) )
        )
      `)
      .in('status', ['aktiv', 'uppsagd'])

    // --- Lediga lokaler (yta, bashyra) för förlorad hyra ---
    let ledigaQuery = sb
      .from('f_lokal')
      .select('yta, bashyra, fastighet:f_fastighet!inner ( bolag_id )')
      .eq('status', 'ledig')
      .neq('typ', 'mark')
    if (bolagId) ledigaQuery = ledigaQuery.eq('f_fastighet.bolag_id', bolagId)

    // --- Obetalda fakturor (count, INGET bolag-filter i källan) ---
    // Prisma: prisma.faktura.count({ where: { status != 'betald' } })
    const obetaldaQuery = sb
      .from('f_faktura')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'betald')

    // --- Driftskostnader denna månad (_sum belopp) ---
    // Prisma: aggregate _sum belopp där fakturadatum >= första i månaden [+ bolag].
    const forstaIManaden = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ).toISOString()
    let driftQuery = sb
      .from('f_driftskostnad')
      .select('belopp, fastighet:f_fastighet!inner ( bolag_id )')
      .gte('fakturadatum', forstaIManaden)
    if (bolagId) driftQuery = driftQuery.eq('f_fastighet.bolag_id', bolagId)

    // --- Aktiva hyresgäster (count via avtal med status + bolag) ---
    // Prisma: hyresgast.count({ where: { hyresavtal.some { status in [...], lokaler.some... } } })
    // Vi hämtar hyresgäster + deras avtal (status) + junction→fastighet.bolag_id och räknar i JS.
    const hyresgastQuery = sb
      .from('f_hyresgast')
      .select(`
        id,
        hyresavtal:f_hyresavtal (
          status,
          lokaler:f_hyresavtal_lokal (
            lokal:f_lokal ( fastighet:f_fastighet ( bolag_id ) )
          )
        )
      `)

    // --- Fastigheter m. byggnader + lokaler för vakansberäkning ---
    // Prisma: fastighet.findMany({ where: bolag, orderBy namn, select byggnader/lokaler })
    let fastighetQuery = sb
      .from('f_fastighet')
      .select(`
        id, namn,
        byggnader:f_byggnad ( totalyta, uthyrbar_yta ),
        lokaler:f_lokal ( yta, status, bashyra, typ )
      `)
      .order('namn', { ascending: true })
    if (bolagId) fastighetQuery = fastighetQuery.eq('bolag_id', bolagId)

    const [
      lokalRes,
      avtalRes,
      ledigaRes,
      obetaldaRes,
      driftRes,
      hyresgastRes,
      fastighetRes,
    ] = await Promise.all([
      lokalQuery,
      avtalQuery,
      ledigaQuery,
      obetaldaQuery,
      driftQuery,
      hyresgastQuery,
      fastighetQuery,
    ])

    for (const r of [
      lokalRes,
      avtalRes,
      ledigaRes,
      obetaldaRes,
      driftRes,
      hyresgastRes,
      fastighetRes,
    ]) {
      if (r.error) throw r.error
    }

    const lokaler = lokalRes.data ?? []
    const totalLokaler = lokaler.length
    const uthyrdaLokaler = lokaler.filter((l: any) => l.status === 'uthyrd').length

    // Aktiva avtal → filtrera på bolag i JS, summera bashyra.
    const aktivaAvtal = (avtalRes.data ?? []).filter((a: any) =>
      avtalMatchesBolag(a, bolagId)
    )
    const totalHyra = aktivaAvtal.reduce(
      (s: number, a: any) => s + (Number(a.bashyra) || 0),
      0
    )

    const ledigaLokalerData = ledigaRes.data ?? []
    const obetalda = obetaldaRes.count ?? 0

    const driftskostnaderTotal = (driftRes.data ?? []).reduce(
      (s: number, d: any) => s + (Number(d.belopp) || 0),
      0
    )

    // Aktiva hyresgäster: har minst ett avtal med status aktiv/uppsagd + bolag-match.
    const aktiva_hyresgaster = (hyresgastRes.data ?? []).filter((hg: any) =>
      (hg.hyresavtal ?? []).some(
        (a: any) =>
          ['aktiv', 'uppsagd'].includes(a.status) &&
          avtalMatchesBolag(a, bolagId)
      )
    ).length

    const fastigheterMedByggnader = fastighetRes.data ?? []

    const ledigaLokaler = totalLokaler - uthyrdaLokaler

    // Lokal-baserad beläggning (antal)
    const belaggningsgrad =
      totalLokaler > 0 ? (uthyrdaLokaler / totalLokaler) * 100 : 0

    // Ytabaserad vakans — summera byggnader om de finns, annars lokaler
    let totalBTA = 0
    let totalLOA = 0
    let totalUthyrdYta = 0

    const vakansPerFastighet = fastigheterMedByggnader.map((f: any) => {
      const byggnader = f.byggnader ?? []
      const flokaler = f.lokaler ?? []
      const bBTA = byggnader.reduce(
        (s: number, b: any) => s + (Number(b.totalyta) ?? 0),
        0
      )
      const bLOA = byggnader.reduce(
        (s: number, b: any) => s + (Number(b.uthyrbar_yta) ?? 0),
        0
      )
      // Exkludera mark från yta-baserade nyckeltal — mark räknas separat
      const inomhusLokaler = flokaler.filter((l: any) => l.typ !== 'mark')
      const uthyrdYta = inomhusLokaler
        .filter((l: any) => l.status === 'uthyrd')
        .reduce((s: number, l: any) => s + (Number(l.yta) || 0), 0)
      const lokalYtaTotal = inomhusLokaler.reduce(
        (s: number, l: any) => s + (Number(l.yta) || 0),
        0
      )
      // Byggnadens LOA är källan — kan rättas i fastighetsformuläret
      const uthyrbarYta = bLOA > 0 ? bLOA : lokalYtaTotal
      const vakantYta = Math.max(0, uthyrbarYta - uthyrdYta)
      const vakansgrad = uthyrbarYta > 0 ? (vakantYta / uthyrbarYta) * 100 : 0

      // Estimerad förlorad hyra: lediga lokalers bashyra
      const forloradHyra = flokaler
        .filter((l: any) => l.status === 'ledig' && l.bashyra)
        .reduce((s: number, l: any) => s + (Number(l.bashyra) ?? 0), 0)

      totalBTA += bBTA
      totalLOA += uthyrbarYta
      totalUthyrdYta += uthyrdYta

      return {
        fastighetId: f.id,
        fastighetNamn: f.namn,
        antalByggnader: byggnader.length,
        totalBTA: bBTA,
        uthyrbarYta,
        uthyrdYta,
        vakantYta,
        vakansgrad: Math.round(vakansgrad * 10) / 10,
        forloradHyra,
        antalLokaler: flokaler.filter((l: any) => l.typ !== 'mark').length,
        ledigaLokaler: flokaler.filter(
          (l: any) => l.typ !== 'mark' && l.status === 'ledig'
        ).length,
      }
    })

    const totalVakantYta = Math.max(0, totalLOA - totalUthyrdYta)
    const totalVakansgrad =
      totalLOA > 0 ? (totalVakantYta / totalLOA) * 100 : 0
    const totalForloradHyra = ledigaLokalerData.reduce(
      (s: number, l: any) => s + (Number(l.bashyra) ?? 0),
      0
    )

    // Kommande avtal som löper ut inom 12 månader
    const now = new Date()
    const twelveMonths = new Date()
    twelveMonths.setMonth(now.getMonth() + 12)

    // Prisma include: hyresgast + lokaler.lokal.fastighet.namn, orderBy slutdatum asc.
    // slutdatum: { not: null, gte: now, lte: twelveMonths } → .not('slutdatum','is',null) + range.
    const { data: kommandeAvtalRaw, error: kommandeErr } = await sb
      .from('f_hyresavtal')
      .select(`
        id, slutdatum, status, bashyra, arshyra,
        uppsagningstid_hg, uppsagningstid_hv, uppsagningstid,
        hyresgast:f_hyresgast ( namn ),
        lokaler:f_hyresavtal_lokal (
          lokal:f_lokal (
            namn,
            fastighet:f_fastighet ( namn, bolag_id )
          )
        )
      `)
      .in('status', ['aktiv', 'uppsagd'])
      .not('slutdatum', 'is', null)
      .gte('slutdatum', now.toISOString())
      .lte('slutdatum', twelveMonths.toISOString())
      .order('slutdatum', { ascending: true })
    if (kommandeErr) throw kommandeErr

    // Bolag-filter på nästlad koppling görs i JS (som övriga avtals-queries).
    const kommandeAvtal = (kommandeAvtalRaw ?? [])
      .filter((a: any) => avtalMatchesBolag(a, bolagId))
      // Behåll käll-UI:ts fältnamn: uppsagningstidHG/uppsagningstidHV samt
      // lokaler[].lokal.fastighet (utan att exponera bolag_id-hjälpfältet).
      .map((a: any) => ({
        id: a.id,
        slutdatum: a.slutdatum,
        status: a.status,
        bashyra: a.bashyra,
        arshyra: a.arshyra,
        uppsagningstidHG: a.uppsagningstid_hg,
        uppsagningstidHV: a.uppsagningstid_hv,
        uppsagningstid: a.uppsagningstid,
        hyresgast: a.hyresgast,
        lokaler: (a.lokaler ?? []).map((k: any) => ({
          lokal: {
            namn: k.lokal?.namn,
            fastighet: { namn: k.lokal?.fastighet?.namn },
          },
        })),
      }))

    return NextResponse.json({
      totalLokaler,
      uthyrdaLokaler,
      ledigaLokaler,
      belaggningsgrad: Math.round(belaggningsgrad * 10) / 10,
      totalHyraPerManad: totalHyra,
      obetalda,
      driftskostnaderManad: driftskostnaderTotal,
      aktiva_hyresgaster,
      kommandeAvtal,
      // Ytabaserad vakans
      totalBTA,
      totalLOA,
      totalUthyrdYta,
      totalVakantYta,
      totalVakansgrad: Math.round(totalVakansgrad * 10) / 10,
      totalForloradHyra,
      vakansPerFastighet,
    })
  } catch (e) {
    console.error('dashboard error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
