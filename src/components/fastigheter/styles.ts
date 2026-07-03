import type { CSSProperties, FocusEvent } from 'react'

// ============================================================================
// Delade guld/mörk-tokens för fastighets-modulen.
// Utökar mönstret från src/components/order-tabs/shared.ts.
// Alla portade sidor/komponenter använder dessa istället för Tailwind-klasser.
// ============================================================================

// Färgpalett (käll-appens blå/ljusa tema → mål-appens guld/mörka)
export const C = {
  gold: '#E8C96A',
  goldSoft: 'rgba(232,201,106,0.08)',
  bg: '#111',
  panel: '#1a1a1a',
  panel2: '#141414',
  field: '#111',
  border: '#2a2a2a',
  borderSoft: '#222',
  borderStrong: '#333',
  text: '#f2f2f7',
  text2: '#e0e0e0',
  muted: '#888',
  muted2: '#666',
  danger: '#f87171',
  ok: '#4ade80',
  warn: '#fb923c',
  blue: '#60a5fa',
}

export const fmtKr = (n: number) => (n ?? 0).toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr'
export const fmtKvm = (n: number) => `${(n ?? 0).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kvm`
export const fmtDatum = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// ---- Fältstilar ------------------------------------------------------------
export const inp: CSSProperties = {
  background: C.field, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px',
  color: C.text2, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
}

export const lbl: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: C.muted, marginBottom: 6, display: 'block',
  textTransform: 'uppercase',
}

type FocusableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
export const fo = (e: FocusEvent<FocusableElement>) => { e.target.style.borderColor = C.gold }
export const fb = (e: FocusEvent<FocusableElement>) => { e.target.style.borderColor = C.border }

// ---- Knappar ---------------------------------------------------------------
export const btnPrimary: CSSProperties = {
  background: C.gold, color: '#000', border: 'none', borderRadius: 8,
  padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
export const btnGhost: CSSProperties = {
  background: 'transparent', color: C.text2, border: `1px solid ${C.border}`, borderRadius: 8,
  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
export const btnDanger: CSSProperties = {
  background: 'transparent', color: C.danger, border: `1px solid rgba(248,113,113,0.4)`, borderRadius: 8,
  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

// ---- Kort / sektioner ------------------------------------------------------
export const card: CSSProperties = {
  background: C.panel, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: 20,
}
export const sectionLabel: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: C.muted, textTransform: 'uppercase',
  marginBottom: 14,
}
export const badge: CSSProperties = {
  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
  background: C.goldSoft, color: C.gold,
}

// Energiklass-färger (behåll semantiken från källan, mörkanpassat)
export const energiColor: Record<string, string> = {
  A: '#16a34a', B: '#22c55e', C: '#84cc16',
  D: '#eab308', E: '#fb923c', F: '#ea580c', G: '#dc2626',
}
