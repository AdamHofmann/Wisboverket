// Migrerad från källans src/app/api/elmatare/[id]/route.ts (Prisma → Supabase).
// Modeller: ElMatare → f_elmatare, ElAvlasning → f_elavlasning.
// Fält: matareId→matare_id, schablonKwh→schablon_kwh, lokalId→lokal_id, byggnadId→byggnad_id, avlastAv→avlast_av.
// include: { fastighet:{namn}, avlasningar:orderBy(datum desc) } → PostgREST nested select
//   med alias fastighet/avlasningar + .order('datum', foreignTable:'f_elavlasning').
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — hämta mätare med alla avläsningar
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const { data: matare, error } = await sb
      .from('f_elmatare')
      .select(`
        *,
        fastighet:f_fastighet ( namn ),
        avlasningar:f_elavlasning (*)
      `)
      .eq('id', id)
      .order('datum', { ascending: false, foreignTable: 'f_elavlasning' })
      .maybeSingle()
    if (error) throw error
    if (!matare) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })
    return NextResponse.json(matare)
  } catch (e) {
    console.error('GET elmatare error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

// POST — ny avläsning
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const sb = await createClient()
    const { data: avlasning, error } = await sb
      .from('f_elavlasning')
      .insert({
        matare_id: id,
        datum: body.datum ? new Date(body.datum).toISOString() : new Date().toISOString(),
        varde: parseFloat(body.varde),
        avlast_av: body.avlastAv || body.avlast_av || null,
        kommentar: body.kommentar || null,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(avlasning, { status: 201 })
  } catch (e) {
    console.error('POST avlasning error:', e)
    return NextResponse.json({ error: 'Kunde inte spara' }, { status: 500 })
  }
}

// PUT — uppdatera mätare
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.matarnummer !== undefined) data.matarnummer = body.matarnummer
    if (body.beskrivning !== undefined) data.beskrivning = body.beskrivning || null
    if (body.schablonKwh !== undefined || body.schablon_kwh !== undefined) {
      const raw = body.schablonKwh ?? body.schablon_kwh
      data.schablon_kwh = raw ? parseFloat(raw) : null
    }
    if (body.aktiv !== undefined) data.aktiv = Boolean(body.aktiv)
    if (body.lokalId !== undefined || body.lokal_id !== undefined) {
      data.lokal_id = (body.lokalId ?? body.lokal_id) || null
    }
    if (body.byggnadId !== undefined || body.byggnad_id !== undefined) {
      data.byggnad_id = (body.byggnadId ?? body.byggnad_id) || null
    }
    const sb = await createClient()
    const { data: matare, error } = await sb
      .from('f_elmatare')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(matare)
  } catch (e) {
    console.error('PUT elmatare error:', e)
    return NextResponse.json({ error: 'Kunde inte uppdatera' }, { status: 500 })
  }
}

// DELETE (f_elavlasning raderas via ON DELETE CASCADE i schemat)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const { error } = await sb.from('f_elmatare').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE elmatare error:', e)
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}
