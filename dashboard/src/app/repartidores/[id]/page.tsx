'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Map, { Marker, Source, Layer } from 'react-map-gl'
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
  const [trackPoints, setTrackPoints] = useState<{lat: number, lng: number}[]>([])
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

  const loadTrack = async (date: string, routeId: string) => {
    setSelectedDate(date)
    setTrackPoints([])
    setLoadingTrack(true)
    try {
      const gps = await apiFetch(`/api/gps/track/${routeId}`)
      const pts = Array.isArray(gps) ? gps : gps.points ?? []
      setTrackPoints(pts.map((p: any) => ({ lat: p.latitude, lng: p.longitude })))
    } catch {} finally { setLoadingTrack(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="text-center">
        <span className="text-5xl">💧</span>
        <p className="text-gray-400 mt-3">Cargando repartidor...</p>
      </div>
    </div>
  )

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <p className="text-gray-500">Repartidor no encontrado</p>
    </div>
  )

  const centerLat = trackPoints.length > 0 ? trackPoints[Math.floor(trackPoints.length / 2)].lat : -37.879
  const centerLng = trackPoints.length > 0 ? trackPoints[Math.floor(trackPoints.length / 2)].lng : -67.799

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
            <h1 className="font-bold text-lg">{user.name}</h1>
            <p className="text-blue-200 text-xs capitalize">{user.role}</p>
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
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
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
                  {new Date(selectedDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                  {' · '}{trackPoints.length} puntos GPS
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
                  {trackPoints.length >= 2 && (
                    <Source id="rep-track" type="geojson" data={{
                      type: 'Feature',
                      geometry: {
                        type: 'LineString',
                        coordinates: trackPoints.map(p => [p.lng, p.lat])
                      }
                    }}>
                      <Layer id="rep-track-line" type="line"
                        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                        paint={{ 'line-color': '#3B82F6', 'line-width': 4, 'line-opacity': 0.85 }}
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
          </div>
        </div>
      </div>
    </div>
  )
}