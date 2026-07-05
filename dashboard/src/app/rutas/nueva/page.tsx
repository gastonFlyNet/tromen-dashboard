'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { theme, cardCls, inputCls, labelCls } from '@/lib/theme'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tromen-backend-production.up.railway.app'

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem('tromen_token')
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function NuevaRutaPage() {
  const router = useRouter()
  const [clients, setClients]           = useState<any[]>([])
  const [repartidores, setRepartidores] = useState<any[]>([])
  const [geofences, setGeofences]       = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [selected, setSelected]         = useState<any[]>([])
  const [assignedTo, setAssignedTo]     = useState('')
  const [selectedGeofences, setSelectedGeofences] = useState<string[]>([])
  const [routeDate, setRouteDate]       = useState(new Date().toISOString().slice(0, 10))
  const [cashStart, setCashStart]       = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    Promise.all([
      apiFetch('/api/clients?active=true'),
      apiFetch('/api/users?role=repartidor'),
      apiFetch('/api/geofences'),
    ]).then(([clientsData, usersData, geoData]) => {
      setClients(Array.isArray(clientsData) ? clientsData : clientsData.clients ?? [])
      setRepartidores(Array.isArray(usersData) ? usersData : usersData.users ?? [])
      setGeofences(Array.isArray(geoData) ? geoData.filter((g: any) => g.active) : [])
    }).catch(() => setError('Error cargando datos'))
    .finally(() => setLoading(false))
  }, [])

  const toggleClient = (client: any) => {
    setSelected(prev => {
      const exists = prev.find(c => c.id === client.id)
      if (exists) return prev.filter(c => c.id !== client.id)
      return [...prev, { ...client, expected_amount: '0' }]
    })
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    setSelected(prev => {
      const arr = [...prev]
      ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
      return arr
    })
  }

  const moveDown = (index: number) => {
    setSelected(prev => {
      if (index === prev.length - 1) return prev
      const arr = [...prev]
      ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
      return arr
    })
  }

  const handleCreate = async () => {
    if (!assignedTo) return setError('Selecciona un repartidor')
    if (selected.length === 0) return setError('Selecciona al menos un cliente')
    setSaving(true)
    setError('')
    try {
      const stops = selected.map((c, i) => ({
        client_id: c.id,
        expected_amount: parseFloat(c.expected_amount || '0'),
        stop_order: i + 1,
      }))
      const route = await apiFetch('/api/routes', {
        method: 'POST',
        body: JSON.stringify({
          user_id: assignedTo,
          route_date: routeDate,
          cash_start: cashStart ? Number(cashStart) : 0,
          stops,
        }),
      })
      if (selectedGeofences.length > 0 && route.id) {
        await apiFetch(`/api/routes/${route.id}/geofences`, {
          method: 'POST',
          body: JSON.stringify({ geofence_ids: selectedGeofences }),
        })
      }
      setSuccess(true)
    } catch (err: any) {
      setError(err.message ?? 'No se pudo crear la ruta')
    } finally { setSaving(false) }
  }

  const filtered = clients.filter(c =>
    !selected.find(s => s.id === c.id) && (
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase()) ||
      c.zone?.toLowerCase().includes(search.toLowerCase())
    )
  )

  if (success) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: theme.colors.bg }}>
      <div className={cardCls + ' p-10 text-center max-w-sm w-full'} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }}>
        <p className="text-6xl mb-4">✅</p>
        <h2 className="text-2xl font-bold mb-2" style={{ color: theme.colors.text }}>¡Ruta creada!</h2>
        <p className="text-sm mb-6" style={{ color: theme.colors.textMuted }}>
          La ruta fue asignada al repartidor. Ya puede verla en la app móvil.
        </p>
        <div className="flex gap-3">
          <button onClick={() => router.push('/')}
            className="flex-1 rounded-xl py-3 text-sm font-semibold border transition-colors hover:bg-[#1A2236]"
            style={{ borderColor: theme.colors.border, color: theme.colors.textMuted }}>
            Ir al panel
          </button>
          <button onClick={() => { setSuccess(false); setSelected([]); setAssignedTo(''); setSelectedGeofences([]) }}
            className="flex-1 text-white rounded-xl py-3 text-sm font-bold hover:brightness-110 transition-all"
            style={{ background: theme.colors.brand }}>
            Nueva ruta
          </button>
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
            <h1 className="font-bold text-lg" style={{ color: theme.colors.text }}>Nueva ruta del día</h1>
            <p className="text-xs" style={{ color: theme.colors.textFaint }}>TROMEN · Catriel</p>
          </div>
        </div>
        <button onClick={handleCreate} disabled={saving || selected.length === 0 || !assignedTo}
          className="cult-btn text-white rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-40"
          style={{ background: theme.colors.success }}>
          {saving ? 'Creando...' : `✓ Crear ruta (${selected.length})`}
        </button>
      </nav>

      {error && (
        <div className="px-6 py-3 text-sm font-semibold border-b"
          style={{ background: theme.colors.errorSoft, color: theme.colors.error, borderColor: theme.colors.error }}>
          ⚠️ {error}
        </div>
      )}

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* COLUMNA IZQUIERDA */}
          <div className="space-y-4">

            {/* Configuración */}
            <div className={cardCls + ' cult-card p-5'}>
              <h3 className="font-bold mb-4" style={{ color: theme.colors.text }}>⚙️ Configuración de la ruta</h3>
              <div className="space-y-4">

                {/* Repartidor */}
                <div>
                  <label className={labelCls}>Repartidor *</label>
                  <select className={inputCls}
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}>
                    <option value="">Seleccionar repartidor...</option>
                    {repartidores.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Fecha */}
                <div>
                  <label className={labelCls}>Fecha de la ruta</label>
                  <input type="date" className={inputCls}
                    value={routeDate}
                    onChange={e => setRouteDate(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Dinero de salida ($)</label>
                  <input type="number" className={inputCls}
                    placeholder="Efectivo con el que sale (opcional)"
                    value={cashStart}
                    onChange={e => setCashStart(e.target.value)} />
                </div>

                {/* Geocercas */}
                <div>
                  <label className={labelCls}>Geocercas de la ruta (opcional)</label>
                  <div className="mt-1 rounded-xl overflow-hidden border" style={{ borderColor: theme.colors.border }}>
                    {geofences.length === 0 ? (
                      <p className="text-xs px-4 py-3" style={{ color: theme.colors.textFaint }}>No hay geocercas activas</p>
                    ) : geofences.map((g: any) => (
                      <label key={g.id}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b last:border-0 transition-colors hover:bg-[#1A2236]"
                        style={{ borderColor: theme.colors.border }}>
                        <input
                          type="checkbox"
                          checked={selectedGeofences.includes(g.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedGeofences(prev => [...prev, g.id])
                            } else {
                              setSelectedGeofences(prev => prev.filter(id => id !== g.id))
                            }
                          }}
                          className="w-4 h-4 accent-[#38BDF8]"
                        />
                        <span className="text-sm" style={{ color: theme.colors.text }}>{g.name}</span>
                        <span className="text-xs ml-auto" style={{ color: theme.colors.textFaint }}>
                          {Number(g.radius_meters) >= 1000
                            ? `${(Number(g.radius_meters)/1000).toFixed(1)} km`
                            : `${Number(g.radius_meters)} m`}
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedGeofences.length > 0 && (
                    <p className="text-xs mt-1 font-semibold" style={{ color: theme.colors.accent }}>
                      {selectedGeofences.length} geocerca{selectedGeofences.length > 1 ? 's' : ''} seleccionada{selectedGeofences.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

              </div>
            </div>

            {/* Lista clientes seleccionados */}
            <div className={cardCls + ' cult-card overflow-hidden'}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: theme.colors.border }}>
                <h3 className="font-bold" style={{ color: theme.colors.text }}>
                  📋 Paradas de la ruta
                  {selected.length > 0 && (
                    <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: theme.colors.accentSoft, color: theme.colors.accent }}>
                      {selected.length}
                    </span>
                  )}
                </h3>
                {selected.length > 0 && (
                  <button onClick={() => setSelected([])}
                    className="text-xs hover:brightness-125 transition-all" style={{ color: theme.colors.error }}>
                    Limpiar todo
                  </button>
                )}
              </div>

              {selected.length === 0 ? (
                <div className="text-center py-12" style={{ color: theme.colors.textFaint }}>
                  <p className="text-3xl mb-2">👈</p>
                  <p className="text-sm">Seleccioná clientes de la lista de la derecha</p>
                </div>
              ) : (
                <div className="divide-y divide-[#1E2D40]">
                  {selected.map((c, i) => (
                    <div key={c.id} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: theme.colors.brand }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" style={{ color: theme.colors.text }}>{c.name}</p>
                          <p className="text-xs truncate" style={{ color: theme.colors.textFaint }}>{c.address}</p>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveUp(i)}
                            className="text-xs px-1 transition-colors hover:text-[#F1F5F9]" style={{ color: theme.colors.textFaint }}>▲</button>
                          <button onClick={() => moveDown(i)}
                            className="text-xs px-1 transition-colors hover:text-[#F1F5F9]" style={{ color: theme.colors.textFaint }}>▼</button>
                        </div>
                        <button onClick={() => toggleClient(c)}
                          className="text-sm px-2 hover:brightness-125 transition-all" style={{ color: theme.colors.error }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA — Buscador de clientes */}
          <div className={cardCls + ' overflow-hidden flex flex-col'} style={{ maxHeight: '75vh' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: theme.colors.border }}>
              <h3 className="font-bold mb-3" style={{ color: theme.colors.text }}>👥 Clientes disponibles</h3>
              <input className={inputCls + ' !mt-0'}
                placeholder="🔍 Buscar cliente..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#1E2D40]">
              {loading ? (
                <p className="text-center py-12 text-sm" style={{ color: theme.colors.textFaint }}>Cargando clientes...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center py-12 text-sm" style={{ color: theme.colors.textFaint }}>
                  {search ? 'Sin resultados' : 'Todos los clientes ya están en la ruta'}
                </p>
              ) : filtered.map(c => {
                const balance = Number(c.balance ?? c.current_balance)
                return (
                  <button key={c.id}
                    onClick={() => toggleClient(c)}
                    className="cult-row w-full text-left p-4 flex items-center gap-3 transition-colors hover:bg-[#1A2236]">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${theme.colors.brand}, ${theme.colors.brandLight})` }}>
                      {c.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm" style={{ color: theme.colors.text }}>{c.name}</p>
                        {c.zone && (
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: theme.colors.accentSoft, color: theme.colors.accent }}>{c.zone}</span>
                        )}
                        {balance > 0 && (
                          <span className="text-xs font-semibold" style={{ color: theme.colors.warning }}>
                            💰 ${balance.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: theme.colors.textFaint }}>{c.address}</p>
                    </div>
                    <div className="text-lg flex-shrink-0" style={{ color: theme.colors.success }}>+</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* BOTON CREAR móvil */}
        <div className="mt-6 lg:hidden">
          <button onClick={handleCreate} disabled={saving || selected.length === 0 || !assignedTo}
            className="cult-btn w-full text-white rounded-xl py-4 text-base font-bold disabled:opacity-40"
            style={{ background: theme.colors.success }}>
            {saving ? 'Creando ruta...' : `✓ Crear ruta (${selected.length} clientes)`}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
