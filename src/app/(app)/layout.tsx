import Navbar from '@/components/Navbar'
import LoggProvider from '@/components/LoggProvider'
import PullToRefresh from '@/components/PullToRefresh'
import RefreshBoundary from '@/components/RefreshBoundary'
import OneSignalInit from '@/components/OneSignalInit'
import PushToTalk from '@/components/PushToTalk'
import SWRProvider from '@/components/SWRProvider'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { ToastProvider } from '@/components/Toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <ToastProvider>
        <SWRProvider>
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#111' }}>
          <LoggProvider />
          <OneSignalInit />
          <PushToTalk />
          <PullToRefresh />
          <Navbar />
          <main className="app-main" style={{ flex: 1, minHeight: 0, width: '100%', padding: '24px calc(20px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left))' }}>
            <RefreshBoundary>{children}</RefreshBoundary>
          </main>
        </div>
        </SWRProvider>
      </ToastProvider>
    </ConfirmProvider>
  )
}
