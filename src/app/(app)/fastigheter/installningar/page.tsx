'use client'

// Migrerad sida. Källa: src/app/installningar/page.tsx (Tailwind + lucide, blå/ljus).
// Portad till Order-appens inline dark/gold-tema via @/components/fastigheter/styles.
//
// Datalager (matchar mönstret i objekt/page.tsx): sidan fetchar de redan migrerade
// route-handlers under /api/fastigheter/* :
//   * bolag-CRUD via useBolag() (Supabase-query) + POST/PUT/DELETE /api/fastigheter/bolag
//   * logotyp-upload via /api/fastigheter/bolag/[id]/logotyp
//   * fastighetslista via /api/fastigheter/objekt
//   * fastighetsbestånd via /api/fastigheter/statistik/fastighetsbestand
//
// Fältnamn: Supabase returnerar snake_case. BolagItem har faktura_prefix_text och
// _count.fastigheter. Fastighet-objektet från /api/fastigheter/objekt har bolag_id
// (snake) och lokaler:{id}[] (istället för käll-appens _count.lokaler / bolagId).
// lucide-ikoner → emoji, AddressAutocomplete → AdressInput, BolagAutocomplete/SlideOver
// från @/components/fastigheter.

import { useState, useEffect, useRef } from 'react'
import { useBolag, BolagItem } from '@/components/fastigheter/BolagContext'
import { useRouter } from 'next/navigation'
import AdressInput from '@/components/AdressInput'
import BolagAutocomplete from '@/components/fastigheter/BolagAutocomplete'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost } from '@/components/fastigheter/styles'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BolagFormData {
  namn: string
  orgnummer: string
  adress: string
  postnummer: string
  stad: string
  epost: string
  telefon: string
  bankgiro: string
  plusgiro: string
  momsregistreringsnummer: string
  hemsida: string
  fakturaPrefixText: string
  betalningsvillkor: string
  drojsmalsranta: string
  fastighetsskattesats: string
}

const emptyBolagForm: BolagFormData = {
  namn: '',
  orgnummer: '',
  adress: '',
  postnummer: '',
  stad: '',
  epost: '',
  telefon: '',
  bankgiro: '',
  plusgiro: '',
  momsregistreringsnummer: '',
  hemsida: '',
  fakturaPrefixText: '',
  betalningsvillkor: '30',
  drojsmalsranta: '8',
  fastighetsskattesats: '0.5',
}

interface Fastighet {
  id: string
  namn: string
  adress: string
  stad: string
  postnummer: string
  bolag_id?: string | null
}

interface FastighetRad {
  fastighetId: string
  fastighetNamn: string
  antalLokaler: number
  antalByggnader: number
  totalyta: number
  uthyrbarYta: number
  uthyrdYta: number
  belaggning: number
}

interface BolagBestand {
  bolagId: string
  bolagNamn: string
  fastigheter: FastighetRad[]
}

type Tab = 'bolag' | 'fastigheter' | 'bestand' | 'ovrigt'

