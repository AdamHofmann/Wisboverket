'use client'

// Källa: src/app/lokaler/page.tsx (Tailwind, lucide, blå/ljus).
// Portad till: inline dark/gold-styles, emoji-ikoner, data via /api/fastigheter/lokaler
// och /api/fastigheter/objekt. SlideOver + tokens från @/components/fastigheter.
//
// VIKTIGT om fältnamn: Supabase returnerar snake_case-kolumner. Lokal-raden har
// fastighet_id/byggnad_id/beteckning_id, men de nästlade aliasen behåller käll-UI:ts
// nycklar (fastighet, byggnad, beteckning, hyresavtal, byggnader, beteckningar).
// Formuläret POSTar camelCase (fastighetId ...) → route-parsern översätter till snake_case.

import { useEffect, useState } from 'react'
import { useBolag } from '@/components/fastigheter/BolagContext'
import { useIsMobile } from '@/hooks/useMediaQuery'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost, btnDanger } from '@/components/fastigheter/styles'
import { useConfirm } from '@/components/ConfirmDialog'
import Sokfalt from '@/components/Sokfalt'

interface Byggnad { id: string; namn: string }
interface Beteckning { id: string; beteckning: string }
interface Fastighet {
  id: string
  namn: string
  bolag_id?: string | null
  byggnader?: Byggnad[]
  beteckningar?: Beteckning[]
}
interface Lokal {
  id: string
  namn: string
  typ: string
  yta: number
  vaning: number | null
  status: string
  fastighet_id: string
  fastighet: Fastighet
  byggnad_id: string | null
  byggnad?: Byggnad | null
  beteckning_id: string | null
  beteckning?: Beteckning | null
  bashyra: number | null
  moms: number
  hyresavtal?: { hyresavtal: { status: string; slutdatum: string | null; hyresgast: { namn: string } } }[]
}

const typLabels: Record<string, string> = {
  kontor: 'Kontor', lager: 'Lager/Verkstad', lokal: 'Lokal', bostad: 'Bostad',
  garage: 'Garage', mark: 'Mark/Utomhus', parkering: 'Parkering',
}

// Statusfärger mörkanpassade (käll-appens bg-green/orange/yellow → guld/mörk-palett).
const statusStyle: Record<string, React.CSSProperties> = {
  ledig: { background: 'rgba(74,222,128,0.12)', color: C.ok },
  uthyrd: { background: 'rgba(251,146,60,0.12)', color: C.warn },
  uppsagd: { background: 'rgba(234,179,8,0.12)', color: '#eab308' },
}

const formatSEK = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const th: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
  color: C.muted2, textTransform: 'uppercase',
}
const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: C.muted, verticalAlign: 'middle' }

