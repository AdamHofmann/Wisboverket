// Migrerad: src/app/api/hyresgaster/route.ts (Prisma) → Supabase server-klient.
// Modell Hyresgast → f_hyresgast. Kontaktperson → f_kontaktperson.
//
// Mönster:
//  * GET: include hyresavtal -> lokaler (junction f_hyresavtal_lokal) -> lokal -> fastighet,
//    kontaktpersoner (orderBy createdAt), _count.hyresavtal.
//    - Nästlad relation aliaseras för att matcha käll-UI:ts nycklar
//      (hyresavtal / lokaler / lokal / fastighet / kontaktpersoner).
//    - Junction n-n: f_hyresavtal.lokaler:f_hyresavtal_lokal( lokal:f_lokal( fastighet:f_fastighet ) ).
//    - _count via separat aggregat-hämtning + JS-mappning (PostgREST kan inte
//      returnera Prismas _count-form direkt) → efterbearbetas till { _count: { hyresavtal } }.
//  * POST: enkel create, camelCase/snake_case tolererad i body.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()

    const { data, error } = await sb
      .from('f_hyresgast')
      .select(`
        *,
        hyresavtal:f_hyresavtal (
          *,
          lokaler:f_hyresavtal_lokal (
            *,
            lokal:f_lokal (
              *,
              fastighet:f_fastighet (*)
            )
          )
        ),
        kontaktpersoner:f_kontaktperson (*)
      `)
      .order('namn', { ascending: true })
      .order('created_at', { ascending: true, foreignTable: 'f_kontaktperson' })

    if (error) throw error

    // _count.hyresavtal — Prismas _count-form finns inte i PostgREST-svaret.
    // Bygg den av redan hämtade hyresavtal-arrayen (samma resultat, ingen extra query).
    const withCount = (data ?? []).map((hg: Record<string, unknown>) => ({
      ...hg,
      _count: { hyresavtal: Array.isArray(hg.hyresavtal) ? hg.hyresavtal.length : 0 },
    }))

    return NextResponse.json(withCount)
  } catch (e) {
    console.error('GET /api/fastigheter/hyresgaster error:', e)
    return NextResponse.json({ error: 'Serverfel', detail: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    const { data: hyresgast, error } = await sb
      .from('f_hyresgast')
      .insert({
        namn: body.namn,
        personnummer: body.personnummer || null,
        epost: body.epost || null,
        fakturamail: body.fakturamail || null,
        telefon: body.telefon || null,
        adress: body.adress || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(hyresgast, { status: 201 })
  } catch (e) {
    console.error('POST /api/fastigheter/hyresgaster error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
