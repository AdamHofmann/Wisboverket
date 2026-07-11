'use client'

import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { createClient } from '@/lib/supabase/client'

// OneSignal App ID (ej hemlig). REST-nyckeln ligger som Supabase-secret (backend).
const ONESIGNAL_APP_ID = '0a4cbdf6-ea31-44a8-904b-4360d18a4cff'

/**
 * Initierar OneSignal-push i app-skalet (native). Kör INGENTING på webben —
 * appen laddar webben via server.url, men pluginet finns bara i native-lagret,
 * så vi guardar på Capacitor.isNativePlatform() och laddar pluginet dynamiskt
 * (annars kraschar Next-bygget på en cordova-modul som inte finns i webbläsaren).
 *
 * Kopplar även enheten till inloggad Supabase-användare (OneSignal.login) så en
 * push kan riktas till rätt person. Kräver `npx cap sync` + Push-capability i Xcode.
 */
export default function OneSignalInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let active = true
    ;(async () => {
      try {
        const mod = await import('onesignal-cordova-plugin')
        const OneSignal = (mod as unknown as { default?: unknown }).default ?? mod
        const OS = OneSignal as {
          initialize: (id: string) => void
          Notifications: { requestPermission: (fallback: boolean) => Promise<boolean> }
          login: (externalId: string) => void
        }
        OS.initialize(ONESIGNAL_APP_ID)
        OS.Notifications.requestPermission(true).catch(() => {})
        // Koppla enheten till inloggad användare (om någon är inloggad).
        const { data } = await createClient().auth.getUser()
        if (active && data.user) OS.login(data.user.id)
      } catch (e) {
        console.warn('OneSignal-init hoppades över:', e)
      }
    })()
    return () => { active = false }
  }, [])

  return null
}
