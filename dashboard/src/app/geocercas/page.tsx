'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Map, { Marker, Source, Layer, MapMouseEvent } from 'react-map-gl'
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

const TIPOS = [
  { value: 'zona_entrega', label: 'Zona de entrega', color: '#0A5C8A' },
  { value: 'deposito',     label: 'Depósito',        color: '#1A7A4A' },
  { value: 'restringida',  label: 'Zona restringida', color: '#C0392B' },
]

export default function GeocercasPage() {
  const router = useRouter()
  const [geofences, setGeofences]     = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<any>(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [alerts, setAlerts]           = useState<any[]>([])
  const [form, setForm] = useState({
    name: '', description: '', type: 'zona_entrega',
    center_lat: '-37.8850', center_lon: '-68.0750', radius_meters: '5000',
  })

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [geo, alt] = await Promise.all([
        apiFetch('/api/geofences'),
        apiFetch('/api/gps/geofence-alerts').catch(() => []),
      ])
      setGeofences(Array.isArray(geo) ? geo : [])
      setAlerts(Array.isArray(alt) ? alt : [])
    } catch { setError('No se pudieron cargar las geocercas') }
    finally { setLoading(false) }
  }

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', description: '', type: 'zona_entrega',
      center_lat: '-37.8850', center_lon: '-68.0750', radius_meters: '5000' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (g: any) => {
    setEditing(g)
    setForm({
      name: g.name ?? '', description: g.description ?? '',
      type: g.type ?? 'zona_entrega',
      center_lat: String(g.center_lat ?? '-37.8850'),
      center_lon: String(g.center_lon ?? '-68.0750'),
      radius_meters: String(g.radius_meters ?? '5000'),
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return setError('El nombre es obligatorio')
    setSaving(true)
    setError('')
    try {
      const lat = parseFloat(form.center_lat)
      const lon = parseFloat(form.center_lon)
      const radius = parseInt(form.radius_meters)
      const body = {
        name: form.name,
        description: form.description || null,
        type: form.type,
        center_lat: lat,
        center_lon: lon,
        radius_meters: radius,
        polygon_coords: JSON.stringify({
          type: 'Circle',
          center: [lon, lat],
          radius: radius,
        }),
        active: true,
      }
      if (editing) {
        await apiFetch(`/api/geofences/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await apiFetch('/api/geofences', { method: 'POST', body: JSON.stringify(body) })
      }
      setShowModal(false)
      loadData()
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleToggle = async (g: any) => {
    try {
      await apiFetch(`/api/geofences/${g.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !g.active }),
      })
      loadData()
    } catch { setError('No se pudo actualizar') }
  }

  const getTipo = (type: string) => TIPOS.find(t => t.value === type) ?? TIPOS[0]

  // Generar círculo aproximado como GeoJSON
  const circleGeoJSON = (lat: number, lon: number, radiusM: number) => {
    const points = 64
    const coords = []
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI
      const dx = (radiusM / 111320) * Math.cos(angle)
      const dy = (radiusM / (111320 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle)
      coords.push([lon + dy, lat + dx])
    }
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }
  }

  return (
    <div className="min-h-screen" style={{ background: '#F0F7FC' }}>

      {/* NAVBAR */}
      <nav className="text-white px-6 py-4 flex items-center justify-between shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="text-blue-200 hover:text-white text-sm mr-2">← Volver</button>
          <span className="text-2xl">📍</span>
          <div>
            <h1 className="font-bold text-lg">Geocercas</h1>
            <p className="text-blue-200 text-xs">TROMEN · Catriel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData}
            className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all">
            ↻ Actualizar
          </button>
          <button onClick={openNew}
            className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-bold transition-all">
            + Nueva geocerca
          </button>
        </div>
      </nav>

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

        {/* ALERTAS RECIENTES */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <h3 className="font-bold text-red-700 mb-3 flex items-center gap-2">
              <span>🚨</span> Alertas recientes de salida de zona
            </h3>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-red-100">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{a.repartidor}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.occurred_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-600 font-semibold">Fuera de zona</p>
                    <p className="text-xs text-gray-400">
                      {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* MAPA */}
          <div className="bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-700">🗺️ Mapa de geocercas</h3>
            </div>
            <div style={{ height: '450px' }}>
              <Map
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{ latitude: -37.8850, longitude: -68.0750, zoom: 11 }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/streets-v12"
              >
                {geofences.filter(g => g.active && g.center_lat && g.center_lon).map(g => {
                  const tipo = getTipo(g.type)
                  const geoJSON = circleGeoJSON(
                    Number(g.center_lat), Number(g.center_lon), Number(g.radius_meters)
                  )
                  return (
                    <Source key={g.id} id={g.id} type="geojson" data={geoJSON as any}>
                      <Layer id={`fill-${g.id}`} type="fill"
                        paint={{ 'fill-color': tipo.color, 'fill-opacity': 0.15 }} />
                      <Layer id={`outline-${g.id}`} type="line"
                        paint={{ 'line-color': tipo.color, 'line-width': 2, 'line-dasharray': [2, 2] }} />
                    </Source>
                  )
                })}
                {geofences.filter(g => g.active && g.center_lat && g.center_lon).map(g => {
                  const tipo = getTipo(g.type)
                  return (
                    <Marker key={`m-${g.id}`}
                      latitude={Number(g.center_lat)} longitude={Number(g.center_lon)}>
                      <div className="px-2 py-1 rounded-full text-white text-xs font-bold shadow-lg"
                        style={{ background: tipo.color }}>
                        {g.name}
                      </div>
                    </Marker>
                  )
                })}
                {alerts.slice(0, 10).map((a: any) => (
                  <Marker key={`alert-${a.id}`}
                    latitude={Number(a.latitude)} longitude={Number(a.longitude)}>
                    <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg animate-pulse" />
                  </Marker>
                ))}
              </Map>
            </div>
          </div>

          {/* LISTA */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-700 px-1">📋 Geocercas configuradas</h3>
            {loading ? (
              <div className="text-center py-10 text-gray-400">Cargando...</div>
            ) : geofences.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-blue-50">
                <p className="text-3xl mb-3">📍</p>
                <p className="text-gray-400">No hay geocercas configuradas</p>
                <button onClick={openNew}
                  className="mt-4 bg-blue-600 text-white rounded-xl px-6 py-2 text-sm font-bold">
                  + Crear primera geocerca
                </button>
              </div>
            ) : geofences.map(g => {
              const tipo = getTipo(g.type)
              return (
                <div key={g.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${g.active ? 'border-blue-50' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                        style={{ background: tipo.color }} />
                      <div>
                        <p className="font-bold text-gray-800">{g.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{tipo.label}</p>
                        {g.description && (
                          <p className="text-xs text-gray-400">{g.description}</p>
                        )}
                        <div className="flex gap-3 mt-2 text-xs text-gray-500">
                          <span>📍 {Number(g.center_lat).toFixed(4)}, {Number(g.center_lon).toFixed(4)}</span>
                          <span>⭕ {Number(g.radius_meters).toLocaleString()}m radio</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => openEdit(g)}
                        className="text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-1.5 text-sm font-semibold">
                        Editar
                      </button>
                      <button onClick={() => handleToggle(g)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${g.active ? 'text-red-400 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                        {g.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-800">
                {editing ? 'Editar geocerca' : 'Nueva geocerca'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Nombre *</label>
                <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Ej: Perímetro Catriel"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Tipo</label>
                <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Descripción (opcional)</label>
                <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Descripción de la zona"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Latitud centro</label>
                  <input type="number" step="0.0001"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="-37.8850"
                    value={form.center_lat} onChange={e => setForm(f => ({ ...f, center_lat: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Longitud centro</label>
                  <input type="number" step="0.0001"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="-68.0750"
                    value={form.center_lon} onChange={e => setForm(f => ({ ...f, center_lon: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Radio en metros</label>
                <input type="number"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="5000"
                  value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">
                  {form.radius_meters ? `${(parseInt(form.radius_meters)/1000).toFixed(1)} km de radio` : ''}
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-600 font-semibold">💡 Tip para obtener coordenadas</p>
                <p className="text-xs text-blue-500 mt-1">
                  En Google Maps, hacé clic derecho sobre el centro de la zona y copiá las coordenadas.
                </p>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-bold">
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear geocerca'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
