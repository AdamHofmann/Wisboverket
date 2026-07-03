'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtKr } from './shared'

export default function EkonomiTab({ orderId, faktureradeBelopp }: { orderId: string; faktureradeBelopp?: number | null }) {
  const [tidSumma, setTidSumma] = useState({ intakt: 0, kostnad: 0, antal: 0 })
  const [inkopSumma, setInkopSumma] = useState({ belopp: 0, antal: 0 })

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('order_tid_rader').select('total_intakt, total_kostnad').eq('order_id', orderId),
      sb.from('order_inkop').select('belopp').eq('order_id', orderId),
    ]).then(([{ data: tid }, { data: inkop }]) => {
      setTidSumma({
        intakt: (tid || []).reduce((s, r) => s + (r.total_intakt || 0), 0),
        kostnad: (tid || []).reduce((s, r) => s + (r.total_kostnad || 0), 0),
        antal: (tid || []).length,
      })
      setInkopSumma({
        belopp: (inkop || []).reduce((s, i) => s + i.belopp, 0),
        antal: (inkop || []).length,
      })
    })
  }, [orderId])

  const totalKostnad = tidSumma.kostnad + inkopSumma.belopp
  const fakturerat = faktureradeBelopp || 0
  const refIntakt = tidSumma.intakt * 1.25 // inkl moms
  const bruttovinst = fakturerat - totalKostnad
  const marginal = fakturerat > 0 ? (bruttovinst / fakturerat) * 100 : 0
  const marginalFarg = marginal >= 30 ? '#4ade80' : marginal >= 15 ? '#fb923c' : '#f87171'

  if (tidSumma.antal === 0 && inkopSumma.antal === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#444' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
        <div>Lägg till tid och inköp för att se ekonomin</div>
      </div>
    )
  }

  return (
    <div>
      {/* Intäkt */}
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '18px 20px', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 10 }}>INTÄKT</div>
        {fakturerat > 0 ? (
          <>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#4ade80' }}>{fmtKr(fakturerat)}</div>
            <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>✓ Fakturerat</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#555' }}>Ej fakturerad</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Referensintäkt: {fmtKr(refIntakt)} (inkl. moms)</div>
          </>
        )}
      </div>

      {/* Kostnader */}
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '18px 20px', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 12 }}>KOSTNADER</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: '#888' }}>Tid ({tidSumma.antal} poster)</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171' }}>{fmtKr(tidSumma.kostnad)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ fontSize: 13, color: '#888' }}>Inköp ({inkopSumma.antal})</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171' }}>{fmtKr(inkopSumma.belopp)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#d0d0d0' }}>Totalt</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f87171' }}>{fmtKr(totalKostnad)}</div>
        </div>
      </div>

      {/* Resultat */}
      {fakturerat > 0 && (
        <div style={{ background: '#141414', border: `1px solid ${marginalFarg}33`, borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 12 }}>RESULTAT</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Bruttovinst</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: bruttovinst >= 0 ? '#4ade80' : '#f87171' }}>{fmtKr(bruttovinst)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Marginal</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: marginalFarg }}>{marginal.toFixed(0)}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
