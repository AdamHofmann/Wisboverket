'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { Customer } from '@/types'
import AdressInput from '@/components/AdressInput'
import Sokfalt from '@/components/Sokfalt'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 800, color: '#E8C96A' },
  newBtn: { background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' },
  td: { padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0', verticalAlign: 'middle' as const },
}

const LEVERANSSATT_LABEL: Record<string, string> = { brev: 'Brev', epost: 'E-post', peppol: 'E-faktura (Peppol)' }

function SynkBadge({ synkad }: { synkad: boolean }) {
  const c = synkad ? '#4ade80' : '#666'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: c + '1a', color: c, border: `1px solid ${c}44` }}>
      {synkad ? 'Synkad' : 'Ej synkad'}
    </span>
  )
}

export default function KunderPage() {
  const isMobile = useIsMobile()
  const [kunder, setKunder] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [vald, setVald] = useState<Customer | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editKund, setEditKund] = useState<Customer | null>(null)

  const fetchKunder = async () => {
    const { data } = await createClient().from('customers').select('*').order('namn')
    setKunder(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchKunder() }, [])

  const filtered = useMemo(() => kunder.filter(k => {
    if (!search) return true
    const q = search.toLowerCase()
    return k.namn.toLowerCase().includes(q) ||
      k.epost?.toLowerCase().includes(q) ||
      k.telefon?.includes(q) ||
      k.orgnummer?.includes(q) || false
  }), [kunder, search])

  return (
    <div style={isMobile ? { overflowX: 'hidden' as const } : undefined}>
      <div style={isMobile ? { ...S.header, flexDirection: 'column', alignItems: 'stretch', gap: 12 } : S.header}>
        <div style={S.title}>Kunder <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({filtered.length})</span></div>
        <button style={isMobile ? { ...S.newBtn, width: '100%', padding: '12px 18px' } : S.newBtn} onClick={() => { setEditKund(null); setShowModal(true) }}>+ Ny kund</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Sokfalt value={search} onChange={setSearch} placeholder="Sök namn, e-post, org.nr..."
          style={{ width: isMobile ? '100%' : 280 }} />
      </div>

      <div style={isMobile
        ? (loading || filtered.length === 0 ? { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' } : {})
        : { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            {kunder.length === 0 ? 'Inga kunder ännu — lägg till din första kund' : 'Inga träffar'}
          </div>
        ) : isMobile ? (
          <div>
            {filtered.map(k => (
              <div key={k.id}
                style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer' }}
                onClick={() => setVald(k)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#e0e0e0', fontSize: 14, wordBreak: 'break-word' as const }}>{k.namn}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#2a2a2a', color: '#888' }}>{k.typ}</span>
                      {k.kundnummer && <span style={{ fontSize: 11, color: '#E8C96A', fontWeight: 700 }}>#{k.kundnummer}</span>}
                      {k.orgnummer && <span style={{ fontSize: 11, color: '#555' }}>{k.orgnummer}</span>}
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setEditKund(k); setShowModal(true) }}
                    style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 10px', color: '#888', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                    Redigera
                  </button>
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 11, color: '#555' }}>Telefon</span>
                    <span style={{ fontSize: 12, textAlign: 'right' as const, minWidth: 0, wordBreak: 'break-word' as const }}>
                      {k.telefon
                        ? <a href={`tel:${k.telefon}`} style={{ color: '#60a5fa', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{k.telefon}</a>
                        : <span style={{ color: '#333' }}>—</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 11, color: '#555' }}>E-post</span>
                    <span style={{ fontSize: 12, textAlign: 'right' as const, minWidth: 0, wordBreak: 'break-word' as const }}>
                      {k.epost
                        ? <a href={`mailto:${k.epost}`} style={{ color: '#60a5fa', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{k.epost}</a>
                        : <span style={{ color: '#333' }}>—</span>}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 11, color: '#555' }}>Ort</span>
                    <span style={{ fontSize: 12, color: '#d0d0d0', textAlign: 'right' as const }}>{k.ort || <span style={{ color: '#333' }}>—</span>}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 11, color: '#555' }}>Betalvillkor</span>
                    <span style={{ fontSize: 12, color: '#d0d0d0', textAlign: 'right' as const }}>{k.betalvillkor ? `${k.betalvillkor} dagar` : '30 dagar'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>NAMN</th>
                <th style={S.th}>TYP</th>
                <th style={S.th}>TELEFON</th>
                <th style={S.th}>E-POST</th>
                <th style={S.th}>ORT</th>
                <th style={S.th}>BETALVILLKOR</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(k => (
                <tr key={k.id} style={{ cursor: 'pointer' }}
                  onClick={() => setVald(k)}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#e0e0e0' }}>{k.namn}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      {k.kundnummer && <span style={{ fontSize: 11, color: '#E8C96A', fontWeight: 700 }}>#{k.kundnummer}</span>}
                      {k.orgnummer && <span style={{ fontSize: 11, color: '#555' }}>{k.orgnummer}</span>}
                    </div>
                  </td>
                  <td style={S.td}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#2a2a2a', color: '#888' }}>{k.typ}</span>
                  </td>
                  <td style={S.td}>
                    {k.telefon
                      ? <a href={`tel:${k.telefon}`} style={{ color: '#60a5fa', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{k.telefon}</a>
                      : <span style={{ color: '#333' }}>—</span>}
                  </td>
                  <td style={S.td}>
                    {k.epost
                      ? <a href={`mailto:${k.epost}`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 12 }} onClick={e => e.stopPropagation()}>{k.epost}</a>
                      : <span style={{ color: '#333' }}>—</span>}
                  </td>
                  <td style={S.td}>{k.ort || <span style={{ color: '#333' }}>—</span>}</td>
                  <td style={S.td}>{k.betalvillkor ? `${k.betalvillkor} dagar` : '30 dagar'}</td>
                  <td style={S.td}>
                    <button onClick={e => { e.stopPropagation(); setEditKund(k); setShowModal(true) }}
                      style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 10px', color: '#888', fontSize: 11, cursor: 'pointer' }}>
                      Redigera
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {vald && (
        <KundDetailModal kund={vald} onClose={() => setVald(null)}
          onEdit={() => { setEditKund(vald); setVald(null); setShowModal(true) }} />
      )}
      {showModal && (
        <KundModal kund={editKund} onClose={() => setShowModal(false)}
          onSaved={() => { fetchKunder(); setShowModal(false) }} />
      )}
    </div>
  )
}

type Prisavtal = { id: string; artikel_id: string; avtalspris: number; artikel?: { namn: string; enhet: string; a_pris: number; kostnad_per_enhet: number } }
type ArtikelOpt = { id: string; namn: string; enhet: string; a_pris: number }

function KundDetailModal({ kund, onClose, onEdit }: { kund: Customer; onClose: () => void; onEdit: () => void }) {
  const isMobile = useIsMobile()
  const toast = useToast()
  const [ordrar, setOrdrar] = useState<any[]>([])
  const [prisavtal, setPrisavtal] = useState<Prisavtal[]>([])
  const [artiklar, setArtiklar] = useState<ArtikelOpt[]>([])
  const [nyAvtalArt, setNyAvtalArt] = useState('')
  const [nyAvtalPris, setNyAvtalPris] = useState('')
  const [hogiaSynkar, setHogiaSynkar] = useState(false)
  const [hogiaFel, setHogiaFel] = useState('')

  const synkaHogia = async () => {
    setHogiaSynkar(true); setHogiaFel('')
    try {
      const res = await fetch('/api/hogia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ typ: 'kund', id: kund.id }) })
      const data = await res.json()
      if (!res.ok || !data.ok) setHogiaFel(data.error || 'Synk misslyckades')
    } catch {
      setHogiaFel('Kunde inte nå synk-tjänsten')
    } finally {
      setHogiaSynkar(false)
    }
  }
  const STATUS_COLOR: Record<string, string> = { aktiv: '#4ade80', slutförd: '#60a5fa', inaktiv: '#555' }

  const fetchPrisavtal = () => {
    createClient().from('kund_prisavtal').select('id,artikel_id,avtalspris,artikel:artiklar(namn,enhet,a_pris,kostnad_per_enhet)').eq('customer_id', kund.id)
      .then(({ data }) => setPrisavtal((data as any) || []))
  }

  useEffect(() => {
    createClient().from('orders').select('id,titel,status,bokad_datum').eq('customer_id', kund.id)
      .order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => setOrdrar(data || []))
    createClient().from('artiklar').select('id,namn,enhet,a_pris').eq('aktiv', true).order('namn')
      .then(({ data }) => setArtiklar(data || []))
    fetchPrisavtal()
  }, [kund.id])

  const laggTillAvtal = async () => {
    if (!nyAvtalArt || !nyAvtalPris) return
    const { error: err } = await createClient().from('kund_prisavtal').upsert(
      { customer_id: kund.id, artikel_id: nyAvtalArt, avtalspris: parseFloat(nyAvtalPris) || 0 },
      { onConflict: 'customer_id,artikel_id' }
    )
    if (err) { toast.error('Kunde inte spara prisavtalet: ' + err.message); return }
    setNyAvtalArt(''); setNyAvtalPris('')
    fetchPrisavtal()
  }

  const taBortAvtal = async (id: string) => {
    const { error } = await createClient().from('kund_prisavtal').delete().eq('id', id)
    if (error) { toast.error('Kunde inte ta bort prisavtalet: ' + error.message); return }
    fetchPrisavtal()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: isMobile ? 0 : 14, width: '100%', maxWidth: isMobile ? '100vw' : 580, maxHeight: isMobile ? '100vh' : '85vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#E8C96A' }}>{kund.namn}</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
              {kund.kundnummer ? `Kundnr #${kund.kundnummer} · ` : ''}
              {kund.typ === 'företag' ? `Företag${kund.orgnummer ? ` · ${kund.orgnummer}` : ''}` : 'Privatkund'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEdit} style={{ background: '#E8C96A', border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Redigera</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
        </div>

        <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 10 }}>KONTAKT</div>
            {kund.telefon && <KVRow label="Telefon"><a href={`tel:${kund.telefon}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>{kund.telefon}</a></KVRow>}
            {kund.epost && <KVRow label="E-post"><a href={`mailto:${kund.epost}`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 12 }}>{kund.epost}</a></KVRow>}
            {kund.fakturamail && <KVRow label="Fakturamail">{kund.fakturamail}</KVRow>}
            {!kund.telefon && !kund.epost && <div style={{ fontSize: 12, color: '#444' }}>Ingen kontaktinfo</div>}
          </div>

          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 10 }}>ADRESS & FAKTURERING</div>
            {kund.adress && <KVRow label="Adress">{kund.adress}</KVRow>}
            {kund.postnummer && <KVRow label="Postnr">{kund.postnummer} {kund.ort}</KVRow>}
            <KVRow label="Betalvillkor">{kund.betalvillkor || 30} dagar</KVRow>
            <KVRow label="Leveranssätt">{LEVERANSSATT_LABEL[kund.leveranssatt || 'epost']}</KVRow>
            {kund.leveranssatt === 'peppol' && kund.peppol_id && <KVRow label="Peppol-ID">{kund.peppol_id}</KVRow>}
          </div>

          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 14px', gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555' }}>HOGIA</span>
              <SynkBadge synkad={!!kund.hogia_synkad_at} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {hogiaFel && <span style={{ fontSize: 11, color: '#fb923c' }}>{hogiaFel}</span>}
              <button onClick={synkaHogia} disabled={hogiaSynkar}
                style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 10px', color: '#888', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const, opacity: hogiaSynkar ? 0.6 : 1 }}>
                {hogiaSynkar ? '...' : '🔗 Synka med Hogia'}
              </button>
            </div>
          </div>

          {kund.anteckningar && (
            <div style={{ background: '#111', border: '1px solid #2a2200', borderRadius: 8, padding: '12px 14px', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#E8C96A88', marginBottom: 8 }}>ANTECKNINGAR</div>
              <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>{kund.anteckningar}</div>
            </div>
          )}
        </div>

        <div style={{ padding: '0 22px 22px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 10 }}>PRISAVTAL</div>
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 14px' }}>
            {prisavtal.length === 0 ? (
              <div style={{ fontSize: 12, color: '#444', marginBottom: 10 }}>Inga prisavtal — standardpris används</div>
            ) : prisavtal.map(p => {
              const kostnad = p.artikel?.kostnad_per_enhet || 0
              const tbProc = p.avtalspris > 0 ? ((p.avtalspris - kostnad) / p.avtalspris) * 100 : 0
              const tbFarg = tbProc >= 30 ? '#4ade80' : tbProc >= 15 ? '#fb923c' : '#f87171'
              return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' as const, padding: '5px 0', borderBottom: '1px solid #1a1a1a' }}>
                <div style={{ fontSize: 12, color: '#d0d0d0', minWidth: 0, wordBreak: 'break-word' as const }}>
                  {p.artikel?.namn} <span style={{ color: '#444' }}>({p.artikel?.a_pris} kr std · kostn {kostnad} kr)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span title={`Avtalspris ${p.avtalspris} kr vs kostnad ${kostnad} kr`}
                    style={{ fontSize: 11, fontWeight: 700, color: tbFarg, background: tbFarg + '1a', border: `1px solid ${tbFarg}44`, borderRadius: 6, padding: '2px 7px' }}>
                    TB {tbProc.toFixed(0)}%
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#E8C96A' }}>{p.avtalspris} kr/{p.artikel?.enhet}</span>
                  <button onClick={() => taBortAvtal(p.id)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              </div>
              )
            })}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: isMobile ? 'wrap' as const : undefined }}>
              <select value={nyAvtalArt} onChange={e => setNyAvtalArt(e.target.value)}
                style={{ flex: isMobile ? '1 1 100%' : 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 8px', color: '#e0e0e0', fontSize: 12, minWidth: 0 }}>
                <option value="">Välj artikel...</option>
                {artiklar.map(a => <option key={a.id} value={a.id}>{a.namn} ({a.a_pris} kr)</option>)}
              </select>
              <input spellCheck={false} type="number" placeholder="Avtalspris" value={nyAvtalPris} onChange={e => setNyAvtalPris(e.target.value)}
                style={{ flex: isMobile ? 1 : undefined, width: isMobile ? undefined : 90, minWidth: 0, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 8px', color: '#e0e0e0', fontSize: 12, boxSizing: 'border-box' as const }} />
              <button onClick={laggTillAvtal} style={{ background: '#E8C96A', border: 'none', borderRadius: 6, padding: '6px 14px', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>+ Lägg till</button>
            </div>
          </div>
        </div>

        {ordrar.length > 0 && (
          <div style={{ padding: '0 22px 22px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 10 }}>SENASTE ORDRAR</div>
            {ordrar.map(o => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                <div style={{ fontSize: 13, color: '#d0d0d0' }}>{o.titel}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: (STATUS_COLOR[o.status] || '#555') + '22', color: STATUS_COLOR[o.status] || '#555' }}>{o.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KVRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: '#555' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#d0d0d0', textAlign: 'right' as const, maxWidth: '60%' }}>{children}</span>
    </div>
  )
}

const EMPTY_FORM: Partial<Customer> = { namn: '', typ: 'företag', telefon: '', epost: '', fakturamail: '', orgnummer: '', adress: '', postnummer: '', ort: '', betalvillkor: 30, anteckningar: '', leveranssatt: 'epost', peppol_id: '' }

function KundModal({ kund, onClose, onSaved }: { kund: Customer | null; onClose: () => void; onSaved: () => void }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState<Partial<Customer>>(kund ? { ...kund } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [slarUppNamn, setSlarUppNamn] = useState(false)
  const [traffar, setTraffar] = useState<Array<{ namn: string; orgnummer: string; adress: string; postnummer: string; ort: string; aktiv: boolean }> | null>(null)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const slaUppNamn = async () => {
    const namn = (form.namn || '').trim()
    if (namn.length < 2) { setError('Skriv in minst 2 tecken av företagsnamnet'); return }
    setSlarUppNamn(true); setError(''); setTraffar(null)
    try {
      const res = await fetch(`/api/lookup-company?name=${encodeURIComponent(namn)}`)
      const data = await res.json()
      if (res.status === 404) { setTraffar([]); return } // inga träffar → visas i dropdownen vid fältet
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : (data.error?.message || 'Kunde inte söka på företagsnamn')
        setError(msg); return
      }
      setTraffar(data.companies || [])
    } catch {
      setError('Kunde inte nå uppslagstjänsten')
    } finally {
      setSlarUppNamn(false)
    }
  }

  const valjTraff = (c: { namn: string; orgnummer: string; adress: string; postnummer: string; ort: string }) => {
    setForm(f => ({ ...f, namn: c.namn || f.namn, orgnummer: c.orgnummer || f.orgnummer, adress: c.adress || f.adress, postnummer: c.postnummer || f.postnummer, ort: c.ort || f.ort }))
    setTraffar(null)
  }

  const spara = async () => {
    if (!form.namn?.trim()) { setError('Namn krävs'); return }
    setSaving(true); setError('')
    const sb = createClient()
    const payload = { ...form }
    delete (payload as any).id
    delete (payload as any).created_at
    const { error: err } = kund
      ? await sb.from('customers').update(payload).eq('id', kund.id)
      : await sb.from('customers').insert(payload)
    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#E8C96A' }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#2a2a2a' }
  const inp = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: isMobile ? 0 : 14, width: '100%', maxWidth: isMobile ? '100vw' : 540, maxHeight: isMobile ? '100vh' : '90vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{kund ? 'Redigera kund' : 'Ny kund'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <MF label="TYP">
              <select style={inp} value={form.typ} onChange={e => set('typ', e.target.value)} onFocus={fo} onBlur={fb}>
                <option value="företag">Företag</option>
                <option value="privat">Privat</option>
              </select>
            </MF>
            <MF label="ORG.NUMMER">
              <input spellCheck={false} style={inp} value={form.orgnummer || ''} onChange={e => set('orgnummer', e.target.value)} placeholder="556123-4567" onFocus={fo} onBlur={fb} />
            </MF>
          </div>

          <MF label="NAMN *">
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input spellCheck={false} style={{ ...inp, flex: 1 }} value={form.namn || ''} onChange={e => set('namn', e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); slaUppNamn() } }}
                  placeholder="Namn" onFocus={fo} onBlur={fb} />
                <button onClick={slaUppNamn} disabled={slarUppNamn} type="button"
                  style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '0 12px', color: '#E8C96A', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' as const, opacity: slarUppNamn ? 0.6 : 1 }}>
                  {slarUppNamn ? '...' : '🔍 Slå upp'}
                </button>
              </div>
              {traffar !== null && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, maxHeight: 240, overflow: 'auto', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                  {traffar.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: '#888' }}>Inga träffar hittades</div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #222' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{traffar.length} träff{traffar.length === 1 ? '' : 'ar'} — välj ett företag</span>
                        <button onClick={() => setTraffar(null)} type="button" style={{ background: 'none', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
                      </div>
                      {traffar.map((c, i) => (
                        <button key={i} onClick={() => valjTraff(c)} type="button"
                          style={{ display: 'block', width: '100%', textAlign: 'left' as const, background: 'none', border: 'none', borderBottom: i < traffar.length - 1 ? '1px solid #1e1e1e' : 'none', padding: '9px 12px', cursor: 'pointer', color: '#e0e0e0' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>{c.namn}{!c.aktiv && <span style={{ fontSize: 10, color: '#f87171', marginLeft: 6 }}>avregistrerat</span>}</div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{[c.orgnummer, c.ort].filter(Boolean).join(' · ')}</div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </MF>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <MF label="TELEFON">
              <input spellCheck={false} style={inp} value={form.telefon || ''} onChange={e => set('telefon', e.target.value)} placeholder="07X-XXX XX XX" onFocus={fo} onBlur={fb} />
            </MF>
            <MF label="E-POST">
              <input spellCheck={false} style={inp} value={form.epost || ''} onChange={e => set('epost', e.target.value)} placeholder="kontakt@ex.se" onFocus={fo} onBlur={fb} />
            </MF>
          </div>

          <MF label="FAKTURAMAIL (om annan)">
            <input spellCheck={false} style={inp} value={form.fakturamail || ''} onChange={e => set('fakturamail', e.target.value)} placeholder="faktura@ex.se" onFocus={fo} onBlur={fb} />
          </MF>

          <MF label="ADRESS">
            <AdressInput
              value={form.adress || ''}
              onChange={v => set('adress', v)}
              onPick={(adress, postnummer, ort) => setForm(f => ({ ...f, adress, postnummer: postnummer || f.postnummer, ort: ort || f.ort }))}
              style={inp}
              placeholder="Gatuadress"
              onFocus={fo}
              onBlur={fb}
            />
          </MF>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <MF label="POSTNUMMER">
              <input spellCheck={false} style={inp} value={form.postnummer || ''} onChange={e => set('postnummer', e.target.value)} placeholder="611 34" onFocus={fo} onBlur={fb} />
            </MF>
            <MF label="ORT">
              <input spellCheck={false} style={inp} value={form.ort || ''} onChange={e => set('ort', e.target.value)} placeholder="Nyköping" onFocus={fo} onBlur={fb} />
            </MF>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <MF label="BETALVILLKOR">
              <select style={inp} value={form.betalvillkor || 30} onChange={e => set('betalvillkor', parseInt(e.target.value))} onFocus={fo} onBlur={fb}>
                {[10, 20, 30, 45, 60].map(d => <option key={d} value={d}>{d} dagar</option>)}
              </select>
            </MF>
            <MF label="LEVERANSSÄTT (FAKTURA)">
              <select style={inp} value={form.leveranssatt || 'epost'} onChange={e => set('leveranssatt', e.target.value)} onFocus={fo} onBlur={fb}>
                <option value="brev">Brev</option>
                <option value="epost">E-post</option>
                <option value="peppol">E-faktura (Peppol)</option>
              </select>
            </MF>
          </div>

          {form.leveranssatt === 'peppol' && (
            <MF label="PEPPOL-ID">
              <input spellCheck={false} style={inp} value={form.peppol_id || ''} onChange={e => set('peppol_id', e.target.value)} placeholder="0007:5561234567" onFocus={fo} onBlur={fb} />
            </MF>
          )}

          <MF label="ANTECKNINGAR">
            <textarea spellCheck={true} style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} value={form.anteckningar || ''} onChange={e => set('anteckningar', e.target.value)} placeholder="Interna anteckningar..." onFocus={fo} onBlur={fb} />
          </MF>

          {error && <div style={{ fontSize: 12, color: '#f87171', background: '#f8717111', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>Avbryt</button>
          <button onClick={spara} disabled={saving} style={{ padding: '9px 24px', background: '#E8C96A', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Sparar...' : kund ? 'Spara' : 'Lägg till'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{label}</label>
      {children}
    </div>
  )
}
