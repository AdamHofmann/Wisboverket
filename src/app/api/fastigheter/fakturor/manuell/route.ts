// Manuell faktura till en hyresgäst (extra/engångskostnader, ej kopplat till hyresavtal).
//
// POST /api/fastigheter/fakturor/manuell
//   body: { hyresgastId, fakturadatum: 'YYYY-MM-DD', forfallodatum: 'YYYY-MM-DD',
//           rader: [{ beskrivning, antal, apris, moms }] }
//   → skapar f_faktura (hyresavtal_id = null, hyresgast_id, period = fakturadatumets YYYY-MM,
//     belopp = Σ antal×apris exkl moms, status 'ej_skickad', typ 'faktura') + f_fakturarad-rader.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RadInput {
  beskrivning: string
  antal: number
  apris: number
  moms: number
  fritext?: boolean
}

function fakturanummer(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const r = Math.floor(Math.random() * 9000) + 1000
  return `F${y}${m}-${r}`
}

const r2 = (n: number) => Math.round(n * 100) / 100

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    const hyresgastId: string | null = body.hyresgastId ?? body.hyresgast_id ?? null
    const fakturadatum: string = body.fakturadatum
    const forfallodatum: string = body.forfallodatum
    const raderIn: RadInput[] = Array.isArray(body.rader) ? body.rader : []

    if (!hyresgastId) return NextResponse.json({ error: 'Hyresgäst krävs' }, { status: 400 })
    if (!fakturadatum || !forfallodatum) return NextResponse.json({ error: 'Faktura- och förfallodatum krävs' }, { status: 400 })
    // Debiteringsrader måste ha belopp; fritextrader är bara text (visas på fakturan, ingen kostnad).
    const debiteringsrader = raderIn.filter(r => r.beskrivning?.trim() && !r.fritext && Number(r.apris) !== 0)
    if (debiteringsrader.length === 0) return NextResponse.json({ error: 'Minst en fakturarad med belopp krävs' }, { status: 400 })

    // Behåll radordningen (fritext kan ligga mellan debiteringsrader).
    const rader = raderIn
      .filter(r => r.beskrivning?.trim() && (r.fritext || Number(r.apris) !== 0))
      .map(r => {
        if (r.fritext) {
          return { artikelkod: 'TEXT', beskrivning: r.beskrivning.trim(), antal: 0, apris: 0, belopp: 0, moms: 0 }
        }
        const antal = Number(r.antal) || 1
        const apris = r2(Number(r.apris) || 0)
        return {
          artikelkod: 'MAN',
          beskrivning: r.beskrivning.trim(),
          antal,
          apris,
          belopp: r2(antal * apris),
          moms: Number(r.moms) || 0,
        }
      })
    const belopp = r2(rader.reduce((s, r) => s + r.belopp, 0))
    const period = fakturadatum.slice(0, 7) // YYYY-MM

    // Avsändarbolag: använd explicit val, annars härled från hyresgästens hyresavtal
    // (avtal → lokal → fastighet → bolag). Vid tvetydighet (flera bolag) eller kund utan
    // avtal lämnas det tomt (frontend kan då be om ett val).
    let bolagId: string | null = body.bolagId ?? body.bolag_id ?? null
    if (!bolagId) {
      const { data: avtal } = await sb
        .from('f_hyresavtal')
        .select('lokaler:f_hyresavtal_lokal ( lokal:f_lokal ( fastighet:f_fastighet ( bolag_id ) ) )')
        .eq('hyresgast_id', hyresgastId)
      const bolagIds = [...new Set(
        ((avtal ?? []) as any[]).flatMap(a =>
          ((a.lokaler ?? []) as any[]).map(l => l.lokal?.fastighet?.bolag_id).filter((b: unknown): b is string => !!b))
      )]
      if (bolagIds.length === 1) bolagId = bolagIds[0]
    }

    // 1) Skapa fakturan.
    const { data: faktura, error: fErr } = await sb
      .from('f_faktura')
      .insert({
        fakturanummer: fakturanummer(),
        hyresavtal_id: null,
        hyresgast_id: hyresgastId,
        bolag_id: bolagId,
        belopp,
        period,
        forfallodag: new Date(forfallodatum).toISOString(),
        status: 'ej_skickad',
        typ: 'faktura',
      })
      .select()
      .single()
    if (fErr) throw fErr

    // 2) Fakturarader.
    const { error: rErr } = await sb
      .from('f_fakturarad')
      .insert(rader.map(r => ({ ...r, faktura_id: faktura.id as string })))
    if (rErr) throw rErr

    return NextResponse.json(faktura, { status: 201 })
  } catch (e) {
    console.error('manuell faktura error:', e)
    const msg = e instanceof Error ? e.message : 'Serverfel'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
