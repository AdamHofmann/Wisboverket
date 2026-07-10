'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { Order, Customer } from '@/types'
import SendModal from '@/components/SendModal'
import NyOrderModal from '@/components/NyOrderModal'
import TidFaktureringTab from '@/components/order-tabs/TidFaktureringTab'
import InkopTab from '@/components/order-tabs/InkopTab'
import EkonomiTab from '@/components/order-tabs/EkonomiTab'
import FakturorTab from '@/components/order-tabs/FakturorTab'
import BilderTab from '@/components/order-tabs/BilderTab'
import OffertTab from '@/components/order-tabs/OffertTab'
import { fmtKr, STATUS_LABEL, STATUS_COLOR, PRIO_LABEL, PRIO_COLOR, KAT_ICON, PERSONAL } from '@/components/order-tabs/shared'

type Props = { orderId: string; onClose: () => void; onUpdated: () => void }
type Kommunikation = { id: string; typ: string; kanal: string | null; mottagare: string | null; meddelande: string; created_at: string }

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

// Färgpalett — ljusare panel
const BG = '#2c2c2e'
const BG_CARD = '#3a3a3c'
const BG_TOP = '#2c2c2e'
const BORDER = '#48484a'
const TEXT_PRIMARY = '#f2f2f7'
const TEXT_SECONDARY = '#aeaeb2'
const TEXT_MUTED = '#636366'

const fmt = (d: string) => new Date(d).toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtTime = (d: string) => new Date(d).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const ContactRow = ({ icon, href, value, fontSize, last }: { icon: string; href: string; value: string; fontSize: number; last?: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: last ? 0 : 8 }}>
    <span>{icon}</span>
    <a href={href} style={{ fontSize, color: '#60a5fa', textDecoration: 'none' }}>{value}</a>
  </div>
)

