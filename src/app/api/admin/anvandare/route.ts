import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { withLogg } from '@/lib/withLogg'

// Skapar en ny användare (e-post + lösenord som admin sätter och delar ut).
// Kräver att anroparen är admin, och service role-nyckeln server-side.
async function postHandler(req: Request) {
  // 1. Verifiera att anroparen är inloggad admin
  const sb = await createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 })
  const { data: profil } = await sb.from('profiles').select('roll').eq('id', user.id).single()
  if (profil?.roll !== 'admin') return NextResponse.json({ error: 'Endast admin får skapa användare' }, { status: 403 })

  // 2. Service role-klient (server-only)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Service role-nyckel saknas på servern. Lägg SUPABASE_SERVICE_ROLE_KEY i .env.local och starta om.' }, { status: 500 })
  }
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

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

  // 5. Best-effort: sätt namn på profilen (om den skapats av trigger)
  if (data.user && namn) {
    await admin.from('profiles').update({ namn }).eq('id', data.user.id)
  }

  return NextResponse.json({ ok: true, id: data.user?.id })
}

export const POST = withLogg('api/admin/anvandare', postHandler)
