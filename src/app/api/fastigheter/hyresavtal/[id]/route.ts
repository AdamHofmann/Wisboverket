// Migrerad route. Källa: src/app/api/hyresavtal/[id]/route.ts (Prisma) → Supabase server-klient.
//
// Metoder: PATCH (säg upp avtal), PUT (uppdatera avtal + koppla om lokaler), DELETE.
//
// Mönster som demonstreras här:
//  * Prisma-modell Hyresavtal → tabell f_hyresavtal (snake_case-kolumner).
//  * camelCase-body (hyresgastId, uppsagningstidHG ...) → snake_case (hyresgast_id, uppsagningstid_hg ...).
//    UI:t skickar camelCase → vi läser camel och skriver snake.
//  * include: { lokaler } → separat query mot junction f_hyresavtal_lokal.
//  * prisma.hyresavtalLokal.count med nästlad where på hyresavtal.status
//    → PostgREST embedded inner-filter (.select('..., f_hyresavtal!inner(...)') + .in på status).
//  * deleteMany/createMany på junction → .delete().eq(...) / .insert([...]).
//  * belopp (bashyra/arshyra/...) numeric → parseFloat som källan.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Sb = Awaited<ReturnType<typeof createClient>>

// Uppdatera lokal-status baserat på om det finns aktiva avtal.
// Källans prisma.hyresavtalLokal.count({ where: { lokalId, hyresavtal: { status in [...], id != excludeAvtalId } } })
// blir här en query mot junction med embedded inner-filter på f_hyresavtal.
async function syncLokalStatus(sb: Sb, lokalIds: string[], excludeAvtalId?: string) {
  for (const lokalId of lokalIds) {
    let q = sb
      .from('f_hyresavtal_lokal')
      .select('id, hyresavtal:f_hyresavtal!inner(id, status)', { count: 'exact', head: false })
      .eq('lokal_id', lokalId)
      .in('hyresavtal.status', ['aktiv', 'utkast', 'uppsagd'])
    if (excludeAvtalId) q = q.neq('hyresavtal_id', excludeAvtalId)
    const { data, error } = await q
    if (error) throw error
    const aktiva = (data ?? []).length
    const { error: updErr } = await sb
      .from('f_lokal')
      .update({ status: aktiva > 0 ? 'uthyrd' : 'ledig' })
      .eq('id', lokalId)
    if (updErr) throw updErr
  }
}

// Hämta kopplade lokal-ids för ett avtal (motsvarar include: { lokaler: true } + .map(l => l.lokalId)).
async function hamtaLokalIds(sb: Sb, avtalId: string): Promise<string[]> {
  const { data, error } = await sb
    .from('f_hyresavtal_lokal')
    .select('lokal_id')
    .eq('hyresavtal_id', avtalId)
  if (error) throw error
  return (data ?? []).map((r: { lokal_id: string }) => r.lokal_id)
}

