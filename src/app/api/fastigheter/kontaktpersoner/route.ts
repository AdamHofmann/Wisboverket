// Källa: src/app/api/kontaktpersoner/route.ts (Prisma) → Supabase server-klient.
// Prisma-modell Kontaktperson → tabell f_kontaktperson (snake_case-kolumner).
// hyresgastId → hyresgast_id. Enkel CRUD (GET/POST/DELETE), inga externa sidoeffekter.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const hyresgastId = searchParams.get('hyresgastId')
    if (!hyresgastId) return NextResponse.json({ error: 'hyresgastId krävs' }, { status: 400 })

    const { data, error } = await sb
      .from('f_kontaktperson')
      .select('*')
      .eq('hyresgast_id', hyresgastId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('kontaktpersoner GET error:', e)
    return NextResponse.json({ error: 'Kunde inte hämta kontaktpersoner' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()
    const { data, error } = await sb
      .from('f_kontaktperson')
      .insert({
        hyresgast_id: (body.hyresgastId as string) || (body.hyresgast_id as string),
        namn: body.namn,
        roll: body.roll || null,
        telefon: body.telefon || null,
        epost: body.epost || null,
        anteckning: body.anteckning || null,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('kontaktpersoner POST error:', e)
    return NextResponse.json({ error: 'Kunde inte skapa' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 })

    const { error } = await sb.from('f_kontaktperson').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('kontaktpersoner DELETE error:', e)
    return NextResponse.json({ error: 'Kunde inte radera' }, { status: 500 })
  }
}
