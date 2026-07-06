// Källa: src/app/api/meddelanden/route.ts (Prisma) → Supabase server-klient.
// Prisma-modell Meddelande → f_meddelande, MeddelandeMottagare → f_meddelande_mottagare.
// include: { mottagare: true } → nested select mottagare:f_meddelande_mottagare(*).
// _count: { mottagare: true } → beräknas i JS (antal_mottagare) efter hämtning.
// orderBy createdAt desc → .order('created_at', { ascending: false }).
// nested create (mottagare) → insert parent, sedan insert barn med FK.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MAIL_FROM } from '@/lib/site'

export async function GET() {
  try {
    const sb = await createClient()
    const { data, error } = await sb
      .from('f_meddelande')
      .select(`
        *,
        mottagare:f_meddelande_mottagare (*)
      `)
      .order('created_at', { ascending: false })
    if (error) throw error

    // _count: { mottagare: true } → JS-beräkning (PostgREST har ej _count på nested).
    const meddelanden = (data ?? []).map((m) => ({
      ...m,
      _count: { mottagare: Array.isArray(m.mottagare) ? m.mottagare.length : 0 },
    }))

    return NextResponse.json(meddelanden)
  } catch (e) {
    console.error('GET /api/fastigheter/meddelanden error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()
    const { amne, brodel, fran, mottagare, status } = body

    if (!amne || !brodel || !mottagare || mottagare.length === 0) {
      return NextResponse.json(
        { error: 'Ämne, meddelande och minst en mottagare krävs' },
        { status: 400 },
      )
    }

    // nested create → insert parent .select().single(), sedan insert barn med FK.
    const { data: meddelande, error: medErr } = await sb
      .from('f_meddelande')
      .insert({
        amne,
        brodel,
        fran: fran || MAIL_FROM,
        status: status || 'skickat',
      })
      .select()
      .single()
    if (medErr) throw medErr

    const rader = (mottagare as { hyresgastId?: string; hyresgast_id?: string; namn: string; epost: string }[]).map(
      (m) => ({
        meddelande_id: meddelande.id,
        hyresgast_id: m.hyresgastId || m.hyresgast_id || null,
        namn: m.namn,
        epost: m.epost,
      }),
    )

    const { data: skapadeMottagare, error: mottErr } = await sb
      .from('f_meddelande_mottagare')
      .insert(rader)
      .select()
    if (mottErr) throw mottErr

    // TODO: Faktiskt skicka e-post via Resend/Nodemailer (sidoeffekt ej implementerad i källan heller)
    // await sendEmails(meddelande)

    return NextResponse.json({ ...meddelande, mottagare: skapadeMottagare ?? [] }, { status: 201 })
  } catch (e) {
    console.error('POST /api/fastigheter/meddelanden error:', e)
    return NextResponse.json({ error: 'Kunde inte skicka' }, { status: 500 })
  }
}
