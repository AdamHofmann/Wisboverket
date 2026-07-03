'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fmtKr, fmtDatum } from './shared'

type OffertRad = { typ: string; text?: string; artikel_id?: string; antal: number; apris: number; enhet: string; resurser?: number }
type Offert = {
  id: string; offer_number: string | null; titel: string | null; status: string
  giltig_till: string | null; rader: OffertRad[]; subtotal: number; moms_belopp: number; totalt: number
}

const STATUS_COLOR: Record<string, string> = { utkast: '#888', skickad: '#60a5fa', accepterad: '#4ade80', avvisad: '#f87171' }

export default function OffertTab({ orderId }: { orderId: string }) {
  const [offert, setOffert] = useState<Offert | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().from('offers').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { setOffert(data); setLoading(false) })
  }, [orderId])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#8e8e93' }}>Laddar...</div>

  if (!offert) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#636366' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
        <div style={{ fontSize: 13 }}>Ingen offert kopplad till denna order</div>
      </div>
    )
  }

  const color = STATUS_COLOR[offert.status] || '#888'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#E8C96A' }}>{offert.offer_number || `OFF-${offert.id.slice(0, 6)}`}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: color + '22', color, border: `1px solid ${color}44` }}>{offert.status}</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f2f7' }}>{offert.titel || 'Utan titel'}</div>
          {offert.giltig_till && <div style={{ fontSize: 11, color: '#fb923c', marginTop: 2 }}>Giltig t.o.m {fmtDatum(offert.giltig_till)}</div>}
        </div>
        <Link href="/offerter" style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none', border: '1px solid #60a5fa44', borderRadius: 6, padding: '6px 12px' }}>
          Öppna i Offerter →
        </Link>
      </div>

      <div style={{ background: '#252528', borderRadius: 10, overflow: 'hidden' }}>
        {(offert.rader || []).map((r, i) => {
          const antal = r.antal * (r.resurser || 1)
          const belopp = antal * r.apris
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #2c2c2e' }}>
              <div style={{ fontSize: 13, color: '#d0d0d0' }}>{r.text || '—'}</div>
              <div style={{ fontSize: 12, color: '#8e8e93' }}>{antal} {r.enhet} × {r.apris} kr</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#E8C96A' }}>{fmtKr(belopp)}</div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 14, background: '#0d0d0d', borderRadius: 8, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: '#8e8e93' }}>Netto</span>
          <span style={{ fontSize: 12, color: '#b0b0b3' }}>{fmtKr(offert.subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#8e8e93' }}>Moms 25%</span>
          <span style={{ fontSize: 12, color: '#b0b0b3' }}>{fmtKr(offert.moms_belopp)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>Totalt</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#E8C96A' }}>{fmtKr(offert.totalt)}</span>
        </div>
      </div>
    </div>
  )
}
