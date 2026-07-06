// PUT    /api/fastigheter/artiklar/[id]   body: partiell → uppdatera artikel
// DELETE /api/fastigheter/artiklar/[id]   → mjuk borttagning (aktiv=false).
//   ?hard=1 → äkta radering. Fakturarader lagrar artikelkod som fritext utan FK,
//   så registret ska normalt inte hårdraderas (historik ska inte påverkas).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const sb = await createClient()

    // Bygg patch endast av fält som skickats (partiell uppdatering).
    const patch: Record<string, unknown> = {}
    if (body.kod !== undefined) patch.kod = (body.kod ?? '').trim().toUpperCase()
    if (body.benamning !== undefined) patch.benamning = (body.benamning ?? '').trim()
    if (body.apris !== undefined) patch.apris = body.apris === '' || body.apris == null ? null : Number(body.apris)
    if (body.moms !== undefined) patch.moms = body.moms === '' || body.moms == null ? 25 : Number(body.moms)
    if (body.konto !== undefined) patch.konto = body.konto?.trim() || null
    if (body.momskod !== undefined) patch.momskod = body.momskod?.trim() || null
    if (body.aktiv !== undefined) patch.aktiv = !!body.aktiv

    const { data, error } = await sb
      .from('f_artikel')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    return NextResponse.json(data)
  } catch (e) {
    console.error('artikel update error:', e)
    const msg = e instanceof Error ? e.message : 'Serverfel'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const hard = new URL(request.url).searchParams.get('hard') === '1'

    if (hard) {
      const { error } = await sb.from('f_artikel').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    // Mjuk borttagning: avaktivera istället för att radera.
    const { data, error } = await sb
      .from('f_artikel')
      .update({ aktiv: false })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    console.error('artikel delete error:', e)
    const msg = e instanceof Error ? e.message : 'Serverfel'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
