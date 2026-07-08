// DELETE — ta bort EN hyresgästs debitering(ar) ur en el-omgång, så att
// ej fakturerade hyresgäster inte blir kvar och "skvalpar" när andra i samma
// omgång redan fakturerats. Blockeras om hyresgästen har en fakturerad
// debitering (skulle annars orphana den skapade el-fakturan — jfr migration 037).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withLogg } from '@/lib/withLogg'

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const { hyresgastNamn } = await request.json().catch(() => ({}))
    if (!hyresgastNamn) return NextResponse.json({ error: 'hyresgastNamn krävs' }, { status: 400 })

    const { count, error: checkErr } = await sb
      .from('f_eldebitering')
      .select('id', { count: 'exact', head: true })
      .eq('omgang_id', id)
      .eq('hyresgast_namn', hyresgastNamn)
      .not('faktura_id', 'is', null)
    if (checkErr) throw checkErr
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `${hyresgastNamn} har en fakturerad debitering. Kreditera eller ta bort el-fakturan först.` },
        { status: 409 },
      )
    }

    const { error } = await sb
      .from('f_eldebitering')
      .delete()
      .eq('omgang_id', id)
      .eq('hyresgast_namn', hyresgastNamn)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Kunde inte ta bort hyresgästen' }, { status: 500 })
  }
}

export const DELETE = withLogg('api/fastigheter/el-omgang/[id]/debitering', deleteHandler)
