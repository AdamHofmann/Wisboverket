'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Artikel = { id: string; namn: string; enhet: string; a_pris: number; kostnad_per_enhet: number }
type TidRad = {
  id: string; resurs: string; artikel_id: string; artikel_namn: string
  enhet: string; antal: number; a_pris: number; kostnad_per_enhet: number
  total_intakt: number; total_kostnad: number
  datum: string | null; start_tid: string | null; slut_tid: string | null; anteckning: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  card: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '16px 18px', marginBottom: 14 },
  cardTitle: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 14 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 },
  field: { display: 'flex', flexDirection: 'column' as const, gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: '#555' },
  input: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  select: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  addBtn: { background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 8 },
  preview: { background: '#0d0d0d', borderRadius: 8, padding: '12px 14px', marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  previewLabel: { fontSize: 11, color: '#555' },
  previewVal: (c: string): React.CSSProperties => ({ fontSize: 14, fontWeight: 700, color: c }),
  radRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, marginBottom: 6 },
  radLeft: { flex: 1 },
  radTitle: { fontSize: 13, fontWeight: 600, color: '#d0d0d0' },
  radSub: { fontSize: 11, color: '#555', marginTop: 2 },
  radRight: { textAlign: 'right' as const, marginLeft: 16 },
  intakt: { fontSize: 13, fontWeight: 700, color: '#4ade80' },
  kostnad: { fontSize: 11, color: '#f87171', marginTop: 2 },
  delBtn: { background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 10px', color: '#f87171', fontSize: 11, cursor: 'pointer', marginLeft: 8 },
  sumRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderTop: '1px solid #1e1e1e', marginTop: 8 },
}

const fmtKr = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 0 }) + ' kr'

