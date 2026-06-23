'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

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

  // ---- estilos reutilizables (tokens del design system) ----
  const inputCls =
    'w-full rounded-xl px-4 py-2.5 text-sm mt-1 bg-[#f9fafb] ' +
    'border border-[#e5e7eb] text-[#1f2937] placeholder-[#9ca3af] ' +
    'focus:outline-none focus:border-[#0A5C8A] transition-colors'
  const labelCls = 'text-xs font-semibold text-[#6b7280] uppercase tracking-wide'
  const cardCls =
    'rounded-2xl bg-[#ffffff] border border-[#e5e7eb] shadow-[0 1px 3px rgba(0,0,0,0.1)]'

  if (success) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1117' }}>
      <div className={cardCls + ' p-10 text-center max-w-sm w-full'} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <p className="text-6xl mb-4">✅</p>
        <h2 className="text-2xl font-bold text-[#1f2937] mb-2">¡Ruta creada!</h2>
        <p className="text-[#6b7280] text-sm mb-6">
          La ruta fue asignada al repartidor. Ya puede verla en la app móvil.
        </p>
        <div className="flex gap-3">
          <button onClick={() => router.push('/')}
            className="flex-1 rounded-xl py-3 text-sm font-semibold border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f3f4f6] transition-all">
            Ir al panel
          </button>
          <button onClick={() => { setSuccess(false); setSelected([]); setAssignedTo(''); setSelectedGeofences([]) }}
            className="flex-1 text-white rounded-xl py-3 text-sm font-bold hover:brightness-110 transition-all"
            style={{ background: '#0A5C8A' }}>
            Nueva ruta
          </button>
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
            <h1 className="font-bold text-lg" style={{ color: '#f1f5f9' }}>Nueva ruta del día</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>TROMEN · Catriel</p>
          </div>
        </div>
        <button onClick={handleCreate} disabled={saving || selected.length === 0 || !assignedTo}
          className="cult-btn text-white rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-40"
          style={{ background: '#16a34a' }}>
          {saving ? 'Creando...' : `✓ Crear ruta (${selected.length})`}
        </button>
      </nav>

      {error && (
        <div className="px-6 py-3 text-sm font-semibold border-b"
          style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#dc2626' }}>
          ⚠️ {error}
        </div>
      )}

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* COLUMNA IZQUIERDA */}
          <div className="space-y-4">

            {/* Configuración */}
            <div className={cardCls + ' cult-card p-5'}>
              <h3 className="font-bold text-[#1f2937] mb-4">⚙️ Configuración de la ruta</h3>
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
                  <div className="mt-1 rounded-xl overflow-hidden border border-[#e5e7eb]">
                    {geofences.length === 0 ? (
                      <p className="text-xs text-[#9ca3af] px-4 py-3">No hay geocercas activas</p>
                    ) : geofences.map((g: any) => (
                      <label key={g.id}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-[#e5e7eb] last:border-0 hover:bg-[#f3f4f6] transition-colors">
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
                          className="w-4 h-4 accent-[#0A5C8A]"
                        />
                        <span className="text-sm text-[#1f2937]">{g.name}</span>
                        <span className="text-xs text-[#9ca3af] ml-auto">
                          {Number(g.radius_meters) >= 1000
                            ? `${(Number(g.radius_meters)/1000).toFixed(1)} km`
                            : `${Number(g.radius_meters)} m`}
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedGeofences.length > 0 && (
                    <p className="text-xs mt-1 font-semibold" style={{ color: '#0A5C8A' }}>
                      {selectedGeofences.length} geocerca{selectedGeofences.length > 1 ? 's' : ''} seleccionada{selectedGeofences.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

              </div>
            </div>

            {/* Lista clientes seleccionados */}
            <div className={cardCls + ' cult-card overflow-hidden'}>
              <div className="px-5 py-4 border-b border-[#e5e7eb] flex items-center justify-between">
                <h3 className="font-bold text-[#1f2937]">
                  📋 Paradas de la ruta
                  {selected.length > 0 && (
                    <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#e0f2fe', color: '#0A5C8A' }}>
                      {selected.length}
                    </span>
                  )}
                </h3>
                {selected.length > 0 && (
                  <button onClick={() => setSelected([])}
                    className="text-xs hover:brightness-125 transition-all" style={{ color: '#dc2626' }}>
                    Limpiar todo
                  </button>
                )}
              </div>

              {selected.length === 0 ? (
                <div className="text-center py-12 text-[#9ca3af]">
                  <p className="text-3xl mb-2">👈</p>
                  <p className="text-sm">Seleccioná clientes de la lista de la derecha</p>
                </div>
              ) : (
                <div className="divide-y divide-[#e5e7eb]">
                  {selected.map((c, i) => (
                    <div key={c.id} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ background: '#0A5C8A' }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#1f2937] text-sm truncate">{c.name}</p>
                          <p className="text-xs text-[#9ca3af] truncate">{c.address}</p>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveUp(i)}
                            className="text-[#9ca3af] hover:text-[#1f2937] text-xs px-1 transition-colors">▲</button>
                          <button onClick={() => moveDown(i)}
                            className="text-[#9ca3af] hover:text-[#1f2937] text-xs px-1 transition-colors">▼</button>
                        </div>
                        <button onClick={() => toggleClient(c)}
                          className="text-sm px-2 hover:brightness-125 transition-all" style={{ color: '#dc2626' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA — Buscador de clientes */}
          <div className={cardCls + ' overflow-hidden flex flex-col'} style={{ maxHeight: '75vh' }}>
            <div className="px-5 py-4 border-b border-[#e5e7eb]">
              <h3 className="font-bold text-[#1f2937] mb-3">👥 Clientes disponibles</h3>
              <input className={inputCls + ' !mt-0'}
                placeholder="🔍 Buscar cliente..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#e5e7eb]">
              {loading ? (
                <p className="text-center text-[#9ca3af] py-12 text-sm">Cargando clientes...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-[#9ca3af] py-12 text-sm">
                  {search ? 'Sin resultados' : 'Todos los clientes ya están en la ruta'}
                </p>
              ) : filtered.map(c => {
                const balance = Number(c.balance ?? c.current_balance)
                return (
                  <button key={c.id}
                    onClick={() => toggleClient(c)}
                    className="cult-row w-full text-left p-4 flex items-center gap-3 hover:bg-[#f3f4f6]">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)' }}>
                      {c.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[#1f2937] text-sm">{c.name}</p>
                        {c.zone && (
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: '#e0f2fe', color: '#0A5C8A' }}>{c.zone}</span>
                        )}
                        {balance > 0 && (
                          <span className="text-xs font-semibold" style={{ color: '#d97706' }}>
                            💰 ${balance.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#9ca3af] mt-0.5 truncate">{c.address}</p>
                    </div>
                    <div className="text-lg flex-shrink-0" style={{ color: '#16a34a' }}>+</div>
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
            style={{ background: '#16a34a' }}>
            {saving ? 'Creando ruta...' : `✓ Crear ruta (${selected.length} clientes)`}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
