// Källa: src/app/api/fakturor/[id]/route.ts (Prisma) → Supabase server-klient.
//
// Mönster:
//  * Prisma-modell Faktura → tabell f_faktura (snake_case-kolumner).
//  * prisma.faktura.update({ where:{id}, data:{status} }) → sb.from('f_faktura').update(...).eq('id', id).
//  * prisma.faktura.delete({ where:{id} }) → sb.from('f_faktura').delete().eq('id', id).
//    - f_fakturarad har FK "on delete cascade" i SCHEMA.sql, så fakturarader tas bort automatiskt.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const sb = await createClient()

    const status = body.status as string
    const { data, error } = await sb
      .from('f_faktura')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Logga statushändelse i fakturans tidslinje (skickad/betald).
    if (status === 'skickad' || status === 'betald') {
      await sb.from('f_faktura_handelse').insert({ faktura_id: id, typ: status })
    }

    return NextResponse.json(data)
  } catch (e) {
    console.error('faktura update error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()

    // Skickade/betalda fakturor är utfärdade dokument → får inte raderas, krediteras istället.
    const { data: fakt } = await sb.from('f_faktura').select('status').eq('id', id).maybeSingle()
    if (!fakt) return NextResponse.json({ error: 'Faktura hittades inte' }, { status: 404 })
    if (fakt.status !== 'ej_skickad') {
      return NextResponse.json({ error: 'Endast utkast kan tas bort. Skickade fakturor krediteras istället.' }, { status: 409 })
    }

    // Återställ ev. el-debiteringar som fakturerades av denna faktura → kan faktureras igen.
    await sb.from('f_eldebitering')
      .update({ status: 'ej_fakturerad', faktura_id: null, fakturerad_datum: null })
      .eq('faktura_id', id)

    const { error } = await sb.from('f_faktura').delete().eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('faktura delete error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
