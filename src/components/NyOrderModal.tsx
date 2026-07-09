'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { Customer, Fastighet, Contact, Order } from '@/types'
import AdressInput from '@/components/AdressInput'
import DatumValjare from '@/components/DatumValjare'
import { PERSONAL, KATEGORIER } from '@/components/order-tabs/shared'

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'auto' },
  header: { padding: '20px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: 700, color: '#e0e0e0' },
  closeBtn: { background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer', lineHeight: 1 },
  body: { padding: '20px 24px', display: 'flex', flexDirection: 'column' as const, gap: 16 },
  footer: { padding: '16px 24px', borderTop: '1px solid #222', display: 'flex', gap: 10, justifyContent: 'flex-end' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  rowM: { display: 'grid', gridTemplateColumns: '1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column' as const, gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: '#666', letterSpacing: 0.5 },
  input: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  textarea: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: 90 },
  select: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  chips: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  chip: { padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid #2a2a2a', background: '#111', color: '#888', transition: 'all 0.1s' },
  chipActive: { background: 'rgba(232,201,106,0.12)', borderColor: '#E8C96A', color: '#E8C96A' },
  saveBtn: { background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  cancelBtn: { background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 18px', color: '#888', fontSize: 13, cursor: 'pointer' },
  section: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', borderBottom: '1px solid #1e1e1e', paddingBottom: 6, marginBottom: 4 },
  addKundBtn: { background: 'none', border: 'none', color: '#E8C96A', fontSize: 11, cursor: 'pointer', padding: '2px 0', textDecoration: 'underline', alignSelf: 'flex-start' },
  miniForm: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column' as const, gap: 10 },
  miniFormTitle: { fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1 },
  miniRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  miniRowM: { display: 'grid', gridTemplateColumns: '1fr', gap: 8 },
  miniSaveBtn: { background: '#333', border: 'none', borderRadius: 6, padding: '7px 14px', color: '#E8C96A', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' },
}

type KalenderOrder = { bokad_datum: string; bokad_start: string | null; bokad_slut: string | null; titel: string; tilldelad: string[] | null }

type MiniKalenderProps = {
  ordrar: KalenderOrder[]
  datumFran: string
  datumTill: string
}

// Read-only beläggningsvy: klick på en dag visar vilka ordrar som ligger den dagen (tid + tilldelad).
function MiniKalender({ ordrar, datumFran, datumTill }: MiniKalenderProps) {
  const [månOffset, setMånOffset] = useState(0)
  const [valdDag, setValdDag] = useState<string | null>(null)
  const idag = new Date()
  const år = new Date(idag.getFullYear(), idag.getMonth() + månOffset, 1)
  const månad = år.getMonth()
  const månadsår = år.getFullYear()
  const förstaVeckodag = (new Date(månadsår, månad, 1).getDay() + 6) % 7
  const antalDagar = new Date(månadsår, månad + 1, 0).getDate()
  const månNamn = år.toLocaleString('sv-SE', { month: 'long', year: 'numeric' })
  const bokadeDatum = new Set(ordrar.map(o => o.bokad_datum))
  const dagar: (number | null)[] = [...Array.from({ length: förstaVeckodag }, (): null => null), ...Array.from({ length: antalDagar }, (_, i) => i + 1)]

  const iRange = (ds: string) => datumFran && datumTill && ds >= datumFran && ds <= datumTill
  const dagOrdrar = valdDag ? ordrar.filter(o => o.bokad_datum === valdDag) : []

  return (
    <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 10, color: '#E8C96A', fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>
        ▸ Beläggning — klicka på en dag för att se ordrar
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button type="button" onClick={() => setMånOffset(o => o - 1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#d0d0d0', textTransform: 'capitalize' }}>{månNamn}</span>
        <button type="button" onClick={() => setMånOffset(o => o + 1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {['M','T','O','T','F','L','S'].map((d, i) => (
          <div key={i} style={{ fontSize: 9, fontWeight: 700, color: '#555', padding: '2px 0' }}>{d}</div>
        ))}
        {dagar.map((dag, i) => {
          if (!dag) return <div key={i} />
          const ds = `${månadsår}-${String(månad + 1).padStart(2, '0')}-${String(dag).padStart(2, '0')}`
          const belagd = bokadeDatum.has(ds)
          const inRange = iRange(ds)
          const vald = ds === valdDag
          return (
            <div key={i} onClick={() => setValdDag(vald ? null : ds)}
              style={{
                fontSize: 11, padding: '4px 2px', borderRadius: 5, cursor: 'pointer',
                background: vald ? '#E8C96A' : inRange ? 'rgba(232,201,106,0.15)' : belagd ? 'rgba(239,68,68,0.2)' : 'transparent',
                color: vald ? '#000' : belagd ? '#ef4444' : '#ccc',
                fontWeight: vald ? 800 : belagd ? 700 : 400,
                border: belagd && !vald ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
              }}
              title={belagd ? ordrar.filter(o => o.bokad_datum === ds).map(o => o.titel).join(', ') : ''}>
              {dag}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 10, color: '#555' }}>
        <span><span style={{ color: '#ef4444' }}>●</span> Belagd</span>
        <span><span style={{ color: '#E8C96A' }}>●</span> Orderns intervall</span>
      </div>

      {valdDag && (
        <div style={{ marginTop: 10, borderTop: '1px solid #2a2a2a', paddingTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#d0d0d0', marginBottom: 6 }}>
            {new Date(valdDag + 'T00:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          {dagOrdrar.length === 0 ? (
            <div style={{ fontSize: 12, color: '#555' }}>Inga ordrar denna dag</div>
          ) : dagOrdrar.map((o, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: i < dagOrdrar.length - 1 ? '1px solid #1e1e1e' : 'none' }}>
              <span style={{ fontSize: 12, color: '#e0e0e0' }}>{o.titel}</span>
              <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' as const }}>
                {o.bokad_start ? `${o.bokad_start}${o.bokad_slut ? `–${o.bokad_slut}` : ''}` : 'Heldag'}
                {o.tilldelad?.length ? ` · ${o.tilldelad.map(p => p.split(' ')[0]).join(', ')}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Props = { onClose: () => void; onSaved: () => void; order?: Order & { customer?: Customer } }

export default function NyOrderModal({ onClose, onSaved, order }: Props) {
  const isEdit = !!order
  const m = useIsMobile()
  const [kunder, setKunder] = useState<Customer[]>([])
  const [fastigheter, setFastigheter] = useState<Fastighet[]>([])
  const [kontakter, setKontakter] = useState<Contact[]>([])
  const [showNyKontakt, setShowNyKontakt] = useState(false)
  const [nyKontakt, setNyKontakt] = useState({ namn: '', roll: '', telefon: '', epost: '' })
  const [saving, setSaving] = useState(false)
  const [showNyKund, setShowNyKund] = useState(false)
  const [showKalender, setShowKalender] = useState(false)
  const [kalenderOrdrar, setKalenderOrdrar] = useState<KalenderOrder[]>([])

  const [form, setForm] = useState(() => order ? {
    titel: order.titel || '',
    kategori: order.kategori || 'El',
    status: order.status || 'ny',
    customer_id: order.customer_id || '',
    fastighet_id: (order as { fastighet_id?: string }).fastighet_id || '',
    fastighet: order.fastighet || '',
    postnummer: order.postnummer || '',
    ort: order.ort || '',
    lagenhet: order.lagenhet || '',
    kanal: 'admin',
    kontakt_namn: order.kontakt_namn || '',
    kontakt_telefon: order.kontakt_telefon || '',
    kontakt_epost: order.kontakt_epost || '',
    datum_fran: order.bokad_datum || '',
    datum_till: order.bokad_datum_till || '',
    bokad_start: order.bokad_start || '',
    bokad_slut: order.bokad_slut || '',
    tilldelad: order.tilldelad || [] as string[],
    arbetsinstruktion: order.beskrivning || '',
    intern_anteckning: '',
    prioritet: order.prioritet || 'normal',
    fakturareferens: order.fakturareferens || '',
    aterkommande: order.aterkommande || '',
  } : {
    titel: '', kategori: 'El', status: 'ny', customer_id: '', fastighet_id: '',
    fastighet: '', postnummer: '', ort: '', lagenhet: '', kanal: 'admin',
    kontakt_namn: '', kontakt_telefon: '', kontakt_epost: '',
    datum_fran: '', datum_till: '', bokad_start: '', bokad_slut: '',
    tilldelad: [] as string[],
    arbetsinstruktion: '',
    intern_anteckning: '',
    prioritet: 'normal',
    fakturareferens: '',
    aterkommande: '',
  })

  const [nyKund, setNyKund] = useState({
    namn: '', typ: 'företag', telefon: '', epost: '', fakturamail: '',
    orgnummer: '', adress: '', postnummer: '', ort: '', betalvillkor: 30, anteckningar: '',
    leveranssatt: 'epost', peppol_id: '',
  })
  const [nyKundError, setNyKundError] = useState('')
  const [namnFel, setNamnFel] = useState('')
  const [slarUppNamn, setSlarUppNamn] = useState(false)
  const [traffar, setTraffar] = useState<Array<{ namn: string; orgnummer: string; adress: string; postnummer: string; ort: string; aktiv: boolean }> | null>(null)

  const fetchKunder = () => createClient().from('customers').select('*').order('namn').then(({ data }) => setKunder((data as Customer[]) || []))
  const fetchFastigheter = () => createClient().from('fastigheter').select('*').order('namn').then(({ data }) => setFastigheter(data || []))

  const loadKalender = async () => {
    const { data } = await createClient().from('orders')
      .select('bokad_datum,bokad_start,bokad_slut,titel,tilldelad')
      .not('bokad_datum', 'is', null).neq('status', 'inaktiv')
    setKalenderOrdrar((data as KalenderOrder[]) || [])
  }

  const toggleKalender = async () => {
    if (!showKalender) await loadKalender()
    setShowKalender(v => !v)
  }

  useEffect(() => { fetchKunder(); fetchFastigheter() }, [])

  const fetchKontakter = (customerId: string) => {
    if (!customerId) { setKontakter([]); return }
    createClient().from('contacts').select('*').eq('customer_id', customerId).order('namn')
      .then(({ data }) => setKontakter((data as Contact[]) || []))
  }
  useEffect(() => { fetchKontakter(form.customer_id); setShowNyKontakt(false) }, [form.customer_id])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Vid val av fastighet: fyll i adress/postnummer/ort från fastighetens registrerade uppgifter
  const valjFastighet = (id: string) => {
    const f = fastigheter.find(x => x.id === id)
    setForm(prev => ({
      ...prev,
      fastighet_id: id,
      ...(f?.adress ? { fastighet: f.adress, postnummer: f.postnummer || '', ort: f.ort || '' } : {}),
    }))
  }

  const valdKund = kunder.find(k => k.id === form.customer_id)

  const valjKontakt = (k: Contact) => setForm(f => ({
    ...f, kontakt_namn: k.namn, kontakt_telefon: k.telefon || f.kontakt_telefon, kontakt_epost: k.epost || f.kontakt_epost,
  }))

  const skapaNyKontakt = async () => {
    if (!nyKontakt.namn.trim() || !form.customer_id) return
    const { data } = await createClient().from('contacts')
      .insert({ customer_id: form.customer_id, namn: nyKontakt.namn.trim(), roll: nyKontakt.roll.trim() || null, telefon: nyKontakt.telefon.trim() || null, epost: nyKontakt.epost.trim() || null })
      .select('*').single()
    if (data) {
      setKontakter(ks => [...ks, data as Contact].sort((a, b) => a.namn.localeCompare(b.namn)))
      valjKontakt(data as Contact)
      setNyKontakt({ namn: '', roll: '', telefon: '', epost: '' })
      setShowNyKontakt(false)
    }
  }

  const togglePerson = (p: string) => setForm(f => ({
    ...f, tilldelad: f.tilldelad.includes(p) ? f.tilldelad.filter(x => x !== p) : [...f.tilldelad, p]
  }))

  const slaUppNamn = async () => {
    const namn = (nyKund.namn || '').trim()
    if (namn.length < 2) { setNamnFel('Skriv in minst 2 tecken av företagsnamnet'); return }
    setSlarUppNamn(true); setNamnFel(''); setTraffar(null)
    try {
      const res = await fetch(`/api/lookup-company?name=${encodeURIComponent(namn)}`)
      const data = await res.json()
      if (res.status === 404) { setTraffar([]); return } // inga träffar → visas i dropdownen vid fältet
      if (!res.ok) {
        const msg = typeof data.error === 'string' ? data.error : (data.error?.message || 'Kunde inte söka på företagsnamn')
        setNamnFel(msg); return
      }
      setTraffar(data.companies || [])
    } catch {
      setNamnFel('Kunde inte nå uppslagstjänsten')
    } finally {
      setSlarUppNamn(false)
    }
  }

  const valjTraff = (c: { namn: string; orgnummer: string; adress: string; postnummer: string; ort: string }) => {
    setNyKund(k => ({ ...k, namn: c.namn || k.namn, orgnummer: c.orgnummer || k.orgnummer, adress: c.adress || k.adress, postnummer: c.postnummer || k.postnummer, ort: c.ort || k.ort }))
    setTraffar(null)
  }

  const sparaNyKund = async () => {
    if (!nyKund.namn.trim()) { setNyKundError('Namn krävs'); return }
    setNyKundError('')
    const { data, error } = await createClient().from('customers').insert({
      namn: nyKund.namn.trim(),
      typ: nyKund.typ,
      telefon: nyKund.telefon.trim() || null,
      epost: nyKund.epost.trim() || null,
      fakturamail: nyKund.fakturamail.trim() || null,
      orgnummer: nyKund.orgnummer.trim() || null,
      adress: nyKund.adress.trim() || null,
      postnummer: nyKund.postnummer.trim() || null,
      ort: nyKund.ort.trim() || null,
      betalvillkor: nyKund.betalvillkor,
      anteckningar: nyKund.anteckningar.trim() || null,
      leveranssatt: nyKund.leveranssatt,
      peppol_id: nyKund.leveranssatt === 'peppol' ? (nyKund.peppol_id.trim() || null) : null,
    }).select('id,namn').single()
    if (error) { setNyKundError(error.message); return }
    if (data) {
      await fetchKunder()
      set('customer_id', data.id)
      setShowNyKund(false)
      setNyKund({ namn: '', typ: 'företag', telefon: '', epost: '', fakturamail: '', orgnummer: '', adress: '', postnummer: '', ort: '', betalvillkor: 30, anteckningar: '', leveranssatt: 'epost', peppol_id: '' })
    }
  }

  const [saveError, setSaveError] = useState('')

  const handleSave = async () => {
    if (!form.titel.trim()) return
    setSaving(true)
    setSaveError('')
    // status sätts helt automatiskt (ny → klar när tid rapporterats; inaktiv via knapp) — inte i formuläret
    const payload = {
      titel: form.titel, kategori: form.kategori,
      customer_id: form.customer_id || null,
      fastighet_id: form.fastighet_id || null,
      fastighet: form.fastighet || null, postnummer: form.postnummer || null, ort: form.ort || null,
      bokad_datum: form.datum_fran || null,
      bokad_datum_till: form.datum_till || null,
      bokad_start: form.bokad_start || null, bokad_slut: form.bokad_slut || null,
      tilldelad: form.tilldelad.length > 0 ? form.tilldelad : null,
      beskrivning: form.arbetsinstruktion || null,
      prioritet: form.prioritet,
      fakturareferens: form.fakturareferens || null,
      aterkommande: form.aterkommande || null,
      lagenhet: form.lagenhet || null,
      kontakt_namn: form.kontakt_namn || null,
      kontakt_telefon: form.kontakt_telefon || null,
      kontakt_epost: form.kontakt_epost || null,
    }
    const { error } = order
      ? await createClient().from('orders').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', order.id)
      : await createClient().from('orders').insert({ ...payload, status: 'ny' })
    setSaving(false)
    if (error) { setSaveError(error.message) } else { onSaved(); onClose() }
  }

  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.target.style.borderColor = '#E8C96A' }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.target.style.borderColor = '#2a2a2a' }

  return (
    <div style={{ ...S.overlay, ...(m ? { padding: 0, alignItems: 'stretch' } : {}) }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, ...(m ? { width: '100%', maxWidth: '100vw', maxHeight: '100vh', borderRadius: 0, border: 'none' } : {}) }}>
        <div style={{ ...S.header, ...(m ? { paddingTop: 'calc(20px + env(safe-area-inset-top))', position: 'sticky' as const, top: 0, background: '#1a1a1a', zIndex: 1 } : {}) }}>
          <div style={S.title}>{isEdit ? 'Redigera order' : 'Ny order'}</div>
          <button style={S.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={S.body}>
          <div style={S.section}>GRUNDINFO</div>

          <div style={S.field}>
            <label style={S.label}>TITEL *</label>
            <input spellCheck={true} style={S.input} value={form.titel} onChange={e => set('titel', e.target.value)}
              placeholder="T.ex. Rondering Björkalléen 8" onFocus={fo} onBlur={fb} />
          </div>

          <div style={S.field}>
            <label style={S.label}>KATEGORI</label>
            <select style={S.select} value={form.kategori} onChange={e => set('kategori', e.target.value)} onFocus={fo} onBlur={fb}>
              {KATEGORIER.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>

          <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#E8C96A' }}>👤 KOPPLA KUND FRÅN REGISTER</span>
              <button style={{ ...S.addKundBtn, textDecoration: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '3px 10px' }} onClick={() => setShowNyKund(v => !v)}>
                {showNyKund ? '− Avbryt' : '+ Ny kund'}
              </button>
            </div>
            <select style={S.select} value={form.customer_id} onChange={e => set('customer_id', e.target.value)} onFocus={fo} onBlur={fb}>
              <option value="">— Välj kund —</option>
              {kunder.map(k => <option key={k.id} value={k.id}>{k.namn}</option>)}
            </select>

            {/* Inline kundinfo */}
            {valdKund && (valdKund.telefon || valdKund.epost || kontakter.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8, fontSize: 12, color: '#888' }}>
                {valdKund.telefon && <span>📞 {valdKund.telefon}</span>}
                {valdKund.epost && <span>✉ {valdKund.epost}</span>}
                {kontakter.length > 0 && <span>👥 {kontakter.map(k => k.namn).join(', ')}</span>}
              </div>
            )}

            {/* Välj kontaktperson */}
            {valdKund && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#666', marginBottom: 8 }}>VÄLJ KONTAKTPERSON</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {kontakter.map(k => {
                    const active = form.kontakt_namn === k.namn
                    return (
                      <button key={k.id} type="button" onClick={() => valjKontakt(k)}
                        style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: active ? 700 : 500,
                          background: active ? '#E8C96A' : '#1a1a1a', color: active ? '#000' : '#888', border: `1px solid ${active ? '#E8C96A' : '#2a2a2a'}` }}>
                        {k.namn}
                      </button>
                    )
                  })}
                  {!showNyKontakt && (
                    <button type="button" onClick={() => setShowNyKontakt(true)}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', background: 'transparent', color: '#E8C96A', border: '1px solid #E8C96A' }}>
                      + Ny kontakt för {valdKund.namn}
                    </button>
                  )}
                </div>
                {showNyKontakt && (
                  <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input spellCheck={false} style={{ ...S.input, fontSize: 12 }} placeholder="Namn *" value={nyKontakt.namn} onChange={e => setNyKontakt(f => ({ ...f, namn: e.target.value }))} onFocus={fo} onBlur={fb} />
                    <div style={m ? S.miniRowM : S.miniRow}>
                      <input spellCheck={false} style={{ ...S.input, fontSize: 12 }} placeholder="Telefon" value={nyKontakt.telefon} onChange={e => setNyKontakt(f => ({ ...f, telefon: e.target.value }))} onFocus={fo} onBlur={fb} />
                      <input spellCheck={false} style={{ ...S.input, fontSize: 12 }} placeholder="E-post" value={nyKontakt.epost} onChange={e => setNyKontakt(f => ({ ...f, epost: e.target.value }))} onFocus={fo} onBlur={fb} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={skapaNyKontakt} style={{ background: '#E8C96A', color: '#000', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Spara kontakt</button>
                      <button type="button" onClick={() => setShowNyKontakt(false)} style={{ background: 'transparent', color: '#888', border: '1px solid #2a2a2a', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}>Avbryt</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showNyKund && (
              <div style={S.miniForm}>
                <div style={S.miniFormTitle}>NY KUND</div>
                <div style={m ? S.miniRowM : S.miniRow}>
                  <div style={S.field}>
                    <label style={S.label}>TYP</label>
                    <select style={S.select} value={nyKund.typ} onChange={e => setNyKund(k => ({ ...k, typ: e.target.value }))} onFocus={fo} onBlur={fb}>
                      <option value="företag">Företag</option>
                      <option value="privat">Privat</option>
                    </select>
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>ORG.NUMMER</label>
                    <input spellCheck={false} style={S.input} value={nyKund.orgnummer} onChange={e => setNyKund(k => ({ ...k, orgnummer: e.target.value }))}
                      placeholder="556123-4567" onFocus={fo} onBlur={fb} />
                  </div>
                </div>

                <div style={S.field}>
                  <label style={S.label}>NAMN *</label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input spellCheck={false} style={{ ...S.input, flex: 1 }} value={nyKund.namn} onChange={e => setNyKund(k => ({ ...k, namn: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); slaUppNamn() } }}
                        placeholder="Företagsnamn / Namn" onFocus={fo} onBlur={fb} />
                      <button type="button" onClick={slaUppNamn} disabled={slarUppNamn}
                        style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '0 12px', color: '#E8C96A', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', opacity: slarUppNamn ? 0.6 : 1 }}>
                        {slarUppNamn ? '...' : '🔍 Slå upp'}
                      </button>
                    </div>
                    {namnFel && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{namnFel}</div>}
                    {traffar !== null && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, maxHeight: 240, overflow: 'auto', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                        {traffar.length === 0 ? (
                          <div style={{ padding: '10px 12px', fontSize: 12, color: '#888' }}>Inga träffar hittades</div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #222' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{traffar.length} träff{traffar.length === 1 ? '' : 'ar'} — välj ett företag</span>
                              <button type="button" onClick={() => setTraffar(null)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>×</button>
                            </div>
                            {traffar.map((c, i) => (
                              <button key={i} type="button" onClick={() => valjTraff(c)}
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
                </div>

                <div style={m ? S.miniRowM : S.miniRow}>
                  <div style={S.field}>
                    <label style={S.label}>TELEFON</label>
                    <input spellCheck={false} style={S.input} value={nyKund.telefon} onChange={e => setNyKund(k => ({ ...k, telefon: e.target.value }))}
                      placeholder="07X-XXX XX XX" onFocus={fo} onBlur={fb} />
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>E-POST</label>
                    <input spellCheck={false} style={S.input} value={nyKund.epost} onChange={e => setNyKund(k => ({ ...k, epost: e.target.value }))}
                      placeholder="epost@exempel.se" onFocus={fo} onBlur={fb} />
                  </div>
                </div>

                <div style={S.field}>
                  <label style={S.label}>FAKTURAMAIL (om annan)</label>
                  <input spellCheck={false} style={S.input} value={nyKund.fakturamail} onChange={e => setNyKund(k => ({ ...k, fakturamail: e.target.value }))}
                    placeholder="faktura@exempel.se" onFocus={fo} onBlur={fb} />
                </div>

                <div style={S.field}>
                  <label style={S.label}>ADRESS</label>
                  <AdressInput
                    value={nyKund.adress}
                    onChange={v => setNyKund(k => ({ ...k, adress: v }))}
                    onPick={(adress, postnummer, ort) => setNyKund(k => ({ ...k, adress, postnummer: postnummer || k.postnummer, ort: ort || k.ort }))}
                    style={S.input}
                    placeholder="Gatuadress"
                    onFocus={fo}
                    onBlur={fb}
                  />
                </div>

                <div style={m ? S.miniRowM : S.miniRow}>
                  <div style={S.field}>
                    <label style={S.label}>POSTNUMMER</label>
                    <input spellCheck={false} style={S.input} value={nyKund.postnummer} onChange={e => setNyKund(k => ({ ...k, postnummer: e.target.value }))}
                      placeholder="611 34" onFocus={fo} onBlur={fb} />
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>ORT</label>
                    <input spellCheck={false} style={S.input} value={nyKund.ort} onChange={e => setNyKund(k => ({ ...k, ort: e.target.value }))}
                      placeholder="Nyköping" onFocus={fo} onBlur={fb} />
                  </div>
                </div>

                <div style={m ? S.miniRowM : S.miniRow}>
                  <div style={S.field}>
                    <label style={S.label}>BETALVILLKOR</label>
                    <select style={S.select} value={nyKund.betalvillkor} onChange={e => setNyKund(k => ({ ...k, betalvillkor: parseInt(e.target.value) }))} onFocus={fo} onBlur={fb}>
                      {[10, 20, 30, 45, 60].map(d => <option key={d} value={d}>{d} dagar</option>)}
                    </select>
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>LEVERANSSÄTT (FAKTURA)</label>
                    <select style={S.select} value={nyKund.leveranssatt} onChange={e => setNyKund(k => ({ ...k, leveranssatt: e.target.value }))} onFocus={fo} onBlur={fb}>
                      <option value="brev">Brev</option>
                      <option value="epost">E-post</option>
                      <option value="peppol">E-faktura (Peppol)</option>
                    </select>
                  </div>
                </div>

                {nyKund.leveranssatt === 'peppol' && (
                  <div style={S.field}>
                    <label style={S.label}>PEPPOL-ID</label>
                    <input spellCheck={false} style={S.input} value={nyKund.peppol_id} onChange={e => setNyKund(k => ({ ...k, peppol_id: e.target.value }))}
                      placeholder="0007:5561234567" onFocus={fo} onBlur={fb} />
                  </div>
                )}

                <div style={S.field}>
                  <label style={S.label}>ANTECKNINGAR</label>
                  <textarea spellCheck={true} style={S.textarea} value={nyKund.anteckningar} onChange={e => setNyKund(k => ({ ...k, anteckningar: e.target.value }))}
                    placeholder="Interna anteckningar..." onFocus={fo} onBlur={fb} rows={2} />
                </div>

                {nyKundError && <div style={{ fontSize: 12, color: '#ef4444' }}>{nyKundError}</div>}

                <button style={S.miniSaveBtn} onClick={sparaNyKund}>Spara kund →</button>
              </div>
            )}
          </div>

          <div style={S.field}>
            <label style={S.label}>KUNDREFERENS / PO</label>
            <input spellCheck={false} style={S.input} value={form.fakturareferens} onChange={e => set('fakturareferens', e.target.value)}
              placeholder="PO-12345..." onFocus={fo} onBlur={fb} />
          </div>

          <div style={S.section}>FASTIGHET</div>

          <div style={S.field}>
            <label style={S.label}>FASTIGHET (PROJEKT)</label>
            <select style={S.select} value={form.fastighet_id} onChange={e => valjFastighet(e.target.value)} onFocus={fo} onBlur={fb}>
              <option value="">— Ingen koppling —</option>
              {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}{f.ort ? ` · ${f.ort}` : ''}</option>)}
            </select>
          </div>

          <div style={S.field}>
            <label style={S.label}>BESÖKSMOTTAGARE / FÖRETAG PÅ PLATS</label>
            <input spellCheck={false} style={S.input} value={form.lagenhet} onChange={e => set('lagenhet', e.target.value)}
              placeholder="T.ex. Företag AB, Kontaktperson..." onFocus={fo} onBlur={fb} />
          </div>

          <div style={S.field}>
            <label style={S.label}>ADRESS</label>
            <AdressInput
              value={form.fastighet}
              onChange={v => set('fastighet', v)}
              onPick={(adress, postnummer, ort) => setForm(f => ({ ...f, fastighet: adress, postnummer: postnummer || f.postnummer, ort: ort || f.ort }))}
              style={S.input}
              placeholder="Sök adress..."
              onFocus={fo}
              onBlur={fb}
            />
          </div>

          <div style={m ? S.rowM : S.row}>
            <div style={S.field}>
              <label style={S.label}>POSTNUMMER</label>
              <input spellCheck={false} style={S.input} value={form.postnummer} onChange={e => set('postnummer', e.target.value)}
                placeholder="123 45" onFocus={fo} onBlur={fb} />
            </div>
            <div style={S.field}>
              <label style={S.label}>ORT</label>
              <input spellCheck={false} style={S.input} value={form.ort} onChange={e => set('ort', e.target.value)}
                placeholder="Stockholm" onFocus={fo} onBlur={fb} />
            </div>
          </div>

          <div style={{ ...S.section, marginTop: 4 }}>KONTAKTPERSON PÅ ORDERN</div>
          <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <div style={S.field}>
              <label style={S.label}>NAMN</label>
              <input spellCheck={false} style={S.input} value={form.kontakt_namn} onChange={e => set('kontakt_namn', e.target.value)}
                placeholder="Namn" onFocus={fo} onBlur={fb} />
            </div>
            <div style={S.field}>
              <label style={S.label}>TELEFON</label>
              <input spellCheck={false} style={S.input} value={form.kontakt_telefon} onChange={e => set('kontakt_telefon', e.target.value)}
                placeholder="07X-XXX XX XX" onFocus={fo} onBlur={fb} />
            </div>
            <div style={S.field}>
              <label style={S.label}>E-POST</label>
              <input spellCheck={false} style={S.input} value={form.kontakt_epost} onChange={e => set('kontakt_epost', e.target.value)}
                placeholder="kontakt@ex.se" onFocus={fo} onBlur={fb} />
            </div>
          </div>

          <div style={{ ...S.section, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>PLANERING</span>
            <button type="button" onClick={toggleKalender}
              style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, color: '#E8C96A', fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer', letterSpacing: 0.5 }}>
              {showKalender ? '− Dölj beläggning' : '📅 Visa beläggning'}
            </button>
          </div>

          {showKalender && (
            <MiniKalender
              ordrar={kalenderOrdrar}
              datumFran={form.datum_fran}
              datumTill={form.datum_till}
            />
          )}

          <div style={m ? S.rowM : S.row}>
            <div style={S.field}>
              <label style={S.label}>DATUM FRÅN</label>
              <DatumValjare value={form.datum_fran} onChange={d => set('datum_fran', d)} style={S.input} minDate={new Date().toISOString().slice(0, 10)} />
            </div>
            <div style={S.field}>
              <label style={S.label}>DATUM TILL</label>
              <DatumValjare value={form.datum_till} onChange={d => set('datum_till', d)} style={S.input} minDate={form.datum_fran || new Date().toISOString().slice(0, 10)} />
            </div>
          </div>

          <div style={m ? S.rowM : S.row}>
            <div style={S.field}>
              <label style={S.label}>STARTTID</label>
              <input spellCheck={false} type="time" style={S.input} value={form.bokad_start} onChange={e => set('bokad_start', e.target.value)} onFocus={fo} onBlur={fb} />
            </div>
            <div style={S.field}>
              <label style={S.label}>SLUTTID</label>
              <input spellCheck={false} type="time" style={S.input} value={form.bokad_slut} onChange={e => set('bokad_slut', e.target.value)} onFocus={fo} onBlur={fb} />
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>ÅTERKOMMANDE UPPDRAG</label>
            <div style={{ display: 'grid', gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 6 }}>
              {[{ v: '', l: 'Engång' }, { v: 'vecka', l: 'Veckovis' }, { v: 'manad', l: 'Månadsvis' }, { v: 'kvartal', l: 'Kvartalsvis' }].map(o => {
                const active = form.aterkommande === o.v
                return (
                  <button key={o.v || 'nej'} type="button" onClick={() => set('aterkommande', o.v)}
                    style={{ padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: active ? 'rgba(232,201,106,0.12)' : '#111', color: active ? '#E8C96A' : '#666',
                      border: `1px solid ${active ? '#E8C96A' : '#2a2a2a'}` }}>
                    {o.l}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>TILLDELAD PERSONAL</label>
            <div style={S.chips}>
              {PERSONAL.map(p => (
                <div key={p} onClick={() => togglePerson(p)}
                  style={{ ...S.chip, ...(form.tilldelad.includes(p) ? S.chipActive : {}) }}>
                  {p.split(' ')[0]}
                </div>
              ))}
            </div>
          </div>

          <div style={S.section}>INSTRUKTION</div>

          <div style={S.field}>
            <label style={S.label}>ARBETSINSTRUKTION</label>
            <textarea spellCheck={true} style={S.textarea} value={form.arbetsinstruktion} onChange={e => set('arbetsinstruktion', e.target.value)}
              placeholder="Beskriv vad som ska utföras..." onFocus={fo} onBlur={fb} />
          </div>

          <div style={S.field}>
            <label style={S.label}>PRIORITET</label>
            <select style={S.select} value={form.prioritet} onChange={e => set('prioritet', e.target.value)} onFocus={fo} onBlur={fb}>
              <option value="lag">Låg</option>
              <option value="normal">Normal</option>
              <option value="hog">Hög</option>
              <option value="akut">Akut 🚨</option>
            </select>
          </div>
        </div>

        <div style={{ ...S.footer, ...(m ? { position: 'sticky' as const, bottom: 0, background: '#1a1a1a', zIndex: 1, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' } : {}) }}>
          {saveError && <div style={{ color: '#ef4444', fontSize: 12, flex: 1 }}>{saveError}</div>}
          <button style={S.cancelBtn} onClick={onClose}>Avbryt</button>
          <button style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Sparar...' : isEdit ? 'Spara ändringar' : 'Spara order'}
          </button>
        </div>
      </div>
    </div>
  )
}
