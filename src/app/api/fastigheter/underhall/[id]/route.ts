// Migrerad från källan src/app/api/underhall/[id]/route.ts (Prisma → Supabase).
// Tabeller: f_underhallsarende, f_underhallslogg, f_underhallsdokument (SCHEMA.sql).
// Prisma include (fastighet/logg/dokument) → nested select med alias fastighet/logg/dokument.
// UI skickar camelCase i body → läs både camel/snake, skriv snake_case till Supabase.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const { data, error } = await sb
      .from('f_underhallsarende')
      .select(
        `*, ` +
          `fastighet:f_fastighet(id, namn), ` +
          `logg:f_underhallslogg(*), ` +
          `dokument:f_underhallsdokument(*)`
      )
      // orderBy på nästlade relationer (Prisma: logg desc datum, dokument desc created_at)
      .order('datum', { ascending: false, foreignTable: 'f_underhallslogg' })
      .order('created_at', { ascending: false, foreignTable: 'f_underhallsdokument' })
      .eq('id', id)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.namn !== undefined) data.namn = body.namn
    if (body.beskrivning !== undefined) data.beskrivning = body.beskrivning || null
    const intervall = body.intervallManader ?? body.intervall_manader
    if (intervall !== undefined) data.intervall_manader = parseInt(intervall)
    const nastaGang = body.nastaGang ?? body.nasta_gang
    if (nastaGang !== undefined) data.nasta_gang = new Date(nastaGang).toISOString()
    const senastUtford = body.senastUtford ?? body.senast_utford
    if (senastUtford !== undefined)
      data.senast_utford = senastUtford ? new Date(senastUtford).toISOString() : null
    if (body.status !== undefined) data.status = body.status
    if (body.ansvarig !== undefined) data.ansvarig = body.ansvarig || null
    if (body.leverantor !== undefined) data.leverantor = body.leverantor || null
    if (body.kostnad !== undefined) data.kostnad = body.kostnad ? parseFloat(body.kostnad) : null
    if (body.kommentar !== undefined) data.kommentar = body.kommentar || null

    const { data: arende, error } = await sb
      .from('f_underhallsarende')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(arende)
  } catch {
    return NextResponse.json({ error: 'Kunde inte uppdatera' }, { status: 500 })
  }
}

// POST /api/fastigheter/underhall/[id] — Markera som utförd + skapa loggpost + beräkna nästa datum
// OBS: multi-step (create logg + update arende). Källan var ej transaktionell heller,
// så porten kör två sekventiella queries. Vid behov av atomicitet → RPC (se PLAN.md §2).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const body = await request.json()

    const { data: arende, error: findErr } = await sb
      .from('f_underhallsarende')
      .select('*')
      .eq('id', id)
      .single()
    if (findErr || !arende) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })

    const datum = body.datum ? new Date(body.datum) : new Date()

    // Skapa loggpost
    const { error: loggErr } = await sb.from('f_underhallslogg').insert({
      arende_id: id,
      datum: datum.toISOString(),
      utford_av: body.utfordAv || body.utford_av || 'Ej angivet',
      kommentar: body.kommentar || null,
      kostnad: body.kostnad ? parseFloat(body.kostnad) : null,
    })
    if (loggErr) throw loggErr

    // Beräkna nästa datum
    const nasta = new Date(datum)
    nasta.setMonth(nasta.getMonth() + arende.intervall_manader)

    // Uppdatera ärende
    const { data: updated, error: updErr } = await sb
      .from('f_underhallsarende')
      .update({
        senast_utford: datum.toISOString(),
        nasta_gang: nasta.toISOString(),
        status: 'planerad',
        kostnad: body.kostnad ? parseFloat(body.kostnad) : arende.kostnad,
      })
      .eq('id', id)
      .select()
      .single()
    if (updErr) throw updErr

    return NextResponse.json(updated)
  } catch (e) {
    console.error('POST utförd error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    // onDelete cascade (logg/dokument) hanteras av FK i SCHEMA.sql → raderar bara parent.
    const { error } = await sb.from('f_underhallsarende').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}
