'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DatumValjare from '@/components/DatumValjare'
import { useKundPrisavtal } from '@/hooks/useKundPrisavtal'
import { useIsMobile } from '@/hooks/useMediaQuery'
import Sokfalt from '@/components/Sokfalt'
import { useToast } from '@/components/Toast'
import { fmtKr } from '@/lib/format'

type OffertRad = { typ: 'artikel' | 'fritext'; artikel_id: string; text: string; antal: number; resurser: number; apris: number; enhet: string }
type Artikel = { id: string; namn: string; enhet: string; a_pris: number }
type Offert = {
  id: string; offer_number: string | null; titel: string | null; status: string
  customer_id: string | null; order_id: string | null
  beskrivning: string | null; giltig_till: string | null
  rader: OffertRad[]; subtotal: number; moms_belopp: number; totalt: number
  kund_namn?: string; created_at: string
  skickad_at?: string | null; updated_at?: string
}

const STATUS_COLOR: Record<string, string> = { utkast: '#888', skickad: '#60a5fa', accepterad: '#4ade80', avvisad: '#f87171', expired: '#555' }
const fmtDatum = (d: string) => new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })

// Offerten har ändrats efter senaste utskicket (60s tolerans för klockskillnad vid själva utskicket).
const revideradEfterUtskick = (o: Offert) =>
  !!o.skickad_at && !!o.updated_at &&
  new Date(o.updated_at).getTime() - new Date(o.skickad_at).getTime() > 60_000

