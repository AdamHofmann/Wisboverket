import Navbar from '@/components/Navbar'
import LoggProvider from '@/components/LoggProvider'
import { ConfirmProvider } from '@/components/ConfirmDialog'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <div style={{ minHeight: '100vh', background: '#111' }}>
        <LoggProvider />
        <Navbar />
        <main style={{ padding: '24px 20px', maxWidth: 1400, margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </ConfirmProvider>
  )
}
