// Migrerad från käll-appens src/app/api/kpi/route.ts.
// Ingen Prisma/databas här — routen hämtar KPI-total (1980=100) från SCB.
// SCB-fetchen är utbruten till src/lib/fastigheter/kpi.ts (rena funktioner) så
// att t.ex. fakturagenereringen kan anropa fetchLatestKpi() direkt utan intern
// HTTP-fetch. Denna route wrappar bara lib-funktionen och behåller källans
// GET-kontrakt mot UI:t:
//   * ?year=YYYY&month=<Svenskt månadsnamn> → returnerar en enskild KpiRow
//     eller 404 om perioden saknas.
//   * utan filter → { latest, rows } (senaste + de senaste 36 månaderna).
// Ingen extern nyckel krävs för SCB. Ingen sidoeffekt att kommentera.
import { NextResponse } from 'next/server'
import { fetchKpiRows, MONTHS_SV } from '@/lib/fastigheter/kpi'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')   // valfritt filter
  const month = searchParams.get('month')  // valfritt filter, t.ex. "Oktober"

  try {
    const rows = await fetchKpiRows()

    // Filtrera om specifik år+månad efterfrågas.
    if (year && month) {
      const mo = MONTHS_SV.indexOf(month) + 1
      const found = rows.find((r) => r.year === parseInt(year) && r.month === mo)
      if (!found) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })
      return NextResponse.json(found)
    }

    // Returnera senaste + de senaste 36 månaderna.
    return NextResponse.json({ latest: rows[0], rows: rows.slice(0, 36) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
