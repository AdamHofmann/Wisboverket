'use client'

// Delad sökruta för list-sidorna (mörk/guld, funkar i både Order- och Fastighets-modulen).
export default function Sokfalt({
  value, onChange, placeholder, style,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  style?: React.CSSProperties
}) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, opacity: 0.55, pointerEvents: 'none' }}>🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Sök...'}
        spellCheck={false}
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px 8px 34px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
        onFocus={e => (e.currentTarget.style.borderColor = '#E8C96A')}
        onBlur={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
      />
    </div>
  )
}
