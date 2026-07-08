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

    // Blockera borttagning om omgången har fakturerade hyresgäster: cascade skulle
    // radera debiteringarna men lämna de skapade el-fakturorna kvar utan backning
    // (orphaned — samma symptom som migration 037 fick städa). Kreditera/ta bort
    // fakturorna först.
    const { count, error: checkErr } = await sb
      .from('f_eldebitering')
      .select('id', { count: 'exact', head: true })
      .eq('omgang_id', id)
      .not('faktura_id', 'is', null)
    if (checkErr) throw checkErr
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `Omgången har ${count} fakturerad${count === 1 ? '' : 'a'} hyresgäst${count === 1 ? '' : 'er'}. Kreditera eller ta bort de el-fakturorna först innan omgången kan tas bort.` },
        { status: 409 },
      )
    }

    const { error } = await sb.from('f_el_debiteringsomgang').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}

export const DELETE = withLogg('api/fastigheter/el-omgang/[id]', deleteHandler)
