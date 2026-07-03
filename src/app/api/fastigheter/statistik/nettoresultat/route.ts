// Källa: src/app/api/statistik/nettoresultat/route.ts (Prisma) → Supabase server-klient.
//
// Ren beräkningsroute (GET). Inga sidoeffekter (ingen PDF/AI/extern API).
//
// Migrationsmönster:
//  * prisma.fastighet.findMany({ include: bolag, lokaler, driftskostnader, byggnader })
//    → sb.from('f_fastighet').select('*, bolag:f_bolag(namn), lokaler:f_lokal(yta,typ),
//      driftskostnader:f_driftskostnad(*), byggnader:f_byggnad(uthyrbar_yta)')
//  * prisma.hyresavtal.findMany({ where status in [...], include lokaler.lokal + avtalsrader })
//    → nested select via junction f_hyresavtal_lokal → f_lokal, samt f_avtalsrad.
//    - Prisma: avtal.lokaler[].lokal.{fastighetId,typ,yta}
//      PostgREST: avtal.lokaler[].lokal.{fastighet_id,typ,yta}
//  * camelCase → snake_case: fastighetId→fastighet_id, uthyrbarYta→uthyrbar_yta.
//  * numeric(14,2)-fält kommer som number från Supabase; behåll säker Number()-coercion.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()

    const { data: fastigheterData, error: fErr } = await sb
      .from('f_fastighet')
      .select(`
        id,
        namn,
        bolag:f_bolag ( namn ),
        lokaler:f_lokal ( yta, typ ),
        driftskostnader:f_driftskostnad ( belopp, period ),
        byggnader:f_byggnad ( uthyrbar_yta )
      `)
      .order('namn', { ascending: true })
    if (fErr) throw fErr
    const fastigheter = fastigheterData ?? []

    // Hämta aktiva/uppsagda avtal med lokaler (via junction) + avtalsrader
    const { data: aktivaAvtalData, error: aErr } = await sb
      .from('f_hyresavtal')
      .select(`
        id,
        bashyra,
        lokaler:f_hyresavtal_lokal (
          lokal:f_lokal ( fastighet_id, typ, yta )
        ),
        avtalsrader:f_avtalsrad ( belopp )
      `)
      .in('status', ['aktiv', 'uppsagd'])
    if (aErr) throw aErr
    const aktivaAvtal = aktivaAvtalData ?? []

    const result = fastigheter.map((f: any) => {
      // Intäkter: bashyra + avtalsrader per månad för alla aktiva avtal
      let intakterManad = 0
      let intakterManadLokal = 0 // exkl. markhyra — används för kr/kvm
      let antalAvtal = 0
      for (const avtal of aktivaAvtal as any[]) {
        // avtal.lokaler[].lokal (junction → f_lokal). Filtrera på fastighet.
        const avtalLokaler = (avtal.lokaler ?? [])
          .map((l: any) => l.lokal)
          .filter((lok: any) => lok && lok.fastighet_id === f.id)
        if (avtalLokaler.length === 0) continue
        const bashyra = Number(avtal.bashyra) || 0
        intakterManad += bashyra
        for (const rad of avtal.avtalsrader ?? []) intakterManad += Number(rad.belopp) || 0
        // Beräkna lokal-andel av bashyra (proportionellt mot yta, mark exkluderas)
        const totalYta = avtalLokaler.reduce((s: number, lok: any) => s + (Number(lok.yta) || 0), 0)
        const lokalYtaAvtal = avtalLokaler
          .filter((lok: any) => lok.typ !== 'mark')
          .reduce((s: number, lok: any) => s + (Number(lok.yta) || 0), 0)
        const lokalAndel = totalYta > 0 ? lokalYtaAvtal / totalYta : 1
        intakterManadLokal += bashyra * lokalAndel
        for (const rad of avtal.avtalsrader ?? []) intakterManadLokal += (Number(rad.belopp) || 0) * lokalAndel
        antalAvtal++
      }
      const intakterAr = intakterManad * 12

      // Kostnader: driftskostnader summerat till årsbelopp
      let kostnaderAr = 0
      for (const dk of f.driftskostnader ?? []) {
        const belopp = Number(dk.belopp) || 0
        kostnaderAr += dk.period === 'år' ? belopp : belopp * 12
      }
      const kostnaderManad = kostnaderAr / 12

      // Netto
      const nettoManad = intakterManad - kostnaderManad
      const nettoAr = intakterAr - kostnaderAr

      // LOA — exkludera mark helt, använd byggnadens uthyrbar_yta om registrerad
      const lokaler = f.lokaler ?? []
      const lokalYta = lokaler
        .filter((l: any) => l.typ !== 'mark')
        .reduce((s: number, l: any) => s + (Number(l.yta) || 0), 0)
      const byggnadLOA = (f.byggnader ?? []).reduce(
        (s: number, b: any) => s + (Number(b.uthyrbar_yta) || 0),
        0,
      )
      const totalLOA = byggnadLOA > 0 ? byggnadLOA : lokalYta
      // Netto exkl. mark för kr/kvm
      const nettoArLokal = intakterManadLokal * 12 - kostnaderAr

      return {
        fastighetId: f.id,
        fastighetNamn: f.namn,
        // bolag kan komma som objekt eller (teoretiskt) array från PostgREST — hantera båda
        bolagNamn: Array.isArray(f.bolag) ? (f.bolag[0]?.namn ?? null) : (f.bolag?.namn ?? null),
        antalLokaler: lokaler.length,
        antalAvtal,
        totalLOA,
        intakterManad: Math.round(intakterManad * 100) / 100,
        intakterAr: Math.round(intakterAr * 100) / 100,
        kostnaderManad: Math.round(kostnaderManad * 100) / 100,
        kostnaderAr: Math.round(kostnaderAr * 100) / 100,
        nettoManad: Math.round(nettoManad * 100) / 100,
        nettoAr: Math.round(nettoAr * 100) / 100,
        dpiPerKvm: totalLOA > 0 ? Math.round((nettoArLokal / totalLOA) * 100) / 100 : 0,
      }
    })

    // Totaler
    const totalt = {
      intakterManad: result.reduce((s, r) => s + r.intakterManad, 0),
      intakterAr: result.reduce((s, r) => s + r.intakterAr, 0),
      kostnaderManad: result.reduce((s, r) => s + r.kostnaderManad, 0),
      kostnaderAr: result.reduce((s, r) => s + r.kostnaderAr, 0),
      nettoManad: result.reduce((s, r) => s + r.nettoManad, 0),
      nettoAr: result.reduce((s, r) => s + r.nettoAr, 0),
    }

    return NextResponse.json({ fastigheter: result, totalt })
  } catch (e) {
    console.error('GET nettoresultat error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
