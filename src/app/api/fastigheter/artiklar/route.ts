// Artikelregister: central katalog över fakturaartiklar (f_artikel). Håller
// fakturatext, moms och (framöver) Hogia-konton konsekventa. Fakturarader lagrar
// fortsatt artikelkod som fritext utan FK — registret styr bara nya rader.
//
// GET  /api/fastigheter/artiklar          → alla artiklar (aktiva först, sedan på kod)
// POST /api/fastigheter/artiklar  body: { kod, benamning, apris, moms, konto, momskod }
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()
    // Aktiva först, därefter alfabetiskt på kod.
    const { data, error } = await sb
      .from('f_artikel')
      .select('*')
      .order('aktiv', { ascending: false })
      .order('kod', { ascending: true })
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('artiklar list error:', e)
    const msg = e instanceof Error ? e.message : 'Serverfel'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    const kod: string = (body.kod ?? '').trim().toUpperCase()
    const benamning: string = (body.benamning ?? '').trim()
    if (!kod || !benamning) return NextResponse.json({ error: 'Kod och benämning krävs' }, { status: 400 })

    const apris = body.apris === '' || body.apris == null ? null : Number(body.apris)
    const moms = body.moms == null || body.moms === '' ? 25 : Number(body.moms)

    const { data, error } = await sb
      .from('f_artikel')
      .insert({
        kod,
        benamning,
        apris,
        moms,
        konto: body.konto?.trim() || null,
        momskod: body.momskod?.trim() || null,
      })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('artikel create error:', e)
    const msg = e instanceof Error ? e.message : 'Serverfel'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