// PATCH: "Säg upp avtal"
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()

    const { data: avtal, error: hamtaErr } = await sb
      .from('f_hyresavtal')
      .select('id, uppsagningstid')
      .eq('id', id)
      .maybeSingle()
    if (hamtaErr) throw hamtaErr
    if (!avtal) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })

    let body: { slutdatum?: string | null; uppsagningsdatum?: string | null; kommentar?: string | null } = {}
    try { body = await request.json() } catch { /* body är valfri */ }

    const beraknatSlutdatum = new Date()
    beraknatSlutdatum.setMonth(beraknatSlutdatum.getMonth() + (avtal.uppsagningstid ?? 0))
    const slutdatum = body.slutdatum ? new Date(body.slutdatum) : beraknatSlutdatum

    const updateData: Record<string, unknown> = {
      status: 'uppsagd',
      slutdatum: slutdatum.toISOString(),
    }
    if (body.kommentar !== undefined) updateData.uppsagning_kommentar = body.kommentar

    const { data: updated, error: updErr } = await sb
      .from('f_hyresavtal')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (updErr) throw updErr

    const lokalIds = await hamtaLokalIds(sb, id)
    await syncLokalStatus(sb, lokalIds)

    return NextResponse.json(updated)
  } catch (e) {
    console.error('säg upp avtal error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const body = await request.json()

    // Hämta gammalt avtal (status) + gamla lokaler för status-sync.
    const { data: gammaltAvtal, error: gammaltErr } = await sb
      .from('f_hyresavtal')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()
    if (gammaltErr) throw gammaltErr
    const gamlaLokalIds = await hamtaLokalIds(sb, id)

    // Bygg update-data. UI skickar camelCase → skriv snake_case.
    const data: Record<string, unknown> = {}
    if (body.hyresgastId !== undefined) data.hyresgast_id = body.hyresgastId
    if (body.startdatum !== undefined) data.startdatum = new Date(body.startdatum).toISOString()
    if (body.slutdatum !== undefined) data.slutdatum = body.slutdatum ? new Date(body.slutdatum).toISOString() : null
    if (body.bashyra !== undefined) data.bashyra = parseFloat(body.bashyra)
    if (body.arshyra !== undefined) data.arshyra = body.arshyra ? parseFloat(body.arshyra) : null
    if (body.indexupprakning !== undefined) data.indexupprakning = parseFloat(body.indexupprakning)
    if (body.status !== undefined) data.status = body.status
    if (body.hyrestid !== undefined) data.hyrestid = body.hyrestid
    if (body.forlangning !== undefined) data.forlangning = body.forlangning ? parseInt(body.forlangning) : null
    if (body.uppsagningstidHG !== undefined) data.uppsagningstid_hg = body.uppsagningstidHG ? parseInt(body.uppsagningstidHG) : null
    if (body.uppsagningstidHV !== undefined) data.uppsagningstid_hv = body.uppsagningstidHV ? parseInt(body.uppsagningstidHV) : null
    if (body.faktureringsfrekvens !== undefined) data.faktureringsfrekvens = body.faktureringsfrekvens
    if (body.anvandIndex !== undefined) data.anvand_index = Boolean(body.anvandIndex)
    if (body.forfallotyp !== undefined) data.forfallotyp = body.forfallotyp
    if (body.forfallodagar !== undefined) data.forfallodagar = parseInt(body.forfallodagar)
    if (body.avtalsdatum !== undefined) data.avtalsdatum = body.avtalsdatum ? new Date(body.avtalsdatum).toISOString() : null
    if (body.basindexAr !== undefined) data.basindex_ar = body.basindexAr ? parseInt(body.basindexAr) : null
    if (body.basindexManad !== undefined) data.basindex_manad = body.basindexManad || null
    if (body.basindexVarde !== undefined) data.basindex_varde = body.basindexVarde ? parseFloat(body.basindexVarde) : null
    if (body.avtalsnummer !== undefined) data.avtalsnummer = body.avtalsnummer || null
    if (body.anvandning !== undefined) data.anvandning = body.anvandning || null
    if (body.elAbonnemang !== undefined) data.el_abonnemang = body.elAbonnemang
    if (body.vaAbonnemang !== undefined) data.va_abonnemang = body.vaAbonnemang
    if (body.varmeAbonnemang !== undefined) data.varme_abonnemang = body.varmeAbonnemang
    if (body.ventilation !== undefined) data.ventilation = body.ventilation
    if (body.kostnadsandel !== undefined) data.kostnadsandel = body.kostnadsandel ? parseFloat(body.kostnadsandel) : null
    if (body.underhallsansvar !== undefined) data.underhallsansvar = body.underhallsansvar
    if (body.sakerhet !== undefined) data.sakerhet = body.sakerhet || null
    if (body.specialvillkor !== undefined) data.specialvillkor = body.specialvillkor || null

    // Uppdatera lokaler om lokalIds skickas.
    if (Array.isArray(body.lokalIds)) {
      const nyaLokalIds: string[] = body.lokalIds
      // Ta bort gamla junction-rader, lägg till nya (motsvarar deleteMany + createMany).
      const { error: delErr } = await sb
        .from('f_hyresavtal_lokal')
        .delete()
        .eq('hyresavtal_id', id)
      if (delErr) throw delErr
      if (nyaLokalIds.length > 0) {
        const { error: insErr } = await sb
          .from('f_hyresavtal_lokal')
          .insert(nyaLokalIds.map(lokalId => ({ hyresavtal_id: id, lokal_id: lokalId })))
        if (insErr) throw insErr
      }

      // Sync status för både gamla och nya lokaler.
      const allaLokalIds = [...new Set([...gamlaLokalIds, ...nyaLokalIds])]
      const uppdateratStatus = body.status ?? gammaltAvtal?.status
      for (const lokalId of allaLokalIds) {
        const { data: junctions, error: cntErr } = await sb
          .from('f_hyresavtal_lokal')
          .select('id, hyresavtal:f_hyresavtal!inner(id, status)')
          .eq('lokal_id', lokalId)
          .in('hyresavtal.status', ['aktiv', 'utkast', 'uppsagd'])
        if (cntErr) throw cntErr
        const aktiva = (junctions ?? []).length
        // Om avtalet som uppdateras är det enda och sätts till avslutad/uppsagd, räkna utan det.
        const finnsAktiv = nyaLokalIds.includes(lokalId) && uppdateratStatus && !['avslutad', 'uppsagd'].includes(uppdateratStatus)
          ? true
          : aktiva > 0
        const { error: updErr } = await sb
          .from('f_lokal')
          .update({ status: finnsAktiv ? 'uthyrd' : 'ledig' })
          .eq('id', lokalId)
        if (updErr) throw updErr
      }
    } else if (body.status && ['avslutad', 'uppsagd'].includes(body.status)) {
      // Status ändras — sync gamla lokaler.
      await syncLokalStatus(sb, gamlaLokalIds)
    }

    const { data: avtal, error: avtalErr } = await sb
      .from('f_hyresavtal')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (avtalErr) throw avtalErr

    return NextResponse.json(avtal)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()

    // Hämta lokal-ids innan radering (junction cascade-raderas av FK on delete cascade).
    const lokalIds = await hamtaLokalIds(sb, id)

    const { error: delErr } = await sb.from('f_hyresavtal').delete().eq('id', id)
    if (delErr) throw delErr

    // Efter att avtalet raderats: sync lokal-status (junction-raderna är borta → aktiva=0).
    await syncLokalStatus(sb, lokalIds)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('radera avtal error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
