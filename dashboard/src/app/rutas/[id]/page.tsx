'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Map, { Marker, Source, Layer } from 'react-map-gl'
import { getRepColor } from '@/lib/repColors'
import 'mapbox-gl/dist/mapbox-gl.css'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tromen-backend-production.up.railway.app'
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

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

const STATUS_COLOR: Record<string, string> = {
  entregado:    '#1A7A4A',
  no_entregado: '#C0392B',
  pendiente:    '#E67E22',
  parcial:      '#2980B9',
}

const STATUS_LABEL: Record<string, string> = {
  entregado:    'Entregado',
  no_entregado: 'No entregado',
  pendiente:    'Pendiente',
  parcial:      'Parcial',
}

export default function RutaDetallePage() {
  const router  = useRouter()
  const params  = useParams()
  const routeId = params?.id as string

  const [route, setRoute]                       = useState<any>(null)
  const [position, setPosition]                 = useState<any>(null)
  const [loading, setLoading]                   = useState(true)
  const [showAddClients, setShowAddClients]     = useState(false)
  const [showNewClient, setShowNewClient]       = useState(false)
  const [clients, setClients]                   = useState<any[]>([])
  const [searchClient, setSearchClient]         = useState('')
  const [addingSaving, setAddingSaving]         = useState(false)
  const [selectedToAdd, setSelectedToAdd]       = useState<any[]>([])
  const [newClientForm, setNewClientForm]       = useState({
    name: '', address: '', zone: '', phone: '', latitude: '', longitude: ''
  })
  const [savingNewClient, setSavingNewClient]   = useState(false)
  const intervalRef = useRef<NodeJS.Timeout>()
  const [trackPoints, setTrackPoints] = useState<{lat: number, lng: number, estado?: string}[]>([])
  const loadRoute = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/routes/${routeId}`)
      setRoute(data)
    } catch {}
  }, [routeId])

  const loadPosition = useCallback(async () => {
    try {
      const data = await apiFetch('/api/gps/live')
      const positions = Array.isArray(data) ? data : data.positions ?? []
      const pos = positions.find((p: any) => p.route_id === routeId)
      if (pos) setPosition(pos)
    } catch {}
  }, [routeId])

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    Promise.all([loadRoute(), loadPosition()]).then(async () => {
      try {
        const token = localStorage.getItem('tromen_token')
        const rData = await apiFetch(`/api/routes/${routeId}`)
        const rt = rData.route ?? rData
        const uId = rt?.user_id
        const rDate = rt?.route_date ? new Date(rt.route_date).toISOString().slice(0,10) : null
        let pts: any[] = []
        if (uId && rDate) {
          const gps = await fetch(`${API_URL}/api/gps/day-track/${uId}?date=${rDate}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(r => r.json())
          pts = Array.isArray(gps) ? gps : gps.points ?? []
        }
        setTrackPoints(pts.map((p: any) => ({ lat: Number(p.lat ?? p.latitude), lng: Number(p.lng ?? p.longitude), estado: p.estado })))
      } catch {}
    }).finally(() => setLoading(false))
    intervalRef.current = setInterval(() => { loadRoute(); loadPosition() }, 15000)
    return () => clearInterval(intervalRef.current)
  }, [loadRoute, loadPosition])

  const loadClients = async () => {
    try {
      const data = await apiFetch('/api/clients?active=true')
      const allClients = Array.isArray(data) ? data : data.clients ?? []
      const existingIds = (route?.deliveries ?? []).map((d: any) => d.client_id)
      setClients(allClients.filter((c: any) => !existingIds.includes(c.id)))
    } catch {}
  }

  const openAddClients = async () => {
    setSelectedToAdd([])
    setSearchClient('')
    await loadClients()
    setShowAddClients(true)
  }

  const toggleClientToAdd = (client: any) => {
    setSelectedToAdd(prev => {
      const exists = prev.find(c => c.id === client.id)
      if (exists) return prev.filter(c => c.id !== client.id)
      return [...prev, client]
    })
  }

  const handleAddClients = async () => {
    if (selectedToAdd.length === 0) return
    setAddingSaving(true)
    try {
      const existingStops = route?.deliveries?.length ?? 0
      const stops = selectedToAdd.map((c, i) => ({
        client_id: c.id, expected_amount: 0, stop_order: existingStops + i + 1,
      }))
      await apiFetch(`/api/routes/${routeId}/stops`, {
        method: 'POST', body: JSON.stringify({ stops }),
      })
      setShowAddClients(false)
      loadRoute()
    } catch (err: any) {
      alert(err.message ?? 'No se pudo agregar')
    } finally { setAddingSaving(false) }
  }

  const handleCreateAndAdd = async () => {
    if (!newClientForm.name.trim()) return alert('El nombre es obligatorio')
    if (!newClientForm.address.trim()) return alert('La direccion es obligatoria')
    setSavingNewClient(true)
    try {
      const newClient = await apiFetch('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: newClientForm.name,
          address: newClientForm.address,
          zone: newClientForm.zone || null,
          phone: newClientForm.phone || null,
          latitude: newClientForm.latitude ? parseFloat(newClientForm.latitude) : null,
          longitude: newClientForm.longitude ? parseFloat(newClientForm.longitude) : null,
        }),
      })
      const existingStops = route?.deliveries?.length ?? 0
      await apiFetch(`/api/routes/${routeId}/stops`, {
        method: 'POST',
        body: JSON.stringify({
          stops: [{ client_id: newClient.id, expected_amount: 0, stop_order: existingStops + 1 }],
        }),
      })
      setShowNewClient(false)
      setNewClientForm({ name: '', address: '', zone: '', phone: '', latitude: '', longitude: '' })
      setShowAddClients(false)
      loadRoute()
      alert('Cliente creado y agregado a la ruta')
    } catch (err: any) {
      alert(err.message ?? 'Error al crear el cliente')
    } finally { setSavingNewClient(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1117' }}>
      <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}.dot1{animation:pulse 1.2s ease-in-out infinite}.dot2{animation:pulse 1.2s ease-in-out 0.2s infinite}.dot3{animation:pulse 1.2s ease-in-out 0.4s infinite}`}</style>
      <div className="text-center">
        <img src="/tromen-logo.png" alt="TROMEN" style={{ width: 240, height: 'auto', objectFit: 'contain', margin: '0 auto' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 }}>
          <div className="dot1" style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8' }} />
          <div className="dot2" style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8' }} />
          <div className="dot3" style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8' }} />
        </div>
        <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 18 }}>Cargando ruta</p>
      </div>
    </div>
  )

  if (!route) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1117' }}>
      
      <div className="text-center">
        <p className="text-4xl mb-3">❌</p>
        <p className="text-slate-500">Ruta no encontrada</p>
        <button onClick={() => router.push('/')}
          className="mt-4 text-blue-600 text-sm font-semibold">Volver al panel</button>
      </div>
    </div>
  )

  const quitarParada = async (deliveryId: string, clientName: string) => {
    if (!confirm(`Quitar a ${clientName} de la ruta?`)) return
    try {
      await apiFetch(`/api/routes/${routeId}/stops/${deliveryId}`, { method: 'DELETE' })
      await loadRoute()
    } catch (err: any) {
      alert(err.message ?? 'No se pudo quitar la parada')
    }
  }
  const deliveries   = route.deliveries ?? []

  // Recorrido partido en tramos por estado, para colorear
  const ESTADO_COLOR: Record<string, string> = {
    con_ruta: '#16a34a', pausa: '#9ca3af', sin_ruta: '#ef4444',
  }
  const segmentos: { estado: string, coords: [number, number][] }[] = []
  for (let i = 0; i < trackPoints.length; i++) {
    const p = trackPoints[i]
    const estado = p.estado ?? 'sin_ruta'
    const last = segmentos[segmentos.length - 1]
    if (last && last.estado === estado) {
      last.coords.push([p.lng, p.lat])
    } else {
      const startCoords: [number, number][] = []
      if (i > 0) startCoords.push([trackPoints[i-1].lng, trackPoints[i-1].lat])
      startCoords.push([p.lng, p.lat])
      segmentos.push({ estado, coords: startCoords })
    }
  }
  const pending      = deliveries.filter((d: any) => d.status === 'pendiente')
  const done         = deliveries.filter((d: any) => d.status !== 'pendiente')
  const total        = deliveries.length
  const pct          = total > 0 ? Math.round((done.length / total) * 100) : 0
  const totalCobrado = done.reduce((s: number, d: any) => s + Number(d.actual_amount ?? 0), 0)
  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(searchClient.toLowerCase()) ||
    c.address?.toLowerCase().includes(searchClient.toLowerCase())
  )

  const STATUS_ROUTE_COLOR: Record<string, string> = {
    en_curso: '#0A5C8A', completada: '#1A7A4A', pendiente: '#E67E22',
  }

  return (
    <div className="min-h-screen" style={{ background: '#0f1117' }}>

      <nav className="text-white px-6 py-4 flex items-center justify-between shadow-lg"
        style={{ background: '#151b27', borderBottom: '1px solid #1e2d40' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="text-blue-200 hover:text-white text-sm mr-2">← Volver</button>
          <span className="text-2xl">🚚</span>
          <div>
            <h1 className="font-bold text-lg">{route.user_name ?? route.repartidor ?? 'Repartidor'}</h1>
            <p className="text-blue-200 text-xs capitalize">
              Ruta del {new Date(route.route_date).toLocaleDateString('es-AR', {
                weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full text-xs font-bold"
            style={{
              background: (STATUS_ROUTE_COLOR[route.status] ?? '#888') + '30',
              color: STATUS_ROUTE_COLOR[route.status] ?? '#888',
              border: `1px solid ${STATUS_ROUTE_COLOR[route.status] ?? '#888'}`,
            }}>
            {route.status === 'en_curso' ? '● En curso'
              : route.status === 'completada' ? '✓ Completada' : '○ Pendiente'}
          </span>
          <button onClick={() => { setShowNewClient(true); setShowAddClients(false) }}
            className="bg-white/20 hover:bg-white/30 text-white rounded-xl px-4 py-2 text-sm font-bold transition-all">
            + Cliente nuevo
          </button>
          <button onClick={openAddClients}
            className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-bold transition-all">
            + Agregar existente
          </button>
        </div>
      </nav>

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Cuadre de caja por ruta */}
        <div className="rounded-2xl p-5" style={{ background: "#1a1d27", border: "1px solid #2a2e3a" }}>
          <p className="text-sm font-bold mb-4" style={{ color: "#38bdf8" }}>Cuadre de caja</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "#8b92a5" }}>Salio con</p>
              <p className="font-bold text-xl" style={{ color: "#e5e7eb" }}>$ {Number(route.cash_start ?? 0).toLocaleString("es-AR")}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "#8b92a5" }}>Cobro efectivo</p>
              <p className="font-bold text-xl" style={{ color: "#e5e7eb" }}>$ {Number(route.efectivo_cobrado ?? 0).toLocaleString("es-AR")}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "#8b92a5" }}>Esperado en caja</p>
              <p className="font-bold text-xl" style={{ color: "#34d399" }}>$ {Number(route.efectivo_esperado ?? 0).toLocaleString("es-AR")}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Progreso', `${pct}%`, `${done.length}/${total} entregas`, '#0A5C8A', '📊'],
            ['Cobrado', `$${totalCobrado.toLocaleString('es-AR')}`, `de $${Number(route.total_amount ?? 0).toLocaleString('es-AR')} esperado`, '#1A7A4A', '💰'],
            ['Pendientes', String(pending.length), `${done.length} completadas`, '#E67E22', '⏳'],
            ['Bidones vacios', String(done.reduce((s: number, d: any) => {
              const m = d.notes?.match(/Bidones vacios devueltos: (\d+)/)
              return s + (m ? parseInt(m[1]) : 0)
            }, 0)), 'recuperados hoy', '#2980B9', '🫙'],
          ].map(([l, v, sub, c, e]) => (
            <div key={l as string} className="rounded-2xl p-4 shadow-sm" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{l as string}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: c as string }}>{v as string}</p>
                  <p className="text-xs text-gray-400 mt-1">{sub as string}</p>
                </div>
                <span className="text-2xl">{e as string}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1e2d40' }}>
              <h3 className="font-bold text-slate-200">🗺️ Posicion en tiempo real</h3>
              {position && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-slate-400">{Number(position.speed ?? 0).toFixed(0)} km/h</span>
                </div>
              )}
            </div>
            <div style={{ height: '380px' }}>
              <Map
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{ latitude: position?.latitude ?? -37.879, longitude: position?.longitude ?? -68.079, zoom: 13 }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/streets-v12"
              >
                {position && (
                  <Marker latitude={Number(position.latitude)} longitude={Number(position.longitude)}>
                    <div style={{ width: 40, height: 40, borderRadius: 20, background: '#0A5C8A',
                      border: '3px solid white', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 18 }}>🚚</div>
                  </Marker>
                )}
                {pending.map((d: any, i: number) => d.latitude && d.longitude && (
                  <Marker key={d.id} latitude={Number(d.latitude)} longitude={Number(d.longitude)}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: '#E67E22',
                      border: '2px solid white', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer' }}>{i + 1}</div>
                  </Marker>
                ))}
                {done.map((d: any) => d.latitude && d.longitude && (
                  <Marker key={d.id} latitude={Number(d.latitude)} longitude={Number(d.longitude)}>
                    <div style={{ width: 28, height: 28, borderRadius: 14,
                      background: STATUS_COLOR[d.status] ?? '#888',
                      border: '2px solid white', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer' }}>✓</div>
                  </Marker>
                ))}
                {segmentos.length > 0 && (
                  <Source id="route-track" type="geojson" data={{
                    type: 'FeatureCollection',
                    features: segmentos.filter(s => s.coords.length >= 2).map(seg => ({
                      type: 'Feature',
                      properties: { color: ESTADO_COLOR[seg.estado] ?? '#0A5C8A' },
                      geometry: { type: 'LineString', coordinates: seg.coords },
                    }))
                  }}>
                    <Layer id="route-track-line" type="line"
                      layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                      paint={{ 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.9 }}
                    />
                  </Source>
                )}
              </Map>
            </div>
            {!position && (
              <div className="px-5 py-3 text-center text-gray-400 text-xs border-t border-slate-800">
                Sin posicion GPS — el repartidor debe tener la ruta iniciada
              </div>
            )}
            {trackPoints.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-800 flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs" style={{ color: '#94a3b8' }}>
                  <span style={{ width: 14, height: 4, background: '#16a34a', borderRadius: 2, display: 'inline-block' }} /> Con ruta
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: '#94a3b8' }}>
                  <span style={{ width: 14, height: 4, background: '#9ca3af', borderRadius: 2, display: 'inline-block' }} /> Pausada
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: '#94a3b8' }}>
                  <span style={{ width: 14, height: 4, background: '#ef4444', borderRadius: 2, display: 'inline-block' }} /> Sin ruta
                </span>
              </div>
            )}
          </div>

          <div className="rounded-2xl shadow-sm flex flex-col" style={{ maxHeight: '500px', background: '#151b27', border: '1px solid #1e2d40' }}>
            <div className="px-5 py-4 border-b border-slate-800">
              <h3 className="font-bold text-slate-200">📋 Entregas de la ruta</h3>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="text-orange-500 font-semibold">⏳ {pending.length} pendientes</span>
                <span className="text-green-600 font-semibold">✓ {done.filter((d: any) => d.status === 'entregado').length} entregadas</span>
                <span className="text-red-500 font-semibold">✗ {done.filter((d: any) => d.status === 'no_entregado').length} no entregadas</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
              {deliveries.map((d: any, i: number) => (
                <div key={d.id}
                  className="w-full p-4 hover:bg-slate-800/50 transition-colors flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: d.status === 'pendiente' ? '#E67E22' : STATUS_COLOR[d.status] ?? '#888' }}>
                    {d.status === 'pendiente' ? i + 1 : '✓'}
                  </div>
                  <button onClick={() => router.push(`/entregas/${d.id}`)}
                    className="flex-1 min-w-0 text-left flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-100 text-sm truncate">{d.client_name}</p>
                      <p className="text-xs text-gray-400 truncate">{d.address}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold" style={{ color: STATUS_COLOR[d.status] ?? '#E67E22' }}>
                        {STATUS_LABEL[d.status] ?? 'Pendiente'}
                      </p>
                      {d.actual_amount > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">${Number(d.actual_amount).toLocaleString('es-AR')}</p>
                      )}
                    </div>
                  </button>
                  {d.status === 'pendiente' ? (
                    <button onClick={() => quitarParada(d.id, d.client_name)}
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/15 transition-colors"
                      title="Quitar de la ruta">✕</button>
                  ) : (
                    <span className="text-slate-500 text-sm flex-shrink-0 w-8 text-center">›</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-5 shadow-sm" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-200">Progreso de la ruta</h3>
            <span className="text-2xl font-bold" style={{ color: '#0A5C8A' }}>{pct}%</span>
          </div>
          <div className="h-4 rounded-full overflow-hidden" style={{ background: '#1e2d40' }}>
            <div className="h-4 rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0A5C8A, #1A8FBF)' }} />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-slate-400">
            <span>🟢 {done.filter((d: any) => d.status === 'entregado').length} entregadas</span>
            <span>🔴 {done.filter((d: any) => d.status === 'no_entregado').length} no entregadas</span>
            <span>🟡 {pending.length} pendientes</span>
          </div>
        </div>
      </div>

      {showAddClients && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: '#1e2d40' }}>
              <div>
                <h2 className="font-bold text-lg text-slate-100">Agregar clientes a la ruta</h2>
                <p className="text-xs text-gray-400 mt-1">
                  {selectedToAdd.length > 0 ? `${selectedToAdd.length} seleccionados` : 'Selecciona clientes'}
                </p>
              </div>
              <button onClick={() => setShowAddClients(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-4 border-b border-slate-800">
              <input className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ background: '#1a2236', border: '1px solid #243347', color: '#f1f5f9' }}
                placeholder="Buscar cliente..."
                value={searchClient} onChange={e => setSearchClient(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
              {filteredClients.length === 0
                ? <p className="text-center text-gray-400 py-10 text-sm">Sin clientes disponibles</p>
                : filteredClients.map(c => {
                  const isSel = selectedToAdd.find(s => s.id === c.id)
                  return (
                    <button key={c.id} onClick={() => toggleClientToAdd(c)}
                      className="w-full text-left p-4 hover:bg-slate-800/50 transition-colors flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        style={{ background: isSel ? '#1A7A4A' : '#0A5C8A' }}>
                        {isSel ? '✓' : c.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-100 text-sm">{c.name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.address}</p>
                      </div>
                    </button>
                  )
                })}
            </div>
            <div className="p-4 border-t flex gap-3" style={{ borderColor: '#1e2d40' }}>
              <button onClick={() => setShowAddClients(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-slate-400" style={{ border: '1px solid #1e2d40' }}>
                Cancelar
              </button>
              <button onClick={handleAddClients} disabled={addingSaving || selectedToAdd.length === 0}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-bold">
                {addingSaving ? 'Agregando...' : `Agregar (${selectedToAdd.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewClient && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl w-full max-w-md" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: '#1e2d40' }}>
              <h2 className="font-bold text-lg text-slate-100">Nuevo cliente y agregar a ruta</h2>
              <button onClick={() => setShowNewClient(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { key: 'name',      label: 'Nombre *',     placeholder: 'Almacen Don Carlos' },
                { key: 'address',   label: 'Direccion *',  placeholder: 'Av. Roca 1234' },
                { key: 'zone',      label: 'Zona',         placeholder: 'Centro, Norte...' },
                { key: 'phone',     label: 'Telefono',     placeholder: '2994000000' },
                { key: 'latitude',  label: 'Latitud GPS',  placeholder: '-37.8855' },
                { key: 'longitude', label: 'Longitud GPS', placeholder: '-68.0783' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold uppercase text-slate-500">{label}</label>
                  <input
                    className="w-full rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500" style={{ background: '#1a2236', border: '1px solid #243347', color: '#f1f5f9' }}
                    placeholder={placeholder}
                    value={(newClientForm as any)[key]}
                    onChange={e => setNewClientForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="p-5 border-t flex gap-3" style={{ borderColor: '#1e2d40' }}>
              <button onClick={() => setShowNewClient(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-slate-400" style={{ border: '1px solid #1e2d40' }}>
                Cancelar
              </button>
              <button onClick={handleCreateAndAdd} disabled={savingNewClient}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-bold">
                {savingNewClient ? 'Creando...' : 'Crear y agregar a ruta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
