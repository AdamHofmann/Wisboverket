'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtKr, inp, lbl, fo, fb } from './shared'
import { useToast } from '@/components/Toast'

type Inkop = {
  id: string; beskrivning: string; leverantor: string | null
  belopp: number; datum: string | null; kategori: string
  fil_url: string | null; fil_namn: string | null
}
type Leverantor = { id: string; namn: string; typ: string | null }
type Artikel = { id: string; namn: string; enhet: string; kostnad_per_enhet: number }

const KAT: { id: string; label: string; icon: string }[] = [
  { id: 'material', label: 'Material', icon: '📦' },
  { id: 'verktyg', label: 'Verktyg', icon: '🔧' },
  { id: 'konsumtion', label: 'Konsumtionsmaterial', icon: '🛒' },
  { id: 'transport', label: 'Transporter', icon: '🚗' },
  { id: 'ovrigt', label: 'Övrigt', icon: '☑️' },
]

export default function InkopTab({ orderId }: { orderId: string }) {
  const toast = useToast()
  const [inkop, setInkop] = useState<Inkop[]>([])
  const [leverantorer, setLeverantorer] = useState<Leverantor[]>([])
  const [artiklar, setArtiklar] = useState<Artikel[]>([])

  const [beskrivning, setBeskrivning] = useState('')
  const [leverantor, setLeverantor] = useState('')
  const [belopp, setBelopp] = useState('')
  const [datum, setDatum] = useState('')
  const [kategori, setKategori] = useState('material')
  const [artikelId, setArtikelId] = useState('')
  const [fil, setFil] = useState<File | null>(null)

  const [scanning, setScanning] = useState(false)
  const [scanResultat, setScanResultat] = useState<any | null>(null)
  const [nyLeverantor, setNyLeverantor] = useState(false)
  const [nyLevNamn, setNyLevNamn] = useState('')
  const [nyLevTyp, setNyLevTyp] = useState('material')
  const [spararLev, setSpararLev] = useState(false)

  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchAll = async () => {
    const sb = createClient()
    const [{ data: ink }, { data: lev }, { data: art }] = await Promise.all([
      sb.from('order_inkop').select('*').eq('order_id', orderId).order('created_at'),
      sb.from('suppliers').select('id,namn,typ').order('namn'),
      sb.from('artiklar').select('id,namn,enhet,kostnad_per_enhet').eq('aktiv', true).order('namn'),
    ])
    setInkop(ink || [])
    setLeverantorer(lev || [])
    setArtiklar(art || [])
  }

  useEffect(() => { fetchAll() }, [orderId])

  const hanteraFil = async (f: File | null) => {
    if (!f) return
    setFil(f)
    setScanResultat(null)
    setScanning(true)

    const fd = new FormData()
    fd.append('fil', f)

    try {
      const res = await fetch('/api/scan-faktura', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setScanResultat(data)
      if (data.beskrivning) setBeskrivning(data.beskrivning)
      if (data.belopp_exkl_moms) setBelopp(String(data.belopp_exkl_moms))
      if (data.datum) setDatum(data.datum)
      if (data.kategori) setKategori(data.kategori)

      // Matcha leverantör
      if (data.leverantor) {
        const match = leverantorer.find(l =>
          l.namn.toLowerCase().includes(data.leverantor.toLowerCase()) ||
          data.leverantor.toLowerCase().includes(l.namn.toLowerCase())
        )
        if (match) {
          setLeverantor(match.namn)
          setNyLeverantor(false)
        } else {
          setLeverantor(data.leverantor)
          setNyLeverantor(true)
          setNyLevNamn(data.leverantor)
        }
      }

      // Matcha kostnadsartikel
      if (data.artikel_forslag) {
        const match = artiklar.find(a =>
          a.namn.toLowerCase().includes(data.artikel_forslag.toLowerCase()) ||
          data.artikel_forslag.toLowerCase().includes(a.namn.toLowerCase())
        )
        if (match) setArtikelId(match.id)
      }
    } catch (e: any) {
      toast.error('AI-scanning misslyckades: ' + e.message)
    } finally {
      setScanning(false)
    }
  }

  const sparaNyLeverantor = async () => {
    if (!nyLevNamn.trim()) return
    setSpararLev(true)
    // Förifyll levkortet med det AI:n läste av från fakturan (om något)
    const s = scanResultat || {}
    const { data } = await createClient().from('suppliers').insert({
      namn: nyLevNamn,
      typ: nyLevTyp,
      kategori: nyLevTyp,
      orgnummer: s.leverantor_orgnummer || null,
      telefon: s.leverantor_telefon || null,
      epost: s.leverantor_epost || null,
      adress: s.leverantor_adress || null,
    }).select().single()
    if (data) {
      setLeverantorer(l => [...l, data])
      setLeverantor(data.namn)
    }
    setNyLeverantor(false)
    setSpararLev(false)
  }

  const laggTill = async () => {
    if (!beskrivning || !belopp) return
    setSaving(true)
    const sb = createClient()

    let fil_url: string | null = null
    let fil_namn: string | null = null

    if (fil) {
      const ext = fil.name.split('.').pop()
      const path = `${orderId}/${Date.now()}.${ext}`
      const { data: up } = await sb.storage.from('inkop-filer').upload(path, fil)
      if (up) {
        fil_url = sb.storage.from('inkop-filer').getPublicUrl(path).data.publicUrl
        fil_namn = fil.name
      }
    }

    await sb.from('order_inkop').insert({
      order_id: orderId,
      beskrivning,
      leverantor: leverantor || null,
      belopp: parseFloat(belopp),
      datum: datum || null,
      kategori,
      fil_url,
      fil_namn,
    })

    setBeskrivning(''); setLeverantor(''); setBelopp(''); setDatum('')
    setFil(null); setScanResultat(null); setArtikelId(''); setNyLeverantor(false)
    await fetchAll()
    setSaving(false)
  }

  const taBort = async (id: string) => {
    await createClient().from('order_inkop').delete().eq('id', id)
    fetchAll()
  }

  const tot = inkop.reduce((s, i) => s + i.belopp, 0)
  const katInfo = (id: string) => KAT.find(k => k.id === id) || KAT[0]

  return (
    <div>
      <div style={{ background: '#252528', borderRadius: 12, padding: '16px', marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#636366', marginBottom: 14 }}>LÄGG TILL INKÖP</div>

        {/* Filuppladdning */}
        <div
          onClick={() => !scanning && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); hanteraFil(e.dataTransfer.files[0] || null) }}
          style={{
            border: `2px dashed ${dragOver ? '#E8C96A' : scanning ? '#60a5fa' : scanResultat ? '#4ade80' : '#3a3a3c'}`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 14,
            cursor: scanning ? 'wait' : 'pointer',
            background: scanning ? 'rgba(96,165,250,0.05)' : scanResultat ? 'rgba(74,222,128,0.05)' : 'transparent',
            display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
          }}>
          <div style={{ fontSize: 24 }}>{scanning ? '⏳' : scanResultat ? '✅' : fil ? '📄' : '🤖'}</div>
          <div style={{ flex: 1 }}>
            {scanning ? (
              <><div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa' }}>AI läser fakturan...</div>
              <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>Extraherar leverantör, belopp, datum</div></>
            ) : scanResultat ? (
              <><div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>Faktura inläst — {fil?.name}</div>
              <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>Fälten är förifyllda · Klicka för att byta fil</div></>
            ) : fil ? (
              <><div style={{ fontSize: 13, fontWeight: 600, color: '#aeaeb2' }}>{fil.name}</div>
              <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>Klicka för att byta</div></>
            ) : (
              <><div style={{ fontSize: 13, fontWeight: 600, color: '#aeaeb2' }}>Scanna leverantörsfaktura med AI</div>
              <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>Dra PDF eller foto hit · Fälten fylls i automatiskt</div></>
            )}
          </div>
          {fil && !scanning && (
            <button onClick={e => { e.stopPropagation(); setFil(null); setScanResultat(null) }}
              style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 18, cursor: 'pointer', padding: 4 }}>×</button>
          )}
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
            onChange={e => hanteraFil(e.target.files?.[0] || null)} />
        </div>

        {/* Ny leverantör-banner */}
        {nyLeverantor && (
          <div style={{ background: '#2c2010', border: '1px solid #E8C96A44', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#E8C96A', marginBottom: 10 }}>
              🏪 Ny leverantör: &ldquo;{nyLevNamn}&rdquo; finns inte — vill du lägga till den?
            </div>
            {(scanResultat?.leverantor_orgnummer || scanResultat?.leverantor_telefon || scanResultat?.leverantor_epost || scanResultat?.leverantor_adress) && (
              <div style={{ fontSize: 11, color: '#8e8e93', marginBottom: 10, lineHeight: 1.6 }}>
                AI läste av från fakturan (sparas på levkortet):
                {scanResultat.leverantor_orgnummer && <span style={{ color: '#aeaeb2' }}> · {scanResultat.leverantor_orgnummer}</span>}
                {scanResultat.leverantor_telefon && <span style={{ color: '#aeaeb2' }}> · {scanResultat.leverantor_telefon}</span>}
                {scanResultat.leverantor_epost && <span style={{ color: '#aeaeb2' }}> · {scanResultat.leverantor_epost}</span>}
                {scanResultat.leverantor_adress && <span style={{ color: '#aeaeb2' }}> · {scanResultat.leverantor_adress}</span>}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={lbl}>NAMN</label>
                <input spellCheck={false} style={inp} value={nyLevNamn} onChange={e => setNyLevNamn(e.target.value)} onFocus={fo} onBlur={fb} />
              </div>
              <div>
                <label style={lbl}>TYP</label>
                <select style={inp} value={nyLevTyp} onChange={e => setNyLevTyp(e.target.value)} onFocus={fo} onBlur={fb}>
                  <option value="material">Material</option>
                  <option value="verktyg">Verktyg</option>
                  <option value="transport">Transport</option>
                  <option value="tjänst">Tjänst</option>
                  <option value="övrigt">Övrigt</option>
                </select>
              </div>
              <button onClick={sparaNyLeverantor} disabled={spararLev}
                style={{ padding: '8px 14px', background: '#E8C96A', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                {spararLev ? '...' : '+ Lägg till'}
              </button>
              <button onClick={() => setNyLeverantor(false)}
                style={{ padding: '8px 10px', background: 'none', border: '1px solid #3a3a3c', borderRadius: 8, color: '#636366', fontSize: 12, cursor: 'pointer' }}>
                Skippa
              </button>
            </div>
          </div>
        )}

        {/* Formulärfält */}
        <div style={{ marginBottom: 10 }}>
          <label style={lbl}>BESKRIVNING</label>
          <input spellCheck={true} style={inp} value={beskrivning} onChange={e => setBeskrivning(e.target.value)} placeholder="Vad köptes in?" onFocus={fo} onBlur={fb} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={lbl}>LEVERANTÖR</label>
            <input spellCheck={false} style={inp} value={leverantor} onChange={e => setLeverantor(e.target.value)} placeholder="Bauhaus, Ahlsell..." list="lev-lista" onFocus={fo} onBlur={fb} />
            <datalist id="lev-lista">
              {leverantorer.map(l => <option key={l.id} value={l.namn} />)}
            </datalist>
          </div>
          <div>
            <label style={lbl}>BELOPP (ex. moms)</label>
            <input spellCheck={false} type="number" style={inp} value={belopp} onChange={e => setBelopp(e.target.value)} placeholder="0" onFocus={fo} onBlur={fb} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={lbl}>DATUM</label>
            <input spellCheck={false} type="date" style={inp} value={datum} onChange={e => setDatum(e.target.value)} onFocus={fo} onBlur={fb} />
          </div>
          <div>
            <label style={lbl}>KATEGORI</label>
            <select style={inp} value={kategori} onChange={e => setKategori(e.target.value)} onFocus={fo} onBlur={fb}>
              {KAT.map(k => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}
            </select>
          </div>
        </div>

        {/* Kostnadsartikel */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>KOSTNADSARTIKEL (valfritt)</label>
          <select style={inp} value={artikelId} onChange={e => setArtikelId(e.target.value)} onFocus={fo} onBlur={fb}>
            <option value="">— Ingen koppling —</option>
            {artiklar.map(a => <option key={a.id} value={a.id}>{a.namn} · {a.kostnad_per_enhet} kr/{a.enhet}</option>)}
          </select>
          {scanResultat?.artikel_forslag && !artikelId && (
            <div style={{ fontSize: 11, color: '#E8C96A', marginTop: 4 }}>
              AI föreslår: &ldquo;{scanResultat.artikel_forslag}&rdquo; — hittades inte i artikelregistret
            </div>
          )}
        </div>

        <button onClick={laggTill} disabled={saving || scanning || !beskrivning || !belopp}
          style={{ width: '100%', padding: '10px', background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving || scanning || !beskrivning || !belopp ? 0.5 : 1 }}>
          {saving ? 'Sparar...' : '+ Lägg till inköp'}
        </button>
      </div>

      {/* Lista */}
      {inkop.length > 0 ? (
        <div style={{ background: '#252528', borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#636366', marginBottom: 12 }}>INKÖP ({inkop.length})</div>
          {inkop.map(i => {
            const k = katInfo(i.kategori)
            return (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#1c1c1e', borderRadius: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 16 }}>{k.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f2f2f7' }}>{i.beskrivning}</div>
                  <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>
                    {i.leverantor && `${i.leverantor} · `}
                    {i.datum ? new Date(i.datum).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : ''}
                  </div>
                </div>
                {i.fil_url && (
                  <a href={i.fil_url} target="_blank" rel="noreferrer" title={i.fil_namn || 'Öppna fil'}
                    style={{ fontSize: 16, textDecoration: 'none', opacity: 0.7 }}>
                    {i.fil_url.includes('.pdf') ? '📄' : '🖼️'}
                  </a>
                )}
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f87171', flexShrink: 0 }}>{fmtKr(i.belopp)}</div>
                <button onClick={() => taBort(i.id)}
                  style={{ background: 'none', border: '1px solid #3a3a3c', borderRadius: 6, padding: '4px 10px', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>✕</button>
              </div>
            )
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 12px 0', borderTop: '1px solid #3a3a3c', marginTop: 8 }}>
            <div style={{ fontSize: 12, color: '#636366' }}>Totalt inköp</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f87171' }}>{fmtKr(tot)}</div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🛒</div>
          <div style={{ fontSize: 13 }}>Inga inköp registrerade</div>
        </div>
      )}
    </div>
  )
}
