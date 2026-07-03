'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtKr, fmtDatum } from './shared'

type Faktura = {
  id: string; fakturanummer: string; typ: string; status: string
  fakturadatum: string; totalt: number; subtotal: number; moms_belopp: number
  kund_namn: string | null; kund_epost: string | null; referens: string | null; original_faktura_id: string | null
  rader: Array<{ typ: string; desc: string; antal: number; apris: number; enhet: string; belopp: number }>
}

const STATUS_COLOR: Record<string, string> = {
  utkast: '#888', skickad: '#4ade80', betald: '#60a5fa',
  krediterad: '#f87171', delkrediterad: '#fb923c', kreditnota: '#f87171',
}
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

      {/* Fakturavy — fullskärm overlay */}
      {vald && <FakturaVy faktura={vald} onClose={() => setVald(null)} />}

      {/* Kreditmodal (efter FakturaVy) */}
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

// ─── Faktura PDF-liknande vy ────────────────────────────────────────────────
export type { Faktura }
export function FakturaVy({ faktura: f, onClose }: { faktura: Faktura; onClose: () => void }) {
  const [emailSent, setEmailSent] = useState(false)

  const hogiaSync = () => {
    // TODO: POST till /api/hogia/faktura när integrationen är klar
    alert('Hogia-integration kommer i nästa fas. Fakturanummer: ' + f.fakturanummer)
  }

  const print = () => window.print()

  const skickaMedPDF = () => {
    print()
    const sub = `Faktura ${f.fakturanummer}${f.kund_namn ? ' – ' + f.kund_namn : ''}`
    const body = `Hej ${f.kund_namn || ''},

Tack för att ni anlitar Wisboverket AB!

Vänligen se bifogad faktura (${f.fakturanummer}).

Att betala: ${Math.abs(f.totalt).toLocaleString('sv-SE')} kr
Förfallodatum: ${new Date(new Date(f.fakturadatum).getTime() + 30 * 86400000).toLocaleDateString('sv-SE')}

Hör gärna av er om ni har frågor.

Med vänliga hälsningar,
Wisboverket AB
info@wisboverket.se
070-554 09 24`
    setTimeout(() => {
      window.open(`mailto:${f.kund_epost || ''}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`, '_blank')
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 5000)
    }, 400)
  }

  const rader = f.rader.filter(r => r.typ === 'rad')
  const forfallo = f.fakturadatum
    ? new Date(new Date(f.fakturadatum).getTime() + 30 * 86400000).toLocaleDateString('sv-SE')
    : '—'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      {/* Verktygsfält */}
      <div className="no-print" style={{ background: '#1c1c1e', borderBottom: '1px solid #2a2a2a', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8e8e93', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>←</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#f2f2f7' }}>{f.fakturanummer}</span>
        <span style={{ fontSize: 12, color: '#636366', marginLeft: 4 }}>{f.kund_namn || '—'}</span>
        <div style={{ flex: 1 }} />
        {emailSent && <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginRight: 4 }}>✓ PDF och e-postklient öppnade!</span>}
        <button onClick={hogiaSync}
          style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #4ade8044', background: '#4ade8011', color: '#4ade80', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          🔗 Synka med Hogia
        </button>
        <button onClick={print}
          style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #E8C96A44', background: '#E8C96A11', color: '#E8C96A', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          🖨 Skriv ut / PDF
        </button>
        <button onClick={skickaMedPDF}
          style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #60a5fa44', background: '#60a5fa11', color: '#60a5fa', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          📧 Skicka med PDF
        </button>
      </div>

      {/* Fakturadokument */}
      <div style={{ flex: 1, overflow: 'auto', padding: '30px 20px', display: 'flex', justifyContent: 'center' }}>
        <div id="faktura-print" style={{ background: '#fff', color: '#111', width: 794, minHeight: 1123, borderRadius: 4, padding: '60px 64px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 48 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: '#1a1a1a' }}>WISBOVERKET</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#888', marginTop: 1 }}>FASTIGHETER & FÖRVALTNING</div>
              <div style={{ width: 40, height: 2, background: '#E8C96A', marginTop: 6, marginBottom: 10 }} />
              <div style={{ fontSize: 11, color: '#666' }}>Hofmanns AB</div>
              <div style={{ fontSize: 11, color: '#666' }}>Org.nr: 559XXX-XXXX</div>
              <div style={{ fontSize: 11, color: '#666' }}>info@hofmannsab.se</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: f.typ === 'kreditnota' ? '#dc2626' : '#1a1a1a', letterSpacing: -1 }}>
                {f.typ === 'kreditnota' ? 'KREDITNOTA' : 'FAKTURA'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#555', marginTop: 2 }}>{f.fakturanummer}</div>
            </div>
          </div>

          {/* Kund + datum */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 40 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#999', marginBottom: 8 }}>FAKTURERAS TILL</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#000' }}>{f.kund_namn || '—'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#999', marginBottom: 4 }}>FAKTURADATUM</div>
                  <div style={{ fontSize: 13 }}>{fmtDatum(f.fakturadatum)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#999', marginBottom: 4 }}>FÖRFALLODATUM</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{forfallo}</div>
                </div>
              </div>
              {f.referens && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#999', marginBottom: 4 }}>ER REFERENS</div>
                  <div style={{ fontSize: 13 }}>{f.referens}</div>
                </div>
              )}
            </div>
          </div>

          {/* Separator */}
          <div style={{ height: 2, background: '#000', marginBottom: 0 }} />

          {/* Tabell-header */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 80px 90px 90px', gap: 8, padding: '8px 0', borderBottom: '1px solid #e5e5e5' }}>
            {['BESKRIVNING', 'ANTAL', 'À-PRIS', 'BELOPP'].map((h, i) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#999', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>

          {/* Rader */}
          {rader.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 80px 90px 90px', gap: 8, padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{r.desc}</div>
              <div style={{ fontSize: 13, textAlign: 'right', color: '#555' }}>{r.antal} {r.enhet}</div>
              <div style={{ fontSize: 13, textAlign: 'right', color: '#555' }}>{r.apris.toLocaleString('sv-SE')} kr</div>
              <div style={{ fontSize: 13, textAlign: 'right', fontWeight: 600 }}>{Math.abs(r.belopp).toLocaleString('sv-SE')} kr</div>
            </div>
          ))}

          {/* Summering */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ color: '#666' }}>Netto exkl. moms</span>
                <span>{Math.abs(f.subtotal).toLocaleString('sv-SE')} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
                <span style={{ color: '#666' }}>Moms 25%</span>
                <span>{Math.abs(f.moms_belopp).toLocaleString('sv-SE')} kr</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 6px', borderTop: '2px solid #000', marginTop: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 900 }}>ATT BETALA</span>
                <span style={{ fontSize: 16, fontWeight: 900 }}>{Math.abs(f.totalt).toLocaleString('sv-SE')} kr</span>
              </div>
            </div>
          </div>

          {/* Betalningsinformation */}
          <div style={{ marginTop: 60, padding: '20px 24px', background: '#f9f9f9', borderRadius: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#999', marginBottom: 6 }}>BANKGIRO</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>XXX-XXXX</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#999', marginBottom: 6 }}>BETALNINGSVILLKOR</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>30 dagar netto</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#999', marginBottom: 6 }}>DRÖJSMÅLSRÄNTA</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>8%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#faktura-print) { display: none !important; }
          .no-print { display: none !important; }
          #faktura-print { box-shadow: none !important; }
        }
      `}</style>
    </div>
  )
}