export default function OfferterPage() {
  const isMobile = useIsMobile()
  const toast = useToast()
  const [statusFilter, setStatusFilter] = useState('Alla')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editOffert, setEditOffert] = useState<Offert | null>(null)
  const [autoPdf, setAutoPdf] = useState(false)

  // SWR-cache: cachad data visas direkt vid återbesök, revalideras tyst i bakgrunden.
  // fetchOfferter() = revalidera (anropas från updateStatus + modalens onSaved).
  const { data, isLoading, mutate } = useSWR('offerter', async () => {
    const { data } = await createClient()
      .from('offers')
      .select('*, customer:customers(namn)')
      .order('created_at', { ascending: false })
    return (data || []).map((o: any) => ({ ...o, kund_namn: o.customer?.namn, rader: o.rader || [] })) as Offert[]
  })
  const offerter = data ?? []
  const loading = isLoading && !data
  const fetchOfferter = () => { mutate() }

  const filtered = useMemo(() => offerter.filter(o => {
    if (statusFilter !== 'Alla' && o.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const nr = (o.offer_number || `OFF-${o.id.slice(0, 6)}`).toLowerCase()
      const match = nr.includes(q)
        || (o.titel || '').toLowerCase().includes(q)
        || (o.kund_namn || '').toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  }), [offerter, statusFilter, search])

  const updateStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status }
    if (status === 'skickad') patch.skickad_at = new Date().toISOString()
    const { error: err } = await createClient().from('offers').update(patch).eq('id', id)
    if (err) { toast.error('Kunde inte uppdatera offertstatus: ' + err.message); return }
    fetchOfferter()
  }

  const chip = (active: boolean) => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? '#E8C96A' : '#2a2a2a'}`,
    background: active ? 'rgba(232,201,106,0.1)' : '#1a1a1a',
    color: active ? '#E8C96A' : '#888',
  })

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : undefined, marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#E8C96A' }}>Offerter <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({filtered.length})</span></div>
        <button onClick={() => { setEditOffert(null); setShowModal(true) }}
          style={{ background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Ny offert
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 10 : 12, marginBottom: 16 }}>
        <Sokfalt value={search} onChange={setSearch} placeholder="Sök offertnr, titel, kund..." style={{ width: isMobile ? '100%' : 260 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Alla', 'utkast', 'skickad', 'accepterad', 'avvisad'].map(s => (
            <div key={s} style={chip(statusFilter === s)} onClick={() => setStatusFilter(s)}>{s}</div>
          ))}
        </div>
      </div>

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            {offerter.length === 0 ? (
              <><div style={{ fontSize: 32, marginBottom: 10 }}>📄</div><div>Inga offerter ännu</div></>
            ) : 'Inga träffar'}
          </div>
        ) : filtered.map(o => {
          const color = STATUS_COLOR[o.status] || '#888'
          return (
            <div key={o.id} style={{ padding: isMobile ? '14px' : '14px 18px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }}
              onClick={() => { setEditOffert(o); setShowModal(true) }}
              onMouseEnter={e => { if (!isMobile) e.currentTarget.style.background = '#1a1a1a' }}
              onMouseLeave={e => { if (!isMobile) e.currentTarget.style.background = 'transparent' }}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? 10 : 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#E8C96A' }}>{o.offer_number || `OFF-${o.id.slice(0, 6)}`}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: color + '22', color, border: `1px solid ${color}44` }}>{o.status}</span>
                    {revideradEfterUtskick(o) && (
                      <span title="Offerten har ändrats sedan den senast skickades – kunden kan sitta på en äldre version." style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fb923c22', color: '#fb923c', border: '1px solid #fb923c44' }}>⚠ Ändrad efter utskick</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>{o.titel || 'Utan titel'}</div>
                  {o.kund_namn && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{o.kund_namn}</div>}
                </div>
                <div style={{ textAlign: isMobile ? 'left' : 'right', display: isMobile ? 'flex' : 'block', flexWrap: isMobile ? 'wrap' : undefined, alignItems: isMobile ? 'center' : undefined, gap: isMobile ? 8 : undefined, flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#e0e0e0' }}>{fmtKr(o.totalt)}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: isMobile ? 0 : 2 }}>{fmtDatum(o.created_at)}</div>
                  {o.skickad_at && <div style={{ fontSize: 11, color: '#60a5fa' }}>Skickad {fmtDatum(o.skickad_at)}</div>}
                  {o.giltig_till && <div style={{ fontSize: 11, color: '#fb923c' }}>Giltig t.o.m {fmtDatum(o.giltig_till)}</div>}
                  <button onClick={e => { e.stopPropagation(); setEditOffert(o); setAutoPdf(true); setShowModal(true) }}
                    style={{ marginTop: isMobile ? 0 : 8, marginLeft: isMobile ? 'auto' : 0, fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 6, border: '1px solid #E8C96A44', background: '#E8C96A11', color: '#E8C96A', cursor: 'pointer' }}>
                    📄 Öppna PDF
                  </button>
                </div>
              </div>
              {o.status === 'skickad' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => updateStatus(o.id, 'accepterad')} style={{ flex: isMobile ? 1 : undefined, fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 6, border: '1px solid #4ade8044', background: '#4ade8011', color: '#4ade80', cursor: 'pointer' }}>
                    ✓ Accepterad
                  </button>
                  <button onClick={() => updateStatus(o.id, 'avvisad')} style={{ flex: isMobile ? 1 : undefined, fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 6, border: '1px solid #f8717144', background: '#f8717111', color: '#f87171', cursor: 'pointer' }}>
                    ✕ Avvisad
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showModal && (
        <OffertModal offert={editOffert} autoPdf={autoPdf}
          onClose={() => { setShowModal(false); setAutoPdf(false) }}
          onSaved={() => { fetchOfferter(); setShowModal(false); setAutoPdf(false) }} />
      )}
    </div>
  )
}

function OffertModal({ offert, autoPdf, onClose, onSaved }: { offert: Offert | null; autoPdf?: boolean; onClose: () => void; onSaved: () => void }) {
  const isMobile = useIsMobile()
  const toast = useToast()
  const router = useRouter()
  const [skaparOrder, setSkaparOrder] = useState(false)
  const [kunder, setKunder] = useState<{ id: string; namn: string; epost: string | null; adress: string | null; postnummer: string | null; ort: string | null }[]>([])
  const [artiklar, setArtiklar] = useState<Artikel[]>([])
  const [emailSent, setEmailSent] = useState(false)
  const rowRefs = useRef<(HTMLInputElement | HTMLSelectElement | null)[]>([])
  const [form, setForm] = useState({
    titel: offert?.titel || '',
    customer_id: offert?.customer_id || '',
    status: offert?.status || 'utkast',
    beskrivning: offert?.beskrivning || '',
    giltig_till: offert?.giltig_till || '',
    rader: (offert?.rader || []) as OffertRad[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pdfHtml, setPdfHtml] = useState<string | null>(null) // in-app PDF-förhandsvisning (window.open funkar ej i app-webvyn)
  // Dagens datum (lokalt, YYYY-MM-DD) — offertens giltighetsdatum får inte vara bakåt i tiden.
  const idagStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()

  useEffect(() => {
    const sb = createClient()
    sb.from('customers').select('id,namn,epost,adress,postnummer,ort').order('namn').then(({ data }) => setKunder(data || []))
    sb.from('artiklar').select('id,namn,enhet,a_pris').eq('aktiv', true).order('namn').then(({ data }) => setArtiklar(data || []))
  }, [])

  const { prisavtal, artikelPris } = useKundPrisavtal(form.customer_id, artiklar)

  // Slå om offert → order: skapa order, kopiera raderna till tidrader, länka och öppna ordern.
  const skapaOrderFrånOffert = async () => {
    if (!offert) return
    if (offert.order_id) { router.push(`/ordrar?order=${offert.order_id}`); return } // redan konverterad
    setSkaparOrder(true)
    const sb = createClient()
    const { data: order, error: orderErr } = await sb.from('orders').insert({
      titel: form.titel || offert.titel || 'Order från offert',
      kategori: 'Annat',
      status: 'ny',
      customer_id: form.customer_id || null,
      beskrivning: form.beskrivning || null,
      intern_anteckning: offert.offer_number ? `Skapad från offert ${offert.offer_number}.` : 'Skapad från offert.',
    }).select('id').single()
    if (orderErr || !order) { setSkaparOrder(false); toast.error('Kunde inte skapa order: ' + (orderErr?.message || 'okänt fel')); return }

    // Kopiera offertens rader → tidrader. Vik in resurs-multiplikatorn i antalet så beloppet stämmer.
    const tidRader = (form.rader || [])
      .filter(r => (r.antal || 0) !== 0)
      .map(r => ({
        order_id: order.id,
        artikel_id: r.typ === 'artikel' && r.artikel_id ? r.artikel_id : null,
        artikel_namn: r.typ === 'artikel' ? (artiklar.find(a => a.id === r.artikel_id)?.namn || r.text || '') : (r.text || ''),
        enhet: r.enhet || 'tim',
        antal: (r.antal || 0) * (r.resurser || 1),
        a_pris: r.typ === 'artikel' && r.artikel_id ? artikelPris(r.artikel_id) : (r.apris || 0),
      }))
    if (tidRader.length > 0) {
      const { error: radErr } = await sb.from('order_tid_rader').insert(tidRader)
      if (radErr) toast.error('Ordern skapades, men raderna kunde inte kopieras: ' + radErr.message)
    }

    const { error: linkErr } = await sb.from('offers').update({ order_id: order.id }).eq('id', offert.id)
    if (linkErr) toast.error('Ordern skapades, men offerten kunde inte länkas: ' + linkErr.message)

    setSkaparOrder(false)
    onSaved()
    router.push(`/ordrar?order=${order.id}`)
  }

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const TOMRAD = (): OffertRad => ({ typ: 'artikel', artikel_id: '', text: '', antal: 1, resurser: 1, apris: 0, enhet: 'tim' })
  const addRad = () => {
    const id = crypto.randomUUID()
    newRowId.current = id
    setForm(f => ({ ...f, rader: [...f.rader, { ...TOMRAD(), _id: id } as any] }))
  }
  const updateRad = (i: number, k: string, v: any) => setForm(f => ({ ...f, rader: f.rader.map((r, idx) => idx === i ? { ...r, [k]: v } : r) }))
  const removeRad = (i: number) => setForm(f => ({ ...f, rader: f.rader.filter((_, idx) => idx !== i) }))

  const radBelopp = (r: OffertRad) => {
    const totalAntal = r.antal * (r.resurser || 1)
    if (r.typ === 'artikel' && r.artikel_id) return totalAntal * artikelPris(r.artikel_id)
    return totalAntal * r.apris
  }

  const newRowId = useRef<string | null>(null)
  useEffect(() => {
    if (newRowId.current) {
      const idx = form.rader.findIndex((r: any) => r._id === newRowId.current)
      if (idx >= 0) rowRefs.current[idx]?.focus()
      newRowId.current = null
    }
  }, [form.rader])

  const radDesc = (r: OffertRad) => {
    if (r.typ === 'artikel' && r.artikel_id) return artiklar.find(a => a.id === r.artikel_id)?.namn || ''
    return r.text
  }

  const subtotal = form.rader.reduce((s, r) => s + radBelopp(r), 0)
  const moms = subtotal * 0.25
  const totalt = subtotal + moms

  const valdKund = kunder.find(k => k.id === form.customer_id)
  const villkorHTML = `
