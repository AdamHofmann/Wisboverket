// Kreditera en hyresfaktura → skapar en kreditnota.
//
// POST /api/fastigheter/fakturor/[id]/kreditera →
//   * ny f_faktura: typ='kreditnota', fakturanummer = original + '-K',
//     hyresavtal_id/period/forfallodag från originalet, belopp = -original.belopp,
//     status='ej_skickad', original_faktura_id = originalets id.
//   * f_fakturarad-rader: negerade kopior av originalets rader (belopp/apris negativa,
//     beskrivning + ' (kreditering)').
//   * originalfakturan sätts till status='krediterad'.
//   Returnerar kreditnotan. Fel → 500 { error }.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface FakturaradRow {
  artikelkod: string
  beskrivning: string
  antal: number
  apris: number
  belopp: number
  moms: number
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()

    // Hämta originalfakturan + dess rader.
    const { data: original, error: origErr } = await sb
      .from('f_faktura')
      .select('id, fakturanummer, hyresavtal_id, belopp, period, forfallodag, rader:f_fakturarad (*)')
      .eq('id', id)
      .single()
    if (origErr) throw origErr

    const originalRader = (original.rader ?? []) as unknown as FakturaradRow[]

    // 1) Skapa kreditnotan.
    const { data: kreditnota, error: kreditErr } = await sb
      .from('f_faktura')
      .insert({
        fakturanummer: `${original.fakturanummer}-K`,
        hyresavtal_id: original.hyresavtal_id,
        belopp: -original.belopp,
        period: original.period,
        forfallodag: original.forfallodag,
        status: 'ej_skickad',
        typ: 'kreditnota',
        original_faktura_id: original.id,
      })
      .select()
      .single()
    if (kreditErr) throw kreditErr

    // 2) Negerade kopior av originalets rader.
    if (originalRader.length > 0) {
      const kreditRader = originalRader.map((rad) => ({
        faktura_id: kreditnota.id as string,
        artikelkod: rad.artikelkod,
        beskrivning: `${rad.beskrivning} (kreditering)`,
        antal: rad.antal,
        apris: -rad.apris,
        belopp: -rad.belopp,
        moms: rad.moms,
      }))
      const { error: raderErr } = await sb.from('f_fakturarad').insert(kreditRader)
      if (raderErr) throw raderErr
    }

    // 3) Markera originalet som krediterat.
    const { error: statusErr } = await sb
      .from('f_faktura')
      .update({ status: 'krediterad' })
      .eq('id', original.id)
    if (statusErr) throw statusErr

    // 4) Logga krediteringen i originalets tidslinje.
    await sb.from('f_faktura_handelse').insert({
      faktura_id: original.id,
      typ: 'krediterad',
      meddelande: `Kreditnota ${kreditnota.fakturanummer}`,
    })

    return NextResponse.json(kreditnota)
  } catch (e) {
    console.error('faktura kreditera error:', e)
    return NextResponse.json({ error: 'Serverfel', detail: String(e) }, { status: 500 })
  }
}
