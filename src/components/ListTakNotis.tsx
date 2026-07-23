import { LISTA_MAX } from '@/lib/listor'

// Visas när en lista når hämtningstaket (LISTA_MAX). Ingen tyst avkortning —
// användaren ser att äldre rader inte är laddade och kan förfina sökningen.
export default function ListTakNotis({ antal, enhet = 'rader' }: { antal: number; enhet?: string }) {
  if (antal < LISTA_MAX) return null
  return (
    <div style={{
      background: 'rgba(251,146,60,0.1)', border: '1px solid #fb923c44', color: '#fb923c',
      borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12,
    }}>
      Visar de {LISTA_MAX} senaste {enhet}. Förfina sökningen för att hitta äldre.
    </div>
  )
}
