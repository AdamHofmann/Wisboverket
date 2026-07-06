'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useMediaQuery'
import OrderPanel from '@/components/OrderPanel'
import { PERSONAL } from '@/components/order-tabs/shared'

type OrderRad = {
  id: string; titel: string; status: string
  bokad_datum: string | null; bokad_start: string | null
  tilldelad: string[] | null
}

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const toISO = (d: Date) => d.toISOString().slice(0, 10)

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return `hsl(${h % 360}, 55%, 45%)`
}

export default function MedarbetarePage() {
  const isMobile = useIsMobile()
  const [orders, setOrders] = useState<OrderRad[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('orders').select('id,titel,status,bokad_datum,bokad_start,tilldelad')
      .then(({ data }) => { setOrders(data || []); setLoading(false) })
  }, [])

  const weekStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() || 7) - 1) + weekOffset * 7)
    d.setHours(0, 0, 0, 0)
    return d
  }, [weekOffset])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  }), [weekStart])
  const weekEnd = weekDays[6]

  const aktiva = orders.filter(o => o.status !== 'inaktiv')

  const veckoNr = (d: Date) => {
    const t = new Date(d)
    t.setHours(0, 0, 0, 0)
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7))
    const jan4 = new Date(t.getFullYear(), 0, 4)
    return 1 + Math.round(((t.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0, marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#E8C96A' }}>Medarbetare</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: isMobile ? '100%' : undefined }}>
          <button onClick={() => setWeekOffset(w => w - 1)}
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e0e0e0', borderRadius: 6, width: 32, height: 32, flexShrink: 0, cursor: 'pointer', fontSize: 14 }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', minWidth: isMobile ? 0 : 210, flex: isMobile ? 1 : undefined, textAlign: 'center' as const }}>
            v. {veckoNr(weekStart)} — {MONTHS[weekStart.getMonth()]} {weekStart.getDate()}–{MONTHS[weekEnd.getMonth()]} {weekEnd.getDate()}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)}
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e0e0e0', borderRadius: 6, width: 32, height: 32, flexShrink: 0, cursor: 'pointer', fontSize: 14 }}>›</button>
          <button onClick={() => setWeekOffset(0)}
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 6, padding: '5px 12px', flexShrink: 0, cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
            Denna vecka
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PERSONAL.map(person => {
          const personOrders = aktiva.filter(o => o.tilldelad?.includes(person) && o.bokad_datum && o.bokad_datum >= toISO(weekStart) && o.bokad_datum <= toISO(weekEnd))
          return (
            <div key={person} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e1e', background: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(person), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    {person.split(' ').map(p => p[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>{person}</div>
                    <div style={{ fontSize: 10, color: '#555' }}>{personOrders.length} bokningar denna vecka</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid #1e1e1e', background: '#0d0d0d' }}>
                {weekDays.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center' as const, padding: '6px 2px', fontSize: 9, fontWeight: 700, color: '#555', borderRight: i < 6 ? '1px solid #1e1e1e' : 'none' }}>
                    {WEEKDAYS[i]}<br />{d.getDate()}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', minHeight: 70 }}>
                {weekDays.map((d, i) => {
                  const ds = toISO(d)
                  const dayOrders = aktiva.filter(o => o.tilldelad?.includes(person) && o.bokad_datum === ds)
                  const isToday = ds === toISO(new Date())
                  return (
                    <div key={ds} style={{ borderRight: i < 6 ? '1px solid #1e1e1e' : 'none', padding: '6px 4px', background: isToday ? 'rgba(232,201,106,0.04)' : 'transparent', minHeight: 70 }}>
                      {dayOrders.map(o => (
                        <div key={o.id} onClick={() => setOpenOrderId(o.id)}
                          style={{ background: 'rgba(232,201,106,0.1)', border: '1px solid rgba(232,201,106,0.25)', borderRadius: 4, padding: '3px 5px', fontSize: 9, fontWeight: 700, color: '#E8C96A', cursor: 'pointer', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,201,106,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(232,201,106,0.1)'}>
                          {o.bokad_start && `${o.bokad_start} `}{o.titel}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {openOrderId && (
        <OrderPanel orderId={openOrderId} onClose={() => setOpenOrderId(null)} onUpdated={() => {}} />
      )}
    </div>
  )
}
