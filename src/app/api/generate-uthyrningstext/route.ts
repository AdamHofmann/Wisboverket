import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type Objekt = {
  titel?: string
  fastighet?: string
  typer?: string[]
  total_yta?: number
  hyra?: number
  kr_kvm_ar?: number
  planlosning?: string
  bekvamligheter?: string[]
  tillganglig_typ?: string
  tillganglig_fran?: string
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const mode = body?.mode as 'kort' | 'lang' | undefined
  const objekt = body?.objekt as Objekt | undefined

  if (!mode || !['kort', 'lang'].includes(mode) || !objekt) {
    return NextResponse.json({ error: 'mode (kort|lang) och objekt krävs' }, { status: 400 })
  }

  const fakta = `
Titel/annonsnamn: ${objekt.titel || '(ej angiven)'}
Adress: ${objekt.fastighet || '(ej angiven)'}
Typ av objekt: ${(objekt.typer || []).join(', ') || '(ej angiven)'}
Total yta: ${objekt.total_yta ? objekt.total_yta + ' kvm' : '(ej angiven)'}
Hyra: ${objekt.hyra ? objekt.hyra + ' kr/månad' : '(ej angiven)'}
Kr/kvm/år: ${objekt.kr_kvm_ar ? objekt.kr_kvm_ar + ' kr/kvm/år' : '(ej angiven)'}
Planlösning: ${objekt.planlosning || '(ej angiven)'}
Bekvämligheter: ${(objekt.bekvamligheter || []).join(', ') || '(inga angivna)'}
Tillgänglighet: ${objekt.tillganglig_typ === 'datum' && objekt.tillganglig_fran ? `från ${objekt.tillganglig_fran}` : 'enligt överenskommelse'}
`.trim()

  const prompt = mode === 'kort'
    ? `Skriv en kort, säljande beskrivning (MAX 150 tecken) på svenska för denna uthyrningsannons, baserat på fakta nedan. Ingen rubrik, bara löptext. Svara ENDAST med texten, inget annat.

${fakta}`
    : `Skriv en lång, säljande beskrivningstext (200-400 ord) på svenska för denna uthyrningsannons, baserat på fakta nedan. Använd ett professionellt men lockande tonläge riktat mot företag/hyresgäster. Ingen rubrik, bara löptext i naturliga stycken. Hitta inte på fakta som inte finns nedan. Svara ENDAST med texten, inget annat.

${fakta}`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = msg.content[0]
    const text = block && block.type === 'text' ? block.text.trim() : ''
    if (!text) return NextResponse.json({ error: 'Kunde inte generera text' }, { status: 422 })

    return NextResponse.json({ text })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Okänt fel' }, { status: 500 })
  }
}
