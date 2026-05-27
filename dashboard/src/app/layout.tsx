import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TROMEN · Panel Administrativo',
  description: 'BYF Soluciones — Sistema de distribución de agua',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1A2E4A" />
        <link rel="apple-touch-icon" href="/tromen-logo.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
