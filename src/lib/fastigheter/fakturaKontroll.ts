// Kontroll-grind: fångar uppenbart felaktiga fakturor INNAN de skickas.
// Ren, testbar funktion — ingen Hogia-koppling.
// Design: docs/superpowers/specs/2026-07-07-hogia-faktura-kontroll-design.md

export interface KontrollRad {
  artikelkod: string
  antal: number
  belopp: number
}

export interface KontrollFaktura {
  id: string
  typ: string // 'faktura' | 'el' | 'kreditnota'
  period: string // t.ex. '2026-01'
  status: string // 'ej_skickad' | 'skickad' | 'betald' | ...
  kundId: string // '' om mottagare saknas
  rader: KontrollRad[]
}

export interface KontrollResultat {
  fel: string[] // blockerande — får inte skickas
  varningar: string[] // kräver medveten bekräftelse
}

// Statusar som räknas som "redan utskickad" (för dubblett- och anomalikoll).
const REDAN_SKICKAD = new Set(['skickad', 'betald'])

// Elförbrukning (kWh) = summan av antal på EL-rader.
function elForbrukning(f: KontrollFaktura): number {
  return f.rader.filter((r) => r.artikelkod === 'EL').reduce((s, r) => s + (Number(r.antal) || 0), 0)
}

/**
 * Validerar en faktura mot kontroll-grinden.
 * @param f     fakturan som ska skickas
 * @param alla  alla kända fakturor (för dubblett- och historik-koll)
 */
export function valideraFaktura(f: KontrollFaktura, alla: KontrollFaktura[]): KontrollResultat {
  const fel: string[] = []
  const varningar: string[] = []
  const rader = f.rader ?? []

  // 1. Inga rader.
  if (rader.length === 0) fel.push('Fakturan saknar rader.')

  // 2. Belopp ≤ 0 (kreditnotor är negativa med flit → undantas).
  const total = rader.reduce((s, r) => s + (Number(r.belopp) || 0), 0)
  if (f.typ !== 'kreditnota' && total <= 0) fel.push('Fakturans belopp är 0 kr eller mindre.')

  // 3. El: förbrukning ≤ 0 eller saknad.
  if (f.typ === 'el') {
    const elRader = rader.filter((r) => r.artikelkod === 'EL')
    if (elRader.length === 0) fel.push('El-fakturan saknar elrader.')
    else if (elRader.some((r) => !(Number(r.antal) > 0))) fel.push('Elrad med förbrukning 0 kWh eller saknad.')
  }

  // 4. Saknad mottagare.
  if (!f.kundId) fel.push('Fakturan saknar mottagare (hyresgäst/kund).')

  // 5. Misstänkt dubblett: samma kund + period + typ redan skickad/betald.
  if (f.kundId) {
    const dubblett = alla.some(
      (o) => o.id !== f.id && o.kundId === f.kundId && o.period === f.period && o.typ === f.typ && REDAN_SKICKAD.has(o.status),
    )
    if (dubblett) {
      varningar.push(`En ${f.typ === 'el' ? 'el-faktura' : 'faktura'} för samma hyresgäst och period (${f.period}) är redan skickad.`)
    }
  }

  // 6. Anomali (el): förbrukning avviker kraftigt mot tidigare skickade el-fakturor för kunden.
  if (f.typ === 'el' && f.kundId) {
    const denna = elForbrukning(f)
    const tidigare = alla
      .filter((o) => o.id !== f.id && o.typ === 'el' && o.kundId === f.kundId && REDAN_SKICKAD.has(o.status))
      .map(elForbrukning)
      .filter((v) => v > 0)
    if (denna > 0 && tidigare.length > 0) {
      const snitt = tidigare.reduce((s, v) => s + v, 0) / tidigare.length
      if (snitt > 0 && (denna > snitt * 2 || denna < snitt * 0.5)) {
        varningar.push(`Ovanlig förbrukning: ${Math.round(denna)} kWh mot snitt ${Math.round(snitt)} kWh tidigare — kontrollera avläsningen.`)
      }
    }
  }

  return { fel, varningar }
}
