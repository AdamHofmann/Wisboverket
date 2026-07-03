'use client'

// Källa: src/app/kommunikation/page.tsx (Tailwind, lucide, blå/ljus).
// Portad till: inline dark/gold-styles + emoji-ikoner. Data via de migrerade
// API-routerna /api/fastigheter/{meddelanden,hyresgaster,objekt}.
//
// VIKTIGT om datashape (skiljer sig från källan):
//  * Meddelande-rader är snake_case (created_at). _count.mottagare byggs i API:t.
//  * Hyresgast → fastighet-relationen går via junction i den migrerade API:t:
//    hyresavtal[].lokaler[].lokal.fastighet  (källan hade hyresavtal[].lokal.fastighet).
//    fastighetIdsForHyresgast() klarar båda formerna (junction + gammal singular).

import { useEffect, useState } from 'react'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost } from '@/components/fastigheter/styles'

interface Hyresgast {
  id: string
  namn: string
  epost: string | null
  fakturamail: string | null
  // Junction-form från migrerad API (kan även vara källans singular 'lokal').
  hyresavtal?: {
    lokal?: { fastighet?: { id: string; namn: string } | null } | null
    lokaler?: { lokal?: { fastighet?: { id: string; namn: string } | null } | null }[] | null
  }[]
}

interface Mottagare {
  namn: string
  epost: string
  status: string
}

interface Meddelande {
  id: string
  amne: string
  brodel: string
  fran: string
  status: string
  created_at: string
  mottagare: Mottagare[]
  _count: { mottagare: number }
}

interface Fastighet {
  id: string
  namn: string
}

// Plockar ut fastighets-id:n för en hyresgäst oavsett relationsform (junction eller singular).
function fastighetIdsForHyresgast(h: Hyresgast): string[] {
  const ids: string[] = []
  for (const a of h.hyresavtal ?? []) {
    if (a.lokal?.fastighet?.id) ids.push(a.lokal.fastighet.id)
    for (const l of a.lokaler ?? []) {
      if (l.lokal?.fastighet?.id) ids.push(l.lokal.fastighet.id)
    }
  }
  return ids
}

const section: React.CSSProperties = { marginBottom: 24 }
const secLabel: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 12,
  paddingBottom: 6, borderBottom: `1px solid ${C.borderSoft}`,
}

