import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { withLogg } from '@/lib/withLogg'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function postHandler(req: Request) {
  const body = await req.json().catch(() => null)
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''

  if (!prompt) return NextResponse.json({ error: 'prompt krävs' }, { status: 400 })

  const system = `Du skriver korta, professionella kundmeddelanden på svenska för hantverks-/förvaltningsföretaget Hofmanns AB (Wisboverket). Tonen är vänlig, tydlig och saklig. Hitta inte på fakta som inte finns i uppdraget. Ingen rubrik, ingen platshållartext som "[Namn]". Svara ENDAST med själva meddelandetexten, inget annat.`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = msg.content[0]
    const text = block && block.type === 'text' ? block.text.trim() : ''
    if (!text) return NextResponse.json({ error: 'Kunde inte generera meddelande' }, { status: 422 })

    return NextResponse.json({ text })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Okänt fel' }, { status: 500 })
  }
}

export const POST = withLogg('api/ai-meddelande', postHandler)
