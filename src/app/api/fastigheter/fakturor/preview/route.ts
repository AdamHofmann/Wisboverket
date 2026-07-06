// Preview-endpoint för hyres-fakturagenerering.
//
// Återanvänder EXAKT samma avtals-query, kvartals-/månadslogik och dublettspärr
// som POST i ../route.ts — men skapar INGET, räknar bara.
//
// GET /api/fastigheter/fakturor/preview?period=YYYY-MM →
//   { antalNya, skippade, manadsavtal, kvartalsavtal }
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isFirstMonthOfKvartal(period: string): boolean {
  const month = parseInt(period.split('-')[1])
  return month % 3 === 1
}

function kvartalMonths(period: string): string[] {
  const [year, month] = period.split('-').map(Number)
  const q = Math.ceil(month / 3)
  const startMonth = (q - 1) * 3 + 1
  return [startMonth, startMonth + 1, startMonth + 2].map(
    (m) => `${year}-${String(m).padStart(2, '0')}`
  )
}

// ---- Typer för de nästlade Supabase-svaren (snake_case) ----
interface AvtalRow {
  id: string
  hyresgast_id: string
  faktureringsfrekvens: string
  status: string
  hyresgast: { id: string; namn: string } | null
  lokaler: { lokal: { fastighet: { bolag: { id: string } | null } | null } | null }[] | null
}

export async function GET(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')
    const bolagId = searchParams.get('bolagId')

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'Period saknas eller felaktig (YYYY-MM)' }, { status: 400 })
    }

    // Aktiva/uppsagda avtal — samma query som POST (endast fält som behövs för räkning).
    const { data: aktivaAvtalRaw, error: avtalErr } = await sb
      .from('f_hyresavtal')
      .select(`
        id, hyresgast_id, faktureringsfrekvens, status,
        hyresgast:f_hyresgast ( id, namn ),
        lokaler:f_hyresavtal_lokal ( lokal:f_lokal ( fastighet:f_fastighet ( bolag:f_bolag ( id ) ) ) )
      `)
      .in('status', ['aktiv', 'uppsagd'])
    if (avtalErr) throw avtalErr

    const allaAvtal = (aktivaAvtalRaw ?? []) as unknown as AvtalRow[]
    // Respektera bolagsväljaren — samma filter som POST.
    const aktivaAvtal = bolagId
      ? allaAvtal.filter((a) => (a.lokaler ?? []).some((l) => l.lokal?.fastighet?.bolag?.id === bolagId))
      : allaAvtal

    // Antal aktiva avtal per frekvens.
    let manadsavtal = 0
    let kvartalsavtal = 0
    for (const avtal of aktivaAvtal) {
      if (avtal.faktureringsfrekvens === 'kvartalsvis') kvartalsavtal++
      else manadsavtal++
    }

    // Om det inte är kvartalets startmånad skapar POST inga fakturor.
    if (!isFirstMonthOfKvartal(period)) {
      return NextResponse.json({
        antalNya: 0,
        skippade: 0,
        manadsavtal,
        kvartalsavtal,
      })
    }

    // Dublettspärr: befintliga (hyresavtal_id, period) för dessa avtal — samma som POST.
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

    // Räkna nya vs. skippade med samma batch-/periodlogik som POST.
    const kvartalsPerioder = kvartalMonths(period)
    let antalNya = 0
    let skippade = 0

    for (const avtal of aktivaAvtal) {
      const isKvartalsvis = avtal.faktureringsfrekvens === 'kvartalsvis'

      // Kvartalsvis: 1 faktura (periodLabel = spann). Månadsvis: 3 fakturor (per månad).
      const periodLabels: string[] = isKvartalsvis
        ? [`${kvartalsPerioder[0]} – ${kvartalsPerioder[2]}`]
        : kvartalsPerioder

      for (const periodLabel of periodLabels) {
        if (existingSet.has(`${avtal.id}::${periodLabel}`)) {
          skippade++
          continue
        }
        antalNya++
      }
    }

    return NextResponse.json({
      antalNya,
      skippade,
      manadsavtal,
      kvartalsavtal,
    })
  } catch (e) {
    console.error('fakturor preview GET error:', e)
    return NextResponse.json({ error: 'Serverfel', detail: String(e) }, { status: 500 })
  }
}
