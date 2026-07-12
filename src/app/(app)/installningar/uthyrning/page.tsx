'use client'

import { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Hyresobjekt } from '@/types'
import AdressInput from '@/components/AdressInput'
import { PERSONAL } from '@/components/order-tabs/shared'
import { useConfirm } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { fmtKr } from '@/lib/format'

const TYPER = [
  { v: 'lokal', l: 'Lokal' },
  { v: 'kontor', l: 'Kontor' },
  { v: 'garage', l: 'Garage / Parkering' },
  { v: 'butik', l: 'Butik' },
  { v: 'lager', l: 'Lager & logistik' },
  { v: 'restaurang', l: 'Restaurang & café' },
  { v: 'annat', l: 'Annat' },
]
const TYP_LABEL: Record<string, string> = Object.fromEntries(TYPER.map(t => [t.v, t.l]))

const BEKVAMLIGHETER = [
  'Balkong', 'Besöksparkering', 'Biltvätt', 'Cykelrum', 'Dusch', 'Elbilsplatser',
  'Fiberanslutning', 'Garage (kall)', 'Garage (varm)', 'Gym', 'Konferens', 'Kundparkering',
  'Kök/pentry', 'Lasthiss', 'Lastkaj', 'Lastport', 'Mötesrum', 'Omklädningsrum', 'Parkering',
  'Reception', 'Restaurang', 'RWC', 'Serverrum', 'Skyltfönster', 'Skyltläge', 'Terrass',
  'Tvättservice', 'Verkstad', 'WC',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 800, color: '#E8C96A' },
  newBtn: { background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  search: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 14px', color: '#e0e0e0', fontSize: 13, width: 280, outline: 'none' },
}

function completeness(o: Partial<Hyresobjekt>): number {
  let score = 0
  if (o.titel && o.titel.trim()) score += 20
  if (o.total_yta) score += 15
  if (o.hyra) score += 15
  if (o.bilder && o.bilder.length > 0) score += 25
  if (o.beskrivning && o.beskrivning.trim()) score += 15
  if (o.typer && o.typer.length > 0) score += 10
  return Math.min(100, score)
}

