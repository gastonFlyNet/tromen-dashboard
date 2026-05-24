'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  const [clients, setClients]         = useState<any[]>([])
  const [repartidores, setRepartidores] = useState<any[]>([])
  const [geofences, setGeofences] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState<any[]>([])
  const [assignedTo, setAssignedTo]   = useState('')
  const [selectedGeofence, setSelectedGeofence] = useState<string>('')
  const [routeDate, setRouteDate]     = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    Promise.all([
      apiFetch('/api/clients?active=true'),
      apiFetch('/api/users?role=repartidor'),
    ]).then(([clientsData, usersData]) => {
      setClients(Array.isArray(clientsData) ? clientsData : clientsData.clients ?? [])
      setRepartidores(Array.isArray(usersData) ? usersData : usersData.users ?? [])
    }).catch(() => setError('Error cargando datos'))
    .finally(() => setLoading(false))
      apiFetch('/api/geofences').then(data => setGeofences(Array.isArray(data) ? data.filter((g: any) => g.active) : [])).catch(() => {})
  }, [])
       
  const toggleClient = (client: any) => {
    setSelected(prev => {
      const exists = prev.find(c => c.id === client.id)
      if (exists) return prev.filter(c => c.id !== client.id)
      return [...prev, { ...client, expected_amount: '' }]
    })
  }

  const updateAmount = (clientId: string, amount: string) => {
    setSelected(prev => prev.map(c => c.id === clientId ? { ...c, expected_amount: amount } : c))
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
    if (!assignedTo) return setError('Seleccioná un repartidor')
    if (selected.length === 0) return setError('Seleccioná al menos un cliente')
    setSaving(true)
    setError('')
    try {
      const stops = selected.map((c, i) => ({
        client_id: c.id,
        expected_amount: parseFloat(c.expected_amount || '0'),
        stop_order: i + 1,
      }))
      await apiFetch('/api/routes', {
        method: 'POST',
        body: JSON.stringify({
          user_id: assignedTo,
          route_date: routeDate,
          stops,
        }),
      })
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F7FC' }}>
      <div className="bg-white rounded-2xl p-10 shadow-xl text-center max-w-sm w-full">
        <p className="text-6xl mb-4">✅</p>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Ruta creada!</h2>
        <p className="text-gray-500 text-sm mb-6">
          La ruta fue asignada al repartidor. Ya puede verla en la app móvil.
        </p>
        <div className="flex gap-3">
          <button onClick={() => router.push('/')}
            className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600">
            Ir al panel
          </button>
          <button onClick={() => { setSuccess(false); setSelected([]); setAssignedTo('') }}
            className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-bold">
            Nueva ruta
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#F0F7FC' }}>

      {/* NAVBAR */}
      <nav className="text-white px-6 py-4 flex items-center justify-between shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="text-blue-200 hover:text-white text-sm mr-2">← Volver</button>
          <span className="text-2xl">🚚</span>
          <div>
            <h1 className="font-bold text-lg">Nueva ruta del día</h1>
            <p className="text-blue-200 text-xs">TROMEN · Catriel</p>
          </div>
        </div>
        <button onClick={handleCreate} disabled={saving || selected.length === 0 || !assignedTo}
          className="bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded-xl px-5 py-2 text-sm font-bold transition-all">
          {saving ? 'Creando...' : `✓ Crear ruta (${selected.length})`}
        </button>
      </nav>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-red-600 text-sm font-semibold">
          ⚠️ {error}
        </div>
      )}

      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* COLUMNA IZQUIERDA — Configuración + lista seleccionados */}
          <div className="space-y-4">

            {/* Configuración */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
              <h3 className="font-bold text-gray-700 mb-4">⚙️ Configuración de la ruta</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Repartidor *
                  </label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={assignedTo}
                    onChange={e => setAssignedTo(e.target.value)}
                  >
                    <option value="">Seleccioná un repartidor...</option>
                    {repartidores.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  </select>
                  </div>
                  <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Perímetro de la ruta (opcional)
                  </label>
  <select
    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
    value={selectedGeofence}
    onChange={e => setSelectedGeofence(e.target.value)}
  >
    <option value="">Sin perímetro asignado</option>
    {geofences.map(g => (
      <option key={g.id} value={g.id}>{g.name}</option>
    ))}
  </select>
</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Fecha de la ruta
                  </label>
                  <input type="date"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={routeDate}
                    onChange={e => setRouteDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Lista clientes seleccionados */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-700">
                  📋 Paradas de la ruta
                  {selected.length > 0 && (
                    <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {selected.length}
                    </span>
                  )}
                </h3>
                {selected.length > 0 && (
                  <button onClick={() => setSelected([])}
                    className="text-xs text-red-400 hover:text-red-600">
                    Limpiar todo
                  </button>
                )}
              </div>

              {selected.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">👈</p>
                  <p className="text-sm">Seleccioná clientes de la lista de la derecha</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {selected.map((c, i) => (
                    <div key={c.id} className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Número de orden */}
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{c.name}</p>
                          <p className="text-xs text-gray-400 truncate">{c.address}</p>
                        </div>
                        {/* Controles orden */}
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveUp(i)}
                            className="text-gray-400 hover:text-gray-600 text-xs px-1">▲</button>
                          <button onClick={() => moveDown(i)}
                            className="text-gray-400 hover:text-gray-600 text-xs px-1">▼</button>
                        </div>
                        <button onClick={() => toggleClient(c)}
                          className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
                      </div>
                      {/* Monto esperado */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-400">Monto esperado $</span>
                        <input
                          type="number"
                          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                          placeholder="0.00"
                          value={c.expected_amount}
                          onChange={e => updateAmount(c.id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selected.length > 0 && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    Total esperado:{' '}
                    <span className="font-bold text-blue-700">
                      ${selected.reduce((s, c) => s + parseFloat(c.expected_amount || '0'), 0).toLocaleString('es-AR')}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA — Buscador de clientes */}
          <div className="bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden flex flex-col" style={{ maxHeight: '75vh' }}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-700 mb-3">👥 Clientes disponibles</h3>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="🔍 Buscar cliente..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {loading ? (
                <p className="text-center text-gray-400 py-12 text-sm">Cargando clientes...</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">
                  {search ? 'Sin resultados' : 'Todos los clientes ya están en la ruta'}
                </p>
              ) : filtered.map(c => (
                <button key={c.id}
                  onClick={() => toggleClient(c)}
                  className="w-full text-left p-4 hover:bg-blue-50/70 transition-colors flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: '#0A5C8A' }}>
                    {c.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                      {c.zone && (
                        <span className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">{c.zone}</span>
                      )}
                      {Number(c.balance ?? c.current_balance) > 0 && (
                        <span className="text-xs text-orange-500 font-semibold">
                          💰 ${Number(c.balance ?? c.current_balance).toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{c.address}</p>
                  </div>
                  <div className="text-green-500 text-lg flex-shrink-0">+</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* BOTÓN CREAR — visible en móvil */}
        <div className="mt-6 lg:hidden">
          <button onClick={handleCreate} disabled={saving || selected.length === 0 || !assignedTo}
            className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded-xl py-4 text-base font-bold transition-all">
            {saving ? 'Creando ruta...' : `✓ Crear ruta (${selected.length} clientes)`}
          </button>
        </div>
      </div>
    </div>
  )
}
