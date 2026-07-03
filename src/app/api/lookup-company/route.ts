import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatOrgnr } from '@/lib/format'

// Cache av lyckade uppslag så samma sökning inte kostar mot Apiverkets dagskvot igen.
function cacheClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return url && key ? createClient(url, key) : null
}

async function getCached(query: string): Promise<any | null> {
  try {
    const sb = cacheClient(); if (!sb) return null
    const { data } = await sb.from('lookup_cache').select('response').eq('query', query).maybeSingle()
    return data?.response ?? null
  } catch { return null }
}

async function setCached(query: string, response: unknown) {
  try {
    const sb = cacheClient(); if (!sb) return
    await sb.from('lookup_cache').upsert({ query, response })
  } catch { /* cache är best-effort — blockera aldrig uppslaget */ }
}

const UPPER_TOKENS = new Set(['AB', 'HB', 'KB', 'EK', 'FÖR', 'EF', 'BRF', 'KHF', 'I', 'BF'])

function toTitleCase(str: string) {
  if (!str) return str
  return str
    .split(' ')
    .map(word => {
      if (!word) return word
      const upper = word.toUpperCase()
      if (UPPER_TOKENS.has(upper.replace(/[.,]/g, ''))) return upper
      if (/\d/.test(word)) return word
      return word.split('-').map(part => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part)).join('-')
    })
    .join(' ')
}

function mapCompany(c: any, fallbackOrgnr?: string) {
  return {
    namn: toTitleCase(c.name || ''),
    orgnummer: formatOrgnr(c.org_number || fallbackOrgnr || ''),
    adress: toTitleCase(c.visit_address || c.address || ''),
    postnummer: c.visit_postal_code || c.postal_code || '',
    ort: toTitleCase(c.visit_city || c.city || ''),
    aktiv: c.active !== false && !c.deregistered,
  }
}

async function fetchApiverket(url: string, apiKey: string) {
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + apiKey } })
  const data = await res.json()
  if (!res.ok) {
    // Apiverket kan returnera felet som en sträng ELLER som ett objekt { type, code, message, ... }
    const raw = data?.error ?? data
    const error: string = (typeof raw === 'string' ? raw : raw?.message) || data?.message || `Apiverket HTTP ${res.status}`
    return { ok: false as const, error, status: res.status === 404 ? 404 : 502 }
  }
  return { ok: true as const, data }
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.APIVERKET_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'APIVERKET_API_KEY saknas i miljövariabler' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const name = (searchParams.get('name') || '').trim()
  const orgnr = (searchParams.get('orgnr') || '').replace(/[^0-9]/g, '')

  try {
    if (name) {
      const cacheKey = `name:${name.toLowerCase()}`
      const cached = await getCached(cacheKey)
      if (cached) return NextResponse.json({ ...cached, cachad: true })

      const sok = (q: string) => fetchApiverket('https://apiverket.se/v1/companies/search?q=' + encodeURIComponent(q), apiKey)
      let r = await sok(name)
      // Apiverket kräver ofta exakt namn. De flesta svenska bolag heter "... AB" — prova det om första
      // sökningen inte gav träff och namnet saknar bolagsform.
      if (!r.ok && r.status === 404 && !/\b(AB|HB|KB|EK|BRF)\b/i.test(name)) {
        const r2 = await sok(name + ' AB')
        if (r2.ok) r = r2
      }
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
      const companies = (r.data.data?.companies || r.data.companies || []).slice(0, 10).map((c: any) => mapCompany(c))
      const payload = { ok: true, companies }
      await setCached(cacheKey, payload)
      return NextResponse.json(payload)
    }

    if (orgnr.length !== 10) return NextResponse.json({ error: 'Ogiltigt organisationsnummer (10 siffror krävs)' }, { status: 400 })

    const cacheKey = `orgnr:${orgnr}`
    const cached = await getCached(cacheKey)
    if (cached) return NextResponse.json({ ...cached, cachad: true })

    const r = await fetchApiverket(`https://apiverket.se/v1/companies/${orgnr}`, apiKey)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    const payload = { ok: true, company: mapCompany(r.data.data || r.data, orgnr) }
    await setCached(cacheKey, payload)
    return NextResponse.json(payload)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
