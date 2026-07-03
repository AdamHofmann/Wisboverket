// Migrerad: src/app/api/statistik/kassaflode/route.ts (Prisma) → Supabase server-klient.
//
// Mönster som demonstreras här:
//  * Fyra parallella findMany → fyra parallella Supabase-select (Promise.all).
//  * Prisma-modeller → f_-tabeller: Faktura→f_faktura, Driftskostnad→f_driftskostnad,
//    ElLeverantorsfaktura→f_el_leverantorsfaktura, Lan→f_lan.
//  * camelCase→snake_case: periodFran→period_fran, totalBelopp→total_belopp,
//    amortTyp→amort_typ, amortBelopp→amort_belopp.
//  * numeric(14,2)-kolumner kommer som number från PostgREST; datumkolumner
//    (fakturadatum, period_fran, startdatum, slutdatum) kommer som ISO-strängar
//    → new Date(...) i JS. belopp coercas via Number() för säkerhets skull.
//  * Ren beräkning (lanBetalningarPerManad + månadsaggregering) oförändrad.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function lanBetalningarPerManad(lan: {
  belopp: number; ranta: number; amort_typ: string; amort_belopp: number | null;
  startdatum: Date; slutdatum: Date | null;
}): Record<string, { ranta: number; amortering: number }> {
  const result: Record<string, { ranta: number; amortering: number }> = {}
  const nu = new Date()
  const start = new Date(lan.startdatum.getFullYear(), lan.startdatum.getMonth(), 1)
  const slut = lan.slutdatum
    ? new Date(lan.slutdatum.getFullYear(), lan.slutdatum.getMonth(), 1)
    : new Date(nu.getFullYear() + 1, nu.getMonth(), 1)

  const rantaManad = lan.ranta / 100 / 12

  // För arsvis med % av kvarvarande: amort_belopp/belopp = andelen per år
  const amortProcent = (lan.amort_typ === 'arsvis' && lan.amort_belopp && lan.belopp > 0)
    ? lan.amort_belopp / lan.belopp
    : null

  let kvarvarande = lan.belopp
  let d = new Date(start)
  let aretsAmortStart = kvarvarande  // saldot vid årets ingång

  while (d <= slut && kvarvarande > 0) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const manad = d.getMonth()

    // Beräkna månadsamortering
    let amortDennaMånad = 0
    if (lan.amort_typ !== 'ingen' && lan.amort_belopp) {
      if (amortProcent !== null) {
        // arsvis % av kvarvarande: fördela årets amortering jämnt över 12 månader
        amortDennaMånad = (aretsAmortStart * amortProcent) / 12
      } else if (lan.amort_typ === 'manadlig') {
        amortDennaMånad = lan.amort_belopp
      } else if (lan.amort_typ === 'kvartalsvis') {
        amortDennaMånad = manad % 3 === 0 ? lan.amort_belopp : 0
      }
    }

    amortDennaMånad = Math.min(amortDennaMånad, kvarvarande)

    result[key] = {
      ranta: Math.round(kvarvarande * rantaManad * 100) / 100,
      amortering: Math.round(amortDennaMånad * 100) / 100,
    }

    kvarvarande -= amortDennaMånad

    // Uppdatera ingångssaldo för nytt år
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    if (d.getMonth() === 0) aretsAmortStart = kvarvarande
  }
  return result
}

export async function GET() {
  try {
    const sb = await createClient()

    const [fakturorRes, driftskostnaderRes, elFakturorRes, lanRes] = await Promise.all([
      sb.from('f_faktura').select('period, belopp, status'),
      sb.from('f_driftskostnad').select('fakturadatum, belopp, period, typ'),
      sb.from('f_el_leverantorsfaktura').select('period_fran, total_belopp'),
      sb.from('f_lan').select('belopp, ranta, amort_typ, amort_belopp, startdatum, slutdatum'),
    ])

    if (fakturorRes.error) throw fakturorRes.error
    if (driftskostnaderRes.error) throw driftskostnaderRes.error
    if (elFakturorRes.error) throw elFakturorRes.error
    if (lanRes.error) throw lanRes.error

    const fakturor = fakturorRes.data ?? []
    const driftskostnader = driftskostnaderRes.data ?? []
    const elFakturor = elFakturorRes.data ?? []
    const lan = lanRes.data ?? []

    const manader: Record<string, { intakter: number; kostnader: number; elKostnader: number; ranta: number; amortering: number }> = {}

    const nu = new Date()
    for (let i = -24; i <= 12; i++) {
      const d = new Date(nu.getFullYear(), nu.getMonth() + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      manader[key] = { intakter: 0, kostnader: 0, elKostnader: 0, ranta: 0, amortering: 0 }
    }

    for (const f of fakturor) {
      const period = String(f.period).slice(0, 7)
      if (manader[period]) manader[period].intakter += Number(f.belopp)
    }

    for (const dk of driftskostnader) {
      const fd = new Date(dk.fakturadatum as string)
      const key = `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, '0')}`
      if (manader[key]) manader[key].kostnader += Number(dk.belopp)
    }

    for (const el of elFakturor) {
      const pf = new Date(el.period_fran as string)
      const key = `${pf.getFullYear()}-${String(pf.getMonth() + 1).padStart(2, '0')}`
      if (manader[key]) manader[key].elKostnader += Number(el.total_belopp)
    }

    for (const l of lan) {
      const betalningar = lanBetalningarPerManad({
        belopp: Number(l.belopp),
        ranta: Number(l.ranta),
        amort_typ: l.amort_typ as string,
        amort_belopp: l.amort_belopp != null ? Number(l.amort_belopp) : null,
        startdatum: new Date(l.startdatum as string),
        slutdatum: l.slutdatum ? new Date(l.slutdatum as string) : null,
      })
      for (const [key, b] of Object.entries(betalningar)) {
        if (manader[key]) {
          manader[key].ranta += b.ranta
          manader[key].amortering += b.amortering
        }
      }
    }

    const sorted = Object.entries(manader).sort((a, b) => a[0].localeCompare(b[0]))
    let ackumulerat = 0
    const resultat = sorted.map(([period, data]) => {
      const totalKostnader = data.kostnader + data.elKostnader + data.ranta + data.amortering
      const netto = data.intakter - totalKostnader
      ackumulerat += netto
      return {
        period,
        intakter: Math.round(data.intakter * 100) / 100,
        kostnader: Math.round(data.kostnader * 100) / 100,
        elKostnader: Math.round(data.elKostnader * 100) / 100,
        ranta: Math.round(data.ranta * 100) / 100,
        amortering: Math.round(data.amortering * 100) / 100,
        totalKostnader: Math.round(totalKostnader * 100) / 100,
        netto: Math.round(netto * 100) / 100,
        ackumulerat: Math.round(ackumulerat * 100) / 100,
      }
    })

    const nuPeriod = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}`
    const historik = resultat.filter(r => r.period <= nuPeriod)

    return NextResponse.json({
      manader: resultat,
      summor: {
        totalIntakter: historik.reduce((s, r) => s + r.intakter, 0),
        totalKostnader: historik.reduce((s, r) => s + r.totalKostnader, 0),
        totalNetto: historik.reduce((s, r) => s + r.netto, 0),
      },
      nuPeriod,
    })
  } catch (e) {
    console.error('GET kassaflode:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