export default function LokalerPage() {
  const [items, setItems] = useState<Lokal[]>([])
  const [fastigheter, setFastigheter] = useState<Fastighet[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Lokal | null>(null)
  const [form, setForm] = useState({ namn: '', typ: 'lokal', yta: '', vaning: '', status: 'ledig', fastighetId: '', byggnadId: '', beteckningId: '', bashyra: '', arshyra: '', moms: '0' })
  const [saving, setSaving] = useState(false)
  const [filterFastighet, setFilterFastighet] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<string>('namn')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const { valtBolagId } = useBolag()
  const isMobile = useIsMobile()
  const confirm = useConfirm()

  const load = () => {
    const fastUrl = valtBolagId ? `/api/fastigheter/objekt?bolagId=${valtBolagId}` : '/api/fastigheter/objekt'
    Promise.all([
      fetch('/api/fastigheter/lokaler').then(r => r.json()),
      fetch(fastUrl).then(r => r.json()),
    ]).then(([l, f]) => {
      if (Array.isArray(l)) setItems(l)
      if (Array.isArray(f)) setFastigheter(f)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [valtBolagId]) // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => {
    setEditing(null)
    setForm({ namn: '', typ: 'lokal', yta: '', vaning: '', status: 'ledig', fastighetId: fastigheter[0]?.id || '', byggnadId: '', beteckningId: '', bashyra: '', arshyra: '', moms: '0' })
    setOpen(true)
  }

  const openEdit = (l: Lokal) => {
    setEditing(l)
    setForm({
      namn: l.namn, typ: l.typ, yta: String(l.yta), vaning: l.vaning != null ? String(l.vaning) : '',
      status: l.status, fastighetId: l.fastighet_id, byggnadId: l.byggnad_id || '', beteckningId: l.beteckning_id || '',
      bashyra: l.bashyra != null ? String(l.bashyra) : '',
      arshyra: l.bashyra != null ? String(Math.round(l.bashyra * 12)) : '',
      moms: String(l.moms ?? 0),
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    const url = editing ? `/api/fastigheter/lokaler/${editing.id}` : '/api/fastigheter/lokaler'
    const method = editing ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); setOpen(false); load()
  }

  const remove = async (id: string) => {
    if (!(await confirm({ message: 'Ta bort lokal?', danger: true, confirmLabel: 'Ta bort' }))) return
    await fetch(`/api/fastigheter/lokaler/${id}`, { method: 'DELETE' })
    setOpen(false); load()
  }

  // Hyresgäst-namn för sök + sortering.
  const hyresgastNamn = (l: Lokal) => l.hyresavtal?.[0]?.hyresavtal?.hyresgast?.namn || ''

  // Bolagsfilter: fastigheter-listan är redan hämtad bolagsscopad (objekt?bolagId=…).
  // När ett bolag är valt visar vi bara lokaler vars fastighet finns i den listan.
  const bolagFastighetIds = new Set(fastigheter.map(f => f.id))

  let filtered = filterFastighet ? items.filter(l => l.fastighet_id === filterFastighet) : items
  if (valtBolagId) filtered = filtered.filter(l => bolagFastighetIds.has(l.fastighet_id))
  if (filterStatus) filtered = filtered.filter(l => l.status === filterStatus)
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(l =>
      l.namn.toLowerCase().includes(q)
      || (typLabels[l.typ] || l.typ).toLowerCase().includes(q)
      || (l.fastighet?.namn || '').toLowerCase().includes(q)
      || (l.byggnad?.namn || '').toLowerCase().includes(q)
      || (l.beteckning?.beteckning || '').toLowerCase().includes(q)
      || hyresgastNamn(l).toLowerCase().includes(q)
    )
  }

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => (d === 1 ? -1 : 1))
    else { setSortCol(col); setSortDir(1) }
  }

  const sorted = [...filtered].sort((a, b) => {
    let av: string | number = '', bv: string | number = ''
    switch (sortCol) {
      case 'namn': av = a.namn.toLowerCase(); bv = b.namn.toLowerCase(); break
      case 'fastighet': av = (a.fastighet?.namn || '').toLowerCase(); bv = (b.fastighet?.namn || '').toLowerCase(); break
      case 'typ': av = (typLabels[a.typ] || a.typ).toLowerCase(); bv = (typLabels[b.typ] || b.typ).toLowerCase(); break
      case 'yta': av = a.yta; bv = b.yta; break
      case 'bashyra': av = a.bashyra ?? -1; bv = b.bashyra ?? -1; break
      case 'kvmar': av = a.bashyra && a.yta ? (a.bashyra * 12) / a.yta : -1; bv = b.bashyra && b.yta ? (b.bashyra * 12) / b.yta : -1; break
      case 'status': av = a.status; bv = b.status; break
      case 'hyresgast': av = hyresgastNamn(a).toLowerCase(); bv = hyresgastNamn(b).toLowerCase(); break
    }
    return av < bv ? -sortDir : av > bv ? sortDir : 0
  })

  const filterSelect: React.CSSProperties = isMobile
    ? { ...inp, width: '100%' }
    : { ...inp, width: 'auto', minWidth: 160 }

  // Statusbadge återanvänds i både tabell (desktop) och kort (mobil).
  const renderStatus = (l: Lokal) => {
    const avtal = l.hyresavtal?.[0]?.hyresavtal
    const visadStatus = avtal?.status === 'uppsagd' ? 'uppsagd' : l.status
    const slutdatum = avtal?.status === 'uppsagd' && avtal.slutdatum
      ? new Date(avtal.slutdatum).toLocaleDateString('sv-SE')
      : null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'inline-flex', width: 'fit-content', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, ...(statusStyle[visadStatus] || { background: C.field, color: C.muted }) }}>
          {visadStatus === 'uppsagd' ? 'Uppsagd' : visadStatus === 'ledig' ? 'Ledig' : 'Uthyrd'}
        </span>
        {slutdatum && <span style={{ fontSize: 11, color: C.muted2 }}>Slutar {slutdatum}</span>}
      </div>
    )
  }

  const renderKvmAr = (l: Lokal) =>
    l.bashyra && l.yta ? (
      <span title={l.typ === 'mark' ? 'kr/kvm/år mark' : 'kr/kvm/år lokal'}>
        {Math.round((l.bashyra * 12) / l.yta).toLocaleString('sv-SE')}
        {l.typ === 'mark' && <span style={{ marginLeft: 4, fontSize: 11, color: C.muted2 }}>(mark)</span>}
      </span>
    ) : '–'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, overflowX: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Lokaler</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{filtered.length} lokaler</p>
        </div>
        <button onClick={openNew} style={btnPrimary}>+ Ny lokal</button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
        <Sokfalt value={search} onChange={setSearch} placeholder="Sök namn, fastighet, typ, hyresgäst..." style={{ width: isMobile ? '100%' : 260 }} />
        <select value={filterFastighet} onChange={e => setFilterFastighet(e.target.value)} onFocus={fo} onBlur={fb} style={filterSelect}>
          <option value="">Alla fastigheter</option>
          {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} onFocus={fo} onBlur={fb} style={filterSelect}>
          <option value="">Alla statusar</option>
          <option value="ledig">Ledig</option>
          <option value="uthyrd">Uthyrd</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>
      ) : isMobile ? (
        sorted.length === 0 ? (
          <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Inga lokaler</div>
        ) : (
          <div>
            {sorted.map((l) => (
              <div key={l.id} onClick={() => openEdit(l)}
                style={{ border: `1px solid ${C.borderSoft}`, borderRadius: 10, background: C.panel, padding: 12, marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{l.namn}</div>
                  <button onClick={(e) => { e.stopPropagation(); remove(l.id) }} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 16, padding: 4, marginTop: -2 }}>🗑️</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 12, rowGap: 6, fontSize: 13 }}>
                  <span style={{ color: C.muted2 }}>Fastighet</span><span style={{ color: C.muted }}>{l.fastighet?.namn || '–'}</span>
                  <span style={{ color: C.muted2 }}>Typ</span><span style={{ color: C.muted }}>{typLabels[l.typ] || l.typ}</span>
                  <span style={{ color: C.muted2 }}>Yta</span><span style={{ color: C.muted }}>{l.yta} kvm</span>
                  <span style={{ color: C.muted2 }}>Hyra/mån</span><span style={{ color: C.muted }}>{l.bashyra ? formatSEK(l.bashyra) : '–'}</span>
                  <span style={{ color: C.muted2 }}>kr/kvm/år</span><span style={{ color: C.muted2 }}>{renderKvmAr(l)}</span>
                  <span style={{ color: C.muted2 }}>Status</span><span>{renderStatus(l)}</span>
                  <span style={{ color: C.muted2 }}>Hyresgäst</span><span style={{ color: C.muted }}>{l.hyresavtal?.[0]?.hyresavtal?.hyresgast?.namn || '–'}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.borderSoft}`, background: C.panel2 }}>
                  {([
                    { key: 'namn', label: 'Namn/Nr' },
                    { key: 'fastighet', label: 'Fastighet' },
                    { key: 'typ', label: 'Typ' },
                    { key: 'yta', label: 'Yta' },
                    { key: 'bashyra', label: 'Hyra/mån' },
                    { key: 'kvmar', label: 'kr/kvm/år' },
                    { key: 'status', label: 'Status' },
                    { key: 'hyresgast', label: 'Hyresgäst' },
                    { key: '', label: '' },
                  ] as const).map((h, i) => (
                    <th key={i} onClick={() => h.key && toggleSort(h.key)} style={{ ...th, cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                      {h.label}{h.key && sortCol === h.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Inga lokaler</td></tr>
                ) : sorted.map((l) => (
                  <tr key={l.id} onClick={() => openEdit(l)} style={{ borderTop: `1px solid ${C.borderSoft}`, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...td, fontWeight: 600, color: C.text }}>{l.namn}</td>
                    <td style={td}>{l.fastighet?.namn}</td>
                    <td style={td}>{typLabels[l.typ] || l.typ}</td>
                    <td style={td}>{l.yta} kvm</td>
                    <td style={td}>{l.bashyra ? formatSEK(l.bashyra) : '–'}</td>
                    <td style={{ ...td, color: C.muted2 }}>{renderKvmAr(l)}</td>
                    <td style={td}>{renderStatus(l)}</td>
                    <td style={td}>{l.hyresavtal?.[0]?.hyresavtal?.hyresgast?.namn || '–'}</td>
                    <td style={td}>
                      <button onClick={(e) => { e.stopPropagation(); remove(l.id) }} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 14, padding: 6 }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? editing.namn : 'Ny lokal'}
        subtitle={editing ? `${typLabels[editing.typ] || editing.typ} · ${editing.yta} kvm` : undefined}
        width="md"
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            {editing && <button onClick={() => remove(editing.id)} style={btnDanger}>Ta bort</button>}
            <button onClick={() => setOpen(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button onClick={save} disabled={saving || !form.namn || !form.fastighetId} style={{ ...btnPrimary, flex: 1, opacity: saving || !form.namn || !form.fastighetId ? 0.5 : 1 }}>
              {saving ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        }
      >
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={lbl}>Fastighet</label>
            <select style={inp} onFocus={fo} onBlur={fb} value={form.fastighetId} onChange={e => setForm({ ...form, fastighetId: e.target.value, byggnadId: '', beteckningId: '' })}>
              {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
            </select>
          </div>
          {(() => {
            const vald = fastigheter.find(f => f.id === form.fastighetId)
            const bygg = vald?.byggnader || []
            const bet = vald?.beteckningar || []
            return <>
              {bet.length > 0 && (
                <div>
                  <label style={lbl}>Fastighetsbeteckning</label>
                  <select style={inp} onFocus={fo} onBlur={fb} value={form.beteckningId} onChange={e => setForm({ ...form, beteckningId: e.target.value })}>
                    <option value="">Ej vald</option>
                    {bet.map(b => <option key={b.id} value={b.id}>{b.beteckning}</option>)}
                  </select>
                </div>
              )}
              {bygg.length > 0 && (
                <div>
                  <label style={lbl}>Byggnad</label>
                  <select style={inp} onFocus={fo} onBlur={fb} value={form.byggnadId} onChange={e => setForm({ ...form, byggnadId: e.target.value })}>
                    <option value="">Ej vald</option>
                    {bygg.map(b => <option key={b.id} value={b.id}>{b.namn}</option>)}
                  </select>
                </div>
              )}
            </>
          })()}
          <div>
            <label style={lbl}>Namn / nummer</label>
            <input style={inp} onFocus={fo} onBlur={fb} value={form.namn} onChange={e => setForm({ ...form, namn: e.target.value })} placeholder="T.ex. Lgh 1001 eller Lokal A" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>Typ</label>
              <select style={inp} onFocus={fo} onBlur={fb} value={form.typ} onChange={e => setForm({ ...form, typ: e.target.value })}>
                <option value="kontor">Kontor</option>
                <option value="lager">Lager/Verkstad</option>
                <option value="lokal">Lokal</option>
                <option value="bostad">Bostad</option>
                <option value="garage">Garage</option>
                <option value="parkering">Parkering</option>
                <option value="mark">Mark/Utomhus</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select style={inp} onFocus={fo} onBlur={fb} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="ledig">Ledig</option>
                <option value="uthyrd">Uthyrd</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>Yta (kvm)</label>
              <input type="number" style={inp} onFocus={fo} onBlur={fb} value={form.yta} onChange={e => setForm({ ...form, yta: e.target.value })} placeholder="65" />
            </div>
            <div>
              <label style={lbl}>Våning</label>
              <input type="number" style={inp} onFocus={fo} onBlur={fb} value={form.vaning} onChange={e => setForm({ ...form, vaning: e.target.value })} placeholder="2" />
            </div>
          </div>
          <div>
            <label style={{ ...lbl, color: C.muted2, letterSpacing: 1.4, marginBottom: 12 }}>Föreslagen bashyra</label>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Moms</label>
              <select style={inp} onFocus={fo} onBlur={fb} value={form.moms} onChange={e => setForm({ ...form, moms: e.target.value })}>
                <option value="0">0 % — Bostäder / ej momspliktigt</option>
                <option value="25">25 % — Kommersiella lokaler (frivillig skattskyldighet)</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Månadshyra exkl. moms</label>
                <input type="number" style={inp} onFocus={fo} onBlur={fb} value={form.bashyra} onChange={e => {
                  const manad = e.target.value
                  const ar = manad ? String(Math.round(parseFloat(manad) * 12 * 100) / 100) : ''
                  setForm({ ...form, bashyra: manad, arshyra: ar })
                }} placeholder="8 500" />
              </div>
              <div>
                <label style={lbl}>Årshyra exkl. moms</label>
                <input type="number" style={inp} onFocus={fo} onBlur={fb} value={form.arshyra} onChange={e => {
                  const ar = e.target.value
                  const manad = ar ? String(Math.round(parseFloat(ar) / 12 * 100) / 100) : ''
                  setForm({ ...form, arshyra: ar, bashyra: manad })
                }} placeholder="102 000" />
              </div>
            </div>
            {form.bashyra && (() => {
              const manadExkl = parseFloat(form.bashyra)
              const moms = parseFloat(form.moms || '0')
              const manadInkl = Math.round(manadExkl * (1 + moms / 100))
              const arInkl = manadInkl * 12
              const yta = form.yta ? parseFloat(form.yta) : 0
              const kvmAr = yta > 0 ? Math.round((manadExkl * 12) / yta) : 0
              const isMark = form.typ === 'mark'
              return (
                <div style={{ marginTop: 12, borderRadius: 8, background: C.goldSoft, border: `1px solid ${C.border}`, padding: '12px 16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 4, fontSize: 13 }}>
                    <p style={{ color: C.muted, margin: 0 }}>Inkl. moms/mån:</p>
                    <p style={{ fontWeight: 600, color: C.text, margin: 0 }}>{manadInkl.toLocaleString('sv-SE')} kr</p>
                    <p style={{ color: C.muted, margin: 0 }}>Inkl. moms/år:</p>
                    <p style={{ fontWeight: 600, color: C.text, margin: 0 }}>{arInkl.toLocaleString('sv-SE')} kr</p>
                    {kvmAr > 0 && <>
                      <p style={{ color: C.muted, margin: 0 }}>{isMark ? 'kr/kvm/år mark (exkl.):' : 'kr/kvm/år lokal (exkl.):'}</p>
                      <p style={{ fontWeight: 600, color: C.gold, margin: 0 }}>{kvmAr.toLocaleString('sv-SE')} kr</p>
                    </>}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </SlideOver>
    </div>
  )
}
