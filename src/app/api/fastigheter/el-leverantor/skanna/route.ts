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
import { withLogg } from '@/lib/withLogg'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function postHandler(request: Request) {
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

    const promptText = `Läs av denna elleverantörsfaktura och returnera JSON med följande fält (använd null om värdet saknas).

VIKTIGT 1 — bara EL: Fakturan kan vara en KOMBINERAD faktura med flera tjänster (el, vatten/avlopp/VA, återvinning/avfall/sophämtning, fjärrvärme/värme). totalBelopp och totalKwh ska ENBART avse EL-delen: elnät/elöverföring/nätavgift OCH/ELLER elhandel/elförbrukning/energipris (+ energiskatt på el). EXKLUDERA helt: vatten, avlopp, VA, återvinning, avfall, sophämtning, fjärrvärme, värme och alla andra icke-el-poster. Summera bara el-raderna.

VIKTIGT 2 — exkl moms: totalBelopp ska vara EXKLUSIVE moms (nettobeloppet före moms). Fakturor visar ofta både ett nettobelopp (exkl moms / "belopp före moms") och en totalsumma inkl moms (25% moms i Sverige) — ta ALLTID nettot exkl moms. Om ett el-belopp bara anges inkl moms, räkna om: belopp / 1.25.
{
  "fakturanummer": "string",
  "periodFran": "YYYY-MM-DD",
  "periodTill": "YYYY-MM-DD",
  "totalKwh": number,
  "totalBelopp": number,
  "prisPerKwh": number,
  "leverantor": "string, elleverantörens/nätbolagets namn (avsändaren)",
  "anlaggningsadress": "string, ANLÄGGNINGSADRESSEN / leveransadressen där elen förbrukas (den fysiska fastighetens gatuadress, INTE fakturamottagarens fakturaadress). Format: gata nr, postnr ort. null om saknas.",
  "typ": "string, klassa fakturan: 'nat' om den avser elnät/överföring/nätavgift/abonnemang (nätbolaget); 'handel' om den avser elhandel/spotpris/energipris/förbrukning (elhandelsbolaget); 'ovrigt' om varken passar. null om oklart."
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

export const POST = withLogg('api/fastigheter/el-leverantor/skanna', postHandler)
