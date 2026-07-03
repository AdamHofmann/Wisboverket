// Källa: src/app/api/indexhojningar/[id]/route.ts (Prisma) → Supabase server-klient.
//
// POST /api/fastigheter/indexhojningar/[id] — applicera en manuell %-höjning på ETT avtal.
// Mönster:
//  * Prisma-modell Hyresavtal → f_hyresavtal, Indexhojning → f_indexhojning.
//  * camelCase-body (procent, skapadAv) läses i både camel/snake.
//  * findUnique → .select().eq('id').maybeSingle(); create → .insert().select().single();
//    update → .update().eq('id').
//  * bashyra är numeric(14,2) → kommer som number.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/fastigheter/indexhojningar/[id] — apply a manual % increase to a single avtal
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const procent = body.procent as number
    const skapadAv = (body.skapadAv as string) || (body.skapad_av as string)

    const sb = await createClient()

    const { data: avtal, error: avtalError } = await sb
      .from('f_hyresavtal')
      .select('id, bashyra')
      .eq('id', id)
      .maybeSingle()
    if (avtalError) throw avtalError
    if (!avtal) return NextResponse.json({ error: 'Avtal ej hittat' }, { status: 404 })

    const bashyraNy = Math.round(avtal.bashyra * (1 + procent / 100) * 100) / 100

    const { data: hojning, error: insertError } = await sb
      .from('f_indexhojning')
      .insert({
        hyresavtal_id: id,
        datum: new Date().toISOString(),
        kpi_gammal: 0,
        kpi_ny: 0,
        procent,
        bashyra_gammal: avtal.bashyra,
        bashyra_ny: bashyraNy,
        skapad_av: skapadAv || 'Manuell',
      })
      .select()
      .single()
    if (insertError) throw insertError

    const { error: updateError } = await sb
      .from('f_hyresavtal')
      .update({ bashyra: bashyraNy })
      .eq('id', id)
    if (updateError) throw updateError

    // NOTE: Källan gör insert + update i två steg utan transaktion. Om atomicitet
    // önskas bör detta flyttas till en Postgres-RPC (jfr batch-höjningar i PLAN.md §2).
    return NextResponse.json(hojning, { status: 201 })
  } catch (e) {
    console.error('indexhojning error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
