// Källa: src/app/api/bolag/route.ts (Prisma) → Supabase server-klient.
// Fil-karta (PLAN.md): /api/bolag → /api/fastigheter/bolag (namespacat).
//
// Mönster:
//  * Prisma-modell Bolag → tabell f_bolag (snake_case-kolumner).
//  * camelCase-fält (fakturaPrefixText) → snake_case (faktura_prefix_text).
//  * include:{ _count:{ select:{ fastigheter:true } } } → PostgREST kan inte
//    ordna på aggregat, så vi hämtar bolagen ordnade på namn och räknar
//    fastigheter per bolag i en separat gruppering (jfr BolagContext bolag-count).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()

    const { data: bolag, error } = await sb
      .from('f_bolag')
      .select('*')
      .order('namn', { ascending: true })
    if (error) throw error

    // _count.fastigheter → separat query + JS-gruppering per bolag_id.
    const { data: fastigheter, error: countError } = await sb
      .from('f_fastighet')
      .select('bolag_id')
    if (countError) throw countError

    const counts = new Map<string, number>()
    for (const f of fastigheter ?? []) {
      const bid = (f as { bolag_id: string | null }).bolag_id
      if (bid) counts.set(bid, (counts.get(bid) ?? 0) + 1)
    }

    // Behåll käll-UI:ts form: { ..., _count: { fastigheter: number } }
    const result = (bolag ?? []).map((b) => ({
      ...b,
      _count: { fastigheter: counts.get(b.id) ?? 0 },
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error('bolag error:', e)
    return NextResponse.json({ error: 'Kunde inte hämta bolag' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    const { data: b, error } = await sb
      .from('f_bolag')
      .insert({
        namn: body.namn,
        orgnummer: body.orgnummer || null,
        adress: body.adress || null,
        postnummer: body.postnummer || null,
        stad: body.stad || null,
        epost: body.epost || null,
        telefon: body.telefon || null,
        bankgiro: body.bankgiro || null,
        plusgiro: body.plusgiro || null,
        momsregistreringsnummer: body.momsregistreringsnummer || null,
        hemsida: body.hemsida || null,
        // camelCase → snake_case (UI kan skicka endera)
        faktura_prefix_text: body.fakturaPrefixText || body.faktura_prefix_text || null,
        betalningsvillkor: body.betalningsvillkor ? Number(body.betalningsvillkor) : null,
        drojsmalsranta: body.drojsmalsranta ? Number(body.drojsmalsranta) : null,
      })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json(b, { status: 201 })
  } catch (e) {
    console.error('skapa bolag error:', e)
    return NextResponse.json({ error: 'Kunde inte skapa bolag' }, { status: 500 })
  }
}
