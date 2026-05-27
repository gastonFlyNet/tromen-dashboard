'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Map, { Marker, Source, Layer } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { dashboardApi, gpsApi, routesApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { getRepColor } from '@/lib/repColors'
import {
  Truck, Droplets, CircleDollarSign, CheckCircle2,
  MapPin, Users, RefreshCw, LogOut, Plus, ShoppingCart,
  Package, AlertTriangle, TrendingUp
} from 'lucide-react'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tromen-backend-production.up.railway.app'

// ── PALETA UNIFICADA ──────────────────────────────────────────
const C = {
  navy:    '#1A2E4A',
  accent:  '#2D7DD2',
  green:   '#27AE60',
  red:     '#C0392B',
  orange:  '#E67E22',
  bg:      '#F5F6FA',
  white:   '#FFFFFF',
  text:    '#1A1A1A',
  textSub: '#555555',
}

// ── TIPOS ─────────────────────────────────────────────────────
interface Summary {
  total_routes: number
  routes_active: number
  routes_done: number
  routes_pending: number
  total_stops: number
  completed_stops: number
  total_collected: number
  total_expected: number
}

interface Repartidor {
  user_id: string
  repartidor: string
  email?: string
  route_status: string
  route_id: string
  total_deliveries: number
  delivered: number
  not_delivered: number
  total_collected: number
  cash_total: number
  transfer_total: number
  credit_total: number
}

interface Position {
  user_id: string
  repartidor: string
  latitude: number
  longitude: number
  speed: number
  recorded_at: string
  route_status: string
}

interface Alert {
  overdue_clients: number
  stopped_routes: number
  pending_closings: number
}

// ── COLORES POR ESTADO ────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  en_curso:   C.accent,
  completada: C.green,
  pendiente:  C.orange,
  cancelada:  C.red,
  pausada:    C.orange,
}

const STATUS_LABEL: Record<string, string> = {
  en_curso:   'En curso',
  completada: 'Completada',
  pendiente:  'Pendiente',
  cancelada:  'Cancelada',
  pausada:    'Pausada',
}

// ── STAT CARD ─────────────────────────────────────────────────
function StatCard({ label, value, sub, highlight, icon }: {
  label: string; value: string | number; sub?: string
  highlight?: boolean; icon: React.ReactNode
}) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 12,
      padding: '20px 20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      borderTop: highlight ? `3px solid ${C.accent}` : `3px solid transparent`,
      border: `1px solid #EEEEEE`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.textSub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</p>
          <p style={{ fontSize: highlight ? 32 : 28, fontWeight: 700, color: highlight ? C.navy : '#333333', lineHeight: 1, marginBottom: 4 }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{sub}</p>}
        </div>
        <div style={{ color: highlight ? C.accent : C.textSub, marginTop: 2 }}>{icon}</div>
      </div>
    </div>
  )
}

// ── BADGE REPARTIDOR ──────────────────────────────────────────
function RepBadge({ name, status }: { name: string; status: string }) {
  const color = STATUS_COLOR[status] ?? '#888'
  const label = STATUS_LABEL[status] ?? status
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600,
      background: color + '18', color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {name} — {label}
    </span>
  )
}

