'use client'

const STATUS = [
  { label: 'Kunder', status: 'Förberedd' },
  { label: 'Artiklar', status: 'Förberedd' },
  { label: 'Fakturor', status: 'Förberedd' },
]

export default function IntegrationPage() {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', marginBottom: 4 }}>Hogia OpenBusiness</div>
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 16px', marginTop: 12, marginBottom: 20, fontSize: 12, color: '#888', lineHeight: 1.7 }}>
        Synk aktiveras i <strong style={{ color: '#E8C96A' }}>Fas 2</strong> när API-nyckeln är på plats.
      </div>

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        {STATUS.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: i > 0 ? '1px solid #1a1a1a' : 'none' }}>
            <span style={{ fontSize: 13, color: '#d0d0d0', fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 4, background: '#fb923c22', color: '#fb923c', border: '1px solid #fb923c44' }}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