export default function UthyrningPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'alla' | 'aktiva' | 'inaktiva'>('alla')
  const [vald, setVald] = useState<Hyresobjekt | null>(null)
  const [showModal, setShowModal] = useState(false)

  // SWR-cache: cachad data visas direkt vid återbesök, revalideras tyst i bakgrunden.
  // fetchObjekt() = revalidera (används av modalens onSaved).
  const { data, isLoading, mutate } = useSWR('uthyrning-hyresobjekt', async () => {
    const { data } = await createClient().from('hyresobjekt').select('*').order('created_at', { ascending: false })
    return (data as Hyresobjekt[]) || []
  })
  const objekt = data ?? []
  const loading = isLoading && !data
  const fetchObjekt = () => { mutate() }

  const filtered = useMemo(() => objekt.filter(o => {
    if (filter === 'aktiva' && !o.publicerad) return false
    if (filter === 'inaktiva' && o.publicerad) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (o.titel || '').toLowerCase().includes(q) ||
      (o.intern_namn || '').toLowerCase().includes(q) ||
      (o.fastighet || '').toLowerCase().includes(q) ||
      (o.typer || []).some(t => (TYP_LABEL[t] || t).toLowerCase().includes(q))
  }), [objekt, search, filter])

  const nyttObjekt = (): Hyresobjekt => ({
    id: '',
    intern_namn: '',
    titel: '',
    fastighet: '',
    typer: [],
    typ: null,
    tillganglig_typ: 'overenskommelse',
    tillganglig_fran: null,
    publicerad: false,
    total_yta: null,
    hyra: null,
    kr_kvm_ar: null,
    planlosning: '',
    bilder: [],
    bekvamligheter: [],
    kort_beskrivning: '',
    beskrivning: '',
    kontakt_namn: '',
    kontakt_epost: '',
    kontakt_telefon: '',
    kontakt_titel: '',
    created_at: '',
    updated_at: '',
  })

  return (
    <div>
      <div style={S.header}>
        <div style={S.title}>Uthyrning <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({filtered.length})</span></div>
        <button style={S.newBtn} onClick={() => { setVald(nyttObjekt()); setShowModal(true) }}>+ Nytt objekt</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input spellCheck={false} placeholder="Sök titel, fastighet, typ..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...S.search, flex: '1 1 200px', minWidth: 0 }}
          onFocus={e => (e.currentTarget.style.borderColor = '#E8C96A')}
          onBlur={e => (e.currentTarget.style.borderColor = '#2a2a2a')} />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['alla', 'aktiva', 'inaktiva'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${filter === f ? '#E8C96A' : '#2a2a2a'}`,
                background: filter === f ? 'rgba(232,201,106,0.1)' : 'transparent',
                color: filter === f ? '#E8C96A' : '#888',
              }}>
              {f === 'alla' ? 'Alla' : f === 'aktiva' ? 'Aktiva' : 'Inaktiva'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#555', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10 }}>
          {objekt.length === 0 ? 'Inga hyresobjekt ännu — skapa ditt första objekt' : 'Inga träffar'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtered.map(o => (
            <div key={o.id} onClick={() => { setVald(o); setShowModal(true) }}
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: 16, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{o.titel || o.intern_namn || 'Namnlöst objekt'}</div>
                {o.publicerad && (
                  <span style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>AKTIV</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {o.intern_namn && (
                  <span style={{ background: '#111', border: '1px solid #2a2a2a', color: '#888', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>{o.intern_namn}</span>
                )}
                {(o.typer || []).map(t => (
                  <span key={t} style={{ background: 'rgba(232,201,106,0.08)', border: '1px solid rgba(232,201,106,0.3)', color: '#E8C96A', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6 }}>{TYP_LABEL[t] || t}</span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{o.fastighet || 'Ingen adress angiven'}</div>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#666' }}>
                <span>{o.total_yta ? `${o.total_yta} kvm` : '—'}</span>
                <span>{o.hyra ? `${fmtKr(o.hyra)}/mån` : '—'}</span>
                <span>{o.tillganglig_typ === 'datum' && o.tillganglig_fran ? `Från ${o.tillganglig_fran}` : 'Enligt ök.'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && vald && (
        <ObjektModal
          objekt={vald}
          onClose={() => { setShowModal(false); setVald(null) }}
          onSaved={() => { setShowModal(false); setVald(null); fetchObjekt() }}
        />
      )}
    </div>
  )
}

// ============================= DETALJMODAL =============================

type TabKey = 'objekt' | 'yta' | 'media' | 'bekvam' | 'text' | 'kontakt'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'objekt', label: '🏢 Objekt' },
  { key: 'yta', label: '📏 Yta' },
  { key: 'media', label: '🖼 Media' },
  { key: 'bekvam', label: '✨ Bekväml.' },
  { key: 'text', label: '📝 Text' },
  { key: 'kontakt', label: '👤 Kontakt' },
]

function ObjektModal({ objekt, onClose, onSaved }: { objekt: Hyresobjekt; onClose: () => void; onSaved: () => void }) {
  const isNew = !objekt.id
  const [tab, setTab] = useState<TabKey>('objekt')
  const [form, setForm] = useState<Hyresobjekt>({ ...objekt })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const sb = createClient()
  const confirm = useConfirm()
  const toast = useToast()

  const set = <K extends keyof Hyresobjekt>(k: K, v: Hyresobjekt[K]) => setForm(f => ({ ...f, [k]: v }))

  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#E8C96A' }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#2a2a2a' }
  const inp = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }

  const toggleTyp = (v: string) => {
    setForm(f => {
      const has = f.typer.includes(v)
      const typer = has ? f.typer.filter(t => t !== v) : [...f.typer, v]
      return { ...f, typer, typ: typer[0] || null }
    })
  }

  const toggleBekvam = (v: string) => {
    setForm(f => ({ ...f, bekvamligheter: f.bekvamligheter.includes(v) ? f.bekvamligheter.filter(b => b !== v) : [...f.bekvamligheter, v] }))
  }

  const score = completeness(form)

  const spara = async () => {
    if (!form.titel?.trim() && !form.intern_namn?.trim()) { setError('Ange minst internt namn eller titel'); return }
    setSaving(true)
    setError('')
    const payload = {
      intern_namn: form.intern_namn || null,
      titel: form.titel || null,
      fastighet: form.fastighet || null,
      typer: form.typer,
      typ: form.typ,
      tillganglig_typ: form.tillganglig_typ,
      tillganglig_fran: form.tillganglig_typ === 'datum' ? (form.tillganglig_fran || null) : null,
      publicerad: form.publicerad,
      total_yta: form.total_yta || null,
      hyra: form.hyra || null,
      kr_kvm_ar: form.kr_kvm_ar || null,
      planlosning: form.planlosning || null,
      bilder: form.bilder,
      bekvamligheter: form.bekvamligheter,
      kort_beskrivning: form.kort_beskrivning || null,
      beskrivning: form.beskrivning || null,
      kontakt_namn: form.kontakt_namn || null,
      kontakt_epost: form.kontakt_epost || null,
      kontakt_telefon: form.kontakt_telefon || null,
      kontakt_titel: form.kontakt_titel || null,
    }

    if (isNew) {
      const { error: err } = await sb.from('hyresobjekt').insert(payload)
      setSaving(false)
      if (err) { setError(err.message); return }
    } else {
      const { error: err } = await sb.from('hyresobjekt').update(payload).eq('id', form.id)
      setSaving(false)
      if (err) { setError(err.message); return }
    }
    onSaved()
  }

  const togglePublicerad = async () => {
    const next = !form.publicerad
    set('publicerad', next)
    if (!isNew) {
      const { error: err } = await sb.from('hyresobjekt').update({ publicerad: next }).eq('id', form.id)
      if (err) {
        set('publicerad', !next) // återställ optimistisk ändring
        toast.error('Kunde inte ändra publiceringsstatus: ' + err.message)
      }
    }
  }

  const radera = async () => {
    if (isNew) { onClose(); return }
    if (!(await confirm({ message: 'Ta bort detta hyresobjekt? Detta går inte att ångra.', danger: true, confirmLabel: 'Ta bort' }))) return
    const { error: err } = await sb.from('hyresobjekt').delete().eq('id', form.id)
    if (err) { toast.error('Kunde inte ta bort objektet: ' + err.message); return }
    onSaved()
  }

  if (showPreview) {
    return <ForhandsvisningModal form={form} onClose={() => setShowPreview(false)} />
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 700, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {form.titel || form.intern_namn || 'Nytt hyresobjekt'}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{form.fastighet || 'Ingen adress'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div title="Fullständighet" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 60, height: 6, background: '#111', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${score}%`, height: '100%', background: score >= 80 ? '#4ade80' : score >= 40 ? '#E8C96A' : '#f87171' }} />
                </div>
                <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{score}%</span>
              </div>
              <button onClick={() => setShowPreview(true)}
                style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 12px', color: '#E8C96A', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                🔍 Förhandsvisa
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '10px 22px 0', borderBottom: '1px solid #222', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '9px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.key ? '#E8C96A' : 'transparent'}`,
                color: tab === t.key ? '#E8C96A' : '#888',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tab === 'objekt' && (
            <ObjektTab form={form} set={set} toggleTyp={toggleTyp} togglePublicerad={togglePublicerad} inp={inp} fo={fo} fb={fb} />
          )}
          {tab === 'yta' && <YtaTab form={form} set={set} inp={inp} fo={fo} fb={fb} />}
          {tab === 'media' && !isNew && <MediaTab objektId={form.id} bilder={form.bilder} onChange={b => set('bilder', b)} />}
          {tab === 'media' && isNew && (
            <div style={{ textAlign: 'center', padding: 30, color: '#666', fontSize: 13 }}>Spara objektet först för att kunna ladda upp bilder.</div>
          )}
          {tab === 'bekvam' && <BekvamTab form={form} toggleBekvam={toggleBekvam} />}
          {tab === 'text' && <TextTab form={form} set={set} inp={inp} fo={fo} fb={fb} />}
          {tab === 'kontakt' && <KontaktTab form={form} set={set} inp={inp} fo={fo} fb={fb} />}

          {error && <div style={{ fontSize: 12, color: '#f87171', background: '#f8717111', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <button onClick={radera} style={{ padding: '9px 16px', background: 'none', border: '1px solid #3a2020', borderRadius: 8, color: '#f87171', cursor: 'pointer', fontSize: 13 }}>
            Ta bort
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '9px 20px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>Stäng</button>
            <button onClick={spara} disabled={saving} style={{ padding: '9px 24px', background: '#E8C96A', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MF({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><label style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{label}</label>{children}</div>
}

// ---------- Objekt-fliken ----------
type TabProps = {
  form: Hyresobjekt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: <K extends keyof Hyresobjekt>(k: K, v: Hyresobjekt[K]) => void
  inp: React.CSSProperties
  fo: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  fb: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
}

function ObjektTab({ form, set, toggleTyp, togglePublicerad, inp, fo, fb }: TabProps & { toggleTyp: (v: string) => void; togglePublicerad: () => void }) {
  return (
    <>
      <MF label="INTERNT NAMN (syns ej publikt)">
        <input spellCheck={false} style={inp} value={form.intern_namn || ''} onChange={e => set('intern_namn', e.target.value)} onFocus={fo} onBlur={fb} placeholder="T.ex. Lokal 3 - Vägmästarvägen" />
      </MF>
      <MF label="ANNONSNAMN (titel, publikt)">
        <input spellCheck={true} style={inp} value={form.titel || ''} onChange={e => set('titel', e.target.value)} onFocus={fo} onBlur={fb} placeholder="T.ex. Ljus kontorslokal centralt" />
      </MF>
      <MF label="FASTIGHET / ADRESS">
        <AdressInput
          value={form.fastighet || ''}
          onChange={v => set('fastighet', v)}
          onPick={adress => set('fastighet', adress)}
          style={inp}
          onFocus={fo}
          onBlur={fb}
        />
      </MF>
      <MF label="TYP AV OBJEKT">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TYPER.map(t => (
            <div key={t.v} onClick={() => toggleTyp(t.v)}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${form.typer.includes(t.v) ? '#E8C96A' : '#2a2a2a'}`, background: form.typer.includes(t.v) ? 'rgba(232,201,106,0.1)' : '#111', color: form.typer.includes(t.v) ? '#E8C96A' : '#888' }}>
              {t.l}
            </div>
          ))}
        </div>
      </MF>
      <MF label="TILLGÄNGLIG">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div onClick={() => set('tillganglig_typ', form.tillganglig_typ === 'datum' ? 'overenskommelse' : 'datum')}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${form.tillganglig_typ === 'overenskommelse' ? '#E8C96A' : '#2a2a2a'}`, background: form.tillganglig_typ === 'overenskommelse' ? 'rgba(232,201,106,0.1)' : '#111', color: form.tillganglig_typ === 'overenskommelse' ? '#E8C96A' : '#888' }}>
            Enligt överenskommelse
          </div>
          {form.tillganglig_typ === 'datum' && (
            <input spellCheck={false} type="date" style={{ ...inp, width: 180 }} value={form.tillganglig_fran || ''} onChange={e => set('tillganglig_fran', e.target.value)} onFocus={fo} onBlur={fb} />
          )}
        </div>
      </MF>
      <MF label="STATUS">
        <div onClick={togglePublicerad}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: 'fit-content' }}>
          <div style={{ width: 40, height: 22, borderRadius: 12, background: form.publicerad ? '#E8C96A' : '#333', position: 'relative', transition: 'background 0.15s' }}>
            <div style={{ position: 'absolute', top: 2, left: form.publicerad ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#0d0d0d', transition: 'left 0.15s' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: form.publicerad ? '#4ade80' : '#888' }}>{form.publicerad ? 'Aktiv (visas på hemsidan)' : 'Inaktiv'}</span>
        </div>
      </MF>
    </>
  )
}

function YtaTab({ form, set, inp, fo, fb }: TabProps) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <MF label="TOTAL YTA (KVM)">
          <input spellCheck={false} type="number" style={inp} value={form.total_yta ?? ''} onChange={e => set('total_yta', e.target.value ? Number(e.target.value) : null)} onFocus={fo} onBlur={fb} />
        </MF>
        <MF label="HYRA (KR/MÅN)">
          <input spellCheck={false} type="number" style={inp} value={form.hyra ?? ''} onChange={e => set('hyra', e.target.value ? Number(e.target.value) : null)} onFocus={fo} onBlur={fb} />
        </MF>
        <MF label="KR/KVM/ÅR">
          <input spellCheck={false} type="number" style={inp} value={form.kr_kvm_ar ?? ''} onChange={e => set('kr_kvm_ar', e.target.value ? Number(e.target.value) : null)} onFocus={fo} onBlur={fb} />
        </MF>
      </div>
      <MF label="PLANLÖSNING">
        <textarea spellCheck={true} style={{ ...inp, minHeight: 100, resize: 'vertical' }} value={form.planlosning || ''} onChange={e => set('planlosning', e.target.value)} onFocus={fo} onBlur={fb} placeholder="Beskriv ytfördelning, t.ex. 2 kontorsrum, öppet landskap, pentry..." />
      </MF>
    </>
  )
}

function BekvamTab({ form, toggleBekvam }: { form: Hyresobjekt; toggleBekvam: (v: string) => void }) {
  return (
    <MF label="BEKVÄMLIGHETER">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {BEKVAMLIGHETER.map(b => {
          const checked = form.bekvamligheter.includes(b)
          return (
            <div key={b} onClick={() => toggleBekvam(b)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${checked ? '#E8C96A' : '#2a2a2a'}`, background: checked ? 'rgba(232,201,106,0.08)' : '#111' }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, border: `1px solid ${checked ? '#E8C96A' : '#444'}`, background: checked ? '#E8C96A' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#000' }}>
                {checked ? '✓' : ''}
              </div>
              <span style={{ fontSize: 12, color: checked ? '#E8C96A' : '#aaa' }}>{b}</span>
            </div>
          )
        })}
      </div>
    </MF>
  )
}

function TextTab({ form, set, inp, fo, fb }: TabProps) {
  const [genKort, setGenKort] = useState(false)
  const [genLang, setGenLang] = useState(false)

  const generera = async (mode: 'kort' | 'lang') => {
    mode === 'kort' ? setGenKort(true) : setGenLang(true)
    try {
      const res = await fetch('/api/generate-uthyrningstext', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          objekt: {
            titel: form.titel,
            fastighet: form.fastighet,
            typer: form.typer,
            total_yta: form.total_yta,
            hyra: form.hyra,
            kr_kvm_ar: form.kr_kvm_ar,
            planlosning: form.planlosning,
            bekvamligheter: form.bekvamligheter,
            tillganglig_typ: form.tillganglig_typ,
            tillganglig_fran: form.tillganglig_fran,
          },
        }),
      })
      const data = await res.json()
      if (data.text) set(mode === 'kort' ? 'kort_beskrivning' : 'beskrivning', data.text)
    } finally {
      mode === 'kort' ? setGenKort(false) : setGenLang(false)
    }
  }

  return (
    <>
      <MF label={`KORT BESKRIVNING (${(form.kort_beskrivning || '').length}/150)`}>
        <textarea spellCheck={true} style={{ ...inp, minHeight: 60, resize: 'vertical' }} maxLength={150} value={form.kort_beskrivning || ''} onChange={e => set('kort_beskrivning', e.target.value)} onFocus={fo} onBlur={fb} placeholder="Kort säljande text för listvyn..." />
        <button onClick={() => generera('kort')} disabled={genKort}
          style={{ alignSelf: 'flex-start', marginTop: 6, background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 12px', color: '#E8C96A', cursor: 'pointer', fontSize: 12 }}>
          {genKort ? 'Genererar...' : '✨ Generera med AI'}
        </button>
      </MF>
      <MF label="LÅNG BESKRIVNING">
        <textarea spellCheck={true} style={{ ...inp, minHeight: 160, resize: 'vertical' }} value={form.beskrivning || ''} onChange={e => set('beskrivning', e.target.value)} onFocus={fo} onBlur={fb} placeholder="Lång säljtext, 200-400 ord..." />
        <button onClick={() => generera('lang')} disabled={genLang}
          style={{ alignSelf: 'flex-start', marginTop: 6, background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '6px 12px', color: '#E8C96A', cursor: 'pointer', fontSize: 12 }}>
          {genLang ? 'Genererar...' : '✨ Generera med AI'}
        </button>
      </MF>
    </>
  )
}

function KontaktTab({ form, set, inp, fo, fb }: TabProps) {
  const valjPerson = (namn: string) => {
    set('kontakt_namn', namn)
  }
  return (
    <>
      <MF label="KONTAKTPERSON">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PERSONAL.map(p => (
            <div key={p} onClick={() => valjPerson(p)}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${form.kontakt_namn === p ? '#E8C96A' : '#2a2a2a'}`, background: form.kontakt_namn === p ? 'rgba(232,201,106,0.1)' : '#111', color: form.kontakt_namn === p ? '#E8C96A' : '#888' }}>
              {p}
            </div>
          ))}
        </div>
      </MF>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <MF label="NAMN">
          <input spellCheck={false} style={inp} value={form.kontakt_namn || ''} onChange={e => set('kontakt_namn', e.target.value)} onFocus={fo} onBlur={fb} />
        </MF>
        <MF label="TITEL">
          <input spellCheck={true} style={inp} value={form.kontakt_titel || ''} onChange={e => set('kontakt_titel', e.target.value)} onFocus={fo} onBlur={fb} placeholder="T.ex. Fastighetsförvaltare" />
        </MF>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <MF label="E-POST">
          <input spellCheck={false} type="email" style={inp} value={form.kontakt_epost || ''} onChange={e => set('kontakt_epost', e.target.value)} onFocus={fo} onBlur={fb} />
        </MF>
        <MF label="TELEFON">
          <input spellCheck={false} style={inp} value={form.kontakt_telefon || ''} onChange={e => set('kontakt_telefon', e.target.value)} onFocus={fo} onBlur={fb} />
        </MF>
      </div>
    </>
  )
}

// ---------- Media-fliken (drag & drop, mönster från BilderTab.tsx) ----------
function MediaTab({ objektId, bilder, onChange }: { objektId: string; bilder: string[]; onChange: (b: string[]) => void }) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const sb = createClient()
  const confirm = useConfirm()

  const uploadFiler = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!arr.length) return
    setUploading(true)
    for (const file of arr) {
      const namn = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      await sb.storage.from('hyresobjekt-bilder').upload(`${objektId}/${namn}`, file, { upsert: false })
    }
    const { data } = await sb.storage.from('hyresobjekt-bilder').list(objektId, { sortBy: { column: 'created_at', order: 'asc' } })
    if (data) {
      const urls = data.map(f => sb.storage.from('hyresobjekt-bilder').getPublicUrl(`${objektId}/${f.name}`).data.publicUrl)
      onChange(urls)
    }
    setUploading(false)
  }

  const raderaBild = async (url: string) => {
    const path = url.split('/hyresobjekt-bilder/')[1]
    if (!path) return
    await sb.storage.from('hyresobjekt-bilder').remove([path])
    onChange(bilder.filter(u => u !== url))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) uploadFiler(e.dataTransfer.files)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragOver ? '#E8C96A' : '#2a2a2a'}`,
          borderRadius: 10,
          padding: '32px 20px',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: dragOver ? 'rgba(232,201,106,0.05)' : 'transparent',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>{uploading ? '⏳' : '🖼️'}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: uploading ? '#E8C96A' : '#e0e0e0', marginBottom: 4 }}>
          {uploading ? 'Laddar upp...' : 'Dra och släpp bilder här'}
        </div>
        <div style={{ fontSize: 11, color: '#666' }}>eller klicka för att välja • jpg, png, webp</div>
        <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
          onChange={e => e.target.files && uploadFiler(e.target.files)} />
      </div>

      {bilder.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#666', fontSize: 13 }}>Inga bilder uppladdade ännu</div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: '#666', fontWeight: 600, letterSpacing: 1 }}>{bilder.length} BILD{bilder.length !== 1 ? 'ER' : ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {bilder.map((url, i) => (
              <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#111', border: '1px solid #2a2a2a', aspectRatio: '4/3' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <button onClick={async () => { if (await confirm({ message: 'Ta bort bild?', danger: true, confirmLabel: 'Ta bort' })) raderaBild(url) }}
                  style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 12, lineHeight: '24px', textAlign: 'center', padding: 0 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------- Förhandsvisning ----------
function ForhandsvisningModal({ form, onClose }: { form: Hyresobjekt; onClose: () => void }) {
  const bild = form.bilder[0]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#0d0d0d', zIndex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#E8C96A' }}>Förhandsvisning — hur annonsen ser ut på hemsidan</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Kort i listan */}
          <div>
            <div style={{ fontSize: 11, color: '#666', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>KORT I LISTAN</div>
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, overflow: 'hidden', maxWidth: 340 }}>
              <div style={{ aspectRatio: '4/3', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {bild ? <img src={bild} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#444', fontSize: 12 }}>Ingen bild</span>}
              </div>
              <div style={{ padding: 14 }}>
                {form.typer[0] && (
                  <span style={{ background: 'rgba(232,201,106,0.1)', color: '#E8C96A', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>{TYP_LABEL[form.typer[0]] || form.typer[0]}</span>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0', marginTop: 8 }}>{form.titel || form.intern_namn || 'Namnlöst objekt'}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{form.fastighet || 'Adress saknas'}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#666', marginTop: 8 }}>
                  <span>{form.total_yta ? `${form.total_yta} kvm` : '—'}</span>
                  <span>{form.hyra ? `${fmtKr(form.hyra)}/mån` : '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detaljvy */}
          <div>
            <div style={{ fontSize: 11, color: '#666', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>DETALJVY</div>
            <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ aspectRatio: '16/7', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {bild ? <img src={bild} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#444', fontSize: 12 }}>Ingen bild</span>}
              </div>
              {form.bilder.length > 1 && (
                <div style={{ display: 'flex', gap: 6, padding: '10px 20px 0' }}>
                  {form.bilder.slice(1, 6).map((b, i) => (
                    <div key={i} style={{ width: 64, height: 48, borderRadius: 6, overflow: 'hidden', background: '#111' }}>
                      <img src={b} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {form.typer.map(t => (
                    <span key={t} style={{ background: 'rgba(232,201,106,0.1)', color: '#E8C96A', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>{TYP_LABEL[t] || t}</span>
                  ))}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#e0e0e0' }}>{form.titel || form.intern_namn || 'Namnlöst objekt'}</div>
                <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>{form.fastighet || 'Adress saknas'}</div>

                <div style={{ display: 'flex', gap: 24, marginTop: 18, flexWrap: 'wrap' }}>
                  <Faktaruta label="Yta" value={form.total_yta ? `${form.total_yta} kvm` : '—'} />
                  <Faktaruta label="Hyra" value={form.hyra ? `${fmtKr(form.hyra)}/mån` : '—'} />
                  <Faktaruta label="Kr/kvm/år" value={form.kr_kvm_ar ? `${fmtKr(form.kr_kvm_ar)}/kvm/år` : '—'} />
                  <Faktaruta label="Tillgänglig" value={form.tillganglig_typ === 'datum' && form.tillganglig_fran ? form.tillganglig_fran : 'Enligt ök.'} />
                </div>

                {form.bekvamligheter.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 11, color: '#666', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>BEKVÄMLIGHETER</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {form.bekvamligheter.map(b => (
                        <span key={b} style={{ background: '#111', border: '1px solid #2a2a2a', color: '#aaa', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{b}</span>
                      ))}
                    </div>
                  </div>
                )}

                {form.beskrivning && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 11, color: '#666', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>OM LOKALEN</div>
                    <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{form.beskrivning}</div>
                  </div>
                )}

                <button style={{ marginTop: 24, background: '#E8C96A', border: 'none', borderRadius: 10, padding: '12px 24px', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  📩 Skicka intresseanmälan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Faktaruta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#666', fontWeight: 700, letterSpacing: 1 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 15, color: '#e0e0e0', fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  )
}
