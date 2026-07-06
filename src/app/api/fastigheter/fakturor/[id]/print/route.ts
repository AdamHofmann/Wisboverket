// Migrerad från käll-appen: src/app/api/fakturor/[id]/print/route.ts
// Prisma → Supabase server-klient. Genererar en utskrivbar HTML-faktura (ingen PDF-lib här;
// utskrift sker klient-sidan via window.print()).
//
// Prisma-include → PostgREST nested select:
//   faktura.include:{
//     rader,
//     hyresavtal.include:{ lokaler.include:{ lokal.include:{ fastighet.include:{ bolag } } }, hyresgast }
//   }
// →
//   f_faktura select:
//     rader:f_fakturarad(*),
//     hyresavtal:f_hyresavtal(
//       *,
//       lokaler:f_hyresavtal_lokal( lokal:f_lokal( *, fastighet:f_fastighet( *, bolag:f_bolag(*) ) ) ),
//       hyresgast:f_hyresgast(*)
//     )
// Junction f_hyresavtal_lokal → nested lokal (behåller käll-UI:ts { lokal } -nyckel).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const fmtSEK = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d: Date) => d.toLocaleDateString('sv-SE')

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()

    const { data: faktura, error } = await sb
      .from('f_faktura')
      .select(`
        *,
        rader:f_fakturarad (*),
        hyresgast:f_hyresgast (*),
        bolag:f_bolag (*),
        hyresavtal:f_hyresavtal (
          *,
          lokaler:f_hyresavtal_lokal (
            lokal:f_lokal (
              *,
              fastighet:f_fastighet (
                *,
                bolag:f_bolag (*)
              )
            )
          ),
          hyresgast:f_hyresgast (*)
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!faktura) return new NextResponse('Faktura hittades inte', { status: 404 })

    const arEl = faktura.typ === 'el'
    const rader = (faktura.rader ?? []) as Array<{
      artikelkod: string
      beskrivning: string
      antal: number
      apris: number
      belopp: number
      moms: number
      start_varde?: number | null
      slut_varde?: number | null
      avlast_fran?: string | null
      avlast_till?: string | null
    }>

    const lokaler = (faktura.hyresavtal?.lokaler ?? []) as Array<{ lokal: any }>
    const forstaLokal = lokaler[0]?.lokal
    // Manuella fakturor saknar hyresavtal → fall tillbaka på fakturans direkta bolag/hyresgäst.
    const bolag = forstaLokal?.fastighet?.bolag ?? faktura.bolag
    const hg = faktura.hyresavtal?.hyresgast ?? faktura.hyresgast
    const fastighet = forstaLokal?.fastighet

    // numeric(14,2) kommer som number (parseFloat som skyddsnät)
    const subtotal = rader.reduce((s, r) => s + parseFloat(String(r.belopp)), 0)
    const momsBelopp = rader.reduce((s, r) => s + parseFloat(String(r.belopp)) * (parseFloat(String(r.moms)) / 100), 0)
    const totalInkl = Math.round((subtotal + momsBelopp) * 100) / 100
    const r2 = (n: number) => Math.round(n * 100) / 100

    // Fakturameddelande per bolag (t.ex. "OBS! Nytt bankgiro" eller "God Jul") — visas
    // som en tydlig noteringsruta högst upp. Lagras i f_bolag.faktura_prefix_text.
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const meddelande = bolag?.faktura_prefix_text
      ? `<div class="notice">${esc(String(bolag.faktura_prefix_text)).replace(/\n/g, '<br>')}</div>`
      : ''

    const fmtKwh = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('sv-SE'))
    const raderHTML = rader
      .filter(r => r.artikelkod !== 'ORE' || parseFloat(String(r.belopp)) !== 0)
      .map(r => {
        // Fritextrad: bara text över hela bredden, inga belopp.
        if (r.artikelkod === 'TEXT') {
          return `
        <tr>
          <td colspan="${arEl ? 7 : 5}" style="color:#555; font-style:italic;">${esc(String(r.beskrivning))}</td>
        </tr>
      `
        }
        // El-faktura: kolumner Del · Avläsningsperiod · Start · Slut · Förbrukning · Pris/kWh · Belopp
        if (arEl) {
          const per = r.avlast_fran && r.avlast_till ? `${r.avlast_fran} – ${r.avlast_till}` : '—'
          return `
        <tr>
          <td>${r.beskrivning}</td>
          <td>${per}</td>
          <td class="right">${fmtKwh(r.start_varde)}</td>
          <td class="right">${fmtKwh(r.slut_varde)}</td>
          <td class="right bold">${fmtKwh(r.antal)}</td>
          <td class="right">${fmtSEK(parseFloat(String(r.apris)))}</td>
          <td class="right bold">${fmtSEK(parseFloat(String(r.belopp)))}</td>
        </tr>
      `
        }
        return `
        <tr>
          <td>${r.beskrivning}</td>
          <td class="right">${r.antal}</td>
          <td class="right">${fmtSEK(parseFloat(String(r.apris)))}</td>
          <td class="right">${parseFloat(String(r.moms)) > 0 ? parseFloat(String(r.moms)) + '%' : '—'}</td>
          <td class="right bold">${fmtSEK(parseFloat(String(r.belopp)))}</td>
        </tr>
      `
      }).join('')

    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<title>Faktura ${faktura.fakturanummer}</title>
<style>
  @page { size: A4; margin: 20mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; padding: 40px; max-width: 210mm; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #1a1a1a; }
  .header h1 { font-size: 24pt; font-weight: 700; letter-spacing: -0.5px; }
  .header .fnr { font-size: 10pt; color: #666; margin-top: 4px; }
  .company { text-align: right; font-size: 9pt; color: #444; }
  .company .name { font-size: 11pt; font-weight: 700; color: #1a1a1a; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
  .party-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
  .party-name { font-size: 12pt; font-weight: 600; }
  .meta { font-size: 9pt; color: #444; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
  .meta-label { color: #888; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { text-align: left; padding: 10px 8px; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #666; border-bottom: 2px solid #ddd; }
  td { padding: 8px; border-bottom: 1px solid #eee; font-size: 9.5pt; }
  .right { text-align: right; }
  .bold { font-weight: 600; }
  .totals { border-top: 2px solid #1a1a1a; padding-top: 12px; }
  .total-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10pt; }
  .total-row.big { font-size: 14pt; font-weight: 700; padding: 8px 0; border-top: 1px solid #ddd; margin-top: 6px; }
  .payment { margin-top: 30px; padding: 16px; background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 4px; }
  .payment h3 { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .payment-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 16px; font-size: 9.5pt; }
  .payment-grid .label { color: #666; }
  .payment-grid .value { font-weight: 600; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 8pt; color: #999; text-align: center; }
  .notice { margin-bottom: 28px; padding: 12px 16px; background: #fdf6e3; border-left: 4px solid #c9a840; border-radius: 4px; font-size: 10pt; color: #1a1a1a; }
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 24px; background: #0071e3; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 100; }
  .print-btn:hover { background: #005bb5; }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">Skriv ut / Spara PDF</button>

<div class="header">
  <div>
    <h1>${arEl ? 'EL-FAKTURA' : 'FAKTURA'}</h1>
    <p class="fnr">${faktura.fakturanummer}</p>
  </div>
  <div class="company">
    <p class="name">${bolag?.namn || fastighet?.namn}</p>
    ${bolag?.orgnummer ? `<p>${bolag.orgnummer}</p>` : ''}
    ${bolag?.adress ? `<p>${bolag.adress}</p>` : ''}
    ${bolag?.postnummer || bolag?.stad ? `<p>${[bolag?.postnummer, bolag?.stad].filter(Boolean).join(' ')}</p>` : ''}
    ${bolag?.epost ? `<p>${bolag.epost}</p>` : ''}
    ${bolag?.telefon ? `<p>${bolag.telefon}</p>` : ''}
  </div>
</div>

${meddelande}

<div class="parties">
  <div>
    <p class="party-label">Faktureras</p>
    <p class="party-name">${hg?.namn ?? ''}</p>
    ${hg?.personnummer ? `<p class="meta">${hg.personnummer}</p>` : ''}
    ${hg?.adress ? `<p class="meta">${hg.adress}</p>` : ''}
    ${hg?.epost ? `<p class="meta">${hg.epost}</p>` : ''}
  </div>
  <div>
    <p class="party-label">Fakturainformation</p>
    <div class="meta-grid">
      <span class="meta-label">Fakturadatum</span><span>${fmtDate(new Date())}</span>
      <span class="meta-label">Förfallodatum</span><span class="bold">${fmtDate(new Date(faktura.forfallodag))}</span>
      <span class="meta-label">Period</span><span>${faktura.period}</span>
      <span class="meta-label">Lokal</span><span>${lokaler.map(l => l.lokal?.namn).filter(Boolean).join(', ')}</span>
      <span class="meta-label">Fastighet</span><span>${fastighet?.namn ?? ''}</span>
    </div>
  </div>
</div>

<table>
  <thead>
    ${arEl ? `<tr>
      <th>Del</th>
      <th>Avläsningsperiod</th>
      <th class="right">Start kWh</th>
      <th class="right">Slut kWh</th>
      <th class="right">Förbrukning</th>
      <th class="right">Pris/kWh</th>
      <th class="right">Belopp</th>
    </tr>` : `<tr>
      <th>Beskrivning</th>
      <th class="right">Antal</th>
      <th class="right">À-pris</th>
      <th class="right">Moms</th>
      <th class="right">Belopp</th>
    </tr>`}
  </thead>
  <tbody>
    ${raderHTML}
  </tbody>
</table>

<div class="totals">
  <div class="total-row"><span>Summa exkl. moms</span><span>${fmtSEK(r2(subtotal))} kr</span></div>
  ${momsBelopp > 0 ? `<div class="total-row"><span>Moms 25%</span><span>${fmtSEK(r2(momsBelopp))} kr</span></div>` : ''}
  <div class="total-row big"><span>Att betala</span><span>${fmtSEK(r2(totalInkl))} kr</span></div>
</div>

<div class="payment">
  <h3>Betalningsinformation</h3>
  <div class="payment-grid">
    <span class="label">Belopp att betala:</span><span class="value">${fmtSEK(r2(totalInkl))} kr</span>
    <span class="label">Förfallodatum:</span><span class="value">${fmtDate(new Date(faktura.forfallodag))}</span>
    ${bolag?.bankgiro ? `<span class="label">Bankgiro:</span><span class="value">${bolag.bankgiro}</span>` : ''}
    ${bolag?.plusgiro ? `<span class="label">Plusgiro:</span><span class="value">${bolag.plusgiro}</span>` : ''}
    <span class="label">Fakturanummer (ref):</span><span class="value">${faktura.fakturanummer}</span>
    ${bolag?.momsregistreringsnummer ? `<span class="label">Momsreg.nr:</span><span class="value">${bolag.momsregistreringsnummer}</span>` : ''}
  </div>
</div>

<div class="footer">
  ${bolag?.namn || fastighet?.namn}${bolag?.orgnummer ? ` · ${bolag.orgnummer}` : ''}${bolag?.bankgiro ? ` · Bankgiro ${bolag.bankgiro}` : ''}
</div>

</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (e) {
    console.error('Print error:', e)
    return new NextResponse('Fel vid generering', { status: 500 })
  }
}