<strong>Betalning</strong><br>
Betalning 30 dagar netto om inget annat avtalats. Vid försenad betalning debiteras dröjsmålsränta enligt räntelagen (referensränta + 8 pp).<br><br>
<strong>Moms &amp; priser</strong><br>
Angivna priser är exklusive moms. Moms tillkommer enligt gällande lagstiftning. Tillkommande arbeten och material utanför offertens
omfattning debiteras löpande enligt prislista.<br><br>
<strong>Giltighet</strong><br>
Offerten är giltig till angivet datum. Därefter förbehåller sig Wisboverket AB rätten att revidera priser och villkor.<br><br>
<strong>Ansvar &amp; reklamation</strong><br>
Wisboverket AB ansvarar för utförda tjänsters kvalitet i enlighet med branschstandard. Klagomål ska framföras skriftligen inom 30 dagar
efter utfört arbete. Vi åtgärdar påtalade brister utan extra kostnad om de beror på fel i utförandet.<br><br>
<strong>Force majeure</strong><br>
Wisboverket AB ansvarar inte för förseningar orsakade av omständigheter utanför vår kontroll – exempelvis väderhändelser,
materialbrist eller myndighetsåtgärder. Parterna meddelar varandra snarast möjligt vid sådana händelser.<br><br>
<strong>Tvist</strong><br>
Tvist löses i första hand genom förhandling. I andra hand tillämpas svensk lag med Nyköpings tingsrätt som behörig domstol.`

  // visaSparad=true → rendera EXAKT det sparade (frusna) offerten: sparade radpriser + sparade totaler,
  // ingen live-omräkning. Så man ser precis vad kunden fick, även om artikelpriser ändrats sedan dess.
  const genereraPDF = (visaSparad = false) => {
    const offerNr = offert?.offer_number || 'UTKAST'
    const pdfSubtotal = visaSparad && offert ? offert.subtotal : subtotal
    const pdfMoms = visaSparad && offert ? offert.moms_belopp : moms
    const pdfTotalt = visaSparad && offert ? offert.totalt : totalt
    const raderHTML = form.rader.map((r, i) => {
      const enhet = r.typ === 'artikel' ? (artiklar.find(a => a.id === r.artikel_id)?.enhet || r.enhet) : r.enhet
      const totalAntal = r.antal * (r.resurser || 1)
      const apris = visaSparad ? r.apris : (r.typ === 'artikel' ? artikelPris(r.artikel_id) : r.apris)
      const belopp = visaSparad ? totalAntal * r.apris : radBelopp(r)
      return `
        <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
          <td>${radDesc(r)}</td>
          <td class="center">${totalAntal} ${enhet}</td>
          <td class="right">${Math.round(apris).toLocaleString('sv-SE')} kr</td>
          <td class="right bold">${Math.round(belopp).toLocaleString('sv-SE')} kr</td>
        </tr>`
    }).join('')
    const kundAdress = valdKund ? [valdKund.adress, valdKund.postnummer && valdKund.ort ? `${valdKund.postnummer} ${valdKund.ort}` : ''].filter(Boolean).join(', ') : ''
    const logoUrl = `${window.location.origin}/logo.png`
    const html = `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8">
