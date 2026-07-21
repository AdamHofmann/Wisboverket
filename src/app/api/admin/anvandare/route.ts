import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { withLogg } from '@/lib/withLogg'

// Skapar en ny användare (e-post + lösenord som admin sätter och delar ut).
// Kräver att anroparen är admin, och service role-nyckeln server-side.
async function postHandler(req: Request) {
  // 1. Verifiera inloggning
  const sb = await createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 })

  // 2. Service role-klient (server-only) — används både för admin-kollen och för
  //    att skapa användaren.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Service role-nyckel saknas på servern. Lägg SUPABASE_SERVICE_ROLE_KEY i .env.local och starta om.' }, { status: 500 })
  }
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // 3. Verifiera att den inloggade är admin. Läses med SERVICE ROLE (inte
  //    användar-sessionen) — annars kan RLS/session-propagering i vissa klienter
  //    (t.ex. appens WKWebView) ge en tom profil-läsning → felaktigt 403.
  const { data: profil } = await admin.from('profiles').select('roll').eq('id', user.id).single()
  if (profil?.roll !== 'admin') return NextResponse.json({ error: 'Endast admin får skapa användare' }, { status: 403 })

  // 3. Validera indata
  const body = await req.json().catch(() => null)
  const namn = String(body?.namn || '').trim()
  const epost = String(body?.epost || '').trim().toLowerCase()
  const losenord = String(body?.losenord || '')
  if (!epost || !losenord) return NextResponse.json({ error: 'E-post och lösenord krävs' }, { status: 400 })
  if (losenord.length < 6) return NextResponse.json({ error: 'Lösenordet måste vara minst 6 tecken' }, { status: 400 })

  // 4. Skapa användaren (e-post redan bekräftad så personen kan logga in direkt)
  const { data, error } = await admin.auth.admin.createUser({
    email: epost,
    password: losenord,
    email_confirm: true,
    user_metadata: { namn },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // 5. Skapa profil-raden EXPLICIT. Ingen databas-trigger gör det, så utan detta
  //    får den nya användaren ingen profil → osynlig i listan + ingen roll/modul.
  //    Ny användare: roll 'användare', ingen modulåtkomst → visas som INAKTIV tills
  //    admin aktiverar moduler i listan. upsert så det är idempotent.
  if (data.user) {
    const { error: profilErr } = await admin.from('profiles').upsert({
      id: data.user.id,
      namn: namn || null,
      roll: 'användare',
      modul_order: false,
      modul_fastighet: false,
    }, { onConflict: 'id' })
    if (profilErr) return NextResponse.json({ error: 'Användaren skapades men profilen kunde inte sättas upp: ' + profilErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.user?.id })
}

export const POST = withLogg('api/admin/anvandare', postHandler)
