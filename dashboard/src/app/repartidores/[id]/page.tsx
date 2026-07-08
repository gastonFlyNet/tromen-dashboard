'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Map, { Marker, Source, Layer } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import Sidebar from '@/components/Sidebar'
import FadeIn from '@/components/FadeIn'

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

function calcularKm(points: {lat: number, lng: number}[]): number {
  if (points.length < 2) return 0
  const R = 6371
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180
    const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2
    total += R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
  }
  return total
}

export default function RepartidorPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.id as string

  const [user, setUser]               = useState<any>(null)
  const [form, setForm]               = useState({ name: '', phone: '', vehicle_plate: '', notes: '' })
  const [saving, setSaving]           = useState(false)
  const [savedOk, setSavedOk]         = useState(false)
  const [routes, setRoutes]           = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [trackPoints, setTrackPoints] = useState<{lat: number, lng: number, estado?: string}[]>([])
  const [loadingTrack, setLoadingTrack] = useState(false)
  const [loading, setLoading]         = useState(true)

  const loadUser = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/users/${userId}`)
      const u = data.user ?? data
      setUser(u)
      setForm({
        name:          u.name ?? '',
        phone:         u.phone ?? '',
        vehicle_plate: u.vehicle_plate ?? '',
        notes:         u.notes ?? '',
      })
    } catch {}
  }, [userId])

  const loadRoutes = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/users/${userId}/routes-history`)
      setRoutes(data.routes ?? [])
    } catch {}
  }, [userId])

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    Promise.all([loadUser(), loadRoutes()]).finally(() => setLoading(false))
  }, [loadUser, loadRoutes])

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiFetch(`/api/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      })
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    } catch (err: any) {
      alert(err.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const loadTrack = async (date: string, _routeId: string) => {
    setSelectedDate(date)
    setTrackPoints([])
    setLoadingTrack(true)
    try {
      const gps = await apiFetch(`/api/gps/day-track/${userId}?date=${date}`)
      const pts = Array.isArray(gps) ? gps : gps.points ?? []
      setTrackPoints(pts.map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng), estado: p.estado })))
    } catch {} finally { setLoadingTrack(false) }
  }

  // Parte el recorrido en tramos consecutivos del mismo estado, para colorear cada uno
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
      // arranca un tramo nuevo; lo conecto con el punto anterior para que no queden huecos
      const startCoords: [number, number][] = []
      if (i > 0) startCoords.push([trackPoints[i-1].lng, trackPoints[i-1].lat])
      startCoords.push([p.lng, p.lat])
      segmentos.push({ estado, coords: startCoords })
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'row' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <div className="animate-spin" style={{ width: 40, height: 40, border: '3px solid #1e2d40', borderTopColor: '#38bdf8', borderRadius: '50%', margin: '0 auto' }} />
          <p style={{ color: '#64748b', marginTop: 16, fontSize: 14 }}>Cargando repartidor...</p>
        </div>
      </div>
    </div>
  )

  if (!user) return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'row' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b' }}>Repartidor no encontrado</p>
      </div>
    </div>
  )

  const centerLat = trackPoints.length > 0 ? trackPoints[Math.floor(trackPoints.length / 2)].lat : -37.879
  const centerLng = trackPoints.length > 0 ? trackPoints[Math.floor(trackPoints.length / 2)].lng : -67.799
  const kmRecorridos = calcularKm(trackPoints)

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'row' }}>

      <Sidebar />

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>

      {/* HEADER */}
      <nav className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: '#151b27', borderBottom: '1px solid #1e2d40' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/repartidores')}
            style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>← Repartidores</button>
          <span className="text-2xl">🚚</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#f1f5f9' }}>{user.name}</h1>
            <p className="text-xs capitalize" style={{ color: '#64748b' }}>{user.role}</p>
          </div>
        </div>
      </nav>

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

        {/* EDICIÓN DE PERFIL */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-50">
          <h2 className="font-bold text-gray-700 mb-4">👤 Datos del repartidor</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'name',          label: 'Nombre',   placeholder: 'Juan Pérez' },
              { key: 'phone',         label: 'Teléfono', placeholder: '2994000000' },
              { key: 'vehicle_plate', label: 'Patente',  placeholder: 'AB 123 CD' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">{label}</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder={placeholder}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Notas</label>
              <textarea
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                placeholder="Observaciones..."
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl px-6 py-2.5 text-sm font-bold transition-all">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {savedOk && <span className="text-green-600 text-sm font-semibold">✓ Guardado</span>}
          </div>
        </div>

        {/* HISTORIAL + MAPA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* HISTORIAL DE RUTAS */}
          <div className="bg-white rounded-2xl shadow-sm border border-blue-50 flex flex-col" style={{ maxHeight: '520px' }}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-700">📋 Historial de rutas</h3>
              <p className="text-xs text-gray-400 mt-0.5">Clic en una ruta para ver el track en el mapa</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {routes.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">Sin rutas registradas</p>
                : routes.map((r: any) => {
                  const date = new Date(r.date).toLocaleDateString('es-AR', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
                  })
                  const deliveries = r.deliveries ?? []
                  const done = deliveries.filter((d: any) => d.status !== 'pendiente').length
                  const isSelected = selectedDate === r.date
                  const STATUS_COLOR: Record<string, string> = {
                    en_curso: '#0A5C8A', completada: '#1A7A4A', pendiente: '#E67E22'
                  }
                  return (
                    <button key={r.id}
                      onClick={() => loadTrack(r.date, r.id)}
                      className="w-full text-left p-4 transition-colors flex items-center gap-3"
                      style={{ background: isSelected ? '#EFF6FF' : 'white' }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: STATUS_COLOR[r.status] ?? '#888' }}>
                        {r.status === 'completada' ? '✓' : r.status === 'en_curso' ? '●' : '○'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm capitalize">{date}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {done}/{deliveries.length} entregas · {r.status}
                        </p>
                      </div>
                      {isSelected && <span className="text-blue-500 text-xs font-bold">📍 Viendo</span>}
                    </button>
                  )
                })
              }
            </div>
          </div>

          {/* MAPA CON TRACK */}
          <div className="bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-700">🗺️ Track del día</h3>
              {selectedDate && (
                <span className="text-xs text-gray-400">
                  {new Date(selectedDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
                  {' · '}{trackPoints.length} puntos{kmRecorridos > 0 ? ` · ${kmRecorridos.toFixed(2)} km` : ''}
                </span>
              )}
            </div>
            <div style={{ height: '420px' }}>
              {loadingTrack ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  Cargando track...
                </div>
              ) : (
                <Map
                  mapboxAccessToken={MAPBOX_TOKEN}
                  initialViewState={{ latitude: centerLat, longitude: centerLng, zoom: 13 }}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle="mapbox://styles/mapbox/streets-v12"
                >
                  {segmentos.length > 0 && (
                    <Source id="rep-track" type="geojson" data={{
                      type: 'FeatureCollection',
                      features: segmentos.filter(s => s.coords.length >= 2).map(seg => ({
                        type: 'Feature',
                        properties: { color: ESTADO_COLOR[seg.estado] ?? '#3B82F6' },
                        geometry: { type: 'LineString', coordinates: seg.coords },
                      }))
                    }}>
                      <Layer id="rep-track-line" type="line"
                        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                        paint={{ 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.9 }}
                      />
                    </Source>
                  )}
                  {trackPoints.length > 0 && (
                    <Marker latitude={trackPoints[0].lat} longitude={trackPoints[0].lng}>
                      <div style={{ width: 28, height: 28, borderRadius: 14, background: '#10B981',
                        border: '2px solid white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 14 }}>🟢</div>
                    </Marker>
                  )}
                  {trackPoints.length > 1 && (
                    <Marker latitude={trackPoints[trackPoints.length-1].lat} longitude={trackPoints[trackPoints.length-1].lng}>
                      <div style={{ width: 28, height: 28, borderRadius: 14, background: '#EF4444',
                        border: '2px solid white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 14 }}>🔴</div>
                    </Marker>
                  )}
                </Map>
              )}
            </div>
            {!selectedDate && (
              <div className="px-5 py-3 text-center text-gray-400 text-xs border-t border-gray-100">
                Seleccioná una ruta del historial para ver el recorrido
              </div>
            )}
            {selectedDate && trackPoints.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span style={{ width: 14, height: 4, background: '#16a34a', borderRadius: 2, display: 'inline-block' }} /> Con ruta
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span style={{ width: 14, height: 4, background: '#9ca3af', borderRadius: 2, display: 'inline-block' }} /> Pausada
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span style={{ width: 14, height: 4, background: '#ef4444', borderRadius: 2, display: 'inline-block' }} /> Sin ruta
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}