export default function OrderPanel({ orderId, onClose, onUpdated }: Props) {
  const m = useIsMobile()
  const confirm = useConfirm()
  const toast = useToast()
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
  const [redigerarTilldelad, setRedigerarTilldelad] = useState(false)
  const [tilldeladSaving, setTilldeladSaving] = useState(false)

  const fetchAll = async () => {
    const sb = createClient()
    const [{ data: o }, { data: k }, { data: tid }, { data: inkop }] = await Promise.all([
      sb.from('orders').select('*, customer:customers(id,namn,telefon,epost,adress,postnummer,ort)').eq('id', orderId).single(),
      sb.from('order_kommunikation').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
      sb.from('order_tid_rader').select('total_kostnad').eq('order_id', orderId),
      sb.from('order_inkop').select('belopp').eq('order_id', orderId),
    ])
    setOrder(o)
    setKommunikation(k || [])
    if (o) { setBetyg(o.betyg || 0); setBetygKommentar(o.betyg_kommentar || '') }
    const tidKostnad = (tid || []).reduce((s, r) => s + (r.total_kostnad || 0), 0)
    const inkopBelopp = (inkop || []).reduce((s, i) => s + (i.belopp || 0), 0)
    setEkonomi({ kostnad: tidKostnad + inkopBelopp, harData: (tid?.length || 0) > 0 || (inkop?.length || 0) > 0 })
    setLoading(false)
  }

  useEffect(() => { setLoading(true); setTab('info'); fetchAll() }, [orderId])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const updateStatus = async (status: string) => {
    const { error } = await createClient().from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId)
    if (error) { toast.error('Kunde inte ändra status: ' + error.message); return }
    fetchAll(); onUpdated()
  }

  const stangUtanFakturering = async () => {
    const { error } = await createClient().from('orders').update({ faktureras_inte: true, updated_at: new Date().toISOString() }).eq('id', orderId)
    if (error) { toast.error('Kunde inte stänga ordern: ' + error.message); return }
    await fetchAll(); onUpdated()
  }

  const lasUpp = async () => {
    if (order?.fakturerat && !(await confirm({ message: 'Ordern har en faktura — lås upp ändå?', confirmLabel: 'Lås upp' }))) return
    const { error } = await createClient().from('orders').update({ faktureras_inte: false, fakturerat: false, updated_at: new Date().toISOString() }).eq('id', orderId)
    if (error) { toast.error('Kunde inte låsa upp: ' + error.message); return }
    await fetchAll(); onUpdated()
  }

  const sparaBetygFn = async () => {
    setSparaBetyg(true)
    const { error } = await createClient().from('orders').update({ betyg, betyg_kommentar: betygKommentar }).eq('id', orderId)
    setSparaBetyg(false)
    if (error) { toast.error('Kunde inte spara betyg: ' + error.message); return }
  }

  const toggleTilldelad = async (person: string) => {
    const nuvarande = order?.tilldelad || []
    const nya = nuvarande.includes(person) ? nuvarande.filter(p => p !== person) : [...nuvarande, person]
    setTilldeladSaving(true)
    const { error } = await createClient().from('orders').update({ tilldelad: nya.length ? nya : null, updated_at: new Date().toISOString() }).eq('id', orderId)
    setTilldeladSaving(false)
    if (error) { toast.error('Kunde inte uppdatera resurs: ' + error.message); return }
    await fetchAll(); onUpdated()
  }

  if (loading || !order) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: m ? '100%' : 760, maxWidth: '100vw', background: BG, zIndex: 201, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: TEXT_MUTED }}>{loading ? 'Laddar...' : 'Hittades inte'}</span>
        </div>
      </>
    )
  }

  const orderNr = order.order_number ? `#${String(order.order_number).padStart(4, '0')}` : `#${orderId.slice(0, 6).toUpperCase()}`
  const statusColor = STATUS_COLOR[order.status] || '#888'
  const prioColor = PRIO_COLOR[order.prioritet || 'normal'] || '#aaa'
  const last = !!(order.fakturerat || order.faktureras_inte)

  const adressDelar = [order.fastighet, order.postnummer, order.ort].filter(Boolean)
  const mapsUrl = adressDelar.length > 0
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adressDelar.join(' '))}`
    : null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />

      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: m ? '100%' : 760, maxWidth: '100vw', background: BG, zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.5)' }}>

        {/* Scrollbart innehåll */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

          {/* Toprad */}
          <div className="modal-safe-top" style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: m ? 'flex-start' : 'center', justifyContent: 'space-between', gap: m ? 8 : 0, position: 'sticky', top: 0, background: BG_TOP, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0, flex: m ? 1 : undefined }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#E8C96A' }}>{orderNr}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: statusColor + '33', color: statusColor, border: `1px solid ${statusColor}66` }}>
                {STATUS_LABEL[order.status] || order.status}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: prioColor + '22', color: prioColor, border: `1px solid ${prioColor}44` }}>
                {PRIO_LABEL[order.prioritet || 'normal'] || order.prioritet}
              </span>
              {order.kategori && <span style={{ fontSize: 11, color: TEXT_MUTED }}>{KAT_ICON[order.kategori] || ''} {order.kategori}</span>}
              {order.fakturerat ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(232,201,106,0.15)', color: '#E8C96A', border: '1px solid #E8C96A66' }}>🔒 Fakturerad</span>
              ) : order.faktureras_inte ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid #fb923c66' }}>🚫 Stängd utan fakt.</span>
              ) : null}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>×</button>
          </div>

          {/* Titel & meta */}
          <div style={{ padding: '18px 20px 12px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: TEXT_PRIMARY, marginBottom: 8 }}>{order.titel}</div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              {order.customer && (
                <span style={{ fontSize: 14, color: TEXT_SECONDARY, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>👤</span>{order.customer.namn}
                </span>
              )}
              {order.tilldelad?.length ? (
                <span style={{ fontSize: 14, color: TEXT_SECONDARY, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🔧</span>{order.tilldelad.map(n => n.split(' ')[0]).join(', ')}
                </span>
              ) : null}
            </div>
          </div>

          {/* Status-bar */}
          <div style={{ margin: '0 20px 16px', background: statusColor + '22', border: `1px solid ${statusColor}44`, borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, color: statusColor }}>
            {STATUS_LABEL[order.status] || order.status}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, overflowX: 'auto' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none', whiteSpace: 'nowrap',
                  color: tab === t.id ? '#E8C96A' : TEXT_MUTED,
                  borderBottom: tab === t.id ? '2px solid #E8C96A' : '2px solid transparent' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab-innehåll */}
          <div style={{ padding: '18px 20px' }}>

            {tab === 'info' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Ekonomi-summering */}
                {ekonomi.harData && (() => {
                  const intakt = order.fakturerat_belopp || 0
                  const tb = intakt - ekonomi.kostnad
                  const tbColor = tb >= 0 ? '#4ade80' : '#f87171'
                  return (
                    <div style={{ background: BG_CARD, borderRadius: 12, padding: '14px 16px', display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: TEXT_MUTED, marginBottom: 4 }}>INTÄKT</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: order.fakturerat ? '#4ade80' : TEXT_MUTED }}>{intakt > 0 ? fmtKr(intakt) : '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: TEXT_MUTED, marginBottom: 4 }}>KOSTNAD</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#f87171' }}>{fmtKr(ekonomi.kostnad)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: TEXT_MUTED, marginBottom: 4 }}>TB</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: order.fakturerat ? tbColor : TEXT_MUTED }}>{order.fakturerat ? fmtKr(tb) : '—'}</div>
                      </div>
                    </div>
                  )
                })()}

                {/* Bokning */}
                <div style={{ background: BG_CARD, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, marginBottom: 12 }}>BOKNING</div>
                  {order.bokad_datum ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span>📅</span>
                        <span style={{ fontSize: 14, color: TEXT_PRIMARY }}>
                          {fmt(order.bokad_datum)}
                          {order.bokad_datum_till && order.bokad_datum_till !== order.bokad_datum
                            ? ` – ${fmt(order.bokad_datum_till)}`
                            : ''}
                          {order.bokad_start ? ` kl ${order.bokad_start}` : ''}
                          {order.bokad_slut ? `–${order.bokad_slut}` : ''}
                        </span>
                      </div>
                      <div onClick={() => setRedigerarTilldelad(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <span>👤</span>
                        {order.tilldelad?.length
                          ? <span style={{ fontSize: 14, color: TEXT_PRIMARY }}>{order.tilldelad.join(', ')}</span>
                          : <span style={{ fontSize: 14, color: '#f87171' }}>Ej tilldelad ännu</span>}
                        <span style={{ fontSize: 12, color: TEXT_MUTED, marginLeft: 'auto' }}>{redigerarTilldelad ? '▲ stäng' : '✏️ sätt resurs'}</span>
                      </div>
                      {redigerarTilldelad && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                          {PERSONAL.map(p => {
                            const vald = order.tilldelad?.includes(p)
                            return (
                              <button key={p} onClick={() => toggleTilldelad(p)} disabled={tilldeladSaving}
                                style={{ padding: m ? '12px 16px' : '6px 12px', minHeight: m ? 44 : undefined, borderRadius: 20, fontSize: 13, fontWeight: 600,
                                  cursor: tilldeladSaving ? 'default' : 'pointer', opacity: tilldeladSaving ? 0.6 : 1,
                                  border: `1px solid ${vald ? '#E8C96A' : BORDER}`,
                                  background: vald ? 'rgba(232,201,106,0.15)' : 'transparent',
                                  color: vald ? '#E8C96A' : TEXT_SECONDARY }}>
                                {vald ? '✓ ' : ''}{p}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : <div style={{ fontSize: 14, color: TEXT_MUTED }}>Ej planerad</div>}
                </div>

                {/* Beskrivning */}
                {order.beskrivning && (
                  <div style={{ background: BG_CARD, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, marginBottom: 10 }}>BESKRIVNING</div>
                    <div style={{ fontSize: 14, color: TEXT_PRIMARY, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{order.beskrivning}</div>
                  </div>
                )}

                {/* Adress — vart man ska åka */}
                {(adressDelar.length > 0 || order.customer || order.lagenhet) && (
                  <div style={{ background: BG_CARD, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, marginBottom: 10 }}>ADRESS</div>
                    {order.lagenhet && <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><span>🏢</span>{order.lagenhet}</div>}
                    {mapsUrl ? (
                      <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ background: '#2c2c2e', border: '1px solid #48484a', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#60a5fa')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = '#48484a')}>
                          {order.fastighet && <div style={{ fontSize: 14, color: '#60a5fa', marginBottom: 2 }}>{order.fastighet}</div>}
                          {(order.postnummer || order.ort) && <div style={{ fontSize: 14, color: '#60a5fa' }}>{order.postnummer} {order.ort}</div>}
                          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 6 }}>🗺 Öppna i Google Maps</div>
                        </div>
                      </a>
                    ) : (
                      <div>
                        {order.fastighet && <div style={{ fontSize: 14, color: TEXT_PRIMARY }}>{order.fastighet}</div>}
                        {(order.postnummer || order.ort) && <div style={{ fontSize: 14, color: TEXT_SECONDARY }}>{order.postnummer} {order.ort}</div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Kontaktperson — vem man ska kontakta */}
                {(order.kontakt_namn || order.kontakt_telefon || order.kontakt_epost) && (
                  <div style={{ background: BG_CARD, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, marginBottom: 10 }}>KONTAKTPERSON</div>
                    {order.kontakt_namn && <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 8 }}>{order.kontakt_namn}</div>}
                    {order.kontakt_telefon && <ContactRow icon="📞" href={`tel:${order.kontakt_telefon}`} value={order.kontakt_telefon} fontSize={14} />}
                    {order.kontakt_epost && <ContactRow icon="✉️" href={`mailto:${order.kontakt_epost}`} value={order.kontakt_epost} fontSize={13} last />}
                  </div>
                )}

                {/* Intern anteckning */}
                {order.intern_anteckning && (
                  <div style={{ background: '#2a2200', border: '1px solid #3d3300', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#E8C96A99', marginBottom: 8 }}>INTERN ANTECKNING</div>
                    <div style={{ fontSize: 14, color: '#c8b560', lineHeight: 1.7 }}>{order.intern_anteckning}</div>
                  </div>
                )}

                <div style={{ fontSize: 11, color: TEXT_MUTED, paddingTop: 4 }}>
                  Skapad {fmt(order.created_at)} · Ändrad {fmt(order.updated_at)}
                </div>
              </div>
            )}

            {tab === 'utskick' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: TEXT_MUTED }}>{kommunikation.length} utskick</div>
                  <button onClick={() => setShowSend(true)} style={{ background: '#a78bfa22', border: '1px solid #a78bfa55', borderRadius: 8, padding: '7px 14px', color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nytt utskick</button>
                </div>
                {kommunikation.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: TEXT_MUTED }}><div style={{ fontSize: 28, marginBottom: 8 }}>📬</div><div>Inga utskick</div></div>
                ) : kommunikation.map(k => (
                  <div key={k.id} style={{ background: BG_CARD, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{TYP_ICON[k.typ] || '📩'} {k.typ}</span>
                      <span style={{ fontSize: 11, color: TEXT_MUTED }}>{fmtTime(k.created_at)}</span>
                    </div>
                    {k.mottagare && <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>{k.mottagare}</div>}
                    <div style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{k.meddelande}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'betyg' && (
              <div style={{ background: BG_CARD, borderRadius: 12, padding: '18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: TEXT_MUTED, marginBottom: 14 }}>KUNDBETYG</div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button key={s} onClick={() => setBetyg(s)} style={{ background: 'none', border: 'none', fontSize: 30, cursor: 'pointer', color: s <= betyg ? '#E8C96A' : '#48484a' }}>★</button>
                  ))}
                  {betyg > 0 && <span style={{ fontSize: 14, color: '#E8C96A', alignSelf: 'center', marginLeft: 6 }}>{betyg}/5</span>}
                </div>
                <textarea spellCheck={true} value={betygKommentar} onChange={e => setBetygKommentar(e.target.value)} placeholder="Kommentar från kunden..."
                  style={{ background: '#2c2c2e', border: '1px solid #48484a', borderRadius: 8, padding: '10px 12px', color: TEXT_PRIMARY, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 90 }}
                  onFocus={e => e.currentTarget.style.borderColor = '#E8C96A'} onBlur={e => e.currentTarget.style.borderColor = '#48484a'} />
                <button onClick={sparaBetygFn} disabled={sparaBetyg}
                  style={{ marginTop: 10, background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: sparaBetyg ? 0.6 : 1 }}>
                  {sparaBetyg ? 'Sparar...' : 'Spara betyg'}
                </button>
              </div>
            )}

            {tab === 'offert' && <OffertTab orderId={order.id} />}
            {tab === 'tid' && <TidFaktureringTab orderId={order.id} last={last} onUpdated={() => { fetchAll(); onUpdated() }} />}
            {tab === 'inkop' && <InkopTab orderId={order.id} />}
            {tab === 'ekonomi' && <EkonomiTab orderId={order.id} faktureradeBelopp={order.fakturerat_belopp} />}
            {tab === 'fakturor' && <FakturorTab orderId={order.id} />}
            {tab === 'bilder' && <BilderTab orderId={order.id} />}
          </div>
        </div>

        {/* Action-bar */}
        {(() => {
          const bar = [
            { label: 'Kontakta kund', icon: '📬', action: () => setShowSend(true), color: '#a78bfa', disabled: false },
            { label: 'Redigera', icon: '✏️', action: () => setShowEdit(true), color: '#E8C96A', disabled: last },
            { label: last ? 'Lås upp' : 'Stäng utan fakt.', icon: last ? '🔓' : '🚷', action: last ? lasUpp : stangUtanFakturering, color: last ? '#4ade80' : '#fb923c', disabled: false },
            { label: order.status === 'inaktiv' ? 'Återställ' : 'Avboka', icon: order.status === 'inaktiv' ? '↩️' : '🚫', action: () => updateStatus(order.status === 'inaktiv' ? 'ny' : 'inaktiv'), color: order.status === 'inaktiv' ? '#4ade80' : '#f87171', disabled: false },
          ]
          return (
            <div className="modal-safe-bottom" style={{ borderTop: `1px solid ${BORDER}`, background: BG_TOP, flexShrink: 0,
              ...(m ? { display: 'grid', gridTemplateColumns: '1fr 1fr' } : { display: 'flex', flexDirection: 'row' }) }}>
              {bar.map((btn, i) => (
                <button key={btn.label} onClick={btn.disabled ? undefined : btn.action} disabled={btn.disabled}
                  style={{ flex: m ? undefined : 1, background: 'none', border: 'none',
                    borderRight: m ? (i % 2 === 0 ? `1px solid ${BORDER}` : 'none') : (i < bar.length - 1 ? `1px solid ${BORDER}` : 'none'),
                    borderTop: m && i >= 2 ? `1px solid ${BORDER}` : 'none',
                    padding: m ? '10px 6px' : '14px 8px', cursor: btn.disabled ? 'not-allowed' : 'pointer', opacity: btn.disabled ? 0.4 : 1,
                    display: 'flex', flexDirection: m ? 'row' : 'column', justifyContent: m ? 'center' : undefined, alignItems: 'center', gap: m ? 7 : 5 }}
                  onMouseEnter={e => { if (!btn.disabled) e.currentTarget.style.background = '#3a3a3c' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ fontSize: m ? 15 : 20 }}>{btn.icon}</span>
                  <span style={{ fontSize: m ? 11 : 10, fontWeight: 700, letterSpacing: 0.3, color: btn.color }}>{btn.label.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )
        })()}
      </div>

      {showEdit && (
        <NyOrderModal order={order} onClose={() => setShowEdit(false)} onSaved={() => { fetchAll(); onUpdated(); setShowEdit(false) }} />
      )}
      {showSend && (
        <SendModal orderId={order.id} orderTitel={order.titel} kundEpost={order.customer?.epost} kundTelefon={order.customer?.telefon}
          onClose={() => setShowSend(false)} onSent={() => { fetchAll(); setTab('utskick') }} />
      )}
    </>
  )
}
