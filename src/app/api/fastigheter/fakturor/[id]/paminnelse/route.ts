// Betalningspåminnelse för en förfallen faktura.
//   GET  → utskrivbar HTML-påminnelse (ursprungsbelopp + påminnelseavgift + dröjsmålsränta + ny förfallodag)
//   POST → loggar att en påminnelse skickats (f_faktura_handelse typ 'paminnelse')
// Påminnelser sköts i Wisboverket (Hogia Customer Invoice-API:t saknar påminnelse-endpoint);
// när Hogia-synken ger betald-status slutar vi påminna automatiskt.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PAMINNELSEAVGIFT = 60 // lagstadgad påminnelseavgift (kr)
const fmtSEK = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d: Date) => d.toLocaleDateString('sv-SE')
const r2 = (n: number) => Math.round(n * 100) / 100

async function hamtaFaktura(id: string) {
  const sb = await createClient()
  const { data, error } = await sb
    .from('f_faktura')
    .select(`
      *,
      rader:f_fakturarad (*),
      hyresgast:f_hyresgast (*),
      bolag:f_bolag (*),
      handelser:f_faktura_handelse (*),
      hyresavtal:f_hyresavtal (
        *,
        lokaler:f_hyresavtal_lokal ( lokal:f_lokal ( *, fastighet:f_fastighet ( *, bolag:f_bolag (*) ) ) ),
        hyresgast:f_hyresgast (*)
      )
    `)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return { sb, faktura: data }
}

// POST — logga att en påminnelse skickats
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { sb, faktura } = await hamtaFaktura(id)
    if (!faktura) return NextResponse.json({ error: 'Faktura hittades inte' }, { status: 404 })
    const antal = ((faktura.handelser ?? []) as Array<{ typ: string }>).filter(h => h.typ === 'paminnelse').length + 1
    const { error } = await sb.from('f_faktura_handelse').insert({
      faktura_id: id,
      typ: 'paminnelse',
      meddelande: `Betalningspåminnelse ${antal} skickad`,
    })
    if (error) throw error
    return NextResponse.json({ ok: true, antal })
  } catch (e) {
    console.error('paminnelse POST error:', e)
    return NextResponse.json({ error: 'Kunde inte logga påminnelsen' }, { status: 500 })
  }
}

// GET — utskrivbar betalningspåminnelse
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { faktura } = await hamtaFaktura(id)
    if (!faktura) return new NextResponse('Faktura hittades inte', { status: 404 })

    const rader = (faktura.rader ?? []) as Array<{ belopp: number; moms: number }>
    const lokaler = (faktura.hyresavtal?.lokaler ?? []) as Array<{ lokal: any }>
    const forstaLokal = lokaler[0]?.lokal
    const bolag = forstaLokal?.fastighet?.bolag ?? faktura.bolag
    const hg = faktura.hyresavtal?.hyresgast ?? faktura.hyresgast
    const fastighet = forstaLokal?.fastighet

    const subtotal = rader.reduce((s, r) => s + parseFloat(String(r.belopp)), 0)
    const momsBelopp = rader.reduce((s, r) => s + parseFloat(String(r.belopp)) * (parseFloat(String(r.moms)) / 100), 0)
    const totalInkl = r2(subtotal + momsBelopp)

    const forfallo = new Date(faktura.forfallodag)
    const idag = new Date()
    const dagarForsenad = Math.max(0, Math.floor((idag.getTime() - forfallo.getTime()) / 86400000))
    const rantesats = Number(bolag?.drojsmalsranta ?? 8) // % per år
    const ranta = r2(totalInkl * (rantesats / 100) * (dagarForsenad / 365))
    const attBetala = r2(totalInkl + PAMINNELSEAVGIFT + ranta)
    const nyForfallo = new Date(idag); nyForfallo.setDate(nyForfallo.getDate() + 10)

    const antalTidigare = ((faktura.handelser ?? []) as Array<{ typ: string }>).filter(h => h.typ === 'paminnelse').length
    const paminnelseNr = Math.max(1, antalTidigare)

    const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="UTF-8">
