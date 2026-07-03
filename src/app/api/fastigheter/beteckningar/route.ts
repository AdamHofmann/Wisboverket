// Källa: src/app/api/beteckningar/route.ts. Prisma → Supabase.
// DELETE tar id som searchParam (?id=...), som i källan.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()
    const { data, error } = await sb
      .from('f_fastighetsbeteckning')
      .insert({
        fastighet_id: body.fastighetId || body.fastighet_id,
        beteckning: body.beteckning,
        taxeringsvarde: body.taxeringsvarde ? parseFloat(body.taxeringsvarde) : null,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Kunde inte skapa' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 })
    const { error } = await sb.from('f_fastighetsbeteckning').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}
