// Skapar el-fakturor från en debiteringsomgång: en separat faktura (typ='el') per
// hyresgäst, med en rad per mätare (Del, avläsningsperiod, start/slut/förbrukning kWh,
// blandpris). Raderna använder EL-artikeln → Hogia hämtar konto + moms därifrån,
// antal = kWh (quantity), apris = blandpris (prisöverstyrning per rad).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/* eslint-disable @typescript-eslint/no-explicit-any */
const r2 = (n: number) => Math.round(n * 100) / 100
const EL_MOMS = 25

function fakturanummer(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const r = Math.floor(Math.random() * 9000) + 1000
  return `F${y}${m}-EL-${r}`
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const body = await request.json().catch(() => ({}))

    const { data: omgang, error: oErr } = await sb
      .from('f_el_debiteringsomgang')
      .select('*')
      .eq('id', id)
      .single()
    if (oErr || !omgang) return NextResponse.json({ error: 'Omgången hittades inte' }, { status: 404 })

    // Ofakturerade debiteringar med belopp (hoppa över mätare utan förbrukning).
    const { data: deb, error: dErr } = await sb
      .from('f_eldebitering')
      .select('*, matare:f_elmatare(matarnummer, beskrivning)')
      .eq('omgang_id', id)
      .eq('status', 'ej_fakturerad')
    if (dErr) throw dErr
    // Valfritt: fakturera bara utvalda hyresgäster (annars alla i omgången).
    const valdaHyresgaster: string[] | null = Array.isArray(body.hyresgastNamn) && body.hyresgastNamn.length > 0 ? body.hyresgastNamn : null
    const debiteringar = (deb ?? [])
      .filter((d: any) => d.forbrukning && Number(d.belopp) > 0)
      .filter((d: any) => !valdaHyresgaster || valdaHyresgaster.includes(d.hyresgast_namn))
    if (debiteringar.length === 0) {
      return NextResponse.json({ error: 'Inga ofakturerade debiteringar med belopp att fakturera' }, { status: 400 })
    }

    // Resolvera hyresgäst + avsändarbolag per lokal (aktivt avtal → hyresgäst; lokal → fastighet → bolag).
    const lokalIds = [...new Set(debiteringar.map((d: any) => d.lokal_id).filter(Boolean))] as string[]
    const lokalInfo: Record<string, { hyresgastId: string | null; bolagId: string | null; namn: string | null }> = {}
    for (const lokalId of lokalIds) {
      const { data: kopplingar } = await sb
        .from('f_hyresavtal_lokal')
        .select('hyresavtal:f_hyresavtal(hyresgast_id, status)')
        .eq('lokal_id', lokalId)
      const avtal = ((kopplingar ?? []) as any[])
        .map((k) => (Array.isArray(k.hyresavtal) ? k.hyresavtal[0] : k.hyresavtal))
        .filter(Boolean)
      const valt = avtal.find((a: any) => a?.status === 'aktiv') || avtal[0]
      const { data: lok } = await sb
        .from('f_lokal')
        .select('namn, fastighet:f_fastighet(bolag_id)')
        .eq('id', lokalId)
        .single()
      const fast = (lok as any)?.fastighet
      lokalInfo[lokalId] = {
        hyresgastId: valt?.hyresgast_id ?? null,
        bolagId: (Array.isArray(fast) ? fast[0]?.bolag_id : fast?.bolag_id) ?? null,
        namn: (lok as any)?.namn ?? null,
      }
    }

    // Gruppera per hyresgäst (via lokalens aktiva avtal; fallback på namn).
    const grupper: Record<string, { hyresgastId: string | null; bolagId: string | null; namn: string; rader: any[] }> = {}
    for (const d of debiteringar as any[]) {
      const info = d.lokal_id ? lokalInfo[d.lokal_id] : undefined
      const key = info?.hyresgastId || d.hyresgast_namn || 'okand'
      if (!grupper[key]) {
        grupper[key] = { hyresgastId: info?.hyresgastId ?? null, bolagId: info?.bolagId ?? null, namn: d.hyresgast_namn || 'Okänd', rader: [] }
      }
      grupper[key].rader.push(d)
    }

    const period = String(omgang.period_fran).slice(0, 7)
    const forfallo = new Date()
    forfallo.setDate(forfallo.getDate() + Number(body.betalvillkorDagar ?? 20))

    const skapade: string[] = []
    for (const key of Object.keys(grupper)) {
      const g = grupper[key]
      const fakturaRader = g.rader.map((d: any) => {
        // Del = mätarens namn (fångat vid omgången, annars mätarens nuvarande beskrivning)
        // → annars lokalnamnet (som avläsningsvyn) → annars mätarnr.
        const lokalNamn = d.lokal_id ? lokalInfo[d.lokal_id]?.namn : null
        const del = (d.matare_beskrivning || d.matare?.beskrivning || lokalNamn || d.matare?.matarnummer || '').trim()
        // Undvik "El – El" när mätaren saknar/har generiskt namn.
        const beskrivning = !del || /^el$/i.test(del) ? 'Elförbrukning' : `El – ${del}`
        return {
          artikelkod: 'EL',
          beskrivning,
          antal: d.forbrukning,
          apris: r2(Number(d.pris_per_kwh)),
          belopp: r2(Number(d.belopp)),
          moms: EL_MOMS,
          start_varde: d.start_varde,
          slut_varde: d.slut_varde,
          avlast_fran: d.avlast_fran,
          avlast_till: d.avlast_till,
        }
      })
      const belopp = r2(fakturaRader.reduce((s, r) => s + r.belopp, 0))

      const { data: faktura, error: fErr } = await sb
        .from('f_faktura')
        .insert({
          fakturanummer: fakturanummer(),
          hyresavtal_id: null,
          hyresgast_id: g.hyresgastId,
          bolag_id: g.bolagId,
          belopp,
          period,
          forfallodag: forfallo.toISOString(),
          status: 'ej_skickad',
          typ: 'el',
        })
        .select()
        .single()
      if (fErr) throw fErr

      const { error: rErr } = await sb
        .from('f_fakturarad')
        .insert(fakturaRader.map((r) => ({ ...r, faktura_id: faktura.id as string })))
      if (rErr) throw rErr

      await sb
        .from('f_eldebitering')
        .update({ status: 'fakturerad', faktura_id: faktura.id, fakturerad_datum: new Date().toISOString() })
        .in('id', g.rader.map((d: any) => d.id))

      skapade.push(faktura.id as string)
    }

    return NextResponse.json({ ok: true, antal: skapade.length, fakturaIds: skapade }, { status: 201 })
  } catch (e) {
    console.error('el-fakturera error:', e)
    const msg = e instanceof Error ? e.message : 'Serverfel'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
