import { NextResponse } from 'next/server'

// Stub — Hogia OpenBusiness-synk aktiveras i Fas 2 (API-nyckel saknas).
// Anropas från kunddetalj + fakturavy för att visa synk-status/felmeddelande.
export async function POST() {
  return NextResponse.json(
    { ok: false, error: 'Hogia-synk aktiveras i Fas 2 (API-nyckel saknas)' },
    { status: 501 }
  )
}
