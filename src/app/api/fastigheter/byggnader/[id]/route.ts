// Källa: src/app/api/byggnader/[id]/route.ts. Prisma → Supabase.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseByggnadBody } from '@/lib/fastigheter/parsers'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const body = await request.json()
    const { data, error } = await sb
      .from('f_byggnad')
      .update(parseByggnadBody(body))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    console.error('PUT byggnad error:', e)
    return NextResponse.json({ error: 'Kunde inte uppdatera', detail: String(e) }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const { error } = await sb.from('f_byggnad').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}
