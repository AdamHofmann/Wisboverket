// Migrerad från: src/app/api/el-leverantor/skanna/route.ts (käll-appen).
// Ren AI-route (Anthropic vision) — INGEN databasåtkomst, alltså ingen Prisma→Supabase-port.
//
// Ändringar mot källan:
//  * Modell-id 'claude-sonnet-4-6' → 'claude-opus-4-8' (matchar mål-appens scan-faktura, PLAN.md §skanna).
//  * Behåller @anthropic-ai/sdk + ANTHROPIC_API_KEY (finns i package.json / .env.local).
//  * Behåller multipart-formdata-inläsning, base64, media-type-hantering (image/*, application/pdf),
//    JSON-extraktion och samma statuskoder (400 ingen fil, 422 kunde ej tolka, 500 serverfel/nyckel saknas).
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY saknas i .env.local' }, { status: 500 })
    }

    const formData = await request.formData()
    const fil = formData.get('fil') as File | null
    if (!fil) return NextResponse.json({ error: 'Ingen fil' }, { status: 400 })

    const bytes = await fil.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = fil.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf'

    const promptText = `Läs av denna elleverantörsfaktura och returnera JSON med följande fält (använd null om värdet saknas):
{
  "fakturanummer": "string",
  "periodFran": "YYYY-MM-DD",
  "periodTill": "YYYY-MM-DD",
  "totalKwh": number,
  "totalBelopp": number,
  "prisPerKwh": number,
  "leverantor": "string"
}
Returnera BARA JSON, inget annat.`

    const isPdf = mediaType === 'application/pdf'
    const contentBlock = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } }

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [contentBlock, { type: 'text', text: promptText }],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Kunde inte tolka fakturan' }, { status: 422 })

    const data = JSON.parse(jsonMatch[0])
    return NextResponse.json(data)
  } catch (e) {
    console.error('skanna error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
