'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useKundPrisavtal } from '@/hooks/useKundPrisavtal'
import { fmtKr, inp, lbl, fo, fb } from './shared'
import { useIsMobile } from '@/hooks/useMediaQuery'
import DatumValjare from '@/components/DatumValjare'
import { FakturaVy, type Faktura } from '@/components/order-tabs/FakturorTab'
import { useToast } from '@/components/Toast'

type Artikel = { id: string; namn: string; enhet: string; a_pris: number; kostnad_per_enhet: number }
type TidRad = {
  id: string; resurs: string | null; artikel_id: string | null; artikel_namn: string; enhet: string
  antal: number; a_pris: number; kostnad_per_enhet: number
  total_intakt: number; total_kostnad: number
  datum: string | null; start_tid: string | null; slut_tid: string | null; anteckning: string | null
  fakturerad?: boolean
}
type DagRad = { datum: string; start: string; slut: string }
type PlanRad = { id: string; resurs: string; datum: string; start: string; slut: string; artikelId: string }
type FakturaRad = { id: string; typ: 'artikel' | 'fritext' | 'datum'; artikel_id: string; text: string; antal: number; resurser: number; apris: number; enhet: string }

const PERSONAL = ['Adam', 'Isabelle', 'Kalle', 'Maria', 'Erik', 'Sofia']
const fmtDag = (d: string) => new Date(d).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })

