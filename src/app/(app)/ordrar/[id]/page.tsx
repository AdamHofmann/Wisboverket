'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, Customer } from '@/types'
import SendModal from '@/components/SendModal'
import NyOrderModal from '@/components/NyOrderModal'
import TidFaktureringTab from '@/components/order-tabs/TidFaktureringTab'
import InkopTab from '@/components/order-tabs/InkopTab'
import EkonomiTab from '@/components/order-tabs/EkonomiTab'
import FakturorTab from '@/components/order-tabs/FakturorTab'
import BilderTab from '@/components/order-tabs/BilderTab'
import OffertTab from '@/components/order-tabs/OffertTab'
import { fmtKr, STATUS_LABEL, STATUS_COLOR, PRIO_LABEL, PRIO_COLOR, KAT_ICON } from '@/components/order-tabs/shared'

type Kommunikation = {
  id: string; typ: string; kanal: string | null; mottagare: string | null; meddelande: string; created_at: string
}

const TYP_ICON: Record<string, string> = { orderbekräftelse: '📩', åtgärdad: '✅', info: 'ℹ️', eget: '✏️', kopierat: '📋' }

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'offert', label: 'Offert' },
  { id: 'tid', label: 'Tid & Fakturering' },
  { id: 'inkop', label: 'Inköp' },
  { id: 'ekonomi', label: 'Statistik' },
  { id: 'fakturor', label: 'Fakturor' },
  { id: 'bilder', label: 'Bilder' },
  { id: 'utskick', label: 'Utskick' },
  { id: 'betyg', label: 'Betyg' },
]

