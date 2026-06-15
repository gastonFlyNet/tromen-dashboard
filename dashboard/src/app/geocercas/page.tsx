'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Map, { Marker, Source, Layer } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import Sidebar from '@/components/Sidebar'

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

function circleGeoJSON(lat: number, lon: number, radiusM: number) {
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

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export default function GeocercasPage() {
  const router  = useRouter()
  const mapRef  = useRef<any>(null)

  const [geofences, setGeofences]       = useState<any[]>([])
  const [alerts, setAlerts]             = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [editing, setEditing]           = useState<any>(null)

  // Modo dibujo
  const [drawMode, setDrawMode]         = useState<'idle'|'circle'|'done'>('idle')
  const [drawCenter, setDrawCenter]     = useState<{lat:number,lon:number}|null>(null)
  const [drawRadius, setDrawRadius]     = useState<number>(0)
  const [drawStep, setDrawStep]         = useState<'center'|'radius'>('center')
  const [mousePos, setMousePos]         = useState<{lat:number,lon:number}|null>(null)

  // Form
  const [form, setForm] = useState({ name: '', type: 'zona_entrega', description: '' })
  const [showForm, setShowForm] = useState(false)

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
    } catch { setError('Error cargando datos') }
    finally { setLoading(false) }
  }

  const handleMapClick = useCallback((e: any) => {
    if (drawMode !== 'circle') return
    const { lng, lat } = e.lngLat

    if (drawStep === 'center') {
      setDrawCenter({ lat, lon: lng })
      setDrawStep('radius')
    } else if (drawStep === 'radius' && drawCenter) {
      const dist = haversineDistance(drawCenter.lat, drawCenter.lon, lat, lng)
      setDrawRadius(Math.round(dist))
      setDrawMode('done')
      setDrawStep('center')
      setShowForm(true)
    }
  }, [drawMode, drawStep, drawCenter])

  const handleMapMove = useCallback((e: any) => {
    if (drawMode !== 'circle' || drawStep !== 'radius') return
    setMousePos({ lat: e.lngLat.lat, lon: e.lngLat.lng })
  }, [drawMode, drawStep])

  const cancelDraw = () => {
    setDrawMode('idle')
    setDrawCenter(null)
    setDrawRadius(0)
    setDrawStep('center')
    setMousePos(null)
    setShowForm(false)
    setEditing(null)
    setForm({ name: '', type: 'zona_entrega', description: '' })
    setError('')
  }

  const handleSave = async () => {
    if (!form.name.trim()) return setError('El nombre es obligatorio')
    if (!drawCenter || drawRadius === 0) return setError('Dibujá la geocerca en el mapa')
    setSaving(true)
    setError('')
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        type: form.type,
        center_lat: drawCenter.lat,
        center_lon: drawCenter.lon,
        radius_meters: drawRadius,
        polygon_coords: JSON.stringify({
          type: 'Circle',
          center: [drawCenter.lon, drawCenter.lat],
          radius: drawRadius,
        }),
        active: true,
      }
      if (editing) {
        await apiFetch(`/api/geofences/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await apiFetch('/api/geofences', { method: 'POST', body: JSON.stringify(body) })
      }
      cancelDraw()
      loadData()
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const startEdit = (g: any) => {
    setEditing(g)
    setDrawCenter({ lat: Number(g.center_lat), lon: Number(g.center_lon) })
    setDrawRadius(Number(g.radius_meters))
    setForm({ name: g.name, type: g.type, description: g.description ?? '' })
    setDrawMode('done')
    setShowForm(true)
  }

  const handleToggle = async (g: any) => {
    try {
      await apiFetch(`/api/geofences/${g.id}`, {
        method: 'PATCH', body: JSON.stringify({ active: !g.active }),
      })
      loadData()
    } catch {}
  }

  // Preview mientras el usuario mueve el mouse
  const previewRadius = drawStep === 'radius' && drawCenter && mousePos
    ? haversineDistance(drawCenter.lat, drawCenter.lon, mousePos.lat, mousePos.lon)
    : 0

  const getTipo = (type: string) => TIPOS.find(t => t.value === type) ?? TIPOS[0]

  return (
    <div style={{ height: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'row' }}>

      <Sidebar />

      <div className="flex flex-col" style={{ flex: 1, height: '100vh', overflow: 'hidden' }}>

      {/* HEADER */}
      <nav className="px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ background: '#151b27', borderBottom: '1px solid #1e2d40' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">📍</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#f1f5f9' }}>Geocercas</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>TROMEN · Catriel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {drawMode === 'idle' && (
            <button onClick={() => { cancelDraw(); setDrawMode('circle') }}
              className="cult-btn bg-green-500 text-white rounded-xl px-4 py-2 text-sm font-bold">
              ✏️ Dibujar geocerca
            </button>
          )}
          {drawMode !== 'idle' && (
            <button onClick={cancelDraw}
              className="cult-btn bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-bold">
              ✕ Cancelar
            </button>
          )}
        </div>
      </nav>

      {/* INSTRUCCIONES */}
      {drawMode === 'circle' && (
        <div className="px-6 py-3 flex-shrink-0"
          style={{ background: drawStep === 'center' ? '#EBF5FB' : '#E8F8F5',
            borderBottom: `2px solid ${drawStep === 'center' ? '#2980B9' : '#1ABC9C'}` }}>
          <p className="text-sm font-semibold" style={{ color: drawStep === 'center' ? '#2980B9' : '#1ABC9C' }}>
            {drawStep === 'center'
              ? '🖱️ Paso 1: Hacé clic en el mapa para marcar el CENTRO de la geocerca'
              : '🖱️ Paso 2: Hacé clic para definir el BORDE (radio) de la geocerca'}
          </p>
        </div>
      )}

      {drawMode === 'done' && !showForm && (
        <div className="px-6 py-3 flex-shrink-0 bg-green-50 border-b-2 border-green-400">
          <p className="text-sm font-semibold text-green-700">
            ✅ Geocerca dibujada — completá el formulario para guardar
          </p>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* MAPA */}
        <div className="flex-1 relative">
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ latitude: -37.8850, longitude: -68.0750, zoom: 11 }}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            onClick={handleMapClick}
            onMouseMove={handleMapMove}
            cursor={drawMode === 'circle' ? 'crosshair' : 'grab'}
          >
            {/* Geocercas guardadas */}
            {geofences.filter(g => g.center_lat && g.center_lon).map(g => {
              const tipo = getTipo(g.type)
              const geoJSON = circleGeoJSON(Number(g.center_lat), Number(g.center_lon), Number(g.radius_meters))
              return (
                <Source key={g.id} id={`geo-${g.id}`} type="geojson" data={geoJSON as any}>
                  <Layer id={`fill-${g.id}`} type="fill"
                    paint={{ 'fill-color': tipo.color, 'fill-opacity': g.active ? 0.15 : 0.05 }} />
                  <Layer id={`line-${g.id}`} type="line"
                    paint={{ 'line-color': tipo.color, 'line-width': 2,
                      'line-opacity': g.active ? 1 : 0.3,
                      'line-dasharray': g.active ? [1] : [4, 4] }} />
                </Source>
              )
            })}

            {/* Labels geocercas */}
            {geofences.filter(g => g.center_lat && g.center_lon && g.active).map(g => {
              const tipo = getTipo(g.type)
              return (
                <Marker key={`label-${g.id}`}
                  latitude={Number(g.center_lat)} longitude={Number(g.center_lon)}>
                  <div className="px-2 py-1 rounded-full text-white text-xs font-bold shadow-lg pointer-events-none"
                    style={{ background: tipo.color }}>
                    {g.name}
                  </div>
                </Marker>
              )
            })}

            {/* Preview mientras dibuja */}
            {drawCenter && drawStep === 'radius' && mousePos && previewRadius > 0 && (
              <Source id="preview" type="geojson"
                data={circleGeoJSON(drawCenter.lat, drawCenter.lon, previewRadius) as any}>
                <Layer id="preview-fill" type="fill"
                  paint={{ 'fill-color': '#27AE60', 'fill-opacity': 0.1 }} />
                <Layer id="preview-line" type="line"
                  paint={{ 'line-color': '#27AE60', 'line-width': 2, 'line-dasharray': [4, 2] }} />
              </Source>
            )}

            {/* Geocerca dibujada confirmada */}
            {drawCenter && drawRadius > 0 && (
              <Source id="drawn" type="geojson"
                data={circleGeoJSON(drawCenter.lat, drawCenter.lon, drawRadius) as any}>
                <Layer id="drawn-fill" type="fill"
                  paint={{ 'fill-color': '#27AE60', 'fill-opacity': 0.2 }} />
                <Layer id="drawn-line" type="line"
                  paint={{ 'line-color': '#27AE60', 'line-width': 3 }} />
              </Source>
            )}

            {/* Centro marcado */}
            {drawCenter && (
              <Marker latitude={drawCenter.lat} longitude={drawCenter.lon}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: '#27AE60',
                  border: '3px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
              </Marker>
            )}

            {/* Alertas GPS */}
            {alerts.slice(0, 10).map((a: any) => (
              <Marker key={`alert-${a.id}`}
                latitude={Number(a.latitude)} longitude={Number(a.longitude)}>
                <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg animate-pulse" />
              </Marker>
            ))}
          </Map>

          {/* Info radio en tiempo real */}
          {drawStep === 'radius' && previewRadius > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-full px-4 py-2 shadow-lg text-sm font-bold text-gray-700">
              Radio: {previewRadius >= 1000
                ? `${(previewRadius/1000).toFixed(1)} km`
                : `${Math.round(previewRadius)} m`}
            </div>
          )}
        </div>

        {/* PANEL LATERAL */}
        <div className="w-80 bg-white border-l border-gray-100 flex flex-col overflow-hidden">

          {/* Formulario al dibujar */}
          {showForm && (
            <div className="p-4 border-b border-gray-100 bg-green-50">
              <h3 className="font-bold text-gray-800 mb-3">
                {editing ? 'Editar geocerca' : 'Nueva geocerca'}
              </h3>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-2 text-red-600 text-xs mb-3">{error}</div>
              )}
              {drawCenter && drawRadius > 0 && (
                <div className="bg-white rounded-xl p-3 mb-3 border border-green-200 text-xs text-gray-500">
                  <p>Centro: {drawCenter.lat.toFixed(5)}, {drawCenter.lon.toFixed(5)}</p>
                  <p>Radio: {drawRadius >= 1000 ? `${(drawRadius/1000).toFixed(1)} km` : `${drawRadius} m`}</p>
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Nombre *</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Ej: Zona Norte"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                 
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Descripción</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Opcional"
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={cancelDraw}
                    className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-semibold text-gray-600">
                    Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl py-2 text-sm font-bold">
                    {saving ? '...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de geocercas */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-wide">
              Geocercas ({geofences.length})
            </h3>
            {loading ? (
              <p className="text-gray-400 text-sm text-center py-8">Cargando...</p>
            ) : geofences.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">📍</p>
                <p className="text-gray-400 text-sm">Sin geocercas</p>
                <p className="text-gray-300 text-xs mt-1">Hacé clic en "Dibujar geocerca"</p>
              </div>
            ) : geofences.map(g => {
              const tipo = getTipo(g.type)
              return (
                <div key={g.id}
                  className={`cult-card rounded-xl p-3 mb-2 border ${g.active ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: tipo.color }} />
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{g.name}</p>
                        <p className="text-xs text-gray-400">{tipo.label}</p>
                        <p className="text-xs text-gray-400">
                          ⭕ {Number(g.radius_meters) >= 1000
                            ? `${(Number(g.radius_meters)/1000).toFixed(1)} km`
                            : `${Number(g.radius_meters)} m`} radio
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 mt-2">
                   <button onClick={() => startEdit(g)}
                    className="flex-1 text-blue-600 hover:bg-blue-50 rounded-lg py-1 text-xs font-semibold">
                    Editar
                  </button>
                   <button onClick={() => { startEdit(g); setDrawMode('circle'); setDrawStep('center'); setDrawCenter(null); setDrawRadius(0); setShowForm(false); }}
                     className="flex-1 text-green-600 hover:bg-green-50 rounded-lg py-1 text-xs font-semibold">
                     ✏️ Redibujar
                  </button>
                    <button onClick={() => handleToggle(g)}
                      className={`flex-1 rounded-lg py-1 text-xs font-semibold ${g.active ? 'text-red-400 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                      {g.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Alertas recientes */}
          {alerts.length > 0 && (
            <div className="p-4 border-t border-gray-100 bg-red-50">
              <h3 className="font-bold text-red-700 text-sm mb-2">🚨 Alertas recientes</h3>
              {alerts.slice(0, 3).map((a: any) => (
                <div key={a.id} className="bg-white rounded-xl p-2 mb-1 border border-red-100">
                  <p className="font-semibold text-gray-800 text-xs">{a.repartidor}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(a.occurred_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} — Fuera de zona
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
