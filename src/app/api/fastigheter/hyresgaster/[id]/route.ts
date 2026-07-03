// Källa: src/app/api/hyresgaster/[id]/route.ts (Prisma) → Supabase server-klient.
// Modell Hyresgast → tabell f_hyresgast. Kolumnerna är redan snake_case-kompatibla
// (namn, personnummer, epost, fakturamail, telefon, adress, samfakturering, fakturaleverans).
//
// PUT: Prisma-mönstret sätter fält till `undefined` när de saknas i body (= rör inte).
//   För Supabase bygger vi ett partiellt update-objekt och tar bara med de fält som
//   faktiskt finns i body, så oskickade fält lämnas orörda.
// DELETE: f_hyresavtal.hyresgast_id är ON DELETE RESTRICT (som källans obligatoriska
//   relation) → delete failar om hyresgästen har avtal, fångas av catch → 500 (samma
//   beteende som Prisma-källan).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const body = await request.json()

    // Bygg partiellt update-objekt (endast fält som finns i body → matchar Prisma undefined-mönstret)
    const update: Record<string, unknown> = {}
    if (body.namn !== undefined) update.namn = body.namn
    if (body.personnummer !== undefined) update.personnummer = body.personnummer || null
    if (body.epost !== undefined) update.epost = body.epost || null
    if (body.fakturamail !== undefined) update.fakturamail = body.fakturamail || null
    if (body.telefon !== undefined) update.telefon = body.telefon || null
    if (body.adress !== undefined) update.adress = body.adress || null
    if (body.samfakturering !== undefined) update.samfakturering = Boolean(body.samfakturering)
    if (body.fakturaleverans !== undefined) update.fakturaleverans = body.fakturaleverans

    const { data, error } = await sb
      .from('f_hyresgast')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const { error } = await sb.from('f_hyresgast').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
