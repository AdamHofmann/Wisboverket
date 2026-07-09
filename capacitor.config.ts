import type { CapacitorConfig } from '@capacitor/cli'

// Wisboverket som native-skal (Capacitor) runt den live-deployade webbappen.
// server.url gör att appen laddar wisboverket.vercel.app direkt → vanliga
// Vercel-deploys uppdaterar appen omedelbart, utan ny App Store-granskning.
// (webDir krävs av Capacitor men används inte när server.url är satt — pekar
// därför bara på Next-appens public-mapp.)
const config: CapacitorConfig = {
  appId: 'se.wisboverket.app',
  appName: 'Wisboverket',
  webDir: 'public',
  server: {
    // Öppna direkt i appens inloggning, inte på publika marknadsförings-hemsidan.
    url: 'https://wisboverket.vercel.app/login',
    cleartext: false,
  },
}

export default config
