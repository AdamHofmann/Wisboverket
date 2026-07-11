import Navbar from '@/components/Navbar'
import LoggProvider from '@/components/LoggProvider'
import PullToRefresh from '@/components/PullToRefresh'
import RefreshBoundary from '@/components/RefreshBoundary'
import OneSignalInit from '@/components/OneSignalInit'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { ToastProvider } from '@/components/Toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <ToastProvider>
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#111' }}>
          <LoggProvider />
          <OneSignalInit />
          <PullToRefresh />
          <Navbar />
          <main className="app-main" style={{ flex: 1, minHeight: 0, width: '100%', padding: '24px calc(20px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left))' }}>
            <RefreshBoundary>{children}</RefreshBoundary>
          </main>
        </div>
      </ToastProvider>
    </ConfirmProvider>
  )
}