const fmt = (d: string) => new Date(d).toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtTime = (d: string) => new Date(d).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order & { customer?: Customer } | null>(null)
  const [kommunikation, setKommunikation] = useState<Kommunikation[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [showSend, setShowSend] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [betyg, setBetyg] = useState(0)
  const [betygKommentar, setBetygKommentar] = useState('')
  const [sparaBetyg, setSparaBetyg] = useState(false)
  const [ekonomi, setEkonomi] = useState({ kostnad: 0, harData: false })

  const fetchAll = async () => {
    const sb = createClient()
    const [{ data: o }, { data: k }, { data: tid }, { data: inkop }] = await Promise.all([
      sb.from('orders').select('*, customer:customers(id,namn,telefon,epost,adress,postnummer,ort)').eq('id', id).single(),
      sb.from('order_kommunikation').select('*').eq('order_id', id).order('created_at', { ascending: false }),
      sb.from('order_tid_rader').select('total_kostnad').eq('order_id', id),
      sb.from('order_inkop').select('belopp').eq('order_id', id),
    ])
    setOrder(o)
    setKommunikation(k || [])
    if (o) { setBetyg(o.betyg || 0); setBetygKommentar(o.betyg_kommentar || '') }
    const tidKostnad = (tid || []).reduce((s, r) => s + (r.total_kostnad || 0), 0)
    const inkopBelopp = (inkop || []).reduce((s, i) => s + (i.belopp || 0), 0)
    setEkonomi({ kostnad: tidKostnad + inkopBelopp, harData: (tid?.length || 0) > 0 || (inkop?.length || 0) > 0 })
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [id])

  const updateStatus = async (status: string) => {
    await createClient().from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    fetchAll()
  }

  const sparaBetygFn = async () => {
    setSparaBetyg(true)
    await createClient().from('orders').update({ betyg, betyg_kommentar: betygKommentar }).eq('id', id)
    setSparaBetyg(false)
  }

  if (loading) return <div style={{ color: '#555', padding: 60, textAlign: 'center' }}>Laddar...</div>
  if (!order) return <div style={{ color: '#555', padding: 60, textAlign: 'center' }}>Order hittades inte</div>

  const statusColor = STATUS_COLOR[order.status] || '#888'
  const prioColor = PRIO_COLOR[order.prioritet || 'normal']
  const orderNr = order.order_number ? `#${String(order.order_number).padStart(4, '0')}` : `#${order.id.slice(0, 6).toUpperCase()}`

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', paddingBottom: 100 }}>

      {/* Tillbaka */}
      <button onClick={() => router.push('/ordrar')}
        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, padding: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        ← Alla ordrar
      </button>

      {/* Huvud-kort */}
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>

        {/* Toprad */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#E8C96A' }}>{orderNr}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: statusColor + '22', color: statusColor, border: `1px solid ${statusColor}44` }}>
              {STATUS_LABEL[order.status] || order.status}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: prioColor + '22', color: prioColor, border: `1px solid ${prioColor}44` }}>
              {PRIO_LABEL[order.prioritet || 'normal'] || order.prioritet}
            </span>
            {order.kategori && (
              <span style={{ fontSize: 11, color: '#666' }}>{KAT_ICON[order.kategori] || ''} {order.kategori}</span>
            )}
          </div>
          <button onClick={() => router.push('/ordrar')} style={{ background: 'none', border: 'none', color: '#444', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Titel & meta */}
        <div style={{ padding: '16px 20px 14px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#e8e8e8', marginBottom: 6 }}>{order.titel}</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {order.customer && (
              <span style={{ fontSize: 13, color: '#888', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11 }}>👤</span>{order.customer.namn}
              </span>
            )}
            {order.tilldelad?.length ? (
              <span style={{ fontSize: 13, color: '#888', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11 }}>🔧</span>{order.tilldelad.map(n => n.split(' ')[0]).join(', ')}
              </span>
            ) : null}
          </div>
        </div>

        {/* Status-bar */}
        <div style={{ margin: '0 20px 16px', background: statusColor + '18', border: `1px solid ${statusColor}33`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: statusColor }}>
          {STATUS_LABEL[order.status] || order.status}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderTop: '1px solid #1a1a1a', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '12px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none', whiteSpace: 'nowrap',
                color: tab === t.id ? '#E8C96A' : '#555',
                borderBottom: tab === t.id ? '2px solid #E8C96A' : '2px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab-innehåll */}
      <div>
        {tab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Ekonomi-summering */}
            {ekonomi.harData && (() => {
              const intakt = order.fakturerat_belopp || 0
              const tb = intakt - ekonomi.kostnad
              const tbColor = tb >= 0 ? '#4ade80' : '#f87171'
              return (
                <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#555', marginBottom: 4 }}>INTÄKT</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: order.fakturerat ? '#4ade80' : '#555' }}>{intakt > 0 ? fmtKr(intakt) : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#555', marginBottom: 4 }}>KOSTNAD</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#f87171' }}>{fmtKr(ekonomi.kostnad)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#555', marginBottom: 4 }}>TB</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: order.fakturerat ? tbColor : '#555' }}>{order.fakturerat ? fmtKr(tb) : '—'}</div>
                  </div>
                </div>
              )
            })()}

            {/* Bokning */}
            <InfoCard title="BOKNING">
              {order.bokad_datum ? (
                <>
                  <InfoRow icon="📅" value={`${fmt(order.bokad_datum)}${order.bokad_start ? ` kl ${order.bokad_start}` : ''}${order.bokad_slut ? `–${order.bokad_slut}` : ''}`} />
                  {order.tilldelad?.length ? <InfoRow icon="👤" value={order.tilldelad.join(', ')} /> : null}
                </>
              ) : <div style={{ fontSize: 13, color: '#444' }}>Ej planerad</div>}
            </InfoCard>

            {/* Beskrivning */}
            {order.beskrivning && (
              <InfoCard title="BESKRIVNING">
                <div style={{ fontSize: 13, color: '#b0b0b0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{order.beskrivning}</div>
              </InfoCard>
            )}

            {/* Adress — vart man ska åka */}
            {(order.fastighet || order.customer || order.lagenhet) && (
              <InfoCard title="ADRESS">
                {order.lagenhet && <div style={{ fontSize: 14, fontWeight: 700, color: '#d0d0d0', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}><span>🏢</span>{order.lagenhet}</div>}
                {order.fastighet && <div style={{ fontSize: 13, color: '#888' }}>{order.fastighet}</div>}
                {(order.postnummer || order.ort) && <div style={{ fontSize: 13, color: '#888' }}>{order.postnummer} {order.ort}</div>}
              </InfoCard>
            )}

            {/* Kontaktperson — vem man ska kontakta */}
            {(order.kontakt_namn || order.kontakt_telefon || order.kontakt_epost) && (
              <InfoCard title="KONTAKTPERSON">
                {order.kontakt_namn && <div style={{ fontSize: 14, fontWeight: 700, color: '#d0d0d0', marginBottom: 6 }}>{order.kontakt_namn}</div>}
                {order.kontakt_telefon && (
                  <InfoRow icon="📞" value={
                    <a href={`tel:${order.kontakt_telefon}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>{order.kontakt_telefon}</a>
                  } />
                )}
                {order.kontakt_epost && (
                  <InfoRow icon="✉️" value={
                    <a href={`mailto:${order.kontakt_epost}`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 12 }}>{order.kontakt_epost}</a>
                  } />
                )}
              </InfoCard>
            )}

            {/* Intern anteckning */}
            {order.intern_anteckning && (
              <div style={{ background: '#111', border: '1px solid #2a2200', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#E8C96A88', marginBottom: 8 }}>INTERN ANTECKNING</div>
                <div style={{ fontSize: 13, color: '#888', lineHeight: 1.7 }}>{order.intern_anteckning}</div>
              </div>
            )}

            <div style={{ fontSize: 11, color: '#2a2a2a', paddingTop: 4 }}>
              Skapad {fmt(order.created_at)} · Ändrad {fmt(order.updated_at)}
            </div>
          </div>
        )}

        {tab === 'utskick' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#555' }}>{kommunikation.length} utskick</div>
              <button onClick={() => setShowSend(true)} style={{ background: '#a78bfa11', border: '1px solid #a78bfa44', borderRadius: 8, padding: '7px 14px', color: '#a78bfa', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Nytt utskick</button>
            </div>
            {kommunikation.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#444' }}><div style={{ fontSize: 32, marginBottom: 12 }}>📬</div><div>Inga utskick</div></div>
            ) : kommunikation.map(k => (
              <div key={k.id} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#d0d0d0' }}>{TYP_ICON[k.typ] || '📩'} {k.typ}</span>
                  <span style={{ fontSize: 11, color: '#555' }}>{fmtTime(k.created_at)}</span>
                </div>
                {k.mottagare && <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{k.mottagare}</div>}
                <div style={{ fontSize: 12, color: '#777', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{k.meddelande}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'betyg' && (
          <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 14 }}>KUNDBETYG</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setBetyg(s)}
                  style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', color: s <= betyg ? '#E8C96A' : '#2a2a2a' }}>★</button>
              ))}
              {betyg > 0 && <span style={{ fontSize: 13, color: '#E8C96A', alignSelf: 'center', marginLeft: 6 }}>{betyg}/5</span>}
            </div>
            <textarea value={betygKommentar} onChange={e => setBetygKommentar(e.target.value)} placeholder="Kommentar från kunden..."
              style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 100 }}
              onFocus={e => e.currentTarget.style.borderColor = '#E8C96A'} onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'} />
            <button onClick={sparaBetygFn} disabled={sparaBetyg}
              style={{ marginTop: 12, background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: sparaBetyg ? 0.6 : 1 }}>
              {sparaBetyg ? 'Sparar...' : 'Spara betyg'}
            </button>
          </div>
        )}

        {tab === 'offert' && <OffertTab orderId={order.id} />}
        {tab === 'tid' && <TidFaktureringTab orderId={order.id} />}
        {tab === 'inkop' && <InkopTab orderId={order.id} />}
        {tab === 'ekonomi' && <EkonomiTab orderId={order.id} faktureradeBelopp={order.fakturerat_belopp} />}
        {tab === 'fakturor' && <FakturorTab orderId={order.id} />}
        {tab === 'bilder' && <BilderTab orderId={order.id} />}
      </div>

      {/* Action-bar i botten */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', borderTop: '1px solid #1e1e1e', display: 'flex', zIndex: 100 }}>
        {[
          { label: 'Kontakta kund', icon: '📬', action: () => setShowSend(true), color: '#a78bfa' },
          { label: 'Redigera', icon: '✏️', action: () => setShowEdit(true), color: '#E8C96A' },
          { label: 'Duplicera', icon: '📋', action: () => {}, color: '#60a5fa' },
          { label: order.status === 'inaktiv' ? 'Aktivera' : 'Inaktivera', icon: order.status === 'inaktiv' ? '▶' : '🚫', action: () => updateStatus(order.status === 'inaktiv' ? 'aktiv' : 'inaktiv'), color: order.status === 'inaktiv' ? '#4ade80' : '#f87171' },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            style={{ flex: 1, background: 'none', border: 'none', borderRight: '1px solid #1e1e1e', padding: '14px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <span style={{ fontSize: 18 }}>{btn.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: btn.color }}>{btn.label.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {showEdit && order && (
        <NyOrderModal order={order} onClose={() => setShowEdit(false)} onSaved={() => { fetchAll(); setShowEdit(false) }} />
      )}
      {showSend && order && (
        <SendModal orderId={order.id} orderTitel={order.titel} kundEpost={order.customer?.epost} kundTelefon={order.customer?.telefon}
          onClose={() => setShowSend(false)} onSent={() => { fetchAll(); setTab('utskick') }} />
      )}
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function InfoRow({ icon, value }: { icon: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{icon}</span>
      <span style={{ fontSize: 13, color: '#b0b0b0' }}>{value}</span>
    </div>
  )
}
