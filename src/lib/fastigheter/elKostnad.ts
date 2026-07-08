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
