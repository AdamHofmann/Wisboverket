// Källa: src/app/api/byggnader/route.ts. Prisma → Supabase.
// Använder porterad parseByggnadBody (snake_case-utdata) från @/lib/fastigheter/parsers.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseByggnadBody } from '@/lib/fastigheter/parsers'

export async function GET(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const fastighetId = searchParams.get('fastighetId')
    let query = sb.from('f_byggnad').select('*').order('namn', { ascending: true })
    if (fastighetId) query = query.eq('fastighet_id', fastighetId)
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()
    const insert = {
      fastighet_id: (body.fastighetId || body.fastighet_id) as string,
      ...parseByggnadBody(body),
    }
    const { data, error } = await sb.from('f_byggnad').insert(insert).select().single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Kunde inte skapa byggnad' }, { status: 500 })
  }
}