<title>Offert ${offerNr} – ${form.titel}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Helvetica Neue",Arial,sans-serif;color:#1a1a1a;background:#fff;font-size:13px;line-height:1.5}
.page{max-width:820px;margin:0 auto;padding:48px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:28px;border-bottom:3px solid #C8A94F;margin-bottom:32px}
.offert-badge{text-align:right}
.offert-badge .label{font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#888;margin-bottom:4px}
.offert-badge .number{font-size:32px;font-weight:900;color:#1a1a1a;letter-spacing:2px}
.offert-badge .sub{font-size:11px;color:#888;margin-top:2px}
.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;margin-bottom:32px;border:1px solid #e8e0d0;border-radius:4px;overflow:hidden}
.meta-block{padding:18px 20px;border-right:1px solid #e8e0d0}
.meta-block:last-child{border-right:none}
.meta-block .label{font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#888;margin-bottom:6px;font-weight:600}
.meta-block .val{font-size:13px;font-weight:700;color:#1a1a1a;line-height:1.4}
.meta-block .sub{font-size:11px;color:#555;margin-top:2px}
.subject-bar{background:#f7f4ee;border-left:4px solid #C8A94F;padding:12px 18px;margin-bottom:28px;border-radius:0 4px 4px 0}
.subject-bar .slabel{font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#888;margin-bottom:3px}
.subject-bar .stitel{font-size:15px;font-weight:800;color:#1a1a1a}
table{width:100%;border-collapse:collapse;margin-bottom:0}
thead tr{background:#1a1a1a}
thead th{padding:10px 14px;text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#C8A94F;font-weight:600}
thead th.center{text-align:center}
thead th.right{text-align:right}
tbody tr.even{background:#fff}
tbody tr.odd{background:#faf8f4}
tbody td{padding:12px 14px;border-bottom:1px solid #ede8de;font-size:12px;color:#1a1a1a;vertical-align:middle}
td.center{text-align:center;color:#555}
td.right{text-align:right}
td.bold{font-weight:700}
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:36px}
.totals{width:280px;border:1px solid #e8e0d0;border-top:none;border-radius:0 0 4px 4px;overflow:hidden}
.totals table{margin:0}
.totals td{padding:8px 14px;border-bottom:1px solid #ede8de;font-size:12px}
.totals .total-row td{background:#1a1a1a;color:#fff;font-weight:700;font-size:14px;padding:12px 14px;border:none}
.totals .total-row td:last-child{color:#C8A94F}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:40px 0}
.sig-box{border-bottom:1px solid #999;height:40px}
.sig-label{font-size:10px;color:#888;margin-top:6px}
.villkor{margin-top:20px;border-top:1px solid #e8e0d0;padding-top:20px}
.villkor-header{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;font-weight:700;margin-bottom:10px}
.villkor-body{font-size:10px;color:#555;line-height:1.7}
.footer{display:flex;justify-content:space-between;align-items:center;margin-top:40px;padding-top:16px;border-top:1px solid #e8e0d0;font-size:10px;color:#888}
</style></head>
<body>
<div class="page">
  <div class="header">
    <img src="${logoUrl}" style="height:150px;object-fit:contain;" alt="Wisboverket"/>
    <div class="offert-badge">
      <div class="label">Offert</div>
      <div class="number">${offerNr}</div>
      <div class="sub">${new Date().toLocaleDateString('sv-SE')}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-block">
      <div class="label">Kund</div>
      <div class="val">${valdKund?.namn || '—'}</div>
      ${kundAdress ? `<div class="sub">${kundAdress}</div>` : ''}
    </div>
    <div class="meta-block">
      <div class="label">Giltig till</div>
      <div class="val">${form.giltig_till ? fmtDatum(form.giltig_till) : '—'}</div>
    </div>
    <div class="meta-block">
      <div class="label">Kontakt</div>
      <div class="val">${valdKund?.epost || '—'}</div>
    </div>
  </div>

  <div class="subject-bar">
    <div class="slabel">Avser</div>
    <div class="stitel">${form.titel}</div>
    ${form.beskrivning ? `<div class="sfastighet">${form.beskrivning}</div>` : ''}
  </div>

  <table>
    <thead><tr><th>Beskrivning</th><th class="center">Antal</th><th class="right">À-pris</th><th class="right">Belopp</th></tr></thead>
    <tbody>${raderHTML}</tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <table>
        <tr><td>Netto (ex. moms)</td><td class="right">${Math.round(pdfSubtotal).toLocaleString('sv-SE')} kr</td></tr>
        <tr><td>Moms 25%</td><td class="right">${Math.round(pdfMoms).toLocaleString('sv-SE')} kr</td></tr>
        <tr class="total-row"><td>Totalt att betala</td><td class="right">${Math.round(pdfTotalt).toLocaleString('sv-SE')} kr</td></tr>
      </table>
    </div>
  </div>

  <div class="sig">
    <div><div class="sig-box"></div><div class="sig-label">Kundens underskrift &amp; datum</div></div>
    <div><div class="sig-box"></div><div class="sig-label">Wisboverket AB &amp; datum</div></div>
  </div>

  <div class="villkor">
    <div class="villkor-header">Allmänna villkor</div>
    <div class="villkor-body">${villkorHTML}</div>
  </div>

  <div class="footer">
    <div>Wisboverket AB &nbsp;|&nbsp; Södermanland &nbsp;|&nbsp; info@wisboverket.se &nbsp;|&nbsp; 070-554 09 24</div>
    <div>${offerNr} &nbsp;|&nbsp; ${new Date().toLocaleDateString('sv-SE')}</div>
  </div>
</div>
</body></html>`
    setPdfHtml(html)
  }

  const skickaMedPDF = () => {
    genereraPDF()
    const kundEpost = valdKund?.epost || ''
    const offerNr = offert?.offer_number || 'UTKAST'
    const sub = `Offert ${offerNr} – ${form.titel}`
    const body = `Hej ${valdKund?.namn || ''},

Tack för att ni vänder er till Wisboverket AB!

Vänligen se bifogad offert (${offerNr}) avseende: ${form.titel}

Offerten är giltig till och med: ${form.giltig_till ? fmtDatum(form.giltig_till) : '—'}

Hör gärna av er om ni har frågor eller önskemål.

Med vänliga hälsningar,
Wisboverket AB
info@wisboverket.se
070-554 09 24`
    setTimeout(async () => {
      window.open(`mailto:${kundEpost}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`, '_blank')
      if (offert) {
        const { error: err } = await createClient().from('offers').update({ status: 'skickad', skickad_at: new Date().toISOString() }).eq('id', offert.id)
        if (err) { toast.error('E-post öppnad, men kunde inte markera offerten som skickad: ' + err.message); return }
        onSaved()
      }
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 5000)
    }, 400)
  }

  const spara = async () => {
    if (!form.titel.trim()) { setError('Titel krävs'); return }
    setSaving(true); setError('')
    const sb = createClient()
    // Frys in det faktiskt använda priset (inkl. ev. avtalspris) på varje artikelrad,
    // så offerten blir ett oföränderligt dokument även om artikelpriser ändras senare.
    const raderSnapshot = form.rader.map(r => r.typ === 'artikel' && r.artikel_id ? { ...r, apris: artikelPris(r.artikel_id) } : r)
    const payload = { ...form, rader: raderSnapshot, customer_id: form.customer_id || null, subtotal, moms_belopp: moms, totalt }
    const { error: err } = offert
      ? await sb.from('offers').update(payload).eq('id', offert.id)
      : await sb.from('offers').insert(payload)
    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  const inp = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#E8C96A' }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#2a2a2a' }

  // PDF-läge: öppna offertens PDF direkt (samma logik som Förhandsgranska), utan att visa formuläret
  useEffect(() => {
    if (!autoPdf || kunder.length === 0 || artiklar.length === 0) return
    const t = setTimeout(() => { genereraPDF(true); onClose() }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPdf, kunder.length, artiklar.length])

  if (autoPdf) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#E8C96A', fontSize: 14, fontWeight: 600 }}>📄 Genererar PDF…</div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1a1a1a', border: isMobile ? 'none' : '1px solid #2a2a2a', borderRadius: isMobile ? 0 : 14, width: '100%', maxWidth: isMobile ? '100vw' : 640, maxHeight: isMobile ? '100vh' : '90vh', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <div className="modal-safe-top" style={{ padding: isMobile ? '16px' : '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{offert ? 'Redigera offert' : 'Ny offert'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: isMobile ? '16px' : '18px 22px', display: 'flex', flexDirection: 'column', gap: 12, flex: isMobile ? 1 : undefined, overflowY: isMobile ? 'auto' : undefined }}>
          <MF label="TITEL *"><input spellCheck={true} style={inp} value={form.titel} onChange={e => set('titel', e.target.value)} placeholder="Offertens titel" onFocus={fo} onBlur={fb} /></MF>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <MF label="KUND">
              <select style={inp} value={form.customer_id} onChange={e => set('customer_id', e.target.value)} onFocus={fo} onBlur={fb}>
                <option value="">Välj kund...</option>
                {kunder.map(k => <option key={k.id} value={k.id}>{k.namn}</option>)}
              </select>
            </MF>
            <MF label="GILTIG TILL">
              <DatumValjare value={form.giltig_till} onChange={d => set('giltig_till', d)} style={inp} minDate={idagStr} />
            </MF>
          </div>

          <MF label="BESKRIVNING">
            <textarea spellCheck={true} style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} value={form.beskrivning} onChange={e => set('beskrivning', e.target.value)} placeholder="Beskrivning av uppdraget..." onFocus={fo} onBlur={fb} />
          </MF>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 10 }}>OFFERTPOSTER</div>

            {/* Header (dölj på mobil — rader blir kort) */}
            {!isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: '28px 3fr 60px 60px 80px 80px 90px 32px', gap: 6, padding: '0 4px 6px', borderBottom: '1px solid #222', marginBottom: 4 }}>
                {['', 'Beskrivning / Artikel', 'Res.', 'Antal', 'À-pris', 'Enhet', 'Belopp', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#444', textAlign: i >= 2 ? 'center' as const : 'left' as const }}>{h}</div>
                ))}
              </div>
            )}

            {form.rader.map((r, i) => {
              const vald = artiklar.find(a => a.id === r.artikel_id)
              const enhet = vald?.enhet || r.enhet || 'st'
              const apris = r.typ === 'artikel' ? artikelPris(r.artikel_id) : r.apris
              const visaResurser = enhet === 'tim' || enhet === 'dag'
              const totalAntal = r.antal * (r.resurser || 1)
              const belopp = radBelopp(r)

              const cell: React.CSSProperties = {
                ...inp, border: '1px solid transparent', padding: '6px 8px',
                textAlign: 'center' as const, transition: 'border-color 0.15s',
              }
              const cFo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#E8C96A' }
              const cFb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = 'transparent' }

              // På mobil: label ovanför varje numeriskt fält. Vanlig funktion (ej komponent)
              // så inputs inte remountas per render och tappar fokus.
              const Fält = (label: string, children: React.ReactNode) =>
                isMobile
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#444' }}>{label}</span>{children}</div>
                  : <>{children}</>

              return (
                <div key={i} style={isMobile
                  ? { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }
                  : { display: 'grid', gridTemplateColumns: '28px 3fr 60px 60px 80px 80px 90px 32px', gap: 6, padding: '4px', borderRadius: 8, marginBottom: 2,
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>

                  {isMobile ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {/* Typ-toggle */}
                      <button title={r.typ === 'artikel' ? 'Byt till fritext' : 'Byt till artikel'}
                        onClick={() => updateRad(i, 'typ', r.typ === 'artikel' ? 'fritext' : 'artikel')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: r.typ === 'artikel' ? '#E8C96A' : '#666', padding: 0, flexShrink: 0 }}>
                        {r.typ === 'artikel' ? '🏷' : '✏️'}
                      </button>
                      {/* Artikel / fritext */}
                      {r.typ === 'artikel' ? (
                        <select ref={el => { rowRefs.current[i] = el }} style={{ ...cell, textAlign: 'left' as const, flex: 1 }} value={r.artikel_id}
                          onChange={e => {
                            const a = artiklar.find(a => a.id === e.target.value)
                            updateRad(i, 'artikel_id', e.target.value)
                            if (a) { updateRad(i, 'enhet', a.enhet); updateRad(i, 'apris', a.a_pris) }
                          }} onFocus={cFo} onBlur={cFb}>
                          <option value="">— Välj artikel —</option>
                          {artiklar.map(a => <option key={a.id} value={a.id}>{a.namn}</option>)}
                        </select>
                      ) : (
                        <input spellCheck={true} ref={el => { rowRefs.current[i] = el }} style={{ ...cell, textAlign: 'left' as const, flex: 1 }} value={r.text}
                          placeholder="Fritext beskrivning..."
                          onChange={e => updateRad(i, 'text', e.target.value)} onFocus={cFo} onBlur={cFb} />
                      )}
                      {/* Ta bort */}
                      <button onClick={() => removeRad(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#555')}>×</button>
                    </div>
                  ) : (
                    <>
                      {/* Typ-toggle */}
                      <button title={r.typ === 'artikel' ? 'Byt till fritext' : 'Byt till artikel'}
                        onClick={() => updateRad(i, 'typ', r.typ === 'artikel' ? 'fritext' : 'artikel')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: r.typ === 'artikel' ? '#E8C96A' : '#666', padding: 0, textAlign: 'center' as const }}>
                        {r.typ === 'artikel' ? '🏷' : '✏️'}
                      </button>

                      {/* Artikel / fritext */}
                      {r.typ === 'artikel' ? (
                        <select ref={el => { rowRefs.current[i] = el }} style={{ ...cell, textAlign: 'left' as const }} value={r.artikel_id}
                          onChange={e => {
                            const a = artiklar.find(a => a.id === e.target.value)
                            updateRad(i, 'artikel_id', e.target.value)
                            if (a) { updateRad(i, 'enhet', a.enhet); updateRad(i, 'apris', a.a_pris) }
                          }} onFocus={cFo} onBlur={cFb}>
                          <option value="">— Välj artikel —</option>
                          {artiklar.map(a => <option key={a.id} value={a.id}>{a.namn}</option>)}
                        </select>
                      ) : (
                        <input spellCheck={true} ref={el => { rowRefs.current[i] = el }} style={{ ...cell, textAlign: 'left' as const }} value={r.text}
                          placeholder="Fritext beskrivning..."
                          onChange={e => updateRad(i, 'text', e.target.value)} onFocus={cFo} onBlur={cFb} />
                      )}
                    </>
                  )}

                  <div style={isMobile ? { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, alignItems: 'end' } : { display: 'contents' }}>
                    {/* Resurser */}
                    {Fält('RES.',
                      <input spellCheck={false} type="number" min="1"
                        style={{ ...cell, visibility: visaResurser ? 'visible' : 'hidden', color: '#aaa' }}
                        value={r.resurser || ''}
                        onChange={e => updateRad(i, 'resurser', parseInt(e.target.value) || 0)}
                        onFocus={cFo} onBlur={cFb} />
                    )}

                    {/* Antal */}
                    {Fält('ANTAL',
                      <input spellCheck={false} type="number" step="0.5" min="0" style={cell}
                        value={r.antal}
                        onChange={e => updateRad(i, 'antal', parseFloat(e.target.value) || 0)}
                        onFocus={cFo} onBlur={cFb} />
                    )}

                    {/* À-pris */}
                    {Fält('À-PRIS',
                      r.typ === 'fritext' ? (
                        <input spellCheck={false} type="number" min="0" style={cell}
                          value={r.apris}
                          onChange={e => updateRad(i, 'apris', parseFloat(e.target.value) || 0)}
                          onFocus={cFo} onBlur={cFb} />
                      ) : (
                        <div title={prisavtal[r.artikel_id] !== undefined ? 'Kundens avtalspris' : undefined}
                          style={{ ...cell, color: prisavtal[r.artikel_id] !== undefined ? '#E8C96A' : '#666', fontWeight: prisavtal[r.artikel_id] !== undefined ? 700 : 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {apris > 0 ? apris : '—'}
                        </div>
                      )
                    )}

                    {/* Enhet */}
                    {Fält('ENHET',
                      <div style={{ ...cell, color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                        {visaResurser && (r.resurser || 1) > 1 ? `${totalAntal} ${enhet}` : enhet}
                      </div>
                    )}

                    {/* Belopp */}
                    {Fält('BELOPP',
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'flex-end', fontSize: 13, fontWeight: 700, color: belopp > 0 ? '#E8C96A' : '#444', paddingRight: isMobile ? 0 : 4, minHeight: isMobile ? 30 : undefined }}>
                        {belopp > 0 ? fmtKr(belopp) : '—'}
                      </div>
                    )}

                    {/* Ta bort (desktop) */}
                    {!isMobile && (
                      <button onClick={() => removeRad(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 16, padding: 0, lineHeight: 1, textAlign: 'center' as const }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#555')}>×</button>
                    )}
                  </div>
                </div>
              )
            })}

            <button onClick={addRad} style={{ background: '#111', border: '1px dashed #2a2a2a', borderRadius: 8, padding: '8px 16px', color: '#555', cursor: 'pointer', fontSize: 12, width: '100%', marginTop: 4 }}>
              + Lägg till post
            </button>
          </div>

          {form.rader.length > 0 && (
            <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#555' }}>Netto</span>
                <span style={{ fontSize: 12, color: '#888' }}>{fmtKr(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#555' }}>Moms 25%</span>
                <span style={{ fontSize: 12, color: '#888' }}>{fmtKr(moms)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#d0d0d0' }}>Totalt</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#E8C96A' }}>{fmtKr(totalt)}</span>
              </div>
            </div>
          )}

          {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}
        </div>

        <div className="modal-safe-bottom" style={{ padding: isMobile ? '12px 16px' : '14px 22px', borderTop: '1px solid #222', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 8, justifyContent: 'space-between', flexWrap: 'wrap' as const, position: isMobile ? 'sticky' : undefined, bottom: isMobile ? 0 : undefined, background: isMobile ? '#1a1a1a' : undefined, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const, ...(isMobile ? { width: '100%' } : {}) }}>
            {emailSent && <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, ...(isMobile ? { width: '100%' } : {}) }}>✓ PDF och e-postklient öppnade — spara PDF och bifoga!</span>}
            {offert && (
              <>
                <button onClick={() => genereraPDF(false)}
                  style={{ flex: isMobile ? 1 : undefined, padding: '11px 14px', background: 'rgba(232,201,106,0.1)', border: '1px solid rgba(232,201,106,0.4)', borderRadius: 8, color: '#E8C96A', fontWeight: 700, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' as const }}
                  title="Öppnar ett utskriftsfönster (aktuell redigering) — välj 'Spara som PDF'">
                  📄 Förhandsgranska PDF
                </button>
                <button onClick={skickaMedPDF}
                  style={{ flex: isMobile ? 1 : undefined, padding: '11px 14px', background: '#60a5fa11', border: '1px solid #60a5fa44', borderRadius: 8, color: '#60a5fa', fontWeight: 700, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' as const }}
                  title="Genererar PDF + öppnar e-postklient med förberedd text">
                  📧 Skicka med PDF
                </button>
              </>
            )}
            {offert && offert.status === 'utkast' && (
              <button onClick={async () => { const { error: err } = await createClient().from('offers').update({ status: 'skickad', skickad_at: new Date().toISOString() }).eq('id', offert.id); if (err) { toast.error('Kunde inte markera som skickad: ' + err.message); return } onSaved() }}
                style={{ flex: isMobile ? 1 : undefined, padding: '11px 16px', background: '#60a5fa11', border: '1px solid #60a5fa44', borderRadius: 8, color: '#60a5fa', fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' as const }}>
                📤 Markera skickad
              </button>
            )}
            {offert && (
              <button onClick={skapaOrderFrånOffert} disabled={skaparOrder}
                style={{ flex: isMobile ? 1 : undefined, padding: '11px 16px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: 8, color: '#4ade80', fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' as const, opacity: skaparOrder ? 0.6 : 1 }}
                title={offert.order_id ? 'Öppna kopplad order' : 'Skapa en order från denna offert och kopiera raderna'}>
                {skaparOrder ? 'Skapar…' : offert.order_id ? '🔧 Öppna order' : '🔧 Skapa order'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, ...(isMobile ? { width: '100%' } : {}) }}>
            <button onClick={onClose} style={{ flex: isMobile ? 1 : undefined, padding: '11px 20px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>Avbryt</button>
            <button onClick={spara} disabled={saving} style={{ flex: isMobile ? 2 : undefined, padding: '11px 24px', background: '#E8C96A', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Sparar...' : offert ? 'Spara' : 'Skapa offert'}
            </button>
          </div>
        </div>
      </div>

      {pdfHtml && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#525659', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 'calc(10px + env(safe-area-inset-top)) 14px 10px', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', flex: 1 }}>Förhandsvisning</span>
            <button onClick={() => { const f = document.getElementById('pdf-preview-frame') as HTMLIFrameElement | null; f?.contentWindow?.print() }}
              style={{ padding: '8px 14px', background: 'rgba(232,201,106,0.12)', border: '1px solid rgba(232,201,106,0.4)', borderRadius: 8, color: '#E8C96A', fontWeight: 700, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' as const }}>🖨 Skriv ut / PDF</button>
            <button onClick={() => setPdfHtml(null)}
              style={{ padding: '8px 14px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#ccc', cursor: 'pointer', fontSize: 12 }}>Stäng</button>
          </div>
          <iframe id="pdf-preview-frame" srcDoc={pdfHtml} title="Offert" style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }} />
        </div>
      )}
    </div>
  )
}

function MF({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><label style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{label}</label>{children}</div>
}
