// Migrerad från käll-appen: src/app/api/hyresavtal/[id]/pdf/route.ts
// Prisma → Supabase server-klient. Genererar hyreskontrakt-PDF (Fastighetsägarna
// formulär 12B.3) med pdf-lib.
//
// DATALAGER-PORT:
//  * prisma.hyresavtal.findUnique(include:{...}) → f_hyresavtal + djup nested select.
//    - Prisma-relationen `lokaler` (junction HyresavtalLokal) → f_hyresavtal_lokal,
//      aliasad till "lokaler" så resten av koden kan läsa avtal.lokaler[].lokal.
//    - lokal.fastighet.{bolag,byggnader}, lokal.byggnad → nästlade embeds.
//    - hyresgast → hyresgast, avtalsrader → avtalsrader (f_avtalsrad).
//  * Fält camelCase → snake_case enligt SCHEMA.sql (uppsagningstidHG→uppsagningstid_hg,
//    anvandIndex→anvand_index, elAbonnemang→el_abonnemang, arsbelopp osv.).
//  * Belopp är numeric(14,2) → kommer som number/string från PostgREST; num() säkrar Number.
//
// SIDOEFFEKTER: pdf-lib PDF-generering porterad rakt av (server-side, oförändrad layout).
//
// TODO (minnesregel/PLAN R4): Wisboverket-loggan ska med på alla utskrivbara dokument.
//   Käll-footern "Genererat av Hofmanns Fastigheter" bör bytas mot Wisboverket-logga
//   (embedPng från Storage-bucket 'fastigheter') + korrekt avsändartext. Kräver att
//   loggan finns i Storage — lämnas som manuell uppföljning. Se även R4: svenska tecken
//   (å/ä/ö) med StandardFonts.Helvetica renderas dåligt; överväg inbäddad TTF + fontkit.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const num = (v: unknown): number => (v == null ? 0 : Number(v))
const formatDate = (d: string | Date) => new Date(d).toISOString().split('T')[0]
const formatSEK = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()

    // Prisma include-träd → PostgREST nested select.
    // include: { lokaler: { include: { lokal: { include: { fastighet: { include: { bolag, byggnader } }, byggnad } } } }, hyresgast, avtalsrader }
    const { data: avtal, error } = await sb
      .from('f_hyresavtal')
      .select(`
        *,
        lokaler:f_hyresavtal_lokal (
          *,
          lokal:f_lokal (
            *,
            fastighet:f_fastighet (
              *,
              bolag:f_bolag (*),
              byggnader:f_byggnad (*)
            ),
            byggnad:f_byggnad (*)
          )
        ),
        hyresgast:f_hyresgast (*),
        avtalsrader:f_avtalsrad (*)
      `)
      .eq('id', id)
      .single()

    if (error || !avtal) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })

    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const fontSize = 9
    const small = 7.5
    const black = rgb(0, 0, 0)
    const gray = rgb(0.4, 0.4, 0.4)

    type Lokal = {
      namn: string; typ: string; yta: number
      fastighet?: { namn?: string; adress?: string; stad?: string; fastighetsbeteckning?: string | null; bolag?: { namn?: string; orgnummer?: string | null; bankgiro?: string | null } | null } | null
      byggnad?: { adress?: string | null } | null
    }
    const lokalerRader = ((avtal.lokaler as Array<{ lokal: Lokal }>) ?? []).filter(hl => hl?.lokal)

    const forstaLokal = lokalerRader[0]?.lokal
    const f = forstaLokal?.fastighet ?? { namn: '', adress: '', stad: '', fastighetsbeteckning: null, bolag: null }
    const bolag = f.bolag
    const hg = (avtal.hyresgast as { namn: string; personnummer?: string | null; adress?: string | null }) ?? { namn: '', personnummer: null, adress: null }
    const arshyra = avtal.arshyra != null ? num(avtal.arshyra) : num(avtal.bashyra) * 12

    // --- Sida 1 ---
    let page = pdf.addPage([595.28, 841.89]) // A4
    const { width, height } = page.getSize()
    let y = height - 50

    const drawText = (text: string | null | undefined, x: number, yPos: number, options?: { font?: typeof font; size?: number; color?: typeof black }) => {
      if (!text) return
      page.drawText(String(text), { x, y: yPos, font: options?.font || font, size: options?.size || fontSize, color: options?.color || black })
    }

    const drawLabel = (label: string, x: number, yPos: number) => {
      drawText(label, x, yPos, { font: fontBold, size: small, color: gray })
    }

    const drawSection = (nr: string, title: string, yPos: number) => {
      drawText(`${nr}.`, 40, yPos, { font: fontBold, size: 10 })
      drawText(title, 60, yPos, { font: fontBold, size: 10 })
      return yPos - 18
    }

    const drawLine = (yPos: number) => {
      page.drawLine({ start: { x: 40, y: yPos }, end: { x: width - 40, y: yPos }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
      return yPos - 5
    }

    // Header
    drawText('HYRESKONTRAKT FÖR LOKAL', width / 2 - 100, y, { font: fontBold, size: 14 })
    if (avtal.avtalsnummer) drawText(`Nr ${avtal.avtalsnummer}`, width - 120, y, { size: 10, color: gray })
    drawText('Enligt Fastighetsägarna Sveriges formulär 12B.3', width / 2 - 120, y - 16, { size: small, color: gray })
    y -= 45

    // §1 Hyresvärd
    y = drawSection('1', 'Hyresvärd', y)
    drawLabel('Namn', 60, y)
    drawLabel('Org.nummer', 300, y)
    y -= 14
    drawText(bolag?.namn || f.namn, 60, y)
    drawText(bolag?.orgnummer || '', 300, y)
    y -= 20

    // §2 Hyresgäst
    y = drawSection('2', 'Hyresgäst', y)
    drawLabel('Namn', 60, y)
    drawLabel('Personnr/Orgnr', 300, y)
    y -= 14
    drawText(hg.namn, 60, y)
    drawText(hg.personnummer || '', 300, y)
    y -= 5
    if (hg.adress) {
      drawLabel('Aviseringsadress', 60, y)
      y -= 14
      drawText(hg.adress, 60, y)
    }
    y -= 20

    // §3 Lokalens adress
    y = drawSection('3', 'Lokalens adress', y)
    drawLabel('Kommun', 60, y)
    drawLabel('Fastighetsbeteckning', 200, y)
    y -= 14
    drawText(f.stad, 60, y)
    drawText(f.fastighetsbeteckning || '', 200, y)
    y -= 18
    drawLabel('Gatuadress', 60, y)
    drawLabel('Lokaler', 300, y)
    y -= 14
    drawText(forstaLokal?.byggnad?.adress || f.adress, 60, y)
    drawText(lokalerRader.map(l => l.lokal.namn).join(', '), 300, y)
    y -= 20

    // §4 Användning
    y = drawSection('4', 'Lokalens användning', y)
    drawText(avtal.anvandning || 'Ej angivet', 60, y)
    y -= 20

    // §5 Hyrestid
    y = drawSection('5', 'Hyrestid', y)
    drawLabel('Från och med', 60, y)
    drawLabel('Till och med', 300, y)
    y -= 14
    drawText(formatDate(avtal.startdatum), 60, y)
    drawText(avtal.slutdatum ? formatDate(avtal.slutdatum) : 'Tillsvidare', 300, y)
    y -= 20

    // §6 Uppsägning/Förlängning
    y = drawSection('6', 'Uppsägningstid / Förlängningstid', y)
    const uppHG = avtal.uppsagningstid_hg ?? avtal.uppsagningstid
    const uppHV = avtal.uppsagningstid_hv ?? avtal.uppsagningstid
    drawText(`Uppsägning ska ske skriftligen minst ${uppHG} månader före hyrestidens utgång.`, 60, y, { size: small })
    y -= 12
    if (avtal.forlangning) {
      drawText(`I annat fall förlängs kontraktet med ${avtal.forlangning} månader.`, 60, y, { size: small })
      y -= 12
    }
    drawText(`Uppsägningstid hyresgäst: ${uppHG} mån | Uppsägningstid hyresvärd: ${uppHV} mån`, 60, y, { size: small, color: gray })
    y -= 20

    // §8 Storlek
    y = drawSection('8', 'Lokalens storlek', y)
    const typLabels: Record<string, string> = { lokal: 'Lokal', bostad: 'Bostad', garage: 'Garage', mark: 'Mark/Utomhus' }
    const totalYta = lokalerRader.reduce((s, l) => s + num(l.lokal.yta), 0)
    for (const hl of lokalerRader) {
      drawLabel('Typ', 60, y)
      drawLabel('Namn', 160, y)
      drawLabel('Area', 340, y)
      y -= 14
      drawText(typLabels[hl.lokal.typ] || hl.lokal.typ, 60, y)
      drawText(hl.lokal.namn, 160, y)
      drawText(`${num(hl.lokal.yta)} kvm`, 340, y)
      y -= 14
    }
    if (lokalerRader.length > 1) {
      drawText(`Total area: ${totalYta} kvm`, 60, y, { font: fontBold, size: small })
      y -= 14
    }
    y -= 6

    y = drawLine(y)

    // --- Sida 2 (eller fortsättning) ---
    // §10 Hyra
    y = drawSection('10', 'Hyra', y)
    drawText(`${formatSEK(arshyra)} kr per år exklusive tillägg`, 60, y)
    y -= 14
    drawText(`(${formatSEK(num(avtal.bashyra))} kr per månad)`, 60, y, { size: small, color: gray })
    y -= 20

    // §11 Index
    y = drawSection('11', 'Indexreglering', y)
    if (avtal.anvand_index && avtal.basindex_varde) {
      drawText(`[x] Ändring av hyra sker enligt KPI-indexklausul.`, 60, y, { size: small })
      y -= 12
      drawText(`Basindex: ${avtal.basindex_manad} ${avtal.basindex_ar} = ${avtal.basindex_varde}`, 60, y, { size: small, color: gray })
    } else {
      drawText('Ingen indexreglering.', 60, y, { size: small })
    }
    y -= 20

    // §12 Fastighetsskatt
    type Avtalsrad = { artikelkod: string; beskrivning: string; belopp: number; arsbelopp?: number | null }
    const avtalsrader = (avtal.avtalsrader as Avtalsrad[]) ?? []
    const fskattRad = avtalsrader.find(r => r.artikelkod === 'FSKATT')
    y = drawSection('12', 'Fastighetsskatt', y)
    if (fskattRad) {
      drawText(`[x] Fastighetsskatt ersätts: ${formatSEK(num(fskattRad.belopp))} kr/mån (${formatSEK(fskattRad.arsbelopp != null ? num(fskattRad.arsbelopp) : num(fskattRad.belopp) * 12)}/år)`, 60, y, { size: small })
    } else {
      drawText('Fastighetsskatt ingår i hyran.', 60, y, { size: small })
    }
    y -= 20

    // §13 Driftskostnader
    y = drawSection('13', 'Driftskostnader', y)
    const driftLabels: Record<string, string> = { hyresgast: 'Eget abonnemang', hyresvard: 'Hyresvärden', ingar: 'Ingår i hyran' }
    const driftPoster = [
      { label: 'El', value: avtal.el_abonnemang },
      { label: 'VA', value: avtal.va_abonnemang },
      { label: 'Värme', value: avtal.varme_abonnemang },
      { label: 'Ventilation', value: avtal.ventilation },
    ]
    for (const d of driftPoster) {
      drawText(`${d.label}: ${driftLabels[d.value] || d.value}`, 60, y, { size: small })
      y -= 12
    }
    y -= 8

    // Övriga avtalsrader
    const ovriga = avtalsrader.filter(r => r.artikelkod !== 'FSKATT')
    if (ovriga.length > 0) {
      drawText('Övriga tillägg:', 60, y, { font: fontBold, size: small })
      y -= 14
      for (const rad of ovriga) {
        drawText(`${rad.beskrivning}: ${formatSEK(num(rad.belopp))} kr/mån`, 60, y, { size: small })
        y -= 12
      }
      y -= 8
    }

    // Check if we need a new page
    if (y < 200) {
      page = pdf.addPage([595.28, 841.89])
      y = height - 50
    }

    // §17 Kostnadsandel
    if (avtal.kostnadsandel) {
      y = drawSection('17', 'Oförutsedda kostnader', y)
      drawText(`Lokalens andel: ${avtal.kostnadsandel} %`, 60, y, { size: small })
      y -= 20
    }

    // §18 Moms
    y = drawSection('18', 'Mervärdesskatt', y)
    drawText('[x] Hyresgästen ska bedriva momspliktig verksamhet i lokalen.', 60, y, { size: small })
    y -= 12
    drawText('Hyresvärden är skattskyldig till moms. Moms tillkommer på hyra och tillägg.', 60, y, { size: small, color: gray })
    y -= 20

    // §19 Betalning
    y = drawSection('19', 'Hyrans betalning', y)
    const betLabel = avtal.faktureringsfrekvens === 'kvartalsvis' ? 'kalenderkvartals' : 'kalendermånads'
    drawText(`Hyran betalas i förskott senast sista vardagen före varje ${betLabel} början.`, 60, y, { size: small })
    if (bolag?.bankgiro) {
      y -= 12
      drawText(`Bankgiro: ${bolag.bankgiro}`, 60, y, { size: small })
    }
    y -= 20

    // §22 Underhåll
    y = drawSection('22', 'Underhåll', y)
    const underhallLabels: Record<string, string> = {
      hyresvard: 'Hyresvärden utför och bekostar allt underhåll.',
      hyresgast_ytskikt: 'Hyresgästen utför och bekostar underhåll av ytskikt (golv, väggar, tak).',
      hyresgast_allt: 'Hyresgästen utför och bekostar allt underhåll av lokalen.',
    }
    drawText(`[x] ${underhallLabels[avtal.underhallsansvar] || avtal.underhallsansvar}`, 60, y, { size: small })
    y -= 20

    // §32 Säkerhet
    if (avtal.sakerhet) {
      y = drawSection('32', 'Säkerhet', y)
      drawText(avtal.sakerhet, 60, y, { size: small })
      y -= 20
    }

    // Specialvillkor
    if (avtal.specialvillkor) {
      y = drawLine(y)
      y -= 5
      drawText('Särskilda villkor', 40, y, { font: fontBold, size: 10 })
      y -= 16
      const lines = String(avtal.specialvillkor).split('\n')
      for (const line of lines) {
        if (y < 60) { page = pdf.addPage([595.28, 841.89]); y = height - 50 }
        drawText(line, 60, y, { size: small })
        y -= 12
      }
      y -= 10
    }

    // Signaturblock
    if (y < 150) { page = pdf.addPage([595.28, 841.89]); y = height - 50 }
    y = drawLine(y)
    y -= 10
    drawText('Underskrifter', 40, y, { font: fontBold, size: 10 })
    y -= 30

    drawText('Hyresvärd', 60, y, { font: fontBold, size: small })
    drawText('Hyresgäst', 320, y, { font: fontBold, size: small })
    y -= 40
    page.drawLine({ start: { x: 60, y }, end: { x: 250, y }, thickness: 0.5, color: black })
    page.drawLine({ start: { x: 320, y }, end: { x: 510, y }, thickness: 0.5, color: black })
    y -= 14
    drawText(bolag?.namn || f.namn, 60, y, { size: small })
    drawText(hg.namn, 320, y, { size: small })
    y -= 30
    drawLabel('Ort och datum', 60, y)
    drawLabel('Ort och datum', 320, y)
    y -= 30
    page.drawLine({ start: { x: 60, y }, end: { x: 250, y }, thickness: 0.5, color: black })
    page.drawLine({ start: { x: 320, y }, end: { x: 510, y }, thickness: 0.5, color: black })

    // Footer
    // TODO (minnesregel): byt till Wisboverket-logga/avsändare på utskrivbara dokument.
    page.drawText('Genererat av Wisboverket', {
      x: 40, y: 25, font, size: 6, color: rgb(0.6, 0.6, 0.6),
    })

    const pdfBytes = await pdf.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="hyresavtal-${avtal.avtalsnummer || avtal.id}.pdf"`,
      },
    })
  } catch (e) {
    console.error('PDF generation error:', e)
    return NextResponse.json({ error: 'Kunde inte generera PDF' }, { status: 500 })
  }
}
