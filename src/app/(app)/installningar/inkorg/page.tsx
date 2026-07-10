'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { useIsMobile } from '@/hooks/useMediaQuery'

type Forfragan = {
  id: string; typ: 'uthyrning' | 'offert' | 'kontakt'; namn: string | null; telefon: string | null; epost: string | null
  meddelande: string | null; objekt_titel: string | null; tjanst: string | null; amne: string | null
  fastighet: string | null; status: string; created_at: string
}
type Felanmalan = {
  id: string; nummer: number | null; kategori: string; prioritet: string; namn: string | null; telefon: string | null; epost: string | null
  fastighet: string | null; lagenhet: string | null; beskrivning: string; status: string; order_id: string | null; created_at: string
}

const TYP_LABEL: Record<string, string> = { uthyrning: '🏠 Uthyrning', offert: '📄 Offert', kontakt: '✉️ Kontakt' }
const TYP_COLOR: Record<string, string> = { uthyrning: '#E8C96A', offert: '#64b5f6', kontakt: '#81c784' }
const KAT_LABEL: Record<string, string> = { el: 'El ⚡', vvs: 'VVS 🔧', snickeri: 'Snickeri 🪚', stad: 'Städ 🧹', las: 'Lås & Säkerhet 🔒', annat: 'Annat 📋' }
const PRIO_COLOR: Record<string, string> = { lag: '#8e8e93', normal: '#64b5f6', hog: '#fb923c', akut: '#f87171' }
const fmtDate = (d: string) => new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function InkorgPage() {
  const [tab, setTab] = useState<'forfragningar' | 'felanmalan'>('forfragningar')
  const [forfragningarCount, setForfragningarCount] = useState(0)
  const [felanmalanCount, setFelanmalanCount] = useState(0)

  const G = '#E8C96A'

  useEffect(() => {
    const sb = createClient()
    sb.from('forfragningar').select('id', { count: 'exact', head: true }).eq('status', 'ny').then(({ count }) => setForfragningarCount(count || 0))
    sb.from('felanmalningar').select('id', { count: 'exact', head: true }).eq('status', 'ny').then(({ count }) => setFelanmalanCount(count || 0))
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('forfragningar')}
          style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            border: `1px solid ${tab === 'forfragningar' ? G : '#2a2a2a'}`, background: tab === 'forfragningar' ? 'rgba(232,201,106,0.1)' : '#141414', color: tab === 'forfragningar' ? G : '#888' }}>
          📨 Förfrågningar
          {forfragningarCount > 0 && <span style={{ background: G, color: '#000', borderRadius: 10, fontSize: 11, fontWeight: 800, padding: '1px 7px' }}>{forfragningarCount}</span>}
        </button>
        <button onClick={() => setTab('felanmalan')}
          style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            border: `1px solid ${tab === 'felanmalan' ? G : '#2a2a2a'}`, background: tab === 'felanmalan' ? 'rgba(232,201,106,0.1)' : '#141414', color: tab === 'felanmalan' ? G : '#888' }}>
          📥 Felanmälan
          {felanmalanCount > 0 && <span style={{ background: G, color: '#000', borderRadius: 10, fontSize: 11, fontWeight: 800, padding: '1px 7px' }}>{felanmalanCount}</span>}
        </button>
      </div>
      {tab === 'forfragningar'
        ? <ForfragningarTab onHandled={() => setForfragningarCount(c => Math.max(0, c - 1))} />
        : <FelanmalanTab onHandled={() => setFelanmalanCount(c => Math.max(0, c - 1))} />}
    </div>
  )
}

