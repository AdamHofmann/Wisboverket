import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Wisboverket",
  description: "Wisboverket — Order & Fastigheter",
  applicationName: "Wisboverket",
  appleWebApp: {
    capable: true,
    title: "Wisboverket",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lås zoomen till exakt 1.0. iOS-webviewen hamnade annars på ~1.14x
  // (layoutbredd 402 vs fönster 352) vilket sköt hela sidan i sidled så
  // rubriker klipptes av vänsterkanten. Ingen zoom → layout = fönster.
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#111111',
  // Låt innehållet nå ut i hörnen så env(safe-area-inset-*) blir tillgängligt
  // (behövs för att undvika krock med statusrad/notch/home-indikator i app-skalet).
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body style={{ margin: 0, background: '#111', color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
