import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const fil = form.get('fil') as File | null
  if (!fil) return NextResponse.json({ error: 'Ingen fil' }, { status: 400 })

  const bytes = await fil.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = (fil.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'

  const msg = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: mediaType === 'application/pdf' ? 'document' : 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        } as any,
        {
          type: 'text',
          text: `Läs denna leverantörsfaktura och extrahera följande information som JSON. Svara ENDAST med JSON, inget annat.
Alla belopp ska vara EXKLUSIVE moms (netto).

{
  "leverantor": "Företagsnamn från fakturan",
  "belopp_exkl_moms": 0,
  "moms_belopp": 0,
  "datum": "YYYY-MM-DD eller null",
  "fakturanummer": "fakturans eget nummer eller null",
  "beskrivning": "Kort beskrivning av vad som köpts in (1 mening)",
  "kategori": "material|verktyg|konsumtion|transport|ovrigt",
  "artikel_forslag": "Förslag på kostnadsartikel, t.ex. Material, Verktyg, Transport eller null"
}`
        }
      ]
    }]
  })

  const text = (msg.content[0] as any).text as string
  const json = text.match(/\{[\s\S]*\}/)?.[0]
  if (!json) return NextResponse.json({ error: 'Kunde inte läsa fakturan' }, { status: 422 })

  try {
    const data = JSON.parse(json)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Ogiltigt svar från AI' }, { status: 422 })
  }
}
