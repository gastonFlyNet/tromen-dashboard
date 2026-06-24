'use client'
import { useRouter, usePathname } from 'next/navigation'

const D = {
  bg: '#0f1117', surface: '#151b27', surface2: '#1a2236',
  border: '#1e2d40', text: '#f1f5f9', muted: '#64748b',
  accent: '#38bdf8', blue: '#0A5C8A',
}

const NAV_ITEMS = [
  { label: '🏠 Inicio',       path: '/' },
  { label: '👥 Clientes',     path: '/clientes' },
  { label: '🚚 Repartidores', path: '/repartidores' },
  { label: '📊 Resumen',      path: '/resumen' },
  { label: '🪣 Bidones',      path: '/bidones' },
  { label: '📦 Productos',    path: '/productos' },
  { label: '📊 Stock',        path: '/stock' },
  { label: '🗺️ Geocercas',    path: '/geocercas' },
  { label: '📋 Plantillas',   path: '/rutas/plantillas' },
  { label: '🔑 Mi cuenta',    path: '/cuenta' },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = () => { localStorage.clear(); router.push('/login') }

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path)

  const btnStyle = (active: boolean, accent?: string) => ({
    padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', border: 'none',
    background: accent ?? (active ? 'rgba(56,189,248,0.14)' : 'transparent'),
    color: accent ? '#fff' : (active ? D.accent : D.text),
    textAlign: 'left' as const, width: '100%', transition: 'background 0.15s',
  })

  return (
    <aside style={{
      width: 220, background: D.surface, borderRight: `1px solid ${D.border}`,
      display: 'flex', flexDirection: 'column', position: 'sticky', top: 0,
      height: '100vh', flexShrink: 0,
    }}>
      <div style={{ padding: '20px 18px', borderBottom: `1px solid ${D.border}` }}>
        <img src="/tromen-logo.png" alt="TROMEN" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
        <p style={{ fontSize: 11, color: D.muted, fontWeight: 500, marginTop: 8 }}>Panel Administrativo · Catriel</p>
      </div>

      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => (
          <button key={item.path} style={btnStyle(isActive(item.path))} onClick={() => router.push(item.path)}>
            {item.label}
          </button>
        ))}
        <div style={{ height: 1, background: D.border, margin: '8px 4px' }} />
        <button style={btnStyle(false, D.blue)} onClick={() => router.push('/rutas/nueva')}>+ Nueva ruta</button>
      </nav>

      <div style={{ padding: '12px 10px', borderTop: `1px solid ${D.border}` }}>
        <button style={{ ...btnStyle(false), color: '#94a3b8' }} onClick={handleLogout}>⏻ Salir</button>
      </div>
    </aside>
  )
}
