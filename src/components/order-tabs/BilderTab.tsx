'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = { orderId: string }

const BG_CARD = '#3a3a3c'
const BORDER = '#48484a'
const TEXT_PRIMARY = '#f2f2f7'
const TEXT_SECONDARY = '#aeaeb2'
const TEXT_MUTED = '#636366'
const ACCENT = '#E8C96A'

export default function BilderTab({ orderId }: Props) {
  const [bilder, setBilder] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const sb = createClient()

  const fetchBilder = async () => {
    const { data, error } = await sb.storage.from('order-bilder').list(orderId, { sortBy: { column: 'created_at', order: 'asc' } })
    if (error) { setError(error.message); setLoading(false); return }
    if (data) {
      const urls = data
        .filter(f => f.name !== '.emptyFolderPlaceholder')
        .map(f => sb.storage.from('order-bilder').getPublicUrl(`${orderId}/${f.name}`).data.publicUrl)
      setBilder(urls)
    }
    setLoading(false)
  }

  useEffect(() => { fetchBilder() }, [orderId])

  const uploadFiler = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!arr.length) return
    setUploading(true)
    setError('')
    for (const file of arr) {
      const namn = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await sb.storage.from('order-bilder').upload(`${orderId}/${namn}`, file, { upsert: false })
      if (error) { setError(`Kunde inte ladda upp ${file.name}: ${error.message}`); break }
    }
    await fetchBilder()
    setUploading(false)
  }

  const raderaBild = async (url: string) => {
    const path = url.split('/order-bilder/')[1]
    if (!path) return
    await sb.storage.from('order-bilder').remove([path])
    setBilder(b => b.filter(u => u !== url))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) uploadFiler(e.dataTransfer.files)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>Laddar bilder...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Uppladdningszon */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragOver ? ACCENT : BORDER}`,
          borderRadius: 10,
          padding: '32px 20px',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: dragOver ? 'rgba(232,201,106,0.05)' : 'transparent',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>{uploading ? '⏳' : '🖼️'}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: uploading ? ACCENT : TEXT_PRIMARY, marginBottom: 4 }}>
          {uploading ? 'Laddar upp...' : 'Dra och släpp bilder här'}
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED }}>eller klicka för att välja • jpg, png, webp</div>
        <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
          onChange={e => e.target.files && uploadFiler(e.target.files)} />
      </div>

      {/* Felmeddelande */}
      {error && (
        <div style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#f87171' }}>
          ⚠ {error}
        </div>
      )}

      {/* Bildgalleri */}
      {bilder.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
          Inga bilder uppladdade ännu
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, letterSpacing: 1 }}>
            {bilder.length} BILD{bilder.length !== 1 ? 'ER' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {bilder.map((url, i) => (
              <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: BG_CARD, border: `1px solid ${BORDER}`, aspectRatio: '4/3' }}>
                <img
                  src={url} alt="" onClick={() => setLightbox(url)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
                />
                <button
                  onClick={() => { if (confirm('Ta bort bild?')) raderaBild(url) }}
                  style={{
                    position: 'absolute', top: 5, right: 5,
                    background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
                    borderRadius: '50%', width: 24, height: 24, cursor: 'pointer',
                    fontSize: 12, lineHeight: '24px', textAlign: 'center', padding: 0,
                  }}
                >✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, cursor: 'zoom-out',
          }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
              borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18,
            }}
          >✕</button>
        </div>
      )}
    </div>
  )
}