export default function TidFaktureringTab({ orderId }: { orderId: string }) {
  const [artiklar, setArtiklar] = useState<Artikel[]>([])
  const [rader, setRader] = useState<TidRad[]>([])
  const [resurs, setResurs] = useState('')
  const [artikelId, setArtikelId] = useState('')
  const [datum, setDatum] = useState('')
  const [startTid, setStartTid] = useState('')
  const [slutTid, setSlutTid] = useState('')
  const [antal, setAntal] = useState('')
  const [anteckning, setAnteckning] = useState('')
  const [saving, setSaving] = useState(false)
  const [skapaFaktura, setSkapaFaktura] = useState(false)
  const [fakturaSkapad, setFakturaSkapad] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.from('artiklar').select('*').eq('aktiv', true).order('namn').then(({ data }) => setArtiklar(data || []))
    fetchRader()
  }, [orderId])

  const fetchRader = async () => {
    const { data } = await createClient().from('order_tid_rader').select('*').eq('order_id', orderId).order('created_at')
    setRader(data || [])
  }

  const valdArtikel = artiklar.find(a => a.id === artikelId)

  // Beräkna antal från tider om ifyllda
  const beraknatAntal = (() => {
    if (startTid && slutTid) {
      const [sh, sm] = startTid.split(':').map(Number)
      const [eh, em] = slutTid.split(':').map(Number)
      const min = (eh * 60 + em) - (sh * 60 + sm)
      if (min > 0) return (min / 60).toFixed(2)
    }
    return antal
  })()

  const previewnIntakt = valdArtikel ? parseFloat(beraknatAntal || '0') * valdArtikel.a_pris : 0
  const previewKostnad = valdArtikel ? parseFloat(beraknatAntal || '0') * valdArtikel.kostnad_per_enhet : 0

  const laggTill = async () => {
    if (!artikelId || !beraknatAntal) return
    setSaving(true)
    await createClient().from('order_tid_rader').insert({
      order_id: orderId,
      resurs: resurs || null,
      artikel_id: artikelId,
      artikel_namn: valdArtikel?.namn,
      enhet: valdArtikel?.enhet || 'tim',
      antal: parseFloat(beraknatAntal),
      a_pris: valdArtikel?.a_pris || 0,
      kostnad_per_enhet: valdArtikel?.kostnad_per_enhet || 0,
      datum: datum || null,
      start_tid: startTid || null,
      slut_tid: slutTid || null,
      anteckning: anteckning || null,
    })
    setArtikelId(''); setResurs(''); setDatum(''); setStartTid(''); setSlutTid(''); setAntal(''); setAnteckning('')
    await fetchRader()
    setSaving(false)
  }

  const taBort = async (id: string) => {
    await createClient().from('order_tid_rader').delete().eq('id', id)
    fetchRader()
  }

  const skapaFakturaFn = async () => {
    if (rader.length === 0) return
    setSkapaFaktura(true)
    const sb = createClient()

    // Hämta order + kund
    const { data: order } = await sb.from('orders').select('*, customer:customers(*)').eq('id', orderId).single()

    // Generera fakturanummer från befintliga fakturor
    const { count } = await sb.from('fakturor').select('*', { count: 'exact', head: true })
    const fakturanr = `HOF-${1001 + (count || 0)}`

    const fakturaRader = rader.map(r => ({
      typ: 'rad',
      desc: r.resurs ? `${r.artikel_namn} – ${r.resurs}` : r.artikel_namn,
      antal: r.antal,
      apris: r.a_pris,
      enhet: r.enhet,
      belopp: r.antal * r.a_pris,
    }))
    const subtotal = fakturaRader.reduce((s, r) => s + r.belopp, 0)
    const moms = subtotal * 0.25
    const totalt = subtotal + moms

    await sb.from('fakturor').insert({
      fakturanummer: fakturanr,
      order_id: orderId,
      customer_id: order?.customer_id,
      rader: fakturaRader,
      subtotal,
      moms_belopp: moms,
      totalt,
      kund_namn: order?.customer?.namn,
      kund_orgnr: order?.customer?.orgnummer,
      kund_epost: order?.customer?.epost,
      referens: order?.fakturareferens,
    })

    // Uppdatera order som fakturerad
    await sb.from('orders').update({ fakturerat: true, fakturerat_belopp: totalt, fakturadatum: new Date().toISOString().split('T')[0] }).eq('id', orderId)
    setSkapaFaktura(false)
    setFakturaSkapad(true)
    setTimeout(() => setFakturaSkapad(false), 3000)
  }

  const totIntakt = rader.reduce((s, r) => s + (r.total_intakt || 0), 0)
  const totKostnad = rader.reduce((s, r) => s + (r.total_kostnad || 0), 0)

  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#E8C96A' }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#2a2a2a' }

  return (
    <div>
      {/* Formulär */}
      <div style={S.card}>
        <div style={S.cardTitle}>LÄGG TILL TIDPOST</div>

        <div style={S.grid2}>
          <div style={S.field}>
            <label style={S.label}>ARTIKEL / TJÄNST</label>
            <select style={S.select} value={artikelId} onChange={e => setArtikelId(e.target.value)} onFocus={fo} onBlur={fb}>
              <option value="">Välj artikel...</option>
              {artiklar.map(a => (
                <option key={a.id} value={a.id}>{a.namn} ({a.a_pris} kr/{a.enhet})</option>
              ))}
            </select>
          </div>
          <div style={S.field}>
            <label style={S.label}>RESURS / PERSONAL</label>
            <input style={S.input} value={resurs} onChange={e => setResurs(e.target.value)} placeholder="Namn..." onFocus={fo} onBlur={fb} />
          </div>
        </div>

        <div style={S.grid3}>
          <div style={S.field}>
            <label style={S.label}>DATUM</label>
            <input type="date" style={S.input} value={datum} onChange={e => setDatum(e.target.value)} onFocus={fo} onBlur={fb} />
          </div>
          <div style={S.field}>
            <label style={S.label}>STARTTID</label>
            <input type="time" style={S.input} value={startTid} onChange={e => setStartTid(e.target.value)} onFocus={fo} onBlur={fb} />
          </div>
          <div style={S.field}>
            <label style={S.label}>SLUTTID</label>
            <input type="time" style={S.input} value={slutTid} onChange={e => setSlutTid(e.target.value)} onFocus={fo} onBlur={fb} />
          </div>
        </div>

        {!startTid && (
          <div style={{ ...S.field, marginBottom: 10 }}>
            <label style={S.label}>ANTAL ({valdArtikel?.enhet || 'enheter'})</label>
            <input type="number" step="0.5" style={S.input} value={antal} onChange={e => setAntal(e.target.value)} placeholder="0" onFocus={fo} onBlur={fb} />
          </div>
        )}

        <div style={S.field}>
          <label style={S.label}>ANTECKNING</label>
          <input style={S.input} value={anteckning} onChange={e => setAnteckning(e.target.value)} placeholder="Inkl. restid etc..." onFocus={fo} onBlur={fb} />
        </div>

        {valdArtikel && parseFloat(beraknatAntal || '0') > 0 && (
          <div style={S.preview}>
            <div>
              <div style={S.previewLabel}>Intäkt (ref)</div>
              <div style={S.previewVal('#4ade80')}>{fmtKr(previewnIntakt)}</div>
            </div>
            <div>
              <div style={S.previewLabel}>Kostnad</div>
              <div style={S.previewVal('#f87171')}>{fmtKr(previewKostnad)}</div>
            </div>
          </div>
        )}

        <button style={S.addBtn} onClick={laggTill} disabled={saving || !artikelId}>
          {saving ? 'Sparar...' : '+ Lägg till tidpost'}
        </button>
      </div>

      {/* Befintliga rader */}
      {rader.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>TIDPOSTER ({rader.length})</div>
          {rader.map(r => (
            <div key={r.id} style={S.radRow}>
              <div style={S.radLeft}>
                <div style={S.radTitle}>{r.artikel_namn}{r.resurs ? ` – ${r.resurs}` : ''}</div>
                <div style={S.radSub}>
                  {r.antal} {r.enhet}
                  {r.datum ? ` · ${new Date(r.datum).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}` : ''}
                  {r.start_tid && r.slut_tid ? ` · ${r.start_tid}–${r.slut_tid}` : ''}
                  {r.anteckning ? ` · ${r.anteckning}` : ''}
                </div>
              </div>
              <div style={S.radRight}>
                <div style={S.intakt}>{fmtKr(r.total_intakt || 0)}</div>
                <div style={S.kostnad}>kostnad {fmtKr(r.total_kostnad || 0)}</div>
              </div>
              <button style={S.delBtn} onClick={() => taBort(r.id)}>✕</button>
            </div>
          ))}

          <div style={S.sumRow}>
            <div>
              <div style={{ fontSize: 11, color: '#555' }}>Total referensintäkt</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#4ade80' }}>{fmtKr(totIntakt)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#555' }}>Total kostnad</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f87171' }}>{fmtKr(totKostnad)}</div>
            </div>
          </div>

          <button
            onClick={skapaFakturaFn}
            disabled={skapaFaktura}
            style={{ width: '100%', marginTop: 12, padding: '11px', background: fakturaSkapad ? '#4ade80' : '#E8C96A', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            {fakturaSkapad ? '✓ Faktura skapad!' : skapaFaktura ? 'Skapar...' : `🧾 Skapa faktura (${fmtKr(totIntakt * 1.25)} inkl. moms)`}
          </button>
        </div>
      )}
    </div>
  )
}