function ForfragningarTab({ onHandled }: { onHandled: () => void }) {
  const toast = useToast()
  const m = useIsMobile()
  const [items, setItems] = useState<Forfragan[]>([])
  const [flik, setFlik] = useState('alla')
  const [selected, setSelected] = useState<Forfragan | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchItems = () => {
    createClient().from('forfragningar').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(() => { fetchItems() }, [])

  const markHandled = async (item: Forfragan) => {
    const { error } = await createClient().from('forfragningar').update({ status: 'hanterad' }).eq('id', item.id)
    if (error) { toast.error('Kunde inte markera som hanterad: ' + error.message); return }
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'hanterad' } : x))
    if (selected?.id === item.id) setSelected(s => s && { ...s, status: 'hanterad' })
    onHandled()
  }

  const FLIKAR = [{ id: 'alla', label: 'Alla' }, { id: 'uthyrning', label: '🏠 Uthyrning' }, { id: 'offert', label: '📄 Offert' }, { id: 'kontakt', label: '✉️ Kontakt' }]
  const filtered = flik === 'alla' ? items : items.filter(x => x.typ === flik)

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>

  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, display: 'flex', flexDirection: m ? 'column' : 'row', minHeight: 400 }}>
      <div style={{ width: m ? '100%' : 300, flexShrink: 0, borderRight: m ? 'none' : '1px solid #1e1e1e', borderBottom: m ? '1px solid #1e1e1e' : 'none', ...(m ? { maxHeight: 260, overflowY: 'auto' as const } : {}) }}>
        <div style={{ display: 'flex', gap: 4, padding: '10px 12px', borderBottom: '1px solid #1e1e1e', flexWrap: 'wrap' as const }}>
          {FLIKAR.map(f => (
            <button key={f.id} onClick={() => { setFlik(f.id); setSelected(null) }}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${flik === f.id ? '#E8C96A' : '#2a2a2a'}`, background: flik === f.id ? 'rgba(232,201,106,0.1)' : 'transparent', color: flik === f.id ? '#E8C96A' : '#888' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto' as const, maxHeight: 500 }}>
          {filtered.length === 0 ? (
            <div style={{ color: '#555', fontSize: 13, textAlign: 'center' as const, padding: 32 }}>Inga förfrågningar ännu.</div>
          ) : filtered.map(item => {
            const isNy = item.status === 'ny'
            const isSel = selected?.id === item.id
            return (
              <div key={item.id} onClick={() => setSelected(item)}
                style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', background: isSel ? 'rgba(232,201,106,0.08)' : 'transparent', borderLeft: `3px solid ${isSel ? '#E8C96A' : 'transparent'}`, opacity: item.status === 'hanterad' ? 0.55 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontWeight: isNy ? 700 : 500, fontSize: 13, color: '#e0e0e0' }}>{item.namn || 'Okänd'}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: TYP_COLOR[item.typ], background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '2px 6px' }}>{TYP_LABEL[item.typ]}</span>
                </div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>{item.objekt_titel || item.tjanst || item.amne || '—'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: '#555' }}>{fmtDate(item.created_at)}</span>
                  {isNy ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8C96A' }} /> : item.status === 'hanterad' ? <span style={{ fontSize: 11, color: '#81c784', fontWeight: 700 }}>✓</span> : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected ? (
        <div style={{ flex: 1, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#e0e0e0' }}>{selected.namn || 'Okänd'}</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: TYP_COLOR[selected.typ], background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '3px 8px' }}>{TYP_LABEL[selected.typ]}</span>
            </div>
            {selected.status === 'ny' && (
              <button onClick={() => markHandled(selected)} style={{ padding: '6px 14px', borderRadius: 6, background: 'rgba(129,199,132,0.12)', border: '1px solid #81c784', color: '#81c784', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ✓ Markera hanterad
              </button>
            )}
          </div>
          {[['Telefon', selected.telefon], ['E-post', selected.epost], ['Objekt / Ärende', selected.objekt_titel || selected.tjanst || selected.amne], ['Fastighet', selected.fastighet], ['Mottagen', fmtDate(selected.created_at)]]
            .filter(([, v]) => v).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #1e1e1e', fontSize: 13 }}>
                <span style={{ color: '#666' }}>{label}</span>
                <span style={{ fontWeight: 600, color: '#d0d0d0' }}>{val}</span>
              </div>
            ))}
          {selected.meddelande && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 8 }}>MEDDELANDE</div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e1e', borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.7, color: '#d0d0d0' }}>{selected.meddelande}</div>
            </div>
          )}
          {selected.telefon && (
            <a href={`tel:${selected.telefon}`} style={{ display: 'inline-block', marginTop: 20, padding: '10px 20px', background: '#E8C96A', color: '#000', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              📞 Ring {selected.namn || ''}
            </a>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>Välj en förfrågan i listan</div>
      )}
    </div>
  )
}

function FelanmalanTab({ onHandled }: { onHandled: () => void }) {
  const toast = useToast()
  const m = useIsMobile()
  const [items, setItems] = useState<Felanmalan[]>([])
  const [selected, setSelected] = useState<Felanmalan | null>(null)
  const [loading, setLoading] = useState(true)
  const [skaparOrder, setSkaparOrder] = useState(false)
  const router = useRouter()

  const fetchItems = () => {
    createClient().from('felanmalningar').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(() => { fetchItems() }, [])

  const markHandled = async (item: Felanmalan) => {
    const { error } = await createClient().from('felanmalningar').update({ status: 'hanterad' }).eq('id', item.id)
    if (error) { toast.error('Kunde inte markera som hanterad: ' + error.message); return }
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, status: 'hanterad' } : x))
    if (selected?.id === item.id) setSelected(s => s && { ...s, status: 'hanterad' })
    onHandled()
  }

  const KAT_TILL_KATEGORI: Record<string, string> = { el: 'El', vvs: 'VVS', snickeri: 'Snickeri', stad: 'Städ', las: 'Lås', annat: 'Annat' }
  const skapaOrder = async (item: Felanmalan) => {
    setSkaparOrder(true)
    const sb = createClient()
    const { data, error } = await sb.from('orders').insert({
      titel: `Felanmälan: ${KAT_LABEL[item.kategori]?.split(' ')[0] || item.kategori}`,
      kategori: KAT_TILL_KATEGORI[item.kategori] || 'Annat',
      fastighet: item.fastighet,
      lagenhet: item.lagenhet,
      beskrivning: item.beskrivning,
      prioritet: item.prioritet,
      // Anmälaren blir orderns kontaktperson (vem man ringer om jobbet).
      kontakt_namn: item.namn,
      kontakt_telefon: item.telefon,
      kontakt_epost: item.epost,
      intern_anteckning: item.nummer ? `Skapad från felanmälan FA-${item.nummer}.` : 'Skapad från felanmälan.',
      status: 'ny',
    }).select('id').single()
    setSkaparOrder(false)
    if (error || !data) { toast.error('Kunde inte skapa order: ' + (error?.message || 'okänt fel')); return }
    const { error: uppErr } = await sb.from('felanmalningar').update({ status: 'hanterad', order_id: data.id }).eq('id', item.id)
    if (uppErr) toast.error('Ordern skapades, men felanmälan kunde inte markeras som hanterad: ' + uppErr.message)
    if (item.status === 'ny') onHandled()
    router.push(`/ordrar?order=${data.id}`)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>

  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, display: 'flex', flexDirection: m ? 'column' : 'row', minHeight: 400 }}>
      <div style={{ width: m ? '100%' : 300, flexShrink: 0, borderRight: m ? 'none' : '1px solid #1e1e1e', borderBottom: m ? '1px solid #1e1e1e' : 'none', overflowY: 'auto' as const, maxHeight: m ? 260 : 540 }}>
        {items.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center' as const, padding: 32 }}>Inga felanmälningar ännu.</div>
        ) : items.map(item => {
          const isNy = item.status === 'ny'
          const isSel = selected?.id === item.id
          return (
            <div key={item.id} onClick={() => setSelected(item)}
              style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', background: isSel ? 'rgba(232,201,106,0.08)' : 'transparent', borderLeft: `3px solid ${isSel ? '#E8C96A' : 'transparent'}`, opacity: item.status === 'hanterad' ? 0.55 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontWeight: isNy ? 700 : 500, fontSize: 13, color: '#e0e0e0' }}>{KAT_LABEL[item.kategori] || item.kategori}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: PRIO_COLOR[item.prioritet], background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '2px 6px' }}>{item.prioritet}</span>
              </div>
              {item.nummer != null && <div style={{ fontSize: 10, color: '#8a7a4a', fontWeight: 700, letterSpacing: 0.5, marginBottom: 3 }}>FA-{item.nummer}</div>}
              <div style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>{item.fastighet || '—'}{item.lagenhet ? `, ${item.lagenhet}` : ''}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: '#555' }}>{fmtDate(item.created_at)}</span>
                {isNy ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8C96A' }} /> : item.status === 'hanterad' ? <span style={{ fontSize: 11, color: '#81c784', fontWeight: 700 }}>✓</span> : null}
              </div>
            </div>
          )
        })}
      </div>

      {selected ? (
        <div style={{ flex: 1, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: '#e0e0e0' }}>{KAT_LABEL[selected.kategori] || selected.kategori}</div>
              {selected.nummer != null && <div style={{ fontSize: 12, color: '#8a7a4a', fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>Ärende FA-{selected.nummer}</div>}
              <span style={{ fontSize: 11, fontWeight: 700, color: PRIO_COLOR[selected.prioritet], background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '3px 8px' }}>Prioritet: {selected.prioritet}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selected.status === 'ny' && (
                <button onClick={() => markHandled(selected)} style={{ padding: '6px 14px', borderRadius: 6, background: 'rgba(129,199,132,0.12)', border: '1px solid #81c784', color: '#81c784', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Markera hanterad
                </button>
              )}
              {!selected.order_id && (
                <button onClick={() => skapaOrder(selected)} disabled={skaparOrder} style={{ padding: '6px 14px', borderRadius: 6, background: 'rgba(232,201,106,0.12)', border: '1px solid #E8C96A', color: '#E8C96A', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: skaparOrder ? 0.6 : 1 }}>
                  {skaparOrder ? '...' : '+ Skapa order'}
                </button>
              )}
            </div>
          </div>
          {[['Namn', selected.namn], ['Telefon', selected.telefon], ['E-post', selected.epost], ['Fastighet', selected.fastighet], ['Lägenhet', selected.lagenhet], ['Mottagen', fmtDate(selected.created_at)]]
            .filter(([, v]) => v).map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #1e1e1e', fontSize: 13 }}>
                <span style={{ color: '#666' }}>{label}</span>
                <span style={{ fontWeight: 600, color: '#d0d0d0' }}>{val}</span>
              </div>
            ))}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 8 }}>BESKRIVNING</div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e1e', borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.7, color: '#d0d0d0' }}>{selected.beskrivning}</div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>Välj en felanmälan i listan</div>
      )}
    </div>
  )
}
