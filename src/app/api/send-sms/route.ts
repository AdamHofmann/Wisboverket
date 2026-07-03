import { NextRequest, NextResponse } from 'next/server'
import { normalizeSwedishPhone } from '@/lib/format'

export async function POST(req: NextRequest) {
  const { to, message, from } = await req.json()
  const u = (process.env.ELKS_USERNAME || '').trim()
  const p = (process.env.ELKS_PASSWORD || '').trim()
  if (!u || !p) return NextResponse.json({ error: 'ELKS_USERNAME/ELKS_PASSWORD saknas i miljövariabler' }, { status: 500 })
  if (!to || !message) return NextResponse.json({ error: 'Saknar parametrar (to, message)' }, { status: 400 })

  const body = new URLSearchParams({ from: from || 'Wisboverket', to: normalizeSwedishPhone(to), message })

  try {
    const res = await fetch('https://api.46elks.com/a1/sms', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(u + ':' + p).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    const text = await res.text()
    if (!res.ok) return NextResponse.json({ error: `46elks HTTP ${res.status}: ${text.slice(0, 300)}` }, { status: 502 })

    return NextResponse.json(JSON.parse(text))
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '46elks svarade oväntat' }, { status: 502 })
  }
}
