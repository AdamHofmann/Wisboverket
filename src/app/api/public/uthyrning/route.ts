import { createClient } from '@supabase/supabase-js'
import { optionsHandler, jsonWithCors } from '@/lib/public-api'

export const OPTIONS = optionsHandler

export async function GET() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  const { data, error } = await sb
    .from('hyresobjekt')
    .select('*')
    .eq('publicerad', true)
    .order('created_at', { ascending: false })

  if (error) return jsonWithCors({ error: error.message }, 500)
  return jsonWithCors({ data })
}
