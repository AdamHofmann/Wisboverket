// Portad från käll-appens src/app/api/kpi/route.ts.
// SCB KPI-hämtning som RENA FUNKTIONER så att t.ex. fakturagenereringen
// kan anropa fetchLatestKpi() direkt utan en intern HTTP-fetch mot /api/kpi.
// Route-varianten (api/fastigheter/kpi) kan wrappa dessa funktioner.
//
// SCB KPI API – monthly KPI (1980=100, total).

const SCB_URL = 'https://api.scb.se/OV0104/v1/doris/sv/ssd/START/PR/PR0101/PR0101A/KPItotM'

export const MONTHS_SV = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
]

export interface KpiRow {
  year: number
  month: number
  monthName: string
  period: string
  value: number
}

interface SCBData {
  data: { key: string[]; values: string[] }[]
}

// Hämtar och parsar de senaste ~månaderna av KPI-total från SCB, sorterade
// nyast först. Kastar vid nätverks-/parsfel — anropare får hantera.
export async function fetchKpiRows(): Promise<KpiRow[]> {
  const query = {
    query: [
      {
        code: 'ContentsCode',
        selection: { filter: 'item', values: ['000004VU'] },
      },
    ],
    response: { format: 'json' },
  }

  const res = await fetch(SCB_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(query),
    next: { revalidate: 86400 }, // cache 24h
  })

  if (!res.ok) throw new Error(`SCB svarade ${res.status}`)
  const json: SCBData = await res.json()

  return json.data
    .map((d) => {
      const raw = d.key[0] // t.ex. "2023M10"
      const yr = parseInt(raw.slice(0, 4))
      const mo = parseInt(raw.slice(5)) // efter "M"
      return {
        year: yr,
        month: mo,
        monthName: MONTHS_SV[mo - 1],
        period: `${yr}M${String(mo).padStart(2, '0')}`,
        value: parseFloat(d.values[0]),
      }
    })
    .filter((r) => !isNaN(r.value))
    .sort((a, b) => b.year - a.year || b.month - a.month)
}

// Bekvämlighetsfunktion: senaste KPI-värdet (number) eller null vid fel.
// Ersätter käll-appens interna fetch('/api/kpi') i fakturagenereringen.
export async function fetchLatestKpi(): Promise<number | null> {
  try {
    const rows = await fetchKpiRows()
    return rows[0]?.value ?? null
  } catch {
    return null
  }
}

// KPI för hyresindexering. Kommersiella hyresavtal indexeras mot OKTOBER-KPI
// (ej senaste publicerade månad) och basindex är oktobervärden. Returnerar det
// senaste tillgängliga oktobervärdet (t.ex. Okt 2025 = 419.35 för avgiftsår 2026).
export async function fetchIndexKpi(): Promise<number | null> {
  try {
    const rows = await fetchKpiRows() // redan sorterad nyast först
    const oktober = rows.find((r) => r.month === 10)
    return oktober?.value ?? rows[0]?.value ?? null
  } catch {
    return null
  }
}
