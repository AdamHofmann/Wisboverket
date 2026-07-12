// Supabase Edge Function: mintar en LiveKit-access-token för inloggade användare.
// Endast autentiserade Supabase-användare får en token (verifieras via deras JWT).
// Alla får samma öppna rum "wisboverket" och får både prata och lyssna.
//
// Deploy:  supabase functions deploy livekit-token   (MED jwt-verifiering — INTE --no-verify-jwt)
// Secrets: supabase secrets set LIVEKIT_URL=wss://<ditt-projekt>.livekit.cloud \
//                               LIVEKIT_API_KEY=<key> LIVEKIT_API_SECRET=<secret>
// (SUPABASE_URL / SUPABASE_ANON_KEY sätts automatiskt av Edge-runtime.)

import { AccessToken } from 'npm:livekit-server-sdk@2'
import { createClient } from 'npm:@supabase/supabase-js@2'

const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL') ?? ''
const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY') ?? ''
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const ROOM = 'wisboverket' // ett gemensamt öppet rum för hela teamet

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'Ingen inloggning' }, 401)

    // Verifiera användaren via dess Supabase-JWT (kör som användaren → RLS ok).
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return json({ error: 'Ogiltig session' }, 401)

    // Namn (visas som "vem pratar") ur profiles.
    const { data: profile } = await supabase.from('profiles').select('namn').eq('id', user.id).maybeSingle()
    const name = profile?.namn ?? user.email ?? 'Okänd'

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: user.id, name })
    at.addGrant({ roomJoin: true, room: ROOM, canPublish: true, canSubscribe: true })
    const token = await at.toJwt()

    return json({ token, url: LIVEKIT_URL, room: ROOM, identity: user.id, name })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
