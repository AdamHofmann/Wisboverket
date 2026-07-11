// Supabase Edge Function: skickar push via OneSignal när en ny felanmälan eller
// förfrågan skapas. Triggas av en Database Webhook (INSERT på felanmalningar /
// forfragningar) → POST hit med raden.
//
// Deploy:  supabase functions deploy send-push --no-verify-jwt
// Secret:  supabase secrets set ONESIGNAL_REST_KEY=<din REST API-nyckel>
// Webhook: Dashboard → Database → Webhooks → ny webhook på INSERT för
//          `felanmalningar` och `forfragningar` → URL = denna funktions endpoint.

const ONESIGNAL_APP_ID = '0a4cbdf6-ea31-44a8-904b-4360d18a4cff' // ej hemlig
const ONESIGNAL_REST_KEY = Deno.env.get('ONESIGNAL_REST_KEY') ?? ''

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    // Supabase Database Webhook: { type, table, record, old_record, schema }
    const table: string = payload.table ?? ''
    const record: Record<string, unknown> = payload.record ?? {}

    let heading = 'Wisboverket'
    let content = 'Ny händelse'
    if (table === 'felanmalningar') {
      heading = '🛠 Ny felanmälan'
      content = [record.kategori, record.fastighet, record.lagenhet].filter(Boolean).join(' · ') || 'Ny felanmälan inkommen'
    } else if (table === 'forfragningar') {
      heading = '✉️ Ny förfrågan'
      content = [record.typ, record.namn, record.objekt_titel].filter(Boolean).join(' · ') || 'Ny förfrågan inkommen'
    }

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['Subscribed Users'], // hela teamet; kan riktas per user senare
        headings: { en: heading },
        contents: { en: content },
        // Öppnar appen till rätt vy när man trycker på notisen.
        app_url: table === 'felanmalningar'
          ? 'https://wisboverket.vercel.app/installningar/inkorg'
          : 'https://wisboverket.vercel.app/installningar/inkorg',
      }),
    })
    const data = await res.json()
    return new Response(JSON.stringify({ ok: res.ok, data }), {
      status: res.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
