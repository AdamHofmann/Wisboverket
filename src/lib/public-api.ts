import { NextResponse } from 'next/server'

const ALLOWED_ORIGIN = process.env.PUBLIC_FORM_ORIGIN || 'https://hofmannsab.se'

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export function optionsHandler() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export function jsonWithCors(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders() })
}
