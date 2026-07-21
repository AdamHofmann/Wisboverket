// Källa: src/app/api/hyresavtal/route.ts (Prisma) → Supabase server-klient.
//
// Migrationsmönster som används här:
//  * Prisma-modell Hyresavtal → tabell f_hyresavtal (snake_case-kolumner).
//  * camelCase-body → snake_case till Supabase (läs båda i parsern).
//  * Djup include via junction:
//      lokaler.lokal.fastighet.{byggnader,bolag,beteckningar} + hyresgast + indexhojningar
//    → PostgREST nested select. Junction-nyckeln aliaseras "lokaler" (käll-UI:t),
//      barnet "lokal", och fastighetens barn "byggnader"/"bolag"/"beteckningar".
//  * orderBy createdAt desc → .order('created_at', { ascending:false }).
//  * orderBy på nästlad indexhojningar (datum desc) → .order(..., { foreignTable: 'f_indexhojning' }).
//  * updateMany (auto-avsluta uppsagda) → .update(...).eq(...).lte(...).
//  * count(startsWith year) → .ilike('avtalsnummer', `${year}-%`) med head-count.
//  * nested create (lokaler) → separat insert i junction efter parent.
//  * updateMany (lokal-status → 'uthyrd') → .update(...).in('id', ids).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()

    // Auto-avsluta uppsagda avtal vars slutdatum passerat (Prisma updateMany).
    await sb
      .from('f_hyresavtal')
      .update({ status: 'avslutad' })
      .eq('status', 'uppsagd')
      .lte('slutdatum', new Date().toISOString())

    const { data, error } = await sb
      .from('f_hyresavtal')
      .select(`
        *,
        lokaler:f_hyresavtal_lokal (
          id,
          lokal:f_lokal (
            id, namn, yta,
            fastighet:f_fastighet (
              id, namn, taxeringsvarde,
              byggnader:f_byggnad ( id, uthyrbar_yta ),
              bolag:f_bolag ( id, fastighetsskattesats ),
              beteckningar:f_fastighetsbeteckning ( id, taxeringsvarde )
            )
          )
        ),
        hyresgast:f_hyresgast ( id, namn ),
        indexhojningar:f_indexhojning ( id, datum, procent, bashyra_gammal, bashyra_ny, skapad_av )
      `)
      .order('created_at', { ascending: false })
      .order('datum', { ascending: false, foreignTable: 'f_indexhojning' })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('hyresavtal GET error:', e)
    return NextResponse.json({ error: 'Serverfel', detail: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    const lokalIds: string[] = Array.isArray(body.lokalIds)
      ? body.lokalIds
      : body.lokalId
      ? [body.lokalId]
      : Array.isArray(body.lokal_ids)
      ? body.lokal_ids
      : body.lokal_id
      ? [body.lokal_id]
      : []

    if (lokalIds.length === 0) {
      return NextResponse.json({ error: 'Minst en lokal krävs' }, { status: 400 })
    }

    // Generera avtalsnummer: ÅR-NNN (Prisma count startsWith → ilike head-count).
    const year = new Date().getFullYear()
    const { count, error: countError } = await sb
      .from('f_hyresavtal')
      .select('id', { count: 'exact', head: true })
      .ilike('avtalsnummer', `${year}-%`)
    if (countError) throw countError
    const avtalsnummer = `${year}-${String((count ?? 0) + 1).padStart(3, '0')}`

    // Läs body i både camelCase och snake_case → skriv snake_case till Supabase.
    const startdatum = body.startdatum ? new Date(body.startdatum).toISOString() : new Date().toISOString()
    const slutdatumRaw = body.slutdatum
    const avtalsdatumRaw = body.avtalsdatum
    const uppsagningstidHG = body.uppsagningstidHG ?? body.uppsagningstid_hg
    const uppsagningstidHV = body.uppsagningstidHV ?? body.uppsagningstid_hv

    const insertData = {
      avtalsnummer,
      hyresgast_id: (body.hyresgastId ?? body.hyresgast_id) as string,
      startdatum,
      slutdatum: slutdatumRaw ? new Date(slutdatumRaw).toISOString() : null,
      bashyra: parseFloat(body.bashyra),
      arshyra: body.arshyra ? parseFloat(body.arshyra) : null,
      indexupprakning: parseFloat(body.indexupprakning || 0),
      status: body.status || 'aktiv',
      uppsagningstid: parseInt(uppsagningstidHG ?? body.uppsagningstid ?? 3),
      avtalsdatum: avtalsdatumRaw ? new Date(avtalsdatumRaw).toISOString() : null,
      hyrestid: body.hyrestid || 'tillsvidare',
      forlangning: body.forlangning ? parseInt(body.forlangning) : null,
      uppsagningstid_hg: uppsagningstidHG ? parseInt(uppsagningstidHG) : null,
      uppsagningstid_hv: uppsagningstidHV ? parseInt(uppsagningstidHV) : null,
      faktureringsfrekvens: body.faktureringsfrekvens || 'månadsvis',
      forfallotyp: body.forfallotyp || 'fore_period',
      forfallodagar: body.forfallodagar ? parseInt(body.forfallodagar) : 30,
      anvand_index:
        (body.anvandIndex ?? body.anvand_index) !== undefined
          ? Boolean(body.anvandIndex ?? body.anvand_index)
          : true,
      basindex_ar: (body.basindexAr ?? body.basindex_ar) ? parseInt(body.basindexAr ?? body.basindex_ar) : null,
      basindex_manad: (body.basindexManad ?? body.basindex_manad) || null,
      basindex_varde: (body.basindexVarde ?? body.basindex_varde)
        ? parseFloat(body.basindexVarde ?? body.basindex_varde)
        : null,
      anvandning: body.anvandning || null,
      el_abonnemang: (body.elAbonnemang ?? body.el_abonnemang) || 'hyresgast',
      va_abonnemang: (body.vaAbonnemang ?? body.va_abonnemang) || 'ingar',
      varme_abonnemang: (body.varmeAbonnemang ?? body.varme_abonnemang) || 'ingar',
      ventilation: body.ventilation || 'ingar',
      kostnadsandel: body.kostnadsandel ? parseFloat(body.kostnadsandel) : null,
      underhallsansvar: (body.underhallsansvar) || 'hyresgast_ytskikt',
      sakerhet: body.sakerhet || null,
      specialvillkor: body.specialvillkor || null,
    }

    const { data: avtal, error } = await sb
      .from('f_hyresavtal')
      .insert(insertData)
      .select()
      .single()
    if (error) throw error

    // Nested create lokaler → separat insert i junction f_hyresavtal_lokal.
    const junctionRows = lokalIds.map((lokalId) => ({
      hyresavtal_id: avtal.id,
      lokal_id: lokalId,
    }))
    const { error: junctionError } = await sb.from('f_hyresavtal_lokal').insert(junctionRows)
    if (junctionError) throw junctionError

    // Märk alla lokaler som uthyrda (Prisma updateMany).
    const { error: lokalError } = await sb
      .from('f_lokal')
      .update({ status: 'uthyrd' })
      .in('id', lokalIds)
    if (lokalError) throw lokalError

    return NextResponse.json(avtal, { status: 201 })
  } catch (e) {
    console.error('hyresavtal POST error:', e)
    return NextResponse.json({ error: 'Serverfel', detail: String(e) }, { status: 500 })
  }
}
