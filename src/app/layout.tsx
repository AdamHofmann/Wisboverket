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
  maximumScale: 5,
  themeColor: '#111111',
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
