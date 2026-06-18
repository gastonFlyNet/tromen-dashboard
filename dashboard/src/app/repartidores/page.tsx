'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import FadeIn from '@/components/FadeIn'

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

const ROLE_COLOR: Record<string, string> = {
  repartidor: '#0A5C8A',
  supervisor: '#7c3aed',
  admin:      '#dc2626',
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
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'row' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <div className="animate-spin" style={{ width: 40, height: 40, border: '3px solid #1e2d40', borderTopColor: '#38bdf8', borderRadius: '50%', margin: '0 auto' }} />
          <p style={{ color: '#64748b', marginTop: 16, fontSize: 14 }}>Cargando repartidores...</p>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'row' }}>
      <Sidebar />

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>

        {/* HEADER */}
        <nav className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
          style={{ background: '#151b27', borderBottom: '1px solid #1e2d40' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚚</span>
            <div>
              <h1 className="font-bold text-lg" style={{ color: '#f1f5f9' }}>Repartidores</h1>
              <p className="text-xs" style={{ color: '#64748b' }}>{users.length} en total · {activos} activos</p>
            </div>
          </div>
        </nav>

        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

          {/* BUSCADOR */}
          <FadeIn>
            <input
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{ background: '#151b27', border: '1px solid #1e2d40', color: '#f1f5f9' }}
              placeholder="Buscar repartidor por nombre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </FadeIn>

          {/* LISTA */}
          {filtered.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: '#64748b' }}>
              {search ? 'Sin resultados para la búsqueda' : 'Sin repartidores registrados'}
            </p>
          ) : (
            <FadeIn className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(u => (
                <button key={u.id}
                  onClick={() => router.push(`/repartidores/${u.id}`)}
                  className="cult-card text-left rounded-2xl p-5 transition-all"
                  style={{ background: '#ffffff', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ width: 48, height: 48, background: ROLE_COLOR[u.role] ?? '#64748b', color: '#fff', fontSize: 20, fontWeight: 700 }}>
                      {(u.name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: '#1f2937' }}>{u.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: ROLE_COLOR[u.role] ?? '#6b7280', fontWeight: 600 }}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </p>
                    </div>
                    <span style={{
                      width: 10, height: 10, borderRadius: 5,
                      background: u.active ? '#16a34a' : '#9ca3af', flexShrink: 0,
                    }} />
                  </div>
                  <div className="mt-4 pt-3 space-y-1" style={{ borderTop: '1px solid #f3f4f6' }}>
                    {u.phone && (
                      <p className="text-xs" style={{ color: '#6b7280' }}>📞 {u.phone}</p>
                    )}
                    {u.last_login_at && (
                      <p className="text-xs" style={{ color: '#9ca3af' }}>
                        Último ingreso: {new Date(u.last_login_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                  <p className="text-xs mt-3 font-semibold" style={{ color: '#0A5C8A' }}>Ver historial y recorridos →</p>
                </button>
              ))}
            </FadeIn>
          )}
        </div>
      </div>
    </div>
  )
}
