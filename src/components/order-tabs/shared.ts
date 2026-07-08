import type { CSSProperties, FocusEvent } from 'react'

export { fmtKr, fmtKrExakt } from '@/lib/format'

export const fmtDatum = (d: string) =>
  new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })

export const inp: CSSProperties = {
  background: '#1c1c1e', border: '1px solid #3a3a3c', borderRadius: 8, padding: '8px 12px',
  color: '#f2f2f7', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
}

export const lbl: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: '#8e8e93', marginBottom: 6, display: 'block',
}

type FocusableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

export const fo = (e: FocusEvent<FocusableElement>) => { e.target.style.borderColor = '#E8C96A' }
export const fb = (e: FocusEvent<FocusableElement>) => { e.target.style.borderColor = '#3a3a3c' }

export const STATUS_LABEL: Record<string, string> = { ny: 'Ny', pågående: 'Pågående', klar: 'Klar', inaktiv: 'Inaktiv' }
export const STATUS_COLOR: Record<string, string> = { ny: '#60a5fa', pågående: '#E8C96A', klar: '#4ade80', inaktiv: '#666' }
export const PRIO_LABEL: Record<string, string> = { lag: 'Låg', normal: 'Normal', hog: 'Hög', akut: 'Akut' }
export const PRIO_COLOR: Record<string, string> = { lag: '#777', normal: '#aaa', hog: '#fb923c', akut: '#f87171' }
export const KAT_ICON: Record<string, string> = { El: '⚡', VVS: '🔧', Snickeri: '🪚', Städ: '🧹', Lås: '🔑', Utemiljö: '⛏️', Annat: '📋' }
export const KATEGORIER = ['El', 'VVS', 'Snickeri', 'Städ', 'Lås', 'Utemiljö', 'Annat']
export const PERSONAL = ['Adam Hofmann', 'Isabelle Hofmann', 'Kalle Kanberg']
