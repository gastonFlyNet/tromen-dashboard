'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import FadeIn from '@/components/FadeIn'
import { theme, cardCls } from '@/lib/theme'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tromen-backend-production.up.railway.app'

async function apiFetch(path: string) {
  const token = localStorage.getItem('tromen_token')
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const ROLE_LABEL: Record<string, string> = {
  repartidor: 'Repartidor',
  supervisor: 'Supervisor',
  admin:      'Administrador',
}

// Colores de fondo (avatar) — fill + texto blanco, por eso el rol
// "repartidor" usa el azul de marca (brand) y no el acento.
const ROLE_FILL: Record<string, string> = {
  repartidor: theme.colors.brand,
  supervisor: '#7c3aed',
  admin:      theme.colors.error,
}

// Colores de texto (label bajo el nombre) — sobre tarjeta oscura,
// "repartidor" usa el acento en vez del azul de marca.
const ROLE_TEXT: Record<string, string> = {
  repartidor: theme.colors.accent,
  supervisor: '#7c3aed',
  admin:      theme.colors.error,
}

export default function RepartidoresPage() {
  const router = useRouter()
  const [users, setUsers]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    apiFetch('/api/users?role=repartidor')
      .then(data => setUsers(Array.isArray(data) ? data : data.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(u =>
    (u.name ?? '').toLowerCase().includes(search.toLowerCase()))

  const activos = users.filter(u => u.active).length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: theme.colors.bg, display: 'flex', flexDirection: 'row' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <div className="animate-spin" style={{ width: 40, height: 40, border: `3px solid ${theme.colors.border}`, borderTopColor: theme.colors.accent, borderRadius: '50%', margin: '0 auto' }} />
          <p style={{ color: theme.colors.textFaint, marginTop: 16, fontSize: 14 }}>Cargando repartidores...</p>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: theme.colors.bg, display: 'flex', flexDirection: 'row' }}>
      <Sidebar />

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>

        {/* HEADER */}
        <nav className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
          style={{ background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚚</span>
            <div>
              <h1 className="font-bold text-lg" style={{ color: theme.colors.text }}>Repartidores</h1>
              <p className="text-xs" style={{ color: theme.colors.textFaint }}>{users.length} en total · {activos} activos</p>
            </div>
          </div>
        </nav>

        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

          {/* BUSCADOR */}
          <FadeIn>
            <input
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
              style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, color: theme.colors.text }}
              placeholder="Buscar repartidor por nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </FadeIn>

          {/* LISTA */}
          {filtered.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: theme.colors.textFaint }}>
              {search ? 'Sin resultados para la búsqueda' : 'Sin repartidores registrados'}
            </p>
          ) : (
            <FadeIn className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(u => (
                <button key={u.id}
                  onClick={() => router.push(`/repartidores/${u.id}`)}
                  className={cardCls + ' cult-card text-left p-5 transition-colors hover:bg-[#1A2236]'}
                  style={{ cursor: 'pointer' }}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ width: 48, height: 48, background: ROLE_FILL[u.role] ?? theme.colors.textFaint, color: '#fff', fontSize: 20, fontWeight: 700 }}>
                      {(u.name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: theme.colors.text }}>{u.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: ROLE_TEXT[u.role] ?? theme.colors.textMuted, fontWeight: 600 }}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </p>
                    </div>
                    <span style={{
                      width: 10, height: 10, borderRadius: 5,
                      background: u.active ? theme.colors.success : theme.colors.textFaint, flexShrink: 0,
                    }} />
                  </div>
                  <div className="mt-4 pt-3 space-y-1 border-t" style={{ borderColor: theme.colors.border }}>
                    {u.phone && (
                      <p className="text-xs" style={{ color: theme.colors.textMuted }}>📞 {u.phone}</p>
                    )}
                    {u.last_login_at && (
                      <p className="text-xs" style={{ color: theme.colors.textFaint }}>
                        Último ingreso: {new Date(u.last_login_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                  <p className="text-xs mt-3 font-semibold" style={{ color: theme.colors.accent }}>Ver historial y recorridos →</p>
                </button>
              ))}
            </FadeIn>
          )}
        </div>
      </div>
    </div>
  )
}
