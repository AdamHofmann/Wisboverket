'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Faktura = {
  id: string; fakturanummer: string; typ: string; status: string
  fakturadatum: string; totalt: number; subtotal: number; moms_belopp: number
  kund_namn: string | null; referens: string | null; original_faktura_id: string | null
  rader: Array<{ typ: string; desc: string; antal: number; apris: number; enhet: string; belopp: number }>
}

const STATUS_COLOR: Record<string, string> = {
  utkast: '#888', skickad: '#4ade80', betald: '#60a5fa',
  krediterad: '#f87171', delkrediterad: '#fb923c', kreditnota: '#f87171',
}
const fmtKr = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 0 }) + ' kr'
const fmtDatum = (d: string) => new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })

export default function FakturorTab({ orderId }: { orderId: string }) {
  const [fakturor, setFakturor] = useState<Faktura[]>([])
  const [vald, setVald] = useState<Faktura | null>(null)
  const [kreditModal, setKreditModal] = useState<Faktura | null>(null)
  const [kreditBelopp, setKreditBelopp] = useState('')
  const [kreditMode, setKreditMode] = useState<'belopp' | 'rader'>('belopp')
  const [valdaRader, setValdaRader] = useState<Record<number, boolean>>({})
  const [sparar, setSparar] = useState(false)

  const fetchFakturor = async () => {
    const { data } = await createClient().from('fakturor').select('*').eq('order_id', orderId).order('created_at')
    setFakturor(data || [])
  }

  useEffect(() => { fetchFakturor() }, [orderId])

  const uppdateraStatus = async (id: string, status: string) => {
    await createClient().from('fakturor').update({ status }).eq('id', id)
    fetchFakturor()
  }

  const kreditera = async () => {
    if (!kreditModal) return
    setSparar(true)
    const sb = createClient()

    let kreditRader: Faktura['rader'] = []
    let kreditTotalt = 0

    if (kreditMode === 'belopp') {
      const tot = parseFloat(kreditBelopp) || 0
      const netto = tot / 1.25
      kreditRader = [{ typ: 'rad', desc: 'Kreditering', antal: 1, apris: -netto, enhet: 'st', belopp: -netto }]
      kreditTotalt = -tot
    } else {
      const rader = kreditModal.rader.filter((_, i) => valdaRader[i])
      kreditRader = rader.map(r => ({ ...r, apris: -r.apris, belopp: -r.belopp }))
      kreditTotalt = -(kreditRader.reduce((s, r) => s + Math.abs(r.belopp), 0) * 1.25)
    }

    const isFullKredit = Math.abs(kreditTotalt) >= kreditModal.totalt * 0.99

    // Skapa kreditnota
    await sb.from('fakturor').insert({
      fakturanummer: `${kreditModal.fakturanummer}-K`,
      order_id: orderId,
      typ: 'kreditnota',
      status: 'kreditnota',
      rader: kreditRader,
      subtotal: kreditTotalt / 1.25,
      moms_belopp: kreditTotalt - kreditTotalt / 1.25,
      totalt: kreditTotalt,
      kund_namn: kreditModal.kund_namn,
      original_faktura_id: kreditModal.id,
    })

    // Uppdatera original
    await sb.from('fakturor').update({ status: isFullKredit ? 'krediterad' : 'delkrediterad' }).eq('id', kreditModal.id)

    setKreditModal(null); setSparar(false); setKreditBelopp(''); setValdaRader({})
    fetchFakturor()
  }

  if (fakturor.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#444' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🧾</div>
        <div style={{ fontSize: 13 }}>Inga fakturor skapade ännu</div>
        <div style={{ fontSize: 11, marginTop: 6, color: '#333' }}>Fakturor som skapas via "Tid & Fakturering" sparas här</div>
      </div>
    )
  }

  return (
    <div>
      {fakturor.map(f => {
        const color = STATUS_COLOR[f.status] || '#888'
        const erKreditnota = f.typ === 'kreditnota'
        return (
          <div key={f.id} style={{ background: '#141414', border: `1px solid ${color}22`, borderRadius: 10, padding: '14px 18px', marginBottom: 10, cursor: 'pointer' }}
            onClick={() => setVald(f)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#E8C96A' }}>{f.fakturanummer}</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>{fmtDatum(f.fakturadatum)} · {f.rader.filter(r => r.typ === 'rad').length} rader</div>
                {f.kund_namn && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{f.kund_namn}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: erKreditnota ? '#f87171' : '#e0e0e0', textDecoration: ['krediterad'].includes(f.status) ? 'line-through' : 'none' }}>
                  {erKreditnota ? '−' : ''}{fmtKr(Math.abs(f.totalt))}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: color + '22', color, border: `1px solid ${color}44`, marginTop: 4, display: 'inline-block' }}>
                  {f.status.toUpperCase()}
                </span>
              </div>
            </div>

            {!erKreditnota && !['krediterad', 'kreditnota'].includes(f.status) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                {f.status !== 'skickad' && (
                  <button onClick={() => uppdateraStatus(f.id, 'skickad')} style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 6, border: '1px solid #4ade8044', background: '#4ade8011', color: '#4ade80', cursor: 'pointer' }}>
                    Markera skickad
                  </button>
                )}
                {f.status !== 'betald' && (
                  <button onClick={() => uppdateraStatus(f.id, 'betald')} style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 6, border: '1px solid #60a5fa44', background: '#60a5fa11', color: '#60a5fa', cursor: 'pointer' }}>
                    Markera betald
                  </button>
                )}
                <button onClick={() => { setKreditModal(f); setValdaRader({}) }} style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 6, border: '1px solid #f8717144', background: '#f8717111', color: '#f87171', cursor: 'pointer' }}>
                  Kreditera
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Fakturadetaljmodal */}
      {vald && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setVald(null)}>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#E8C96A' }}>{vald.fakturanummer}</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{fmtDatum(vald.fakturadatum)}</div>
              </div>
              <button onClick={() => setVald(null)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              {vald.kund_namn && <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Fakturerad till: <strong style={{ color: '#d0d0d0' }}>{vald.kund_namn}</strong></div>}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: 10, color: '#555', padding: '4px 0', fontWeight: 700, letterSpacing: 1 }}>BESKRIVNING</th>
                    <th style={{ textAlign: 'right', fontSize: 10, color: '#555', padding: '4px 0', fontWeight: 700 }}>ANTAL</th>
                    <th style={{ textAlign: 'right', fontSize: 10, color: '#555', padding: '4px 0', fontWeight: 700 }}>À-PRIS</th>
                    <th style={{ textAlign: 'right', fontSize: 10, color: '#555', padding: '4px 0', fontWeight: 700 }}>BELOPP</th>
                  </tr>
                </thead>
                <tbody>
                  {vald.rader.filter(r => r.typ === 'rad').map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #1e1e1e' }}>
                      <td style={{ fontSize: 12, color: '#d0d0d0', padding: '8px 0' }}>{r.desc}</td>
                      <td style={{ fontSize: 12, color: '#888', padding: '8px 0', textAlign: 'right' }}>{r.antal} {r.enhet}</td>
                      <td style={{ fontSize: 12, color: '#888', padding: '8px 0', textAlign: 'right' }}>{fmtKr(r.apris)}</td>
                      <td style={{ fontSize: 12, color: '#d0d0d0', fontWeight: 600, padding: '8px 0', textAlign: 'right' }}>{fmtKr(r.belopp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#555' }}>Netto</span>
                  <span style={{ fontSize: 12, color: '#888' }}>{fmtKr(vald.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#555' }}>Moms 25%</span>
                  <span style={{ fontSize: 12, color: '#888' }}>{fmtKr(vald.moms_belopp)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#d0d0d0' }}>Totalt</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#E8C96A' }}>{fmtKr(vald.totalt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Kreditmodal */}
      {kreditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setKreditModal(null)}>
          <div style={{ background: '#1a1a1a', border: '1px solid #f8717133', borderRadius: 14, width: '100%', maxWidth: 480 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #222' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f87171' }}>Kreditera {kreditModal.fakturanummer}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Original: {fmtKr(kreditModal.totalt)}</div>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => setKreditMode('belopp')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${kreditMode === 'belopp' ? '#f87171' : '#2a2a2a'}`, background: kreditMode === 'belopp' ? '#f8717111' : '#111', color: kreditMode === 'belopp' ? '#f87171' : '#666', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  ✏️ Manuellt belopp
                </button>
                <button onClick={() => setKreditMode('rader')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${kreditMode === 'rader' ? '#f87171' : '#2a2a2a'}`, background: kreditMode === 'rader' ? '#f8717111' : '#111', color: kreditMode === 'rader' ? '#f87171' : '#666', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  📋 Välj rader
                </button>
              </div>

              {kreditMode === 'belopp' ? (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>KREDITBELOPP INKL. MOMS</label>
                  <input type="number" value={kreditBelopp} onChange={e => setKreditBelopp(e.target.value)}
                    placeholder={`Max ${kreditModal.totalt}`}
                    style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' as const }}
                    onFocus={e => e.currentTarget.style.borderColor = '#f87171'}
                    onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'} />
                </div>
              ) : (
                <div>
                  {kreditModal.rader.filter(r => r.typ === 'rad').map((r, i) => (
                    <label key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e1e1e', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!valdaRader[i]} onChange={e => setValdaRader(prev => ({ ...prev, [i]: e.target.checked }))} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#d0d0d0' }}>{r.desc}</div>
                        <div style={{ fontSize: 11, color: '#555' }}>{r.antal} {r.enhet} × {fmtKr(r.apris)}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: valdaRader[i] ? '#f87171' : '#555' }}>−{fmtKr(Math.abs(r.belopp) * 1.25)}</div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', gap: 8 }}>
              <button onClick={() => setKreditModal(null)} style={{ flex: 1, padding: '9px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>Avbryt</button>
              <button onClick={kreditera} disabled={sparar} style={{ flex: 1, padding: '9px', background: '#f8717111', border: '1px solid #f8717133', borderRadius: 8, color: '#f87171', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {sparar ? 'Skapar...' : 'Skapa kreditnota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
