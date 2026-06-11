import type { Metadata } from 'next'
import { Sora } from 'next/font/google'
import { cn } from '@/lib/utils'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'TROMEN · Panel Administrativo',
  description: 'BYF Soluciones — Sistema de distribución de agua',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={cn('font-sans', sora.variable)}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f1117" />
        <link rel="apple-touch-icon" href="/tromen-logo.png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
