export function normalizeSwedishPhone(to: string) {
  let phone = String(to).replace(/[\s\-()]/g, '')
  if (phone.startsWith('0')) phone = '+46' + phone.slice(1)
  if (!phone.startsWith('+')) phone = '+46' + phone
  return phone
}

export function formatOrgnr(o: string) {
  const d = (o || '').replace(/[^0-9]/g, '')
  return d.length === 10 ? d.slice(0, 6) + '-' + d.slice(6) : o || ''
}

// Delade belopps­formaterare (sv-SE).
//
// fmtKr      — avrundat till hela kronor. Summor, intäkter, kostnader,
//              täckningsbidrag, KPI:er och radbelopp.
// fmtKrExakt — bevarar ören (upp till 2 decimaler). ENDAST för à-priser och
//              enhetspriser där det exakta styckepriset inte får avrundas bort.
export const fmtKr = (n: number | null | undefined) =>
  Math.round(n ?? 0).toLocaleString('sv-SE') + ' kr'

export const fmtKrExakt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('sv-SE', { maximumFractionDigits: 2 }) + ' kr'
