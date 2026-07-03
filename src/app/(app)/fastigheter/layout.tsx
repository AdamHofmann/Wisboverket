'use client'

import { BolagProvider } from '@/components/fastigheter/BolagContext'
import FastigheterSubnav from '@/components/fastigheter/Subnav'

export default function FastigheterLayout({ children }: { children: React.ReactNode }) {
  return (
    <BolagProvider>
      <FastigheterSubnav />
      <div style={{ marginTop: 16 }}>{children}</div>
    </BolagProvider>
  )
}
