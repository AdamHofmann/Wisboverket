// Fritextrader på en BEFINTLIG faktura.
//
// Använder samma mönster som src/app/api/fastigheter/fakturor/[id]/route.ts:
//  * f_fakturarad har faktura_id (FK, on delete cascade i SCHEMA.sql).
//  * En fritextrad = artikelkod 'TEXT', antal/apris/belopp/moms = 0 (visas som textrad
//    i print-routen och app-vyerna där artikelkod === 'TEXT'). Rör inte belopps-raderna
//    eller fakturans summa — fritext påverkar inte f_faktura.belopp.
//
// POST   /api/fastigheter/fakturor/[id]/rader   body: { beskrivning }  → lägger till fritextrad
// DELETE /api/fastigheter/fakturor/[id]/rader?radId=...                → tar bort en fritextrad
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const sb = await createClient()

    const beskrivning = typeof body.beskrivning === 'string' ? body.beskrivning.trim() : ''
    if (!beskrivning) return NextResponse.json({ error: 'Text krävs' }, { status: 400 })

    const { data, error } = await sb
      .from('f_fakturarad')
      .insert({ faktura_id: id, artikelkod: 'TEXT', beskrivning, antal: 0, apris: 0, belopp: 0, moms: 0 })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('fakturarad fritext skapa error:', e)
    const msg = e instanceof Error ? e.message : 'Serverfel'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const radId = new URL(request.url).searchParams.get('radId')
    const sb = await createClient()

    if (!radId) return NextResponse.json({ error: 'radId krävs' }, { status: 400 })

    // Säkra att vi bara tar bort fritextrader (artikelkod 'TEXT') på RÄTT faktura —
    // belopps-rader (HYR/MAN/IDX/ORE ...) och summan lämnas orörda.
    const { error } = await sb
      .from('f_fakturarad')
      .delete()
      .eq('id', radId)
      .eq('faktura_id', id)
      .eq('artikelkod', 'TEXT')

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('fakturarad fritext ta bort error:', e)
    const msg = e instanceof Error ? e.message : 'Serverfel'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