// ─── Delade stilar ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflow: 'hidden',
}
const cardHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 24px', borderBottom: `1px solid ${C.borderSoft}`,
}
const emptyBox: React.CSSProperties = { textAlign: 'center', padding: '48px 0' }
const subLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: C.muted2, textTransform: 'uppercase', marginBottom: 8,
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function InstallningarPage() {
  const [activeTab, setActiveTab] = useState<Tab>('bolag')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'bolag', label: 'Bolag', icon: '🏢' },
    { id: 'fastigheter', label: 'Fastigheter', icon: '📍' },
    { id: 'bestand', label: 'Fastighetsbestånd', icon: '📊' },
    { id: 'ovrigt', label: 'Övrigt', icon: '⚙️' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Inställningar</h2>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Hantera bolag, fastigheter och systeminställningar</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}` }}>
        {tabs.map((t) => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                borderRadius: '8px 8px 0 0',
                border: `1px solid ${active ? C.border : 'transparent'}`,
                borderBottom: 'none',
                marginBottom: -1,
                background: active ? C.panel : 'transparent',
                color: active ? C.gold : C.muted,
                cursor: 'pointer',
              }}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'bolag' && <BolagTab />}
      {activeTab === 'fastigheter' && <FastigheterTab />}
      {activeTab === 'bestand' && <BestandTab />}
      {activeTab === 'ovrigt' && <OvrigtTab />}
    </div>
  )
}

// ─── Bolag tab ───────────────────────────────────────────────────────────────

function BolagTab() {
  const { bolagLista, reloadBolag } = useBolag()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<BolagItem | null>(null)
  const [form, setForm] = useState<BolagFormData>(emptyBolagForm)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingUploadBolagId, setPendingUploadBolagId] = useState<string | null>(null)

  const openNew = () => {
    setEditing(null)
    setForm(emptyBolagForm)
    setShowModal(true)
  }

  const openEdit = (b: BolagItem) => {
    setEditing(b)
    setForm({
      namn: b.namn,
      orgnummer: b.orgnummer || '',
      adress: b.adress || '',
      postnummer: b.postnummer || '',
      stad: b.stad || '',
      epost: b.epost || '',
      telefon: b.telefon || '',
      bankgiro: b.bankgiro || '',
      plusgiro: b.plusgiro || '',
      momsregistreringsnummer: b.momsregistreringsnummer || '',
      hemsida: b.hemsida || '',
      fakturaPrefixText: b.faktura_prefix_text || '',
      betalningsvillkor: b.betalningsvillkor?.toString() || '30',
      drojsmalsranta: b.drojsmalsranta?.toString() || '8',
      fastighetsskattesats: (b as unknown as { fastighetsskattesats?: number }).fastighetsskattesats?.toString() || '0.5',
    })
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    const url = editing ? `/api/fastigheter/bolag/${editing.id}` : '/api/fastigheter/bolag'
    const method = editing ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        betalningsvillkor: form.betalningsvillkor ? Number(form.betalningsvillkor) : null,
        drojsmalsranta: form.drojsmalsranta ? Number(form.drojsmalsranta) : null,
        fastighetsskattesats: form.fastighetsskattesats ? Number(form.fastighetsskattesats) : 0.5,
      }),
    })
    setSaving(false)
    setShowModal(false)
    reloadBolag()
  }

  const remove = async (id: string, namn: string) => {
    if (!confirm(`Ta bort bolaget "${namn}"? Fastigheter kopplade till bolaget behåller sin data men förlorar kopplingen.`)) return
    await fetch(`/api/fastigheter/bolag/${id}`, { method: 'DELETE' })
    reloadBolag()
  }

  const handleLogoClick = (bolagId: string) => {
    setPendingUploadBolagId(bolagId)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingUploadBolagId) return
    setUploadingId(pendingUploadBolagId)
    const fd = new FormData()
    fd.append('file', file)
    await fetch(`/api/fastigheter/bolag/${pendingUploadBolagId}/logotyp`, { method: 'POST', body: fd })
    setUploadingId(null)
    setPendingUploadBolagId(null)
    e.target.value = ''
    reloadBolag()
  }

  // Fält-hjälpare med guld/mörk inline-stil.
  const fi = (key: keyof BolagFormData, label: string, placeholder?: string, type = 'text') => (
    <div key={key}>
      <label style={lbl}>{label}</label>
      <input
        type={type}
        style={inp}
        onFocus={fo}
        onBlur={fb}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div style={card}>
        <div style={cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ borderRadius: 8, background: C.goldSoft, padding: 8, fontSize: 16, lineHeight: 1 }}>🏢</div>
            <div>
              <h3 style={{ fontWeight: 700, color: C.text, margin: 0 }}>Bolag</h3>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{bolagLista.length} bolag registrerade</p>
            </div>
          </div>
          <button onClick={openNew} style={btnPrimary}>+ Lägg till bolag</button>
        </div>

        {bolagLista.length === 0 ? (
          <div style={emptyBox}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
            <p style={{ color: C.muted, fontSize: 13 }}>Inga bolag registrerade ännu</p>
            <button onClick={openNew} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 13, cursor: 'pointer', marginTop: 12 }}>
              Lägg till ditt första bolag
            </button>
          </div>
        ) : (
          <div>
            {bolagLista.map((b, i) => (
              <div
                key={b.id}
                onClick={() => openEdit(b)}
                style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  padding: '20px 24px', cursor: 'pointer',
                  borderTop: i > 0 ? `1px solid ${C.borderSoft}` : 'none',
                }}
              >
                {/* Logo area */}
                <div style={{ marginRight: 16, flexShrink: 0 }}>
                  {b.logotyp ? (
                    <div style={{ position: 'relative', width: 64, height: 48, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}`, background: C.field }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${b.logotyp}?v=${Date.now()}`}
                        alt={`${b.namn} logotyp`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
                      />
                    </div>
                  ) : (
                    <div style={{ width: 64, height: 48, borderRadius: 8, border: `1px dashed ${C.border}`, background: C.field, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                      🖼️
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLogoClick(b.id) }}
                    disabled={uploadingId === b.id}
                    style={{ marginTop: 4, width: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, color: C.muted2, background: 'none', border: 'none', cursor: 'pointer' }}
                    title="Ladda upp logotyp"
                  >
                    ⬆️ {uploadingId === b.id ? 'Laddar...' : 'Logotyp'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h4 style={{ fontWeight: 700, color: C.text, margin: 0 }}>{b.namn}</h4>
                    {b._count && b._count.fastigheter > 0 && (
                      <span style={{ fontSize: 11, background: C.goldSoft, color: C.gold, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                        {b._count.fastigheter} {b._count.fastigheter === 1 ? 'fastighet' : 'fastigheter'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16, rowGap: 4 }}>
                    {b.orgnummer && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.muted }}>#️⃣ {b.orgnummer}</span>}
                    {b.adress && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.muted }}>📍 {b.adress}{b.postnummer ? `, ${b.postnummer}` : ''}{b.stad ? ` ${b.stad}` : ''}</span>}
                    {b.epost && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.muted }}>✉️ {b.epost}</span>}
                    {b.telefon && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.muted }}>📞 {b.telefon}</span>}
                    {b.bankgiro && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.muted }}>💳 BG {b.bankgiro}</span>}
                    {b.hemsida && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.muted }}>🌐 {b.hemsida}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginLeft: 16, flexShrink: 0 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(b.id, b.namn) }}
                    style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 14, padding: 6 }}
                    title="Ta bort"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SlideOver
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Redigera bolag' : 'Nytt bolag'}
        subtitle={editing ? (editing.orgnummer || undefined) : undefined}
        width="md"
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowModal(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button onClick={save} disabled={saving || !form.namn.trim()} style={{ ...btnPrimary, flex: 1, opacity: saving || !form.namn.trim() ? 0.5 : 1 }}>
              {saving ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        }
      >
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <BolagAutocomplete
            onSelect={(res) => setForm(f => ({
              ...f,
              namn: res.namn || f.namn,
              orgnummer: res.orgnummer || f.orgnummer,
              adress: res.adress || f.adress,
              postnummer: res.postnummer || f.postnummer,
              stad: res.stad || f.stad,
              epost: res.epost || f.epost,
            }))}
          />
          <div>
            <p style={subLabel}>Grunduppgifter</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {fi('namn', 'Bolagsnamn *', 'T.ex. Hofmanns AB')}
              {fi('orgnummer', 'Organisationsnummer', '556xxx-xxxx')}
              <div>
                <label style={lbl}>Adress</label>
                <AdressInput
                  value={form.adress}
                  onChange={(v) => setForm(f => ({ ...f, adress: v }))}
                  onPick={(adress, postnummer, ort) => setForm(f => ({ ...f, adress, postnummer, stad: ort }))}
                  placeholder="Sök gatuadress..."
                  style={inp}
                  onFocus={fo}
                  onBlur={fb}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {fi('postnummer', 'Postnummer', '123 45')}
                {fi('stad', 'Stad', 'Stockholm')}
              </div>
              {fi('epost', 'E-post', 'info@bolag.se')}
              {fi('telefon', 'Telefon', '08-xxx xx xx')}
              {fi('hemsida', 'Hemsida', 'www.bolag.se')}
            </div>
          </div>
          <div>
            <p style={subLabel}>Betalningsinformation</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {fi('momsregistreringsnummer', 'Momsregistreringsnummer', 'SE556xxxxx01')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {fi('bankgiro', 'Bankgiro', '1234-5678')}
                {fi('plusgiro', 'Plusgiro', '12 34 56-7')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {fi('betalningsvillkor', 'Betalningsvillkor (dagar)', '30', 'number')}
                {fi('drojsmalsranta', 'Dröjsmålsränta (%)', '8', 'number')}
                {fi('fastighetsskattesats', 'Fastighetsskattesats (%)', '0.5', 'number')}
              </div>
            </div>
          </div>
          <div>
            <p style={subLabel}>Fakturainformation</p>
            <div>
              <label style={lbl}>Fakturatext (visas överst på faktura)</label>
              <textarea
                style={{ ...inp, resize: 'none' }}
                rows={3}
                value={form.fakturaPrefixText}
                onFocus={fo}
                onBlur={fb}
                onChange={(e) => setForm({ ...form, fakturaPrefixText: e.target.value })}
                placeholder="T.ex. Tack för din betalning"
              />
            </div>
          </div>
        </div>
      </SlideOver>
    </>
  )
}

// ─── Fastigheter tab ─────────────────────────────────────────────────────────

function FastigheterTab() {
  const { bolagLista } = useBolag()
  const router = useRouter()
  const [fastigheter, setFastigheter] = useState<Fastighet[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBolag, setExpandedBolag] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/fastigheter/objekt')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setFastigheter(data) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (bolagLista.length > 0) {
      const expanded: Record<string, boolean> = {}
      bolagLista.forEach(b => { expanded[b.id] = true })
      expanded['ingen'] = true
      setExpandedBolag(expanded)
    }
  }, [bolagLista])

  const toggleBolag = (id: string) => setExpandedBolag(prev => ({ ...prev, [id]: !prev[id] }))

  if (loading) {
    return <div style={{ ...card, padding: 48, textAlign: 'center' }}><p style={{ color: C.muted2, fontSize: 13 }}>Laddar fastigheter...</p></div>
  }

  const byBolag = bolagLista.map(b => ({
    id: b.id, namn: b.namn,
    fastigheter: fastigheter.filter(f => f.bolag_id === b.id),
  }))
  const ingenBolag = fastigheter.filter(f => !f.bolag_id)

  const groupHeader = (onClick: () => void, expanded: boolean, icon: string, iconColor: string, namn: string, count: number, countLabel: string): React.ReactNode => (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${C.borderSoft}`, background: C.panel2, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: iconColor }}>{icon}</span>
        <span style={{ fontWeight: 700, color: C.text }}>{namn}</span>
        <span style={{ fontSize: 12, color: C.muted2 }}>{count} {countLabel}</span>
      </div>
      <span style={{ color: C.muted2 }}>{expanded ? '▾' : '▸'}</span>
    </div>
  )

  const fastighetRad = (f: Fastighet) => (
    <div key={f.id} onClick={() => router.push('/fastigheter/objekt')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', cursor: 'pointer', borderTop: `1px solid ${C.borderSoft}` }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{f.namn}</p>
        <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>📍 {f.adress}, {f.postnummer} {f.stad}</p>
      </div>
      <span style={{ color: C.muted2 }}>→</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => router.push('/fastigheter/objekt')} style={btnPrimary}>+ Hantera fastigheter</button>
      </div>

      {byBolag.map(group => (
        <div key={group.id} style={card}>
          {groupHeader(() => toggleBolag(group.id), !!expandedBolag[group.id], '🏢', C.gold, group.namn, group.fastigheter.length, group.fastigheter.length === 1 ? 'fastighet' : 'fastigheter')}
          {expandedBolag[group.id] && (
            <div>
              {group.fastigheter.length === 0
                ? <p style={{ padding: '16px 24px', fontSize: 13, color: C.muted2 }}>Inga fastigheter kopplade till detta bolag.</p>
                : group.fastigheter.map(fastighetRad)}
            </div>
          )}
        </div>
      ))}

      {(ingenBolag.length > 0 || bolagLista.length === 0) && (
        <div style={card}>
          {groupHeader(() => toggleBolag('ingen'), !!expandedBolag['ingen'], '🏢', C.muted2, 'Utan bolagskoppling', ingenBolag.length, 'fastigheter')}
          {expandedBolag['ingen'] && (
            <div>
              {ingenBolag.length === 0
                ? <p style={{ padding: '16px 24px', fontSize: 13, color: C.muted2 }}>Inga fastigheter utan bolagskoppling.</p>
                : ingenBolag.map(fastighetRad)}
            </div>
          )}
        </div>
      )}

      {bolagLista.length === 0 && fastigheter.length === 0 && (
        <div style={{ ...card, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <p style={{ color: C.muted, fontSize: 13 }}>Inga fastigheter ännu.</p>
          <button onClick={() => router.push('/fastigheter/objekt')} style={{ background: 'none', border: 'none', color: C.gold, fontSize: 13, cursor: 'pointer', marginTop: 12 }}>Gå till Fastigheter</button>
        </div>
      )}
    </div>
  )
}

// ─── Fastighetsbestånd tab ───────────────────────────────────────────────────

function BestandTab() {
  const [data, setData] = useState<BolagBestand[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/fastigheter/statistik/fastighetsbestand')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const fmt = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 })
  const fmtPct = (n: number) => `${n.toFixed(1)} %`

  if (loading) {
    return (
      <div style={{ ...card, padding: 48, textAlign: 'center' }}>
        <p style={{ color: C.muted, fontSize: 13 }}>Laddar fastighetsbestånd...</p>
      </div>
    )
  }

  // Grand totals
  const grandTotal = data.reduce(
    (acc, b) => {
      const bf = b.fastigheter.reduce(
        (a, f) => ({
          antalLokaler: a.antalLokaler + f.antalLokaler,
          totalyta: a.totalyta + f.totalyta,
          uthyrbarYta: a.uthyrbarYta + f.uthyrbarYta,
          uthyrdYta: a.uthyrdYta + f.uthyrdYta,
        }),
        { antalLokaler: 0, totalyta: 0, uthyrbarYta: 0, uthyrdYta: 0 }
      )
      return {
        antalFastigheter: acc.antalFastigheter + b.fastigheter.length,
        antalLokaler: acc.antalLokaler + bf.antalLokaler,
        totalyta: acc.totalyta + bf.totalyta,
        uthyrbarYta: acc.uthyrbarYta + bf.uthyrbarYta,
        uthyrdYta: acc.uthyrdYta + bf.uthyrdYta,
      }
    },
    { antalFastigheter: 0, antalLokaler: 0, totalyta: 0, uthyrbarYta: 0, uthyrdYta: 0 }
  )

  if (data.length === 0) {
    return (
      <div style={{ ...card, padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <p style={{ color: C.muted, fontSize: 13 }}>Inga fastigheter registrerade ännu</p>
      </div>
    )
  }

  const th: React.CSSProperties = { padding: '12px 16px', fontWeight: 600, fontSize: 11, color: C.muted2, textTransform: 'uppercase', letterSpacing: 0.6 }
  const thRight: React.CSSProperties = { ...th, textAlign: 'right' }
  const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: C.muted }
  const tdRight: React.CSSProperties = { ...td, textAlign: 'right' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {data.map((b) => {
        const bolagTotals = b.fastigheter.reduce(
          (a, f) => ({
            antalLokaler: a.antalLokaler + f.antalLokaler,
            totalyta: a.totalyta + f.totalyta,
            uthyrbarYta: a.uthyrbarYta + f.uthyrbarYta,
            uthyrdYta: a.uthyrdYta + f.uthyrdYta,
          }),
          { antalLokaler: 0, totalyta: 0, uthyrbarYta: 0, uthyrdYta: 0 }
        )

        return (
          <div key={b.bolagId} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 24px', borderBottom: `1px solid ${C.borderSoft}`, background: C.panel2 }}>
              <span style={{ color: C.gold }}>🏢</span>
              <h3 style={{ fontWeight: 700, color: C.text, margin: 0 }}>{b.bolagNamn}</h3>
              <span style={{ fontSize: 12, color: C.muted2, marginLeft: 4 }}>
                {b.fastigheter.length} {b.fastigheter.length === 1 ? 'fastighet' : 'fastigheter'}
              </span>
            </div>

            {b.fastigheter.length === 0 ? (
              <p style={{ padding: '16px 24px', fontSize: 13, color: C.muted2 }}>Inga fastigheter kopplade</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: `1px solid ${C.borderSoft}` }}>
                      <th style={{ ...th, textAlign: 'left' }}>Fastighet</th>
                      <th style={thRight}>Byggnader</th>
                      <th style={thRight}>BTA (kvm)</th>
                      <th style={thRight}>LOA/uthyrbar (kvm)</th>
                      <th style={thRight}>Uthyrd (kvm)</th>
                      <th style={thRight}>Vakansgrad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.fastigheter.map((f) => {
                      const vakans = f.uthyrbarYta > 0 ? ((f.uthyrbarYta - f.uthyrdYta) / f.uthyrbarYta) * 100 : 0
                      return (
                        <tr key={f.fastighetId} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                          <td style={{ ...td, color: C.text, fontWeight: 600 }}>{f.fastighetNamn}</td>
                          <td style={{ ...tdRight, color: C.text2 }}>{f.antalByggnader || '–'}</td>
                          <td style={tdRight}>{f.totalyta > 0 ? fmt(f.totalyta) : '–'}</td>
                          <td style={{ ...tdRight, color: C.text2 }}>{fmt(f.uthyrbarYta)}</td>
                          <td style={{ ...tdRight, color: C.text2 }}>{fmt(f.uthyrdYta)}</td>
                          <td style={tdRight}>
                            <VakansBadge value={vakans} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: C.goldSoft, borderTop: `1px solid ${C.border}`, fontWeight: 700 }}>
                      <td style={{ ...td, color: C.gold, fontWeight: 700 }}>Summa {b.bolagNamn}</td>
                      <td style={{ ...tdRight, color: C.gold }}>–</td>
                      <td style={{ ...tdRight, color: C.gold }}>{bolagTotals.totalyta > 0 ? fmt(bolagTotals.totalyta) : '–'}</td>
                      <td style={{ ...tdRight, color: C.gold }}>{fmt(bolagTotals.uthyrbarYta)}</td>
                      <td style={{ ...tdRight, color: C.gold }}>{fmt(bolagTotals.uthyrdYta)}</td>
                      <td style={tdRight}>
                        <VakansBadge value={bolagTotals.uthyrbarYta > 0 ? ((bolagTotals.uthyrbarYta - bolagTotals.uthyrdYta) / bolagTotals.uthyrbarYta) * 100 : 0} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {/* Grand total */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.borderStrong}`, background: C.panel2, overflow: 'hidden' }}>
        <div style={{ padding: '12px 24px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <tr style={{ fontWeight: 700, color: C.text }}>
                <td style={{ padding: '8px 0' }}>Totalt — alla bolag</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: C.muted2 }}>{grandTotal.antalLokaler} lok.</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: C.muted2 }}>{grandTotal.totalyta > 0 ? `${fmt(grandTotal.totalyta)} kvm BTA` : '–'}</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: C.text2 }}>{fmt(grandTotal.uthyrbarYta)} kvm LOA</td>
                <td style={{ padding: '8px 0', textAlign: 'right', color: C.text2 }}>{fmt(grandTotal.uthyrdYta)} kvm</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>
                  <span style={{ color: C.gold, fontWeight: 700 }}>
                    {grandTotal.uthyrbarYta > 0
                      ? `${fmtPct((grandTotal.uthyrbarYta - grandTotal.uthyrdYta) / grandTotal.uthyrbarYta * 100)} vakans`
                      : '–'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function VakansBadge({ value }: { value: number }) {
  // Färgremap: grön/gul/röd → mörkanpassade toner via bakgrund + textfärg.
  const palette =
    value <= 5
      ? { bg: 'rgba(74,222,128,0.12)', color: C.ok }
      : value <= 20
      ? { bg: 'rgba(234,179,8,0.12)', color: '#eab308' }
      : { bg: 'rgba(248,113,113,0.12)', color: C.danger }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: palette.bg, color: palette.color }}>
      {value.toFixed(1)} %
    </span>
  )
}

// ─── Övrigt tab ──────────────────────────────────────────────────────────────

function OvrigtTab() {
  return (
    <div style={{ ...card, padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
      <p style={{ color: C.muted, fontSize: 13 }}>Fler inställningar kommer snart</p>
    </div>
  )
}
