// Migrerad från käll-appen: src/app/api/indexhojningar/route.ts (Prisma) → Supabase server-klient.
//
// Mönster som demonstreras:
//  * Prisma-modell Indexhojning → tabell f_indexhojning (snake_case-kolumner).
//  * GET: include: { hyresavtal: { lokaler: { lokal: { fastighet } }, hyresgast } }
//    → PostgREST nested select via junction f_hyresavtal_lokal.
//    - orderBy: { datum: 'desc' } → .order('datum', { ascending: false }).
//  * POST: transaktionslös Prisma-loop (create indexhojning + update bashyra per avtal)
//    → ATOMÄR via Postgres-RPC f_apply_indexhojning (se migration 017).
//  * skapadAv: käll-appens body-fält/'System' → inloggad användare från sessionen,
//    med fallback till body.skapadAv och sist 'System' (matchar AUTH-direktivet).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()

    // include: { hyresavtal: { lokaler: { lokal: { fastighet } }, hyresgast } }
    // Junction f_hyresavtal_lokal binder f_hyresavtal ↔ f_lokal (n-n).
    // Aliaserna hyresavtal/lokaler/lokal/fastighet/hyresgast bevarar käll-UI:ts nycklar.
    const { data, error } = await sb
      .from('f_indexhojning')
      .select(`
        *,
        hyresavtal:f_hyresavtal (
          *,
          lokaler:f_hyresavtal_lokal (
            *,
            lokal:f_lokal (
              *,
              fastighet:f_fastighet (*)
            )
          ),
          hyresgast:f_hyresgast (*)
        )
      `)
      .order('datum', { ascending: false })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('indexhojningar GET error:', e)
    return NextResponse.json({ error: 'Serverfel', detail: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()
    // body: { avtalIds: string[], kpiGammal: number, kpiNy: number, procent: number, datum: string, skapadAv?: string }
    const avtalIds: string[] = (body.avtalIds as string[]) || (body.avtal_ids as string[]) || []
    const kpiGammal = body.kpiGammal ?? body.kpi_gammal ?? 0
    const kpiNy = body.kpiNy ?? body.kpi_ny ?? 0
    const procent = body.procent
    const datum = body.datum ?? null

    if (!Array.isArray(avtalIds) || avtalIds.length === 0) {
      return NextResponse.json({ error: 'avtalIds saknas' }, { status: 400 })
    }
    if (procent == null) {
      return NextResponse.json({ error: 'procent saknas' }, { status: 400 })
    }

    // AUTH: käll-appens skapadAv:'System' → inloggad användare från sessionen.
    const { data: userData } = await sb.auth.getUser()
    const skapadAv =
      userData?.user?.user_metadata?.full_name ||
      userData?.user?.email ||
      (body.skapadAv as string) ||
      'System'

    // ATOMÄRT: create f_indexhojning + update f_hyresavtal.bashyra per avtal
    // körs i en Postgres-RPC (migration 017) istället för Prisma-loopen.
    const { data, error } = await sb.rpc('f_apply_indexhojning', {
      p_avtal_ids: avtalIds,
      p_kpi_gammal: Number(kpiGammal),
      p_kpi_ny: Number(kpiNy),
      p_procent: Number(procent),
      p_datum: datum,
      p_skapad_av: skapadAv,
    })

    if (error) throw error
    // RPC returnerar de skapade f_indexhojning-raderna (setof) — motsvarar källans results[].
    return NextResponse.json(data ?? [], { status: 201 })
  } catch (e) {
    console.error('indexhojningar POST error:', e)
    return NextResponse.json({ error: 'Serverfel', detail: String(e) }, { status: 500 })
  }
}