function datumMellan(fran: string, till: string): string[] {
  const dagar: string[] = []
  const d = new Date(fran)
  const slut = new Date(till)
  while (d <= slut) {
    dagar.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return dagar
}

export default function TidFaktureringTab({ orderId, onUpdated, last = false }: { orderId: string; onUpdated?: () => void; last?: boolean }) {
  const m = useIsMobile()
  const toast = useToast()
  const [subTab, setSubTab] = useState<'tid' | 'faktura'>('tid')
  const [artiklar, setArtiklar] = useState<Artikel[]>([])
  const [rader, setRader] = useState<TidRad[]>([])

  // Tidrapportering state
  const [resurs, setResurs] = useState('')
  const [artikelId, setArtikelId] = useState('')
  const [franDatum, setFranDatum] = useState('')
  const [tillDatum, setTillDatum] = useState('')
  const [dagRader, setDagRader] = useState<DagRad[]>([])
  const [anteckning, setAnteckning] = useState('')
  const [saving, setSaving] = useState(false)
  const [planRader, setPlanRader] = useState<PlanRad[]>([])
  const [savingPlan, setSavingPlan] = useState(false)

  // Faktura state
  const [orderInfo, setOrderInfo] = useState<any>(null)
  const [momsProc, setMomsProc] = useState(25)
  const [fakturaRef, setFakturaRef] = useState('')
  const [fakturaRader, setFakturaRader] = useState<FakturaRad[]>([
    { id: crypto.randomUUID(), typ: 'artikel', artikel_id: '', text: '', antal: 1, resurser: 1, apris: 0, enhet: 'tim' }
  ])
  const [skaparFaktura, setSkaparFaktura] = useState(false)
  const [fakturaSkapad, setFakturaSkapad] = useState(false)
  const [skickadFaktura, setSkickadFaktura] = useState<Faktura | null>(null)
  const [nextFakturaNr, setNextFakturaNr] = useState('HOF-1001')
  const newRowRef = useRef<string | null>(null)
  const rowRefs = useRef<Record<string, HTMLSelectElement | HTMLInputElement | null>>({})

  useEffect(() => {
    const sb = createClient()
    sb.from('artiklar').select('*').eq('aktiv', true).order('namn').then(({ data }) => setArtiklar(data || []))
    fetchRader()
    sb.from('orders').select('*, customer:customers(namn,betalvillkor,orgnummer,epost,fakturamail,adress,postnummer,ort)').eq('id', orderId).single()
      .then(({ data }) => {
        setOrderInfo(data); setFakturaRef(data?.fakturareferens || '')
        // Förifyll FRÅN DATUM med orderns planerade datum (samma som på ordern)
        if (data?.bokad_datum) setFranDatum(prev => prev || String(data.bokad_datum).slice(0, 10))
      })
    sb.from('fakturor').select('*', { count: 'exact', head: true }).then(({ count }) => {
      setNextFakturaNr(`HOF-${1001 + (count || 0)}`)
    })
  }, [orderId])

  // Generera dagrader när datumintervall ändras
  useEffect(() => {
    if (!franDatum) { setDagRader([]); return }
    const till = tillDatum || franDatum
    const dagar = datumMellan(franDatum, till)
    setDagRader(prev => dagar.map(d => {
      const existing = prev.find(r => r.datum === d)
      return existing || { datum: d, start: '08:00', slut: '16:00' }
    }))
  }, [franDatum, tillDatum])

  const fetchRader = async () => {
    const { data } = await createClient().from('order_tid_rader').select('*').eq('order_id', orderId).order('datum').order('created_at')
    setRader(data || [])
  }

  // Auto-status: order blir "klar" när tid rapporterats (eller fakturerad), annars "ny". Inaktiv rörs ej.
  const synkaOrderStatus = async (harTid: boolean) => {
    if (!orderInfo || orderInfo.status === 'inaktiv') return
    const nyStatus = (harTid || orderInfo.fakturerat) ? 'klar' : 'ny'
    if (nyStatus === orderInfo.status) return
    const { error } = await createClient().from('orders').update({ status: nyStatus }).eq('id', orderId)
    if (error) { toast.error('Kunde inte uppdatera orderstatus: ' + error.message); return }
    setOrderInfo((o: any) => o ? { ...o, status: nyStatus } : o)
    onUpdated?.()
  }

  const valdArtikel = artiklar.find(a => a.id === artikelId)
  const { prisavtal, artikelPris } = useKundPrisavtal(orderInfo?.customer_id, artiklar)

  const laggTillTid = async () => {
    if (last) return
    if (!artikelId || dagRader.length === 0) return
    setSaving(true)
    const sb = createClient()
    for (const r of dagRader) {
      const [sh, sm] = r.start.split(':').map(Number)
      const [eh, em] = r.slut.split(':').map(Number)
      const min = (eh * 60 + em) - (sh * 60 + sm)
      const antal = min > 0 ? min / 60 : 0
      const { error } = await sb.from('order_tid_rader').insert({
        order_id: orderId,
        resurs: resurs || null,
        artikel_id: artikelId,
        artikel_namn: valdArtikel?.namn,
        enhet: valdArtikel?.enhet || 'tim',
        antal,
        a_pris: artikelPris(artikelId),
        kostnad_per_enhet: valdArtikel?.kostnad_per_enhet || 0,
        datum: r.datum,
        start_tid: r.start,
        slut_tid: r.slut,
        anteckning: anteckning || null,
      })
      if (error) { toast.error('Kunde inte spara tidrad: ' + error.message); setSaving(false); return }
    }
    setArtikelId(''); setFranDatum(''); setTillDatum(''); setDagRader([]); setAnteckning('')
    await fetchRader()
    await synkaOrderStatus(true)
    setSaving(false)
  }

  const genereraPlanRader = () => {
    if (!orderInfo?.bokad_datum || !orderInfo?.tilldelad?.length) return
    const fran = String(orderInfo.bokad_datum).slice(0, 10)
    const till = orderInfo.bokad_datum_till ? String(orderInfo.bokad_datum_till).slice(0, 10) : fran
    const dagar = datumMellan(fran, till)
    const start = orderInfo.bokad_start || '08:00'
    const slut = orderInfo.bokad_slut || '16:00'
    const rader: PlanRad[] = []
    for (const person of orderInfo.tilldelad as string[]) {
      for (const dag of dagar) {
        rader.push({ id: crypto.randomUUID(), resurs: person, datum: dag, start, slut, artikelId: '' })
      }
    }
    setPlanRader(rader)
  }

  const laggTillAllaPlan = async () => {
    if (last) return
    setSavingPlan(true)
    const sb = createClient()
    for (const r of planRader) {
      if (!r.artikelId) continue
      const valdArtikel = artiklar.find(a => a.id === r.artikelId)
      const [sh, sm] = r.start.split(':').map(Number)
      const [eh, em] = r.slut.split(':').map(Number)
      const min = (eh * 60 + em) - (sh * 60 + sm)
      const antal = min > 0 ? min / 60 : 0
      const { error } = await sb.from('order_tid_rader').insert({
        order_id: orderId,
        resurs: r.resurs,
        artikel_id: r.artikelId,
        artikel_namn: valdArtikel?.namn,
        enhet: valdArtikel?.enhet || 'tim',
        antal,
        a_pris: artikelPris(r.artikelId),
        kostnad_per_enhet: valdArtikel?.kostnad_per_enhet || 0,
        datum: r.datum,
        start_tid: r.start,
        slut_tid: r.slut,
        anteckning: null,
      })
      if (error) { toast.error('Kunde inte spara plan-tidrad: ' + error.message); setSavingPlan(false); return }
    }
    setPlanRader([])
    await fetchRader()
    await synkaOrderStatus(true)
    setSavingPlan(false)
  }

  const taBortRad = async (id: string) => {
    if (last) return
    if (rader.find(r => r.id === id)?.fakturerad) return
    const sb = createClient()
    const { error } = await sb.from('order_tid_rader').delete().eq('id', id)
    if (error) { toast.error('Kunde inte ta bort tidrad: ' + error.message); return }
    await fetchRader()
    const { count } = await sb.from('order_tid_rader').select('id', { count: 'exact', head: true }).eq('order_id', orderId)
    await synkaOrderStatus((count || 0) > 0)
  }

  const totIntakt = rader.reduce((s, r) => s + (r.total_intakt || 0), 0)
  const totKostnad = rader.reduce((s, r) => s + (r.total_kostnad || 0), 0)

  // Faktura-logik
  const addFakturaRad = () => {
    if (last) return
    const id = crypto.randomUUID()
    newRowRef.current = id
    setFakturaRader(r => [...r, { id, typ: 'artikel', artikel_id: '', text: '', antal: 1, resurser: 1, apris: 0, enhet: 'tim' }])
  }
  const updateFakturaRad = (id: string, k: string, v: any) => { if (last) return; setFakturaRader(r => r.map(row => row.id === id ? { ...row, [k]: v } : row)) }
  const removeFakturaRad = (id: string) => { if (last) return; setFakturaRader(r => r.filter(row => row.id !== id)) }

  // Bygg fakturarader från inrapporterade tidposter — grupperat per datum, med en
  // datum-rubrik ovanför varje dags rader. Artikelrader använder artikel_id så att
  // à-priset följer kundens prisavtal (annars artikelpriset) via artikelPris().
  const hamtaFranTid = () => {
    if (last) return
    if (rader.length === 0) return
    const perDatum = new Map<string, Map<string, { namn: string; enhet: string; artikelId: string; apris: number; antal: number }>>()
    for (const r of rader) {
      const dkey = r.datum || ''
      if (!perDatum.has(dkey)) perDatum.set(dkey, new Map())
      const inner = perDatum.get(dkey)!
      const aid = r.artikel_id || ''
      const akey = `${aid}|${r.artikel_namn}|${r.enhet}|${r.a_pris}`
      const g = inner.get(akey)
      if (g) g.antal += r.antal || 0
      else inner.set(akey, { namn: r.artikel_namn, enhet: r.enhet, artikelId: aid, apris: r.a_pris || 0, antal: r.antal || 0 })
    }
    const nya: FakturaRad[] = []
    for (const dkey of Array.from(perDatum.keys()).sort()) {
      nya.push({ id: crypto.randomUUID(), typ: 'datum', artikel_id: '', text: dkey ? fmtDag(dkey) : 'Utan datum', antal: 0, resurser: 1, apris: 0, enhet: '' })
      for (const g of perDatum.get(dkey)!.values()) {
        nya.push({
          id: crypto.randomUUID(),
          typ: g.artikelId ? 'artikel' : 'fritext',
          artikel_id: g.artikelId,
          text: g.artikelId ? '' : g.namn,
          antal: Math.round(g.antal * 100) / 100,
          resurser: 1,
          apris: g.apris, // används bara för fritext-fallback; artikelrader räknar via artikelPris()
          enhet: g.enhet,
        })
      }
    }
    if (nya.length) setFakturaRader(nya)
  }

  const radBelopp = (r: FakturaRad) => {
    if (r.typ === 'datum') return 0
    const totalAntal = r.antal * (r.resurser || 1)
    if (r.typ === 'artikel' && r.artikel_id) return totalAntal * artikelPris(r.artikel_id)
    return totalAntal * r.apris
  }

  useEffect(() => {
    if (newRowRef.current) {
      const el = rowRefs.current[newRowRef.current]
      el?.focus()
      newRowRef.current = null
    }
  }, [fakturaRader])

  const fakturaSubtotal = fakturaRader.reduce((s, r) => s + radBelopp(r), 0)
  const fakturaMoms = fakturaSubtotal * (momsProc / 100)
  const fakturaTotalt = fakturaSubtotal + fakturaMoms

  const skapaFakturaFn = async () => {
    if (last) return
    if (fakturaRader.length === 0) return
    setSkaparFaktura(true)
    const sb = createClient()
    const raderPayload = fakturaRader.map(r => {
      if (r.typ === 'datum') {
        return { typ: 'rubrik', desc: r.text, antal: 0, apris: 0, enhet: '', belopp: 0 }
      }
      if (r.typ === 'artikel' && r.artikel_id) {
        const a = artiklar.find(a => a.id === r.artikel_id)
        const pris = artikelPris(r.artikel_id)
        return { typ: 'rad', desc: a?.namn || '', antal: r.antal, apris: pris, enhet: a?.enhet || 'st', belopp: r.antal * pris }
      }
      return { typ: 'rad', desc: r.text, antal: r.antal, apris: r.apris, enhet: r.enhet, belopp: r.antal * r.apris }
    })
    // Förfallodatum = idag + kundens betalningsvillkor (default 30 dgr) → låser upp reskontra/förfallna.
    const betalvillkor = Number(orderInfo?.customer?.betalvillkor) || 30
    const forfalloDatum = new Date()
    forfalloDatum.setDate(forfalloDatum.getDate() + betalvillkor)
    const { data: nyFaktura, error: fakturaErr } = await sb.from('fakturor').insert({
      fakturanummer: nextFakturaNr,
      forfallodatum: forfalloDatum.toISOString().split('T')[0],
      order_id: orderId,
      customer_id: orderInfo?.customer_id,
      rader: raderPayload,
      moms_pct: momsProc,
      subtotal: fakturaSubtotal,
      moms_belopp: fakturaMoms,
      totalt: fakturaTotalt,
      kund_namn: orderInfo?.customer?.namn,
      kund_orgnr: orderInfo?.customer?.orgnummer,
      kund_epost: orderInfo?.customer?.fakturamail || orderInfo?.customer?.epost,
      referens: fakturaRef,
      status: 'skickad',
    }).select('*').single()
    // Markera INTE ordern fakturerad / lås INTE tidrader om fakturan inte skapades.
    if (fakturaErr || !nyFaktura) {
      toast.error('Kunde inte skapa fakturan: ' + (fakturaErr?.message || 'okänt fel'))
      setSkaparFaktura(false)
      return
    }
    const { error: ordErr } = await sb.from('orders').update({
      fakturerat: true,
      fakturerat_belopp: fakturaTotalt,
      fakturadatum: new Date().toISOString().split('T')[0],
      // Fakturerad order räknas som klar (rör inte manuellt inaktiverade ordrar)
      status: orderInfo?.status === 'inaktiv' ? 'inaktiv' : 'klar',
    }).eq('id', orderId)
    if (ordErr) toast.error('Fakturan skapades, men ordern kunde inte markeras fakturerad: ' + ordErr.message)
    // Markera orderns alla tidposter som fakturerade (låser dem)
    const { error: lasErr } = await sb.from('order_tid_rader').update({ fakturerad: true }).eq('order_id', orderId)
    if (lasErr) toast.error('Fakturan skapades, men tidraderna kunde inte låsas: ' + lasErr.message)
    await fetchRader()
    setOrderInfo((o: any) => o ? { ...o, fakturerat: true, status: o.status === 'inaktiv' ? 'inaktiv' : 'klar' } : o)
    setSkaparFaktura(false)
    setFakturaSkapad(true)
    setTimeout(() => setFakturaSkapad(false), 3000)
    onUpdated?.()
    // Öppna fakturan och trigga skicka-flödet (utskrift/PDF + e-postklient)
    if (nyFaktura) setSkickadFaktura(nyFaktura as Faktura)
  }

  return (
    <div>
      {/* Sub-flikar */}
      <div style={{ display: 'flex', marginBottom: 16, background: '#252528', borderRadius: 10, padding: 4 }}>
        <button onClick={() => setSubTab('tid')}
          style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: subTab === 'tid' ? '#3a3a3c' : 'none', color: subTab === 'tid' ? '#f2f2f7' : '#8e8e93', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          ⏱ Tidrapportering
        </button>
        <button onClick={() => setSubTab('faktura')}
          style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: subTab === 'faktura' ? '#3a3a3c' : 'none', color: subTab === 'faktura' ? '#f2f2f7' : '#8e8e93', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          🧾 Skapa faktura
        </button>
      </div>

      {/* Låst-notis */}
      {last && (
        <div style={{ background: '#1c1c1e', border: '1px solid #E8C96A', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#E8C96A' }}>
          🔒 Ordern är låst (fakturerad/ej deb) — ekonomi kan inte ändras.
        </div>
      )}

      {/* ── TIDRAPPORTERING ── */}
      {subTab === 'tid' && (
        <div>
          {/* Formulär */}
          <div style={{ background: '#252528', borderRadius: 12, padding: '16px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={lbl}>RESURSER</div>
                <select style={{ ...inp, opacity: last ? 0.5 : 1 }} disabled={last} value={resurs} onChange={e => setResurs(e.target.value)} onFocus={fo} onBlur={fb}>
                  <option value="">— Välj —</option>
                  {PERSONAL.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <div style={lbl}>ARTIKEL / TJÄNST</div>
                <select style={{ ...inp, opacity: last ? 0.5 : 1 }} disabled={last} value={artikelId} onChange={e => setArtikelId(e.target.value)} onFocus={fo} onBlur={fb}>
                  <option value="">— Välj —</option>
                  {artiklar.map(a => <option key={a.id} value={a.id}>{a.namn} · {a.a_pris} kr/{a.enhet}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 12, ...(last ? { opacity: 0.5, pointerEvents: 'none' as const } : {}) }}>
              <div>
                <div style={lbl}>FRÅN DATUM</div>
                <DatumValjare value={franDatum} onChange={setFranDatum} style={inp} />
              </div>
              <div>
                <div style={lbl}>TILL DATUM (VALFRITT)</div>
                <DatumValjare value={tillDatum} onChange={setTillDatum} style={inp} minDate={franDatum || undefined} />
              </div>
            </div>

            {/* Genererade dagrader */}
            {dagRader.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {dagRader.map((r, i) => (
                  <div key={r.datum} style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr auto' : '2fr 1fr 1fr auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: '#aeaeb2', padding: '8px 12px', background: '#1c1c1e', borderRadius: 8, ...(m ? { gridColumn: '1 / -1' } : {}) }}>{fmtDag(r.datum)}</div>
                    <input spellCheck={false} type="time" style={inp} value={r.start}
                      onChange={e => setDagRader(dr => dr.map((d, j) => j === i ? { ...d, start: e.target.value } : d))}
                      onFocus={fo} onBlur={fb} />
                    <input spellCheck={false} type="time" style={inp} value={r.slut}
                      onChange={e => setDagRader(dr => dr.map((d, j) => j === i ? { ...d, slut: e.target.value } : d))}
                      onFocus={fo} onBlur={fb} />
                    <button onClick={() => setDagRader(dr => dr.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: '1px solid #3a3a3c', borderRadius: 8, padding: '7px 10px', color: '#f87171', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Fyll i från planering — rader direkt i formuläret */}
            {orderInfo?.tilldelad?.length > 0 && orderInfo?.bokad_datum && (
              <div style={{ marginBottom: 12 }}>
                {planRader.length === 0 ? (
                  <button onClick={genereraPlanRader} disabled={last}
                    style={{ width: '100%', padding: '10px', background: '#1c1c1e', color: '#E8C96A', border: '1px solid #3a3a3c', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: last ? 'not-allowed' : 'pointer', opacity: last ? 0.5 : 1 }}>
                    ⚡ Fyll i från planering
                  </button>
                ) : (
                  <>
                    <div style={{ ...lbl, marginBottom: 8 }}>FRÅN PLANERING ({planRader.length})</div>
                    {planRader.map((r, i) => (
                      <div key={r.id} style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr auto' : '1.2fr 1fr 1fr 2fr auto', gap: 8, marginBottom: m ? 12 : 6, alignItems: 'center' }}>
                        <div style={{ fontSize: 13, padding: '8px 12px', background: '#1c1c1e', borderRadius: 8, ...(m ? { gridColumn: '1 / -1' } : {}) }}>
                          <div style={{ fontWeight: 700, color: '#f2f2f7' }}>{r.resurs}</div>
                          <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>{fmtDag(r.datum)}</div>
                        </div>
                        <input spellCheck={false} type="time" style={inp} value={r.start}
                          onChange={e => setPlanRader(pr => pr.map((d, j) => j === i ? { ...d, start: e.target.value } : d))}
                          onFocus={fo} onBlur={fb} />
                        <input spellCheck={false} type="time" style={inp} value={r.slut}
                          onChange={e => setPlanRader(pr => pr.map((d, j) => j === i ? { ...d, slut: e.target.value } : d))}
                          onFocus={fo} onBlur={fb} />
                        <select style={{ ...inp, ...(m ? { gridColumn: '1 / -1' } : {}) }} value={r.artikelId}
                          onChange={e => setPlanRader(pr => pr.map((d, j) => j === i ? { ...d, artikelId: e.target.value } : d))}
                          onFocus={fo} onBlur={fb}>
                          <option value="">— Välj —</option>
                          {artiklar.map(a => <option key={a.id} value={a.id}>{a.namn} · {a.a_pris} kr/{a.enhet}</option>)}
                        </select>
                        <button onClick={() => setPlanRader(pr => pr.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: '1px solid #3a3a3c', borderRadius: 8, padding: '7px 10px', color: '#f87171', cursor: 'pointer', fontSize: 14 }}>×</button>
                      </div>
                    ))}
                    <button onClick={laggTillAllaPlan} disabled={last || savingPlan || !planRader.some(r => r.artikelId)}
                      style={{ width: '100%', padding: '10px', marginTop: 2, background: 'none', color: '#E8C96A', border: '1px dashed #3a3a3c', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: last ? 'not-allowed' : 'pointer', opacity: last || savingPlan || !planRader.some(r => r.artikelId) ? 0.5 : 1 }}>
                      {savingPlan ? 'Sparar...' : '➕ Lägg till alla planerade tidposter'}
                    </button>
                  </>
                )}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={lbl}>ANTECKNING</div>
              <input spellCheck={true} style={{ ...inp, opacity: last ? 0.5 : 1 }} disabled={last} value={anteckning} onChange={e => setAnteckning(e.target.value)} placeholder="t.ex. inkl. restid" onFocus={fo} onBlur={fb} />
            </div>

            <button onClick={laggTillTid} disabled={last || saving || !artikelId || dagRader.length === 0}
              style={{ width: '100%', padding: '11px', background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: last ? 'not-allowed' : 'pointer', opacity: last || saving || !artikelId || dagRader.length === 0 ? 0.5 : 1 }}>
              {saving ? 'Sparar...' : '+ LÄGG TILL TIDPOST'}
            </button>
          </div>

          {/* Sparade rader */}
          {rader.length > 0 && (
            <div style={{ marginTop: 14, background: '#252528', borderRadius: 12, padding: '16px' }}>
              <div style={{ ...lbl, marginBottom: 12 }}>TIDPOSTER ({rader.length})</div>
              {rader.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#1c1c1e', borderRadius: 8, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f2f2f7', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {r.fakturerad && <span title="Fakturerad – låst">🔒</span>}
                      {r.artikel_namn}{r.resurs ? ` – ${r.resurs}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#8e8e93', marginTop: 2 }}>
                      {r.antal.toFixed(1)} {r.enhet}
                      {r.datum ? ` · ${fmtDag(r.datum)}` : ''}
                      {r.start_tid && r.slut_tid ? ` · ${r.start_tid}–${r.slut_tid}` : ''}
                      {r.anteckning ? ` · ${r.anteckning}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>{fmtKr(r.total_intakt || 0)}</div>
                    <div style={{ fontSize: 11, color: '#f87171' }}>kostnad {fmtKr(r.total_kostnad || 0)}</div>
                  </div>
                  {!r.fakturerad && (
                    <button onClick={() => taBortRad(r.id)}
                      style={{ background: 'none', border: '1px solid #3a3a3c', borderRadius: 6, padding: '4px 10px', color: '#f87171', fontSize: 11, cursor: 'pointer', marginLeft: 10 }}>✕</button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 12px 0', borderTop: '1px solid #3a3a3c', marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#8e8e93' }}>Total intäkt (ref)</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>{fmtKr(totIntakt)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#8e8e93' }}>Total kostnad</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#f87171' }}>{fmtKr(totKostnad)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SKAPA FAKTURA ── */}
      {subTab === 'faktura' && (
        <div>
          {/* Fakturainfo */}
          <div style={{ background: '#252528', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ ...lbl, marginBottom: 12 }}>FAKTURAINFO</div>
            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#8e8e93', marginBottom: 4 }}>Fakturanr</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#E8C96A' }}>{nextFakturaNr}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8e8e93', marginBottom: 4 }}>Faktureras till</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f2f7' }}>{orderInfo?.customer?.namn || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8e8e93', marginBottom: 4 }}>Betalvillkor</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f2f7' }}>{orderInfo?.customer?.betalvillkor || '30 dagar'}</div>
              </div>
            </div>
          </div>

          {/* Moms + referens */}
          <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 2fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={lbl}>MOMS (%)</div>
              <select style={{ ...inp, opacity: last ? 0.5 : 1 }} disabled={last} value={momsProc} onChange={e => setMomsProc(Number(e.target.value))} onFocus={fo} onBlur={fb}>
                <option value={25}>25%</option>
                <option value={12}>12%</option>
                <option value={6}>6%</option>
                <option value={0}>0%</option>
              </select>
            </div>
            <div>
              <div style={lbl}>FAKTURAREFERENS (ER REF.)</div>
              <input spellCheck={false} style={{ ...inp, opacity: last ? 0.5 : 1 }} disabled={last} value={fakturaRef} onChange={e => setFakturaRef(e.target.value)} placeholder="t.ex. PO-12345" onFocus={fo} onBlur={fb} />
            </div>
          </div>

          {/* Fakturarader — inline spreadsheet */}
          <div style={{ background: '#252528', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={lbl}>FAKTURARADER</div>
              {rader.length > 0 && (
                <button onClick={hamtaFranTid} disabled={last}
                  style={{ background: 'none', border: '1px solid #3a3a3c', borderRadius: 8, padding: '5px 12px', color: '#E8C96A', fontSize: 12, fontWeight: 700, cursor: last ? 'not-allowed' : 'pointer', opacity: last ? 0.5 : 1 }}>
                  ⬇ Hämta från tidrapportering ({rader.length})
                </button>
              )}
            </div>

            {/* Header — döljs på mobil (kortvy istället) */}
            {!m && (
              <div style={{ display: 'grid', gridTemplateColumns: '28px 3fr 60px 60px 80px 80px 90px 32px', gap: 6, padding: '0 4px 6px', borderBottom: '1px solid #3a3a3c', marginBottom: 4 }}>
                {['', 'Beskrivning / Artikel', 'Res.', 'Antal', 'À-pris', 'Enhet', 'Belopp', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#636366', textAlign: i >= 2 ? 'center' : 'left' }}>{h}</div>
                ))}
              </div>
            )}

            {fakturaRader.map((r, idx) => {
              if (r.typ === 'datum') {
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 4px 4px', marginTop: idx > 0 ? 6 : 0, borderTop: idx > 0 ? '1px solid #3a3a3c' : 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, color: '#E8C96A', textTransform: 'capitalize' }}>📅 {r.text}</div>
                    {!last && (
                      <button onClick={() => removeFakturaRad(r.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636366', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                    )}
                  </div>
                )
              }
              const vald = artiklar.find(a => a.id === r.artikel_id)
              const enhet = vald?.enhet || r.enhet || 'st'
              const apris = r.typ === 'artikel' ? artikelPris(r.artikel_id) : r.apris
              const visaResurser = enhet === 'tim' || enhet === 'dag'
              const totalAntal = r.antal * (r.resurser || 1)
              const belopp = totalAntal * apris

              const cell: React.CSSProperties = {
                background: '#1c1c1e', border: '1px solid transparent', borderRadius: 6,
                padding: '6px 8px', color: '#f2f2f7', fontSize: 13, outline: 'none',
                width: '100%', boxSizing: 'border-box', textAlign: 'center' as const,
                transition: 'border-color 0.15s',
              }
              const cellFo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#E8C96A' }
              const cellFb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = 'transparent' }
              const cellL = last ? { ...cell, opacity: 0.5 } : cell

              // Beskrivningsfält (artikel-select eller fritext) — återanvänds i desktop-grid och mobil-kortvy
              const beskrivningEl = r.typ === 'artikel' ? (
                <select ref={el => { rowRefs.current[r.id] = el }} disabled={last} style={{ ...cellL, textAlign: 'left' as const }} value={r.artikel_id}
                  onChange={e => {
                    const a = artiklar.find(a => a.id === e.target.value)
                    updateFakturaRad(r.id, 'artikel_id', e.target.value)
                    if (a) { updateFakturaRad(r.id, 'enhet', a.enhet); updateFakturaRad(r.id, 'apris', a.a_pris) }
                  }} onFocus={cellFo} onBlur={cellFb}>
                  <option value="">— Välj artikel —</option>
                  {artiklar.map(a => <option key={a.id} value={a.id}>{a.namn}</option>)}
                </select>
              ) : (
                <input spellCheck={true} ref={el => { rowRefs.current[r.id] = el }} disabled={last} style={{ ...cellL, textAlign: 'left' as const }} value={r.text}
                  placeholder="Fritext beskrivning..."
                  onChange={e => updateFakturaRad(r.id, 'text', e.target.value)} onFocus={cellFo} onBlur={cellFb} />
              )

              // Resurser-input (visas bara för tim/dag)
              const resurserEl = (
                <input spellCheck={false} type="number" min="1" disabled={last} style={{ ...cellL, display: visaResurser ? undefined : 'flex' as const, visibility: visaResurser ? 'visible' : 'hidden', color: '#aeaeb2' }}
                  value={r.resurser || 1}
                  onChange={e => updateFakturaRad(r.id, 'resurser', parseInt(e.target.value) || 1)}
                  onFocus={cellFo} onBlur={cellFb} />
              )

              // Antal-input
              const antalEl = (
                <input spellCheck={false} type="number" step="0.5" min="0" disabled={last} style={cellL}
                  value={r.antal}
                  onChange={e => updateFakturaRad(r.id, 'antal', parseFloat(e.target.value) || 0)}
                  onFocus={cellFo} onBlur={cellFb} />
              )

              // À-pris (input för fritext, annars visning av avtalspris)
              const aprisEl = r.typ === 'fritext' ? (
                <input spellCheck={false} type="number" min="0" disabled={last} style={cellL}
                  value={r.apris}
                  onChange={e => updateFakturaRad(r.id, 'apris', parseFloat(e.target.value) || 0)}
                  onFocus={cellFo} onBlur={cellFb} />
              ) : (
                <div title={prisavtal[r.artikel_id] !== undefined ? 'Kundens avtalspris' : undefined}
                  style={{ ...cell, color: prisavtal[r.artikel_id] !== undefined ? '#E8C96A' : '#8e8e93', fontWeight: prisavtal[r.artikel_id] !== undefined ? 700 : 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {apris > 0 ? apris : '—'}
                </div>
              )

              // ── Mobil: staplad kortvy (etikett–värde) istället för bred grid ──
              if (m) {
                const flabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#636366', marginBottom: 4 }
                return (
                  <div key={r.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                    {/* Rad 1: typ-ikon + beskrivning + ta bort */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <button
                        title={r.typ === 'artikel' ? 'Byt till fritext' : 'Byt till artikel'}
                        disabled={last}
                        onClick={() => updateFakturaRad(r.id, 'typ', r.typ === 'artikel' ? 'fritext' : 'artikel')}
                        style={{ background: 'none', border: 'none', cursor: last ? 'not-allowed' : 'pointer', fontSize: 16, color: r.typ === 'artikel' ? '#E8C96A' : '#8e8e93', padding: 0, flexShrink: 0, opacity: last ? 0.5 : 1 }}>
                        {r.typ === 'artikel' ? '🏷' : '✏️'}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>{beskrivningEl}</div>
                      {!last && (
                        <button onClick={() => removeFakturaRad(r.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636366', fontSize: 18, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                      )}
                    </div>

                    {/* Rad 2: numeriska fält som etikett–värde */}
                    <div style={{ display: 'grid', gridTemplateColumns: visaResurser ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8 }}>
                      {visaResurser && (
                        <div>
                          <div style={flabel}>RES.</div>
                          {resurserEl}
                        </div>
                      )}
                      <div>
                        <div style={flabel}>ANTAL</div>
                        {antalEl}
                      </div>
                      <div>
                        <div style={flabel}>À-PRIS</div>
                        {aprisEl}
                      </div>
                    </div>

                    {/* Rad 3: enhet + belopp */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid #2c2c2e' }}>
                      <div style={{ fontSize: 12, color: '#636366' }}>
                        {visaResurser && r.resurser > 1 ? `${totalAntal} ${enhet}` : enhet}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: belopp > 0 ? '#4ade80' : '#636366' }}>
                        {belopp > 0 ? fmtKr(belopp) : '—'}
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '28px 3fr 60px 60px 80px 80px 90px 32px', gap: 6, padding: '4px', borderRadius: 8, marginBottom: 2,
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>

                  {/* Typ-ikon */}
                  <button
                    title={r.typ === 'artikel' ? 'Byt till fritext' : 'Byt till artikel'}
                    disabled={last}
                    onClick={() => updateFakturaRad(r.id, 'typ', r.typ === 'artikel' ? 'fritext' : 'artikel')}
                    style={{ background: 'none', border: 'none', cursor: last ? 'not-allowed' : 'pointer', fontSize: 14, color: r.typ === 'artikel' ? '#E8C96A' : '#8e8e93', padding: 0, textAlign: 'center' as const, opacity: last ? 0.5 : 1 }}>
                    {r.typ === 'artikel' ? '🏷' : '✏️'}
                  </button>

                  {/* Artikel / fritext */}
                  {beskrivningEl}

                  {/* Resurser */}
                  {resurserEl}

                  {/* Antal */}
                  {antalEl}

                  {/* À-pris */}
                  {aprisEl}

                  {/* Enhet */}
                  <div style={{ ...cell, color: '#636366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                    {visaResurser && r.resurser > 1 ? `${totalAntal} ${enhet}` : enhet}
                  </div>

                  {/* Belopp */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 14, fontWeight: 700, color: belopp > 0 ? '#4ade80' : '#636366', paddingRight: 4 }}>
                    {belopp > 0 ? fmtKr(belopp) : '—'}
                  </div>

                  {/* Ta bort */}
                  {last ? <div /> : (
                    <button onClick={() => removeFakturaRad(r.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636366', fontSize: 16, padding: 0, lineHeight: 1, textAlign: 'center' as const }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#636366')}>×</button>
                  )}
                </div>
              )
            })}

            <button onClick={addFakturaRad} disabled={last}
              style={{ width: '100%', padding: '8px', background: 'none', border: '1px dashed #3a3a3c', borderRadius: 8, color: '#636366', cursor: last ? 'not-allowed' : 'pointer', fontSize: 13, marginTop: 8, opacity: last ? 0.5 : 1 }}>
              + Lägg till rad
            </button>
          </div>

          {/* Summering */}
          <div style={{ background: '#252528', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#8e8e93' }}>Netto</span>
              <span style={{ fontSize: 13, color: '#aeaeb2' }}>{fmtKr(fakturaSubtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#8e8e93' }}>Moms ({momsProc}%)</span>
              <span style={{ fontSize: 13, color: '#aeaeb2' }}>{fmtKr(fakturaMoms)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #3a3a3c', paddingTop: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#f2f2f7' }}>Totalt</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#E8C96A' }}>{fmtKr(fakturaTotalt)}</span>
            </div>
          </div>

          <button onClick={skapaFakturaFn} disabled={last || skaparFaktura || fakturaRader.length === 0}
            style={{ width: '100%', padding: '13px', background: fakturaSkapad ? '#4ade80' : '#E8C96A', color: '#000', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: last ? 'not-allowed' : 'pointer', opacity: last || skaparFaktura ? 0.6 : 1 }}>
            {last ? '🔒 Ordern är låst' : fakturaSkapad ? '✓ Skapad & skickad!' : skaparFaktura ? 'Skapar...' : `📧 Skapa & skicka faktura – ${fmtKr(fakturaTotalt)}`}
          </button>
        </div>
      )}

      {skickadFaktura && <FakturaVy faktura={skickadFaktura} autoSend onClose={() => setSkickadFaktura(null)} />}
    </div>
  )
}
