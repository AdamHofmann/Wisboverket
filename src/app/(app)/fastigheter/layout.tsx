'use client'

import { BolagProvider } from '@/components/fastigheter/BolagContext'
import FastigheterSubnav from '@/components/fastigheter/Subnav'

export default function FastigheterLayout({ children }: { children: React.ReactNode }) {
  return (
    <BolagProvider>
      {/* Fastigheter döljer app-navbaren (egen Subnav) → lägg safe-area här så
          toppraden inte hamnar under statusraden i app-skalet. env()=0 på desktop. */}
      <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <FastigheterSubnav />
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </BolagProvider>
  )
}
