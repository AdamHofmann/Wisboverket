// Migrerad från käll-appen: src/app/api/bolag/[id]/route.ts (Prisma) → Supabase server-klient.
// Modell Bolag → tabell f_bolag. Fält camelCase → snake_case enligt SCHEMA.sql
// (endast fakturaPrefixText → faktura_prefix_text avviker). Behåller PUT + DELETE.
// UI:t kan skicka camelCase i body → läs både camel och snake, skriv snake_case till Supabase.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const body = await request.json()

    const betalningsvillkor = body.betalningsvillkor
    const drojsmalsranta = body.drojsmalsranta
    const fakturaPrefixText = body.fakturaPrefixText ?? body.faktura_prefix_text

    const { data, error } = await sb
      .from('f_bolag')
      .update({
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
        faktura_prefix_text: fakturaPrefixText || null,
        mailsignatur: body.mailsignatur || null,
        betalningsvillkor: betalningsvillkor ? Number(betalningsvillkor) : null,
        drojsmalsranta: drojsmalsranta ? Number(drojsmalsranta) : null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    console.error('uppdatera bolag error:', e)
    return NextResponse.json({ error: 'Kunde inte uppdatera bolag' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const { error } = await sb.from('f_bolag').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('ta bort bolag error:', e)
    return NextResponse.json({ error: 'Kunde inte ta bort bolag' }, { status: 500 })
  }
}
