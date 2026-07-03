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

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await sb.from('felanmalningar').insert({
    kategori: ALLOWED_KATEGORI.has(body.kategori) ? body.kategori : 'annat',
    prioritet: ALLOWED_PRIO.has(body.prioritet) ? body.prioritet : 'normal',
    namn: body.namn || null,
    telefon: body.telefon || null,
    epost: body.epost || null,
    fastighet: body.fastighet || null,
    lagenhet: body.lagenhet || null,
    beskrivning: body.beskrivning,
  })

  if (error) return jsonWithCors({ error: error.message }, 500)
  return jsonWithCors({ ok: true })
}
