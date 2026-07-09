import Navbar from '@/components/Navbar'
import LoggProvider from '@/components/LoggProvider'
import PullToRefresh from '@/components/PullToRefresh'
import RefreshBoundary from '@/components/RefreshBoundary'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { ToastProvider } from '@/components/Toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <ToastProvider>
        <div style={{ minHeight: '100vh', background: '#111' }}>
          <LoggProvider />
          <PullToRefresh />
          <Navbar />
          <main className="app-main" style={{ padding: '24px calc(20px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left))' }}>
            <RefreshBoundary>{children}</RefreshBoundary>
          </main>
        </div>
      </ToastProvider>
    </ConfirmProvider>
  )
}
