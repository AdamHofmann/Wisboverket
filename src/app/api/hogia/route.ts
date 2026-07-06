import { NextResponse } from 'next/server'
import { withLogg } from '@/lib/withLogg'

// Stub — Hogia OpenBusiness-synk aktiveras i Fas 2 (API-nyckel saknas).
// Anropas från kunddetalj + fakturavy för att visa synk-status/felmeddelande.
async function postHandler() {
  return NextResponse.json(
    { ok: false, error: 'Hogia-synk aktiveras i Fas 2 (API-nyckel saknas)' },
    { status: 501 }
  )
}

export const POST = withLogg('api/hogia', postHandler)
