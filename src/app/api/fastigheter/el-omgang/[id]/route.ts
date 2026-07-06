// DELETE — ta bort en el-debiteringsomgång.
// Cascade (on delete cascade i migration 026) tar bort junction-raderna i
// f_el_omgang_faktura och debiteringarna i f_eldebitering (omgang_id FK).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withLogg } from '@/lib/withLogg'

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const { error } = await sb.from('f_el_debiteringsomgang').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}

export const DELETE = withLogg('api/fastigheter/el-omgang/[id]', deleteHandler)
