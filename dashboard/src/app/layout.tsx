import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TROMEN · Panel Administrativo',
  description: 'BYF Soluciones — Sistema de distribución de agua',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