<title>Betalningspåminnelse ${faktura.fakturanummer}</title>
<style>
  @page { size: A4; margin: 20mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; padding: 40px; max-width: 210mm; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #b3261e; }
  .header h1 { font-size: 22pt; font-weight: 700; letter-spacing: -0.5px; color: #b3261e; }
  .header .fnr { font-size: 10pt; color: #666; margin-top: 4px; }
  .company { text-align: right; font-size: 9pt; color: #444; }
  .company .name { font-size: 11pt; font-weight: 700; color: #1a1a1a; }
  .notice { margin-bottom: 24px; padding: 12px 16px; background: #fdecea; border-left: 4px solid #b3261e; border-radius: 4px; font-size: 10pt; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 26px; }
  .party-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
  .party-name { font-size: 12pt; font-weight: 600; }
  .meta { font-size: 9pt; color: #444; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; font-size: 9pt; }
  .meta-label { color: #888; }
  .totals { border-top: 2px solid #1a1a1a; padding-top: 12px; margin-top: 10px; }
  .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 10pt; }
  .total-row.big { font-size: 14pt; font-weight: 700; padding: 8px 0; border-top: 1px solid #ddd; margin-top: 6px; color: #b3261e; }
  .payment { margin-top: 26px; padding: 16px; background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 4px; }
  .payment h3 { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .payment-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 16px; font-size: 9.5pt; }
  .payment-grid .label { color: #666; }
  .payment-grid .value { font-weight: 600; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 8pt; color: #999; text-align: center; }
  .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 24px; background: #0071e3; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; z-index: 100; }
  .print-btn:hover { background: #005bb5; }
</style>
</head>
<body>

<button class="print-btn no-print" onclick="window.print()">Skriv ut / Spara PDF</button>

<div class="header">
  <div>
    <h1>BETALNINGSPÅMINNELSE</h1>
    <p class="fnr">Avser faktura ${faktura.fakturanummer}${paminnelseNr > 1 ? ` · Påminnelse ${paminnelseNr}` : ''}</p>
  </div>
  <div class="company">
    <p class="name">${bolag?.namn || fastighet?.namn || ''}</p>
    ${bolag?.orgnummer ? `<p>${bolag.orgnummer}</p>` : ''}
    ${bolag?.adress ? `<p>${bolag.adress}</p>` : ''}
    ${bolag?.postnummer || bolag?.stad ? `<p>${[bolag?.postnummer, bolag?.stad].filter(Boolean).join(' ')}</p>` : ''}
  </div>
</div>

<div class="notice">
  Vår faktura <strong>${faktura.fakturanummer}</strong> med förfallodag ${fmtDate(forfallo)} är ännu inte betald${dagarForsenad > 0 ? ` (${dagarForsenad} dagar försenad)` : ''}. Vänligen betala snarast, dock senast ${fmtDate(nyForfallo)}. Har betalningen redan gjorts kan denna påminnelse bortses från.
</div>

<div class="parties">
  <div>
    <p class="party-label">Till</p>
    <p class="party-name">${hg?.namn ?? ''}</p>
    ${hg?.adress ? `<p class="meta">${hg.adress}</p>` : ''}
  </div>
  <div>
    <p class="party-label">Uppgifter</p>
    <div class="meta-grid">
      <span class="meta-label">Påminnelsedatum</span><span>${fmtDate(idag)}</span>
      <span class="meta-label">Ursprunglig förfallodag</span><span>${fmtDate(forfallo)}</span>
      <span class="meta-label">Ny förfallodag</span><span class="party-name" style="font-size:10pt">${fmtDate(nyForfallo)}</span>
      <span class="meta-label">Fakturanummer</span><span>${faktura.fakturanummer}</span>
    </div>
  </div>
</div>

<div class="totals">
  <div class="total-row"><span>Ursprungligt fakturabelopp (inkl. moms)</span><span>${fmtSEK(totalInkl)} kr</span></div>
  <div class="total-row"><span>Påminnelseavgift</span><span>${fmtSEK(PAMINNELSEAVGIFT)} kr</span></div>
  <div class="total-row"><span>Dröjsmålsränta (${rantesats} % · ${dagarForsenad} dagar)</span><span>${fmtSEK(ranta)} kr</span></div>
  <div class="total-row big"><span>Att betala</span><span>${fmtSEK(attBetala)} kr</span></div>
</div>

<div class="payment">
  <h3>Betalningsinformation</h3>
  <div class="payment-grid">
    <span class="label">Belopp att betala:</span><span class="value">${fmtSEK(attBetala)} kr</span>
    <span class="label">Betala senast:</span><span class="value">${fmtDate(nyForfallo)}</span>
    ${bolag?.bankgiro ? `<span class="label">Bankgiro:</span><span class="value">${bolag.bankgiro}</span>` : ''}
    ${bolag?.plusgiro ? `<span class="label">Plusgiro:</span><span class="value">${bolag.plusgiro}</span>` : ''}
    <span class="label">Ange referens:</span><span class="value">${faktura.fakturanummer}</span>
  </div>
</div>

<div class="footer">
  ${bolag?.namn || fastighet?.namn || ''}${bolag?.orgnummer ? ` · ${bolag.orgnummer}` : ''}${bolag?.bankgiro ? ` · Bankgiro ${bolag.bankgiro}` : ''}
</div>

</body>
</html>`

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (e) {
    console.error('paminnelse GET error:', e)
    return new NextResponse('Fel vid generering', { status: 500 })
  }
}
