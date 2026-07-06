import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { optionsHandler, jsonWithCors } from '@/lib/public-api'

const ALLOWED_KATEGORI = new Set(['el', 'vvs', 'snickeri', 'stad', 'las', 'annat'])
const ALLOWED_PRIO = new Set(['lag', 'normal', 'hog', 'akut'])

export const OPTIONS = optionsHandler

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !body.beskrivning) {
    return jsonWithCors({ error: 'Beskrivning krävs' }, 400)
  }

  const row = {
    kategori: ALLOWED_KATEGORI.has(body.kategori) ? body.kategori : 'annat',
    prioritet: ALLOWED_PRIO.has(body.prioritet) ? body.prioritet : 'normal',
    namn: body.namn || null,
    telefon: body.telefon || null,
    epost: body.epost || null,
    fastighet: body.fastighet || null,
    lagenhet: body.lagenhet || null,
    beskrivning: body.beskrivning,
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  // Med service role kan vi läsa tillbaka det tilldelade löpnumret. .select() (alla
  // kolumner) refererar inte 'nummer' direkt → fungerar även innan migrationen körts.
  if (serviceKey) {
    const { data, error } = await sb.from('felanmalningar').insert(row).select().single()
    if (error) return jsonWithCors({ error: error.message }, 500)
    return jsonWithCors({ ok: true, nummer: data?.nummer ?? null })
  }

  const { error } = await sb.from('felanmalningar').insert(row)
  if (error) return jsonWithCors({ error: error.message }, 500)
  return jsonWithCors({ ok: true })
}
