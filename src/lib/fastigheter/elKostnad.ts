// Kontroll av om en el-debiteringsomgångs kostnadsbas är komplett för kvartalet.
//
// Elkostnad = nät + handel. En omgång ska ha BÅDA typerna för VARJE månad i
// kvartalet — annars blir total_kostnad (och därmed blandpriset) för lågt och
// hyresgästerna underdebiteras. Vi kräver bara de typer som faktiskt förekommer
// bland de valda fakturorna (en fastighet som bara har t.ex. handel flaggas inte
// för saknad nät). Saknas typ-info helt (bara 'ovrigt') faller vi tillbaka på
// "minst en faktura per månad".

type KostFaktura = { typ?: string | null; period_fran?: string | null; period_till?: string | null }

const MANADER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const TYP_NAMN: Record<string, string> = { nat: 'nät', handel: 'handel' }

// Returnerar en lista på det som saknas, t.ex. ['nät jun'] eller ['maj', 'jun'].
// Tom lista = kostnadsbasen täcker hela kvartalet.
export function elKvartalKostnadsGap(valda: KostFaktura[], ar: number, kvartal: number): string[] {
  if (valda.length === 0) return []
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const manadIdx = [(kvartal - 1) * 3, (kvartal - 1) * 3 + 1, (kvartal - 1) * 3 + 2]
  const typer = [...new Set(valda.map(f => f.typ).filter((t): t is string => t === 'nat' || t === 'handel'))]

  const overlaps = (f: KostFaktura, mStart: string, mSlut: string) =>
    (f.period_fran ?? '') <= mSlut && (f.period_till ?? '') >= mStart

  const gaps: string[] = []
  for (const mi of manadIdx) {
    const mStart = `${ar}-${pad2(mi + 1)}-01`
    const mSlut = `${ar}-${pad2(mi + 1)}-${pad2(new Date(ar, mi + 1, 0).getDate())}`
    if (typer.length === 0) {
      if (!valda.some(f => overlaps(f, mStart, mSlut))) gaps.push(MANADER[mi])
    } else {
      for (const typ of typer) {
        if (!valda.some(f => f.typ === typ && overlaps(f, mStart, mSlut))) {
          gaps.push(`${TYP_NAMN[typ] || typ} ${MANADER[mi]}`)
        }
      }
    }
  }
  return gaps
}

// Vilka aktiva mätpunkter i fastigheten saknar en avläsning som avgränsar
// perioden och kan därför inte debiteras? Samma bracketing-logik som servern
// (el-omgang/route.ts): startavläsning = första ≥ periodstart, slutavläsning =
// första ≥ periodslut. Schablon-mätare har alltid förbrukning. Används för att
// förhandsvarna i "Ny debiteringsomgång" INNAN omgången skapas.
type PreviewMatare = {
  matarnummer: string; beskrivning: string | null; schablon_kwh: number | null
  fastighet_id: string; aktiv: boolean; avlasningar: { datum: string; varde: number }[]
}
export function elMatpunkterUtanAvlasning(
  matare: PreviewMatare[], fastighetId: string, fran: string, till: string,
): string[] {
  if (!fastighetId) return []
  const franT = new Date(fran).getTime()
  const tillT = new Date(till).getTime()
  const saknar: string[] = []
  for (const m of matare) {
    if (!m.aktiv || m.fastighet_id !== fastighetId || m.schablon_kwh) continue
    const avl = (m.avlasningar ?? [])
      .map(a => ({ datum: new Date(a.datum).getTime(), varde: Number(a.varde) }))
      .sort((a, b) => a.datum - b.datum)
    const startAvl = avl.find(a => a.datum >= franT) || avl[0]
    const slutAvl = avl.find(a => a.datum >= tillT) || avl[avl.length - 1]
    const ok = !!startAvl && !!slutAvl && startAvl !== slutAvl && slutAvl.varde >= startAvl.varde
    if (!ok) saknar.push(m.beskrivning || m.matarnummer)
  }
  return saknar
}
