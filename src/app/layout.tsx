import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wisboverket",
  description: "Wisboverket — Order & Fastigheter",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body style={{ margin: 0, background: '#111', color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
