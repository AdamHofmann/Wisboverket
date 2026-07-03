// Migrerad route. Källa: src/app/api/el-leverantor/route.ts (Prisma) → Supabase server-klient.
//
// Prisma-modell ElLeverantorsfaktura → tabell f_el_leverantorsfaktura.
// Relation debiteringar (ElDebitering) → f_eldebitering (FK leverantor_id).
// camelCase-body (fastighetId/periodFran/totalKwh…) → snake_case-kolumner.
//
// include: { fastighet: { id, namn }, debiteringar: true, _count: { debiteringar } }
//  → PostgREST nested select. _count görs via count-modifier på nästlad relation
//    (f_eldebitering(*, count)) och normaliseras till { _count: { debiteringar } }
//    för att behålla käll-UI:ts form.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()
    const { data, error } = await sb
      .from('f_el_leverantorsfaktura')
      .select(`
        *,
        fastighet:f_fastighet ( id, namn ),
        debiteringar:f_eldebitering (*)
      `)
      .order('period_fran', { ascending: false })
    if (error) throw error

    // _count: { debiteringar } → härled i JS (PostgREST-count-modifier krockar med *).
    const rows = (data ?? []).map((f: Record<string, unknown>) => ({
      ...f,
      _count: {
        debiteringar: Array.isArray(f.debiteringar) ? f.debiteringar.length : 0,
      },
    }))
    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET el-leverantor:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    const totalKwhRaw = body.totalKwh ?? body.total_kwh
    const totalKwh = totalKwhRaw ? parseFloat(totalKwhRaw) : null
    const totalBelopp = parseFloat(body.totalBelopp ?? body.total_belopp)
    const prisPerKwh =
      totalKwh && totalKwh > 0
        ? Math.round((totalBelopp / totalKwh) * 10000) / 10000
        : null

    const { data: faktura, error } = await sb
      .from('f_el_leverantorsfaktura')
      .insert({
        fastighet_id: body.fastighetId ?? body.fastighet_id,
        period_fran: new Date(body.periodFran ?? body.period_fran).toISOString(),
        period_till: new Date(body.periodTill ?? body.period_till).toISOString(),
        total_kwh: totalKwh,
        total_belopp: totalBelopp,
        pris_per_kwh: prisPerKwh,
        fakturanummer: body.fakturanummer || null,
      })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json(faktura, { status: 201 })
  } catch (e) {
    console.error('POST el-leverantor:', e)
    return NextResponse.json({ error: 'Kunde inte skapa' }, { status: 500 })
  }
}
