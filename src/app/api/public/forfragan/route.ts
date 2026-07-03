import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { optionsHandler, jsonWithCors } from '@/lib/public-api'

const ALLOWED_TYP = new Set(['uthyrning', 'offert', 'kontakt'])

export const OPTIONS = optionsHandler

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !ALLOWED_TYP.has(body.typ)) {
    return jsonWithCors({ error: 'Ogiltig typ (uthyrning | offert | kontakt krävs)' }, 400)
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await sb.from('forfragningar').insert({
    typ: body.typ,
    namn: body.namn || null,
    telefon: body.telefon || null,
    epost: body.epost || null,
    meddelande: body.meddelande || null,
    objekt_titel: body.objekt_titel || null,
    tjanst: body.tjanst || null,
    amne: body.amne || null,
    fastighet: body.fastighet || null,
  })

  if (error) return jsonWithCors({ error: error.message }, 500)
  return jsonWithCors({ ok: true })
}