// ── DASHBOARD PRINCIPAL ───────────────────────────────────────
export default function Dashboard() {
  const router  = useRouter()
  const [user, setUser]             = useState<any>(null)
  const [summary, setSummary]       = useState<Summary | null>(null)
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [positions, setPositions]   = useState<Position[]>([])
  const [alerts, setAlerts]         = useState<Alert | null>(null)
  const [geofenceAlerts, setGeofenceAlerts] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [selectedRep, setSelectedRep] = useState<string | null>(null)
  const [activeTab, setActiveTab]   = useState<'rutas' | 'cobros' | 'clientes'>('rutas')
  const [tracks, setTracks]         = useState<Record<string, {lat: number, lng: number, timestamp: string}[]>>({})
  const [showTracks, setShowTracks] = useState(true)
  const [pauses, setPauses]         = useState<any[]>([])
  const [selectedPauseRoute, setSelectedPauseRoute] = useState<string | null>(null)
  const mapRef = useRef<any>(null)
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    setUser(JSON.parse(u))
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [todayRes, alertsRes, posRes] = await Promise.all([
        dashboardApi.today(),
        dashboardApi.alerts(),
        gpsApi.live(),
      ])
      setSummary(todayRes.data.summary)
      setRepartidores(todayRes.data.by_repartidor ?? [])
      const livePosData = Array.isArray(posRes.data) ? posRes.data : (posRes.data?.positions ?? [])
setPositions(todayRes.data.live_positions ?? livePosData ?? [])
      setAlerts(alertsRes.data)
      setLastUpdate(new Date())
      const geoRes = await gpsApi.geofenceAlerts().catch(() => ({ data: [] }))
      setGeofenceAlerts(geoRes.data ?? [])
      const tracksRes = await fetch(`${API_URL}/api/gps/tracks-today`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('tromen_token')}` }
      }).then(r => r.json()).catch(() => ({ tracks: {} }))
      setTracks(tracksRes.tracks ?? {})
      const pausesRes = await fetch(`${API_URL}/api/routes/pauses/today`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('tromen_token')}` }
      }).then(r => r.json()).catch(() => [])
      setPauses(Array.isArray(pausesRes) ? pausesRes : [])
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadData()
    intervalRef.current = setInterval(loadData, 30000)
    return () => clearInterval(intervalRef.current)
  }, [loadData])

  const handleLogout = () => {
    localStorage.clear()
    router.push('/login')
  }

  const pct = summary && summary.total_stops > 0
    ? Math.round((summary.completed_stops / summary.total_stops) * 100)
    : 0

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(160deg, #063D5E 0%, ${C.navy} 50%, ${C.accent} 100%)` }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 24, padding: '0 20px' }}>
          <img src="/tromen-bidon.png" alt="TROMEN"
            style={{ height: 320, objectFit: 'contain', filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))', position: 'relative', zIndex: 2, display: 'block' }} />
          <div style={{ position: 'absolute', bottom: 18, left: '22%', right: '22%', height: '55%', zIndex: 1, overflow: 'hidden', borderRadius: '4px 4px 30px 30px' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: `linear-gradient(180deg, rgba(125,211,248,0.6), rgba(10,92,138,0.7))`, animation: 'fillWater 2.5s ease-in-out infinite alternate', borderRadius: '40% 40% 0 0' }} />
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>Cargando panel administrativo...</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.6)', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes fillWater { 0% { height: 15%; } 100% { height: 80%; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-8px); opacity: 1; } }
      `}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: 'Inter, sans-serif' }}>

      {/* ── NAVBAR ── */}
      <nav style={{ background: C.navy, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/tromen-logo.png" alt="TROMEN" style={{ height: 100, objectFit: 'contain', filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.5)) brightness(1.1)' }} />
          <div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: '0.05em' }}>Panel Administrativo · Catriel</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ textAlign: 'right', marginRight: 8 }}>
            <p style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{user?.name}</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'capitalize' }}>{user?.role}</p>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginRight: 8 }}>
            {formatDistanceToNow(lastUpdate, { locale: es, addSuffix: true })}
          </p>
          {[
            { label: 'Clientes', icon: <Users size={14} />, path: '/clientes' },
            { label: 'Productos', icon: <ShoppingCart size={14} />, path: '/productos' },
            { label: 'Geocercas', icon: <MapPin size={14} />, path: '/geocercas' },
            { label: 'Stock', icon: <Package size={14} />, path: '/stock' },
          ].map(btn => (
            <button key={btn.path} onClick={() => router.push(btn.path)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {btn.icon}{btn.label}
            </button>
          ))}
          <button onClick={() => router.push('/rutas/nueva')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.green, border: 'none', color: 'white', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={14} /> Nueva ruta
          </button>
          <button onClick={loadData}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            <LogOut size={14} /> Salir
          </button>
        </div>
      </nav>

      <div style={{ flex: 1, padding: '24px', maxWidth: 1600, margin: '0 auto', width: '100%' }}>

        {/* ALERTA GEOCERCA */}
        {geofenceAlerts.length > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={16} color={C.red} />
            <span style={{ color: C.red, fontSize: 13, fontWeight: 600 }}>
              {geofenceAlerts.length} repartidor{geofenceAlerts.length > 1 ? 'es' : ''} fuera de zona — {geofenceAlerts.map((a: any) => a.repartidor).join(', ')}
            </span>
          </div>
        )}

        {/* ALERTAS */}
        {alerts && (alerts.overdue_clients > 0 || alerts.stopped_routes > 0 || alerts.pending_closings > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            {alerts.overdue_clients > 0 && (
              <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} color={C.orange} />
                <span style={{ color: C.orange, fontSize: 13, fontWeight: 600 }}>{alerts.overdue_clients} cliente{alerts.overdue_clients > 1 ? 's' : ''} con saldo vencido</span>
              </div>
            )}
            {alerts.stopped_routes > 0 && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} color={C.red} />
                <span style={{ color: C.red, fontSize: 13, fontWeight: 600 }}>{alerts.stopped_routes} repartidor{alerts.stopped_routes > 1 ? 'es' : ''} sin movimiento</span>
              </div>
            )}
            {alerts.pending_closings > 0 && (
              <div style={{ background: '#FEFCE8', border: '1px solid #FEF08A', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} color="#CA8A04" />
                <span style={{ color: '#CA8A04', fontSize: 13, fontWeight: 600 }}>{alerts.pending_closings} cierre{alerts.pending_closings > 1 ? 's' : ''} con diferencia</span>
              </div>
            )}
          </div>
        )}

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard icon={<Truck size={22} />} label="Rutas activas" value={summary?.routes_active ?? 0} sub={`${summary?.total_routes ?? 0} total hoy`} />
          <StatCard icon={<Droplets size={22} />} label="Entregas" value={`${summary?.completed_stops ?? 0}/${summary?.total_stops ?? 0}`} sub={`${pct}% completado`} />
          <StatCard icon={<CircleDollarSign size={22} />} label="Total cobrado" value={`$${Number(summary?.total_collected ?? 0).toLocaleString('es-AR')}`} sub={`de $${Number(summary?.total_expected ?? 0).toLocaleString('es-AR')} esperado`} highlight />
          <StatCard icon={<CheckCircle2 size={22} />} label="Rutas completadas" value={summary?.routes_done ?? 0} sub={`${summary?.routes_pending ?? 0} pendientes`} />
        </div>

        {/* BARRA PROGRESO */}
        <div style={{ background: C.white, borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #EEEEEE', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>Progreso general del día</h3>
            <span style={{ fontSize: 24, fontWeight: 700, color: C.navy }}>{pct}%</span>
          </div>
          <div style={{ height: 10, background: '#EEEEEE', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ height: 10, borderRadius: 100, width: `${pct}%`, background: `linear-gradient(90deg, ${C.navy}, ${C.accent})`, transition: 'width 0.7s' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {repartidores.map(r => <RepBadge key={r.user_id} name={r.repartidor} status={r.route_status} />)}
          </div>
        </div>

        {/* MAPA + TABLA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* MAPA */}
          <div style={{ background: C.white, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #EEEEEE', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #EEEEEE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: 700, color: C.text, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={16} color={C.accent} /> Posición en tiempo real
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setShowTracks(t => !t)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 100, fontWeight: 600, border: 'none', cursor: 'pointer', background: showTracks ? C.navy : '#e5e7eb', color: showTracks ? 'white' : '#6b7280' }}>
                  {showTracks ? 'Track ON' : 'Track OFF'}
                </button>
                <span style={{ fontSize: 12, color: C.textSub }}>{positions.length} activo{positions.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div style={{ height: 400, position: 'relative' }}>
              <Map mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{ latitude: -37.879, longitude: -67.799, zoom: 12 }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/streets-v12">
                {positions.map((pos) => (
                  <Marker key={pos.user_id} latitude={Number(pos.latitude)} longitude={Number(pos.longitude)}
                    onClick={() => setSelectedRep(selectedRep === pos.user_id ? null : pos.user_id)}>
                    <div style={{ position: 'relative', cursor: 'pointer' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: STATUS_COLOR[pos.route_status] ?? '#888', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                        {pos.repartidor.charAt(0).toUpperCase()}
                      </div>
                      {selectedRep === pos.user_id && (
                        <div style={{ position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 12, width: 180, zIndex: 10, border: '1px solid #EEEEEE' }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{pos.repartidor}</p>
                          <p style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>{STATUS_LABEL[pos.route_status] ?? pos.route_status}</p>
                          <p style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>{Number(pos.speed ?? 0).toFixed(0)} km/h</p>
                        </div>
                      )}
                    </div>
                  </Marker>
                ))}
                {showTracks && Object.entries(tracks).map(([userId, points]) => {
                  if (points.length < 2) return null
                  const rep = repartidores.find(r => r.user_id === userId)
                  const color = getRepColor(userId, undefined)
                  const coordinates = points.map(p => [p.lng, p.lat])
                  return (
                    <Source key={`track-${userId}`} id={`track-${userId}`} type="geojson" data={{ type: 'Feature', geometry: { type: 'LineString', coordinates } }}>
                      <Layer id={`track-line-${userId}`} type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': color, 'line-width': 3, 'line-opacity': 0.75 }} />
                    </Source>
                  )
                })}
              </Map>
              {showTracks && Object.keys(tracks).length > 0 && (
                <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, background: 'rgba(26,46,74,0.85)', borderRadius: 10, padding: '8px 12px' }}>
                  {Object.keys(tracks).map(userId => {
                    const rep = repartidores.find(r => r.user_id === userId)
                    const color = getRepColor(userId, undefined)
                    return (
                      <div key={userId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ display: 'block', width: 20, height: 3, borderRadius: 2, background: color }} />
                        <span style={{ color: 'white', fontSize: 11, fontWeight: 500 }}>{rep?.repartidor ?? 'Repartidor'}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {positions.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: C.textSub, fontSize: 13, borderTop: '1px solid #EEEEEE' }}>
                Sin posiciones GPS registradas hoy
              </div>
            )}
          </div>

          {/* PANEL TABS */}
          <div style={{ background: C.white, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid #EEEEEE', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #EEEEEE' }}>
              {(['rutas', 'cobros', 'clientes'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ flex: 1, padding: '13px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'transparent', color: activeTab === tab ? C.accent : C.textSub, borderBottom: activeTab === tab ? `2px solid ${C.accent}` : '2px solid transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {tab === 'rutas' ? <><Truck size={14} /> Rutas</> : tab === 'cobros' ? <><CircleDollarSign size={14} /> Cobros</> : <><Users size={14} /> Clientes</>}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380 }}>

              {/* TAB RUTAS */}
              {activeTab === 'rutas' && (
                <div>
                  {repartidores.length === 0
                    ? <p style={{ textAlign: 'center', color: C.textSub, padding: '48px 0', fontSize: 13 }}>Sin rutas activas hoy</p>
                    : repartidores.map(r => (
                      <div key={r.user_id} style={{ padding: '14px 16px', borderBottom: '1px solid #EEEEEE', cursor: 'pointer' }}
                        onClick={() => router.push(`/rutas/${r.route_id}`)}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <p style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{r.repartidor}</p>
                              <button onClick={e => { e.stopPropagation(); router.push(`/repartidores/${r.user_id}`) }}
                                style={{ fontSize: 11, color: C.accent, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                ver perfil →
                              </button>
                              {r.route_status === 'pausada' && (
                                <button onClick={e => { e.stopPropagation(); setSelectedPauseRoute(selectedPauseRoute === r.route_id ? null : r.route_id) }}
                                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, fontWeight: 700, border: 'none', cursor: 'pointer', background: '#FEF3C7', color: '#92400E', animation: 'pulse 2s infinite' }}>
                                  ⏸ Pausada
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[r.route_status] ?? '#888', display: 'inline-block' }} />
                              <span style={{ fontSize: 12, color: C.textSub }}>{STATUS_LABEL[r.route_status] ?? r.route_status}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>${Number(r.total_collected ?? 0).toLocaleString('es-AR')}</p>
                            <p style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>cobrado</p>
                          </div>
                        </div>
                        {selectedPauseRoute === r.route_id && (
                          <div style={{ marginTop: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 12 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>Historial de pausas</p>
                            {pauses.filter(p => p.route_id === r.route_id).length === 0
                              ? <p style={{ fontSize: 11, color: '#B45309' }}>Sin pausas registradas</p>
                              : pauses.filter(p => p.route_id === r.route_id).map(p => (
                                <div key={p.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #FDE68A' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#92400E' }}>{p.resumed_at ? '✅ Reanudada' : '⏸ En pausa'}</span>
                                    <span style={{ fontSize: 11, color: '#B45309' }}>
                                      {new Date(p.paused_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                      {p.resumed_at && ` → ${new Date(p.resumed_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
                                    </span>
                                  </div>
                                  {p.reason && <p style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>Motivo: {p.reason}</p>}
                                  {p.authorized_by_name && <p style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>Autorizado: {p.authorized_by_name}</p>}
                                </div>
                              ))
                            }
                          </div>
                        )}
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textSub, marginBottom: 4 }}>
                            <span>{r.delivered ?? 0}/{r.total_deliveries ?? 0} entregas</span>
                            <span>{r.total_deliveries > 0 ? Math.round(((r.delivered ?? 0) / r.total_deliveries) * 100) : 0}%</span>
                          </div>
                          <div style={{ height: 6, background: '#EEEEEE', borderRadius: 100, overflow: 'hidden' }}>
                            <div style={{ height: 6, borderRadius: 100, background: STATUS_COLOR[r.route_status] ?? '#888', width: `${r.total_deliveries > 0 ? Math.round(((r.delivered ?? 0) / r.total_deliveries) * 100) : 0}%` }} />
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* TAB COBROS */}
              {activeTab === 'cobros' && (
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      ['Efectivo', repartidores.reduce((s, r) => s + Number(r.cash_total ?? 0), 0), C.green],
                      ['Transferencia', repartidores.reduce((s, r) => s + Number(r.transfer_total ?? 0), 0), C.accent],
                      ['Fiado', repartidores.reduce((s, r) => s + Number(r.credit_total ?? 0), 0), C.orange],
                    ].map(([l, v, c]) => (
                      <div key={l as string} style={{ borderRadius: 10, padding: 12, textAlign: 'center', background: (c as string) + '12', border: `1px solid ${c as string}30` }}>
                        <p style={{ fontSize: 11, color: C.textSub, marginBottom: 4 }}>{l as string}</p>
                        <p style={{ fontWeight: 700, color: c as string, fontSize: 15 }}>${Number(v).toLocaleString('es-AR')}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {repartidores.map(r => (
                      <div key={r.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.bg, borderRadius: 10 }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{r.repartidor}</p>
                          <p style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>{r.delivered ?? 0} entregas cobradas</p>
                        </div>
                        <p style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>${Number(r.total_collected ?? 0).toLocaleString('es-AR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'clientes' && <ClientBalances />}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', color: C.textSub, fontSize: 11, paddingTop: 20, paddingBottom: 8 }}>
          BYF Soluciones · TROMEN · Panel Administrativo · Se actualiza cada 30 segundos
        </div>
      </div>
    </div>
  )
}

// ── SALDOS CLIENTES ───────────────────────────────────────────
function ClientBalances() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('@/lib/api').then(({ clientsApi }) => {
      clientsApi.balances()
        .then(({ data }) => setClients(data))
        .catch(() => {})
        .finally(() => setLoading(false))
    })
  }, [])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: '#555', fontSize: 13 }}>Cargando saldos...</div>

  const withBalance = clients.filter(c => Number(c.current_balance) > 0)

  return (
    <div>
      {withBalance.length === 0
        ? <p style={{ textAlign: 'center', color: '#555', padding: '48px 0', fontSize: 13 }}>Sin saldos pendientes 🎉</p>
        : withBalance.map(c => (
          <div key={c.id} style={{ padding: '14px 16px', borderBottom: '1px solid #EEEEEE' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A' }}>{c.name}</p>
                <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{c.zone}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 700, color: '#C0392B', fontSize: 14 }}>${Number(c.current_balance).toLocaleString('es-AR')}</p>
                <p style={{ fontSize: 11, color: '#555', marginTop: 2 }}>saldo deudor</p>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 4, background: '#EEEEEE', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{ height: 4, background: '#E67E22', borderRadius: 100, width: `${Math.min(100, (Number(c.current_balance) / Number(c.credit_limit)) * 100)}%` }} />
              </div>
              <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Límite: ${Number(c.credit_limit).toLocaleString('es-AR')} · Disponible: ${Number(c.available_credit).toLocaleString('es-AR')}</p>
            </div>
          </div>
        ))
      }
    </div>
  )
}
