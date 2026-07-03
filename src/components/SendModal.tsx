'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const TYPER = [
  { id: 'orderbekräftelse', label: 'Orderbekräftelse', icon: '📩' },
  { id: 'åtgärdad', label: 'Åtgärdat', icon: '✅' },
  { id: 'info', label: 'Uppdatering', icon: 'ℹ️' },
  { id: 'eget', label: 'Eget', icon: '✏️' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' },
  header: { padding: '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: '#888' },
  subtitle: { fontSize: 15, fontWeight: 700, color: '#e0e0e0', marginTop: 2 },
  closeBtn: { background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' },
  body: { padding: '18px 22px', display: 'flex', flexDirection: 'column' as const, gap: 16 },
  section: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 8 },
  typGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 },
  typBtn: (active: boolean): React.CSSProperties => ({
    padding: '10px 6px', borderRadius: 8, textAlign: 'center', cursor: 'pointer',
    border: active ? '1px solid #E8C96A' : '1px solid #2a2a2a',
    background: active ? 'rgba(232,201,106,0.1)' : '#111',
    fontSize: 11, color: active ? '#E8C96A' : '#666', fontWeight: 600,
    transition: 'all 0.1s',
  }),
  typIcon: { fontSize: 20, display: 'block', marginBottom: 4 },
  textareaWrap: { position: 'relative' as const },
  textarea: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: 120 },
  aiBtn: { position: 'absolute' as const, bottom: 10, right: 10, background: '#2a2a2a', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#E8C96A', fontSize: 11, cursor: 'pointer', fontWeight: 700 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column' as const, gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: '#666' },
  input: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  footer: { padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', gap: 8 },
  sendBtn: (color: string, disabled: boolean): React.CSSProperties => ({
    flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${color}44`,
    background: color + '11', color, fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }),
  successWrap: { padding: 32, textAlign: 'center' as const },
  successIcon: { fontSize: 48, marginBottom: 12 },
  successTitle: { fontSize: 14, fontWeight: 700, color: '#4ade80', marginBottom: 6 },
  successSub: { fontSize: 12, color: '#555' },
}

type Props = {
  orderId: string
  orderTitel: string
  kundEpost?: string | null
  kundTelefon?: string | null
  onClose: () => void
  onSent: () => void
}

export default function SendModal({ orderId, orderTitel, kundEpost, kundTelefon, onClose, onSent }: Props) {
  const [typ, setTyp] = useState('orderbekräftelse')
  const [meddelande, setMeddelande] = useState('')
  const [epost, setEpost] = useState(kundEpost || '')
  const [telefon, setTelefon] = useState(kundTelefon || '')
  const [aiLoading, setAiLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentKanal, setSentKanal] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsError, setSmsError] = useState('')

  const loggaUtskick = async (kanal: string) => {
    await createClient().from('order_kommunikation').insert({
      order_id: orderId,
      typ,
      kanal,
      mottagare: kanal === 'email' ? epost : kanal === 'sms' ? telefon : null,
      meddelande,
    })
    setSentKanal(kanal)
    setSent(true)
    onSent()
  }

  const skickaEmail = () => {
    if (!epost || !meddelande) return
    const amne = encodeURIComponent(`${TYPER.find(t => t.id === typ)?.label}: ${orderTitel}`)
    const body = encodeURIComponent(meddelande)
    window.open(`mailto:${epost}?subject=${amne}&body=${body}`)
    loggaUtskick('email')
  }

  const skickaSMS = async () => {
    if (!telefon || !meddelande) return
    setSmsSending(true); setSmsError('')
    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: telefon, message: meddelande }),
      })
      const data = await res.json()
      if (!res.ok) { setSmsError(data.error || 'Kunde inte skicka SMS'); return }
      loggaUtskick('sms')
    } catch {
      setSmsError('Kunde inte nå SMS-tjänsten')
    } finally {
      setSmsSending(false)
    }
  }

  const kopiera = async () => {
    if (!meddelande) return
    await navigator.clipboard.writeText(meddelande)
    loggaUtskick('kopierat')
  }

  const genereraAI = async () => {
    if (typ === 'eget') return
    setAiLoading(true)
    const prompt = typ === 'åtgärdad'
      ? `Skriv ett kort kundmeddelande (2-3 meningar) som bekräftar att uppdraget "${orderTitel}" är åtgärdat.`
      : typ === 'orderbekräftelse'
      ? `Skriv ett kort kundmeddelande (2-3 meningar) som bekräftar att vi mottagit uppdraget "${orderTitel}".`
      : `Skriv en kort statusuppdatering (2-3 meningar) angående uppdraget "${orderTitel}".`

    try {
      const res = await fetch('/api/ai-meddelande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.text) setMeddelande(data.text)
      else setMeddelande('Kunde inte generera meddelande. Skriv manuellt.')
    } catch {
      setMeddelande('Kunde inte generera meddelande. Skriv manuellt.')
    }
    setAiLoading(false)
  }

  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#E8C96A' }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#2a2a2a' }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <div>
            <div style={S.title}>ÅTERRAPPORTERING</div>
            <div style={S.subtitle}>{orderTitel}</div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>×</button>
        </div>

        {sent ? (
          <div style={S.successWrap}>
            <div style={S.successIcon}>{sentKanal === 'email' ? '📧' : sentKanal === 'sms' ? '💬' : '📋'}</div>
            <div style={S.successTitle}>
              {sentKanal === 'email' ? 'E-POSTKLIENT ÖPPNAD' : sentKanal === 'sms' ? 'SMS SKICKAT' : 'KOPIERAT!'}
            </div>
            <div style={S.successSub}>Meddelandet är loggat på ordern</div>
            <button onClick={onClose} style={{ marginTop: 20, background: '#2a2a2a', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#e0e0e0', cursor: 'pointer', fontSize: 13 }}>Stäng</button>
          </div>
        ) : (
          <>
            <div style={S.body}>
              <div>
                <div style={S.section}>MEDDELANDETYP</div>
                <div style={S.typGrid}>
                  {TYPER.map(t => (
                    <div key={t.id} style={S.typBtn(typ === t.id)} onClick={() => setTyp(t.id)}>
                      <span style={S.typIcon}>{t.icon}</span>
                      {t.label}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={S.section}>MEDDELANDE</div>
                <div style={S.textareaWrap}>
                  <textarea
                    style={S.textarea} value={meddelande}
                    onChange={e => setMeddelande(e.target.value)}
                    placeholder="Skriv meddelande..."
                    onFocus={fo} onBlur={fb}
                  />
                  {typ !== 'eget' && (
                    <button style={S.aiBtn} onClick={genereraAI} disabled={aiLoading}>
                      {aiLoading ? '...' : '✨ AI'}
                    </button>
                  )}
                </div>
              </div>

              <div style={S.row}>
                <div style={S.field}>
                  <label style={S.label}>E-POSTADRESS</label>
                  <input style={S.input} value={epost} onChange={e => setEpost(e.target.value)}
                    placeholder="kund@example.com" onFocus={fo} onBlur={fb} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>TELEFON (SMS)</label>
                  <input style={S.input} value={telefon} onChange={e => setTelefon(e.target.value)}
                    placeholder="07X-XXX XX XX" onFocus={fo} onBlur={fb} />
                </div>
              </div>
            </div>

            {smsError && <div style={{ padding: '0 22px', fontSize: 12, color: '#f87171' }}>{smsError}</div>}
            <div style={S.footer}>
              <button style={S.sendBtn('#60a5fa', !epost || !meddelande)} onClick={skickaEmail}>📧 E-post</button>
              <button style={S.sendBtn('#4ade80', !telefon || !meddelande || smsSending)} onClick={skickaSMS}>{smsSending ? '...' : '💬 SMS'}</button>
              <button style={S.sendBtn('#888', !meddelande)} onClick={kopiera}>📋 Kopiera</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