export default function KommunikationPage() {
  const [meddelanden, setMeddelanden] = useState<Meddelande[]>([])
  const [hyresgaster, setHyresgaster] = useState<Hyresgast[]>([])
  const [fastigheter, setFastigheter] = useState<Fastighet[]>([])
  const [loading, setLoading] = useState(true)

  const [showNew, setShowNew] = useState(false)
  const [amne, setAmne] = useState('')
  const [brodel, setBrodel] = useState('')
  const [valdaMottagare, setValdaMottagare] = useState<Set<string>>(new Set())
  const [filterFastighet, setFilterFastighet] = useState('')
  const [sending, setSending] = useState(false)

  const [showDetail, setShowDetail] = useState<Meddelande | null>(null)

  const load = () => {
    Promise.all([
      fetch('/api/fastigheter/meddelanden').then(r => r.json()),
      fetch('/api/fastigheter/hyresgaster').then(r => r.json()),
      fetch('/api/fastigheter/objekt').then(r => r.json()),
    ]).then(([m, h, f]) => {
      if (Array.isArray(m)) setMeddelanden(m)
      if (Array.isArray(h)) setHyresgaster(h)
      if (Array.isArray(f)) setFastigheter(f)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setAmne('')
    setBrodel('')
    setValdaMottagare(new Set())
    setFilterFastighet('')
    setShowNew(true)
  }

  const toggleMottagare = (id: string) => {
    setValdaMottagare(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    const filtered = filterFastighet
      ? hyresgaster.filter(h => fastighetIdsForHyresgast(h).includes(filterFastighet))
      : hyresgaster
    const allIds = filtered.filter(h => h.epost).map(h => h.id)
    setValdaMottagare(new Set(allIds))
  }

  const selectNone = () => setValdaMottagare(new Set())

  const sendMessage = async () => {
    const mottagare = hyresgaster
      .filter(h => valdaMottagare.has(h.id) && h.epost)
      .map(h => ({ hyresgastId: h.id, namn: h.namn, epost: h.epost! }))

    if (mottagare.length === 0 || !amne || !brodel) return

    setSending(true)
    await fetch('/api/fastigheter/meddelanden', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amne, brodel, mottagare }),
    })
    setSending(false)
    setShowNew(false)
    load()
  }

  const filteredHyresgaster = filterFastighet
    ? hyresgaster.filter(h => fastighetIdsForHyresgast(h).includes(filterFastighet))
    : hyresgaster

  const mottagareMedMail = filteredHyresgaster.filter(h => h.epost)
  const mottagareUtanMail = filteredHyresgaster.filter(h => !h.epost)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Kommunikation</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{meddelanden.length} skickade meddelanden</p>
        </div>
        <button onClick={openNew} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✉️ Nytt meddelande
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>
      ) : meddelanden.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', background: C.panel, borderRadius: 12, border: `1px solid ${C.borderSoft}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
          <p style={{ color: C.muted }}>Inga meddelanden skickade ännu</p>
          <button onClick={openNew} style={{ ...btnGhost, marginTop: 16, color: C.gold, borderColor: C.gold }}>Skicka första meddelandet</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {meddelanden.map(m => (
            <div
              key={m.id}
              onClick={() => setShowDetail(m)}
              style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 16, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontWeight: 600, color: C.text, margin: 0 }}>{m.amne}</h3>
                  <p style={{ fontSize: 13, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.brodel.replace(/<[^>]*>/g, '').slice(0, 100)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.muted2 }}>
                    👥 {m._count.mottagare}
                  </span>
                  <span style={{ fontSize: 12, color: C.muted2 }}>{new Date(m.created_at).toLocaleDateString('sv-SE')}</span>
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {m.mottagare.slice(0, 5).map((mot, i) => (
                  <span key={i} style={{ fontSize: 11, background: C.field, color: C.text2, borderRadius: 6, padding: '2px 6px' }}>{mot.namn}</span>
                ))}
                {m.mottagare.length > 5 && <span style={{ fontSize: 11, color: C.muted2 }}>+{m.mottagare.length - 5} till</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nytt meddelande */}
      <SlideOver
        open={showNew}
        onClose={() => setShowNew(false)}
        title="Nytt meddelande"
        width="lg"
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowNew(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button
              onClick={sendMessage}
              disabled={sending || valdaMottagare.size === 0 || !amne || !brodel}
              style={{ ...btnPrimary, flex: 1, opacity: (sending || valdaMottagare.size === 0 || !amne || !brodel) ? 0.5 : 1 }}
            >
              ✉️ {sending ? 'Skickar...' : `Skicka till ${valdaMottagare.size} mottagare`}
            </button>
          </div>
        }
      >
        <div style={{ padding: 24 }}>
          {/* Mottagare */}
          <section style={section}>
            <h4 style={secLabel}>Mottagare</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <select
                style={{ ...inp, width: 'auto', minWidth: 180 }}
                onFocus={fo}
                onBlur={fb}
                value={filterFastighet}
                onChange={e => { setFilterFastighet(e.target.value); setValdaMottagare(new Set()) }}
              >
                <option value="">Alla fastigheter</option>
                {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
              </select>
              <button onClick={selectAll} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 12 }}>Välj alla</button>
              <button onClick={selectNone} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12 }}>Avmarkera</button>
              <span style={{ fontSize: 12, color: C.muted2, marginLeft: 'auto' }}>{valdaMottagare.size} valda</span>
            </div>

            <div style={{ maxHeight: 192, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, borderRadius: 8, border: `1px solid ${C.border}`, padding: 8 }}>
              {mottagareMedMail.map(h => {
                const vald = valdaMottagare.has(h.id)
                return (
                  <label
                    key={h.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, padding: '6px 8px', cursor: 'pointer', background: vald ? C.goldSoft : 'transparent' }}
                  >
                    <input type="checkbox" checked={vald} onChange={() => toggleMottagare(h.id)} />
                    <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{h.namn}</span>
                    <span style={{ fontSize: 12, color: C.muted2 }}>{h.epost}</span>
                  </label>
                )
              })}
              {mottagareUtanMail.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.borderSoft}` }}>
                  <p style={{ fontSize: 12, color: C.warn, marginBottom: 4 }}>Saknar e-post:</p>
                  {mottagareUtanMail.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', fontSize: 13, color: C.muted2 }}>
                      <span style={{ width: 16 }} />
                      {h.namn} <span style={{ fontSize: 12, fontStyle: 'italic' }}>— ingen e-post</span>
                    </div>
                  ))}
                </div>
              )}
              {mottagareMedMail.length === 0 && mottagareUtanMail.length === 0 && (
                <p style={{ fontSize: 12, color: C.muted2, fontStyle: 'italic', padding: 8, margin: 0 }}>Inga hyresgäster matchar filtret.</p>
              )}
            </div>
          </section>

          {/* Ämne & meddelande */}
          <section style={section}>
            <h4 style={secLabel}>Meddelande</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Ämne</label>
                <input style={inp} onFocus={fo} onBlur={fb} value={amne} onChange={e => setAmne(e.target.value)} placeholder="T.ex. Information om planerat underhåll" />
              </div>
              <div>
                <label style={lbl}>Meddelande</label>
                <textarea rows={8} style={{ ...inp, resize: 'none' }} onFocus={fo} onBlur={fb} value={brodel} onChange={e => setBrodel(e.target.value)} placeholder="Skriv ditt meddelande här..." />
              </div>
            </div>
          </section>

          {/* Förhandsgranskning */}
          {amne && brodel && valdaMottagare.size > 0 && (
            <div style={{ borderRadius: 8, background: C.field, border: `1px solid ${C.border}`, padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Förhandsgranskning</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{amne}</p>
              <p style={{ fontSize: 13, color: C.text2, marginTop: 8, whiteSpace: 'pre-wrap' }}>{brodel}</p>
              <p style={{ fontSize: 12, color: C.muted2, marginTop: 12, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 8 }}>
                Skickas till {valdaMottagare.size} mottagare
              </p>
            </div>
          )}
        </div>
      </SlideOver>

      {/* Detalj */}
      <SlideOver
        open={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={showDetail?.amne || ''}
        subtitle={showDetail ? new Date(showDetail.created_at).toLocaleDateString('sv-SE') : undefined}
        width="md"
      >
        {showDetail && (
          <div style={{ padding: 24 }}>
            <div style={{ borderRadius: 8, background: C.field, border: `1px solid ${C.borderSoft}`, padding: 16, marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: C.text2, whiteSpace: 'pre-wrap', margin: 0 }}>{showDetail.brodel}</p>
            </div>

            <div>
              <h4 style={secLabel}>Mottagare ({showDetail.mottagare.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {showDetail.mottagare.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 6, padding: '8px 12px', background: C.field }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0 }}>{m.namn}</p>
                      <p style={{ fontSize: 12, color: C.muted2, margin: 0 }}>{m.epost}</p>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.ok }}>✓ Skickat</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  )
}
