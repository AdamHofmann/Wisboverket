import Navbar from '@/components/Navbar'
import LoggProvider from '@/components/LoggProvider'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { ToastProvider } from '@/components/Toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <ToastProvider>
        <div style={{ minHeight: '100vh', background: '#111' }}>
          <LoggProvider />
          <Navbar />
          <main style={{ padding: '24px 20px calc(24px + env(safe-area-inset-bottom))', maxWidth: 1400, margin: '0 auto' }}>
            {children}
          </main>
        </div>
      </ToastProvider>
    </ConfirmProvider>
  )
}
