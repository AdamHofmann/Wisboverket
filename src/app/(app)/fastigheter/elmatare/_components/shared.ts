import React from 'react'
import { C } from '@/components/fastigheter/styles'

// ============================================================================
// Delade typer, format-hjälpare, stil-tokens och konstanter för elmätare-sidan.
// Extraherat oförändrat från page.tsx (ingen logik ändrad).
// ============================================================================

export interface Avlasning { id: string; datum: string; varde: number; avlast_av: string | null }
export interface Matare {
  id: string; matarnummer: string; beskrivning: string | null; schablon_kwh: number | null
  fastighet_id: string; lokal_id: string | null; aktiv: boolean
  fastighet: { id: string; namn: string }
  avlasningar: Avlasning[]
  _count: { avlasningar: number }
}
export interface Debitering {
  id: string; hyresgast_namn: string; forbrukning: number | null; pris_per_kwh: number; belopp: number; status: string
}
export interface LevFaktura {
  id: string; fastighet_id: string; period_fran: string; period_till: string
  total_kwh: number | null; total_belopp: number; pris_per_kwh: number | null
  fakturanummer: string | null; leverantor: string | null; status: string
  typ: 'nat' | 'handel' | 'kombinerad' | 'ovrigt' | null
  fastighet: { id: string; namn: string }
  debiteringar: Debitering[]
}
export interface OmgangDebitering {
  id: string; hyresgast_namn: string; forbrukning: number | null; pris_per_kwh: number; belopp: number; status: string
  matare_id: string | null
}
export interface Omgang {
  id: string; fastighet_id: string; period_fran: string; period_till: string
  total_kwh: number | null; total_kostnad: number; blandpris: number | null; status: string; created_at: string
  fastighet: { id: string; namn: string }
  fakturor: LevFaktura[]
  debiteringar: OmgangDebitering[]
}
export interface Fastighet { id: string; namn: string; adress?: string | null; ort?: string | null; bolag_id?: string | null; bolag?: { namn: string } | null }
export interface Lokal {
  id: string; namn: string; fastighet_id: string
  hyresavtal?: { hyresavtal: { hyresgast: { namn: string } } }[]
}

export type Tab = 'avlasningar' | 'leverantor' | 'debitering' | 'analys'

export type Sort = { key: string; dir: 'asc' | 'desc' }

export interface MatareForm { matarnummer: string; fastighetId: string; lokalId: string; beskrivning: string; schablonKwh: string }
export interface LevForm { fastighetId: string; periodFran: string; periodTill: string; totalKwh: string; totalBelopp: string; fakturanummer: string; leverantor: string; typ: string }

export const TYP_LABELS: Record<string, string> = { nat: 'Nät', handel: 'Handel', kombinerad: 'Nät + handel', ovrigt: 'Övrigt' }
export const typPill = (typ: string | null): React.CSSProperties | null => {
  if (typ === 'nat') return { background: 'rgba(96,165,250,0.14)', color: '#60a5fa' }
  if (typ === 'handel') return { background: 'rgba(232,201,106,0.14)', color: '#E8C96A' }
  // Kombinerad = täcker båda → grön, signalerar komplett kostnadsbas för perioden.
  if (typ === 'kombinerad') return { background: 'rgba(74,222,128,0.14)', color: '#4ade80' }
  if (typ === 'ovrigt') return { background: 'rgba(136,136,136,0.14)', color: '#aaa' }
  return null
}

export const formatSEK = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr'
export const formatDate = (d: string) => new Date(d).toLocaleDateString('sv-SE')
export const fmtKwh = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' kWh'

// ---- Lokala stilhjälpare (bygger på styles.ts-tokens) ----------------------
export const card: React.CSSProperties = { borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflow: 'hidden' }
export const cardHead: React.CSSProperties = { padding: '12px 16px', background: C.panel2, borderBottom: `1px solid ${C.borderSoft}` }
export const th: React.CSSProperties = { padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.muted2, textTransform: 'uppercase' }
export const td: React.CSSProperties = { padding: '10px 16px', fontSize: 13, color: C.text2, borderTop: `1px solid ${C.borderSoft}` }
export const pill = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600, background: bg, color })
export const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 13, padding: 4, borderRadius: 6 }
