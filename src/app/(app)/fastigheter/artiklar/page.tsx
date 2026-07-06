'use client'

// Artikelregister — hanteringssida för fakturaartiklar (f_artikel).
// Tabell (Kod, Benämning, À-pris, Moms %, Konto, Aktiv) + "+ Ny artikel" som öppnar
// en SlideOver för skapa/redigera (samma stil som manuell-faktura-panelen).
// Avaktivering (mjuk borttagning) via useConfirm. Inaktiva artiklar tonas ner och
// döljs bakom "Visa inaktiva"-toggle. Guld/mörk-stil + mobilanpassad.

import { useEffect, useState } from 'react'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost } from '@/components/fastigheter/styles'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useConfirm } from '@/components/ConfirmDialog'
import Sokfalt from '@/components/Sokfalt'

interface Artikel {
  id: string
  kod: string
  benamning: string
  apris: number | null
  moms: number
  konto: string | null
  momskod: string | null
  aktiv: boolean
}

interface ArtikelForm {
  kod: string
  benamning: string
  apris: string
  moms: string
  konto: string
  momskod: string
}

const emptyForm: ArtikelForm = { kod: '', benamning: '', apris: '', moms: '25', konto: '', momskod: '' }

const formatSEK = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n)

export default function ArtiklarPage() {
  const isMobile = useIsMobile()
  const confirm = useConfirm()
  const [artiklar, setArtiklar] = useState<Artikel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [visaInaktiva, setVisaInaktiva] = useState(false)

  // ---- Skapa / redigera -----------------------------------------------------
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Artikel | null>(null)
  const [form, setForm] = useState<ArtikelForm>(emptyForm)
  const [sparar, setSparar] = useState(false)
  const [felmeddelande, setFelmeddelande] = useState<string | null>(null)

  const load = () => {
    fetch('/api/fastigheter/artiklar')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setArtiklar(data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const oppnaNy = () => {
    setEditing(null)
    setForm(emptyForm)
    setFelmeddelande(null)
    setOpen(true)
  }

  const oppnaRedigera = (a: Artikel) => {
    setEditing(a)
    setForm({
      kod: a.kod,
      benamning: a.benamning,
      apris: a.apris == null ? '' : String(a.apris),
      moms: String(a.moms),
      konto: a.konto ?? '',
      momskod: a.momskod ?? '',
    })
    setFelmeddelande(null)
    setOpen(true)
  }

  const formGiltig = !!form.kod.trim() && !!form.benamning.trim()

  const spara = async () => {
    if (!formGiltig) return
    setSparar(true)
    setFelmeddelande(null)
    const url = editing ? `/api/fastigheter/artiklar/${editing.id}` : '/api/fastigheter/artiklar'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kod: form.kod,
        benamning: form.benamning,
        apris: form.apris === '' ? null : Number(form.apris),
        moms: form.moms === '' ? 25 : Number(form.moms),
        konto: form.konto,
        momskod: form.momskod,
      }),
    })
    setSparar(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setFelmeddelande('Kunde inte spara: ' + (d.error || res.statusText))
      return
    }
    setOpen(false)
    load()
  }

  // Mjuk borttagning (avaktivering).
  const avaktivera = async (a: Artikel) => {
    if (!(await confirm({ message: `Avaktivera artikeln "${a.kod} – ${a.benamning}"? Den döljs från nya fakturarader men historik påverkas inte.`, danger: true, confirmLabel: 'Avaktivera' }))) return
    await fetch(`/api/fastigheter/artiklar/${a.id}`, { method: 'DELETE' })
    load()
  }

  // Återaktivera en inaktiv artikel.
  const aktivera = async (a: Artikel) => {
    await fetch(`/api/fastigheter/artiklar/${a.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktiv: true }) })
    load()
  }

  const filtered = artiklar.filter(a => {
    if (!visaInaktiva && !a.aktiv) return false
    if (search) {
      const q = search.toLowerCase()
      if (!a.kod.toLowerCase().includes(q) && !a.benamning.toLowerCase().includes(q)) return false
    }
    return true
  })

  const th: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.muted, textTransform: 'uppercase' }
  const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: C.text2 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, ...(isMobile ? { overflowX: 'hidden' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Artikelregister</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Fakturaartiklar med benämning, á-pris och moms</p>
        </div>
        <button onClick={oppnaNy} style={{ ...btnPrimary, ...(isMobile ? { width: '100%' } : {}) }}>＋ Ny artikel</button>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
        <Sokfalt value={search} onChange={setSearch} placeholder="Sök kod eller benämning..." style={{ width: isMobile ? '100%' : 260 }} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={visaInaktiva} onChange={e => setVisaInaktiva(e.target.checked)} style={{ width: 15, height: 15, accentColor: C.gold, cursor: 'pointer' }} />
          Visa inaktiva
        </label>
      </div>

      {/* Tabell / kort */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>
      ) : filtered.length === 0 ? (
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <p style={{ color: C.muted, fontSize: 13 }}>Inga artiklar {search ? 'matchar sökningen' : 'ännu'}.</p>
          {!search && (
            <button onClick={oppnaNy} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 13, cursor: 'pointer', marginTop: 12 }}>Lägg till din första artikel</button>
          )}
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(a => (
            <div
              key={a.id}
              onClick={() => oppnaRedigera(a)}
              style={{ border: `1px solid ${C.borderSoft}`, borderRadius: 10, background: C.panel, padding: 12, cursor: 'pointer', opacity: a.aktiv ? 1 : 0.5 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: 'monospace', color: C.gold, fontWeight: 700, fontSize: 13 }}>{a.kod}</div>
                  <div style={{ fontWeight: 600, color: C.text, fontSize: 15, marginTop: 2 }}>{a.benamning}</div>
                </div>
                {!a.aktiv && (
                  <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px', background: C.field, color: C.muted2, whiteSpace: 'nowrap' }}>Inaktiv</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
                <span>À-pris: <span style={{ color: C.text2 }}>{a.apris == null ? 'Variabelt' : formatSEK(a.apris)}</span></span>
                <span>Moms: <span style={{ color: C.text2 }}>{a.moms}%</span></span>
                {a.konto && <span>Konto: <span style={{ color: C.text2 }}>{a.konto}</span></span>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                {a.aktiv ? (
                  <button onClick={(e) => { e.stopPropagation(); avaktivera(a) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(248,113,113,0.1)', color: C.danger, border: 'none', cursor: 'pointer' }}>Avaktivera</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); aktivera(a) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(74,222,128,0.12)', color: C.ok, border: 'none', cursor: 'pointer' }}>Aktivera</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.borderSoft}`, background: C.panel2 }}>
                  <th style={th}>Kod</th>
                  <th style={th}>Benämning</th>
                  <th style={{ ...th, textAlign: 'right' }}>À-pris</th>
                  <th style={{ ...th, textAlign: 'right' }}>Moms %</th>
                  <th style={th}>Konto</th>
                  <th style={th}>Aktiv</th>
                  <th style={th}>Åtgärd</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr
                    key={a.id}
                    style={{ borderTop: `1px solid ${C.borderSoft}`, cursor: 'pointer', opacity: a.aktiv ? 1 : 0.5 }}
                    onClick={() => oppnaRedigera(a)}
                    onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...td, fontFamily: 'monospace', color: C.gold, fontWeight: 700 }}>{a.kod}</td>
                    <td style={{ ...td, fontWeight: 600, color: C.text }}>{a.benamning}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{a.apris == null ? <span style={{ color: C.muted2 }}>Variabelt</span> : formatSEK(a.apris)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{a.moms}%</td>
                    <td style={{ ...td, color: a.konto ? C.text2 : C.muted2, fontFamily: a.konto ? 'monospace' : undefined }}>{a.konto || '—'}</td>
                    <td style={td}>
                      {a.aktiv ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, background: 'rgba(74,222,128,0.12)', color: C.ok }}>✅ Aktiv</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, background: C.field, color: C.muted2 }}>Inaktiv</span>
                      )}
                    </td>
                    <td style={td} onClick={(e) => e.stopPropagation()}>
                      {a.aktiv ? (
                        <button onClick={() => avaktivera(a)} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(248,113,113,0.1)', color: C.danger, border: 'none', cursor: 'pointer' }}>Avaktivera</button>
                      ) : (
                        <button onClick={() => aktivera(a)} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(74,222,128,0.12)', color: C.ok, border: 'none', cursor: 'pointer' }}>Aktivera</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Skapa / redigera artikel */}
      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Redigera artikel' : 'Ny artikel'}
        subtitle={editing ? editing.kod : undefined}
        width="md"
        footer={(
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setOpen(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button
              onClick={spara}
              disabled={!formGiltig || sparar}
              style={{ ...btnPrimary, flex: 1, opacity: (!formGiltig || sparar) ? 0.4 : 1, cursor: (!formGiltig || sparar) ? 'not-allowed' : 'pointer' }}
            >
              {sparar ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        )}
      >
        <div style={{ padding: isMobile ? '20px 16px' : 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 16 }}>
            <div>
              <label style={lbl}>Kod *</label>
              <input type="text" value={form.kod} onChange={e => setForm(f => ({ ...f, kod: e.target.value }))} onFocus={fo} onBlur={fb} style={{ ...inp, textTransform: 'uppercase' }} placeholder="T.ex. STAD" />
            </div>
            <div>
              <label style={lbl}>Benämning *</label>
              <input type="text" value={form.benamning} onChange={e => setForm(f => ({ ...f, benamning: e.target.value }))} onFocus={fo} onBlur={fb} style={inp} placeholder="T.ex. Städning trapphus" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>À-pris (kr)</label>
              <input type="number" value={form.apris} onChange={e => setForm(f => ({ ...f, apris: e.target.value }))} onFocus={fo} onBlur={fb} style={inp} placeholder="Lämna tomt = variabelt" />
            </div>
            <div>
              <label style={lbl}>Moms %</label>
              <input type="number" value={form.moms} onChange={e => setForm(f => ({ ...f, moms: e.target.value }))} onFocus={fo} onBlur={fb} style={inp} placeholder="25" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>Konto (Hogia)</label>
              <input type="text" value={form.konto} onChange={e => setForm(f => ({ ...f, konto: e.target.value }))} onFocus={fo} onBlur={fb} style={inp} placeholder="Fylls när Hogia kopplas" />
            </div>
            <div>
              <label style={lbl}>Momskod (Hogia)</label>
              <input type="text" value={form.momskod} onChange={e => setForm(f => ({ ...f, momskod: e.target.value }))} onFocus={fo} onBlur={fb} style={inp} placeholder="Fylls när Hogia kopplas" />
            </div>
          </div>

          {felmeddelande && (
            <p style={{ fontSize: 13, fontWeight: 600, color: C.danger, margin: 0 }}>{felmeddelande}</p>
          )}
        </div>
      </SlideOver>
    </div>
  )
}
