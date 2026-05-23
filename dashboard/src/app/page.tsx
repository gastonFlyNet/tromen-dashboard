'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Map, { Marker, Source, Layer } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { dashboardApi, gpsApi, routesApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

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
  en_curso:   '#0A5C8A',
  completada: '#1A7A4A',
  pendiente:  '#E67E22',
  cancelada:  '#C0392B',
}

const STATUS_LABEL: Record<string, string> = {
  en_curso:   'En curso',
  completada: 'Completada',
  pendiente:  'Pendiente',
  cancelada:  'Cancelada',
}

// ── COMPONENTE STAT CARD ──────────────────────────────────────
function StatCard({ label, value, sub, color, emoji }: {
  label: string; value: string | number; sub?: string
  color?: string; emoji: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: color ?? '#0A5C8A' }}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <span className="text-3xl">{emoji}</span>
      </div>
    </div>
  )
}

// ── COMPONENTE BADGE REPARTIDOR ───────────────────────────────
function RepBadge({ name, status }: { name: string; status: string }) {
  const color = STATUS_COLOR[status] ?? '#888'
  const label = STATUS_LABEL[status] ?? status
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: color + '18', color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
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
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [selectedRep, setSelectedRep] = useState<string | null>(null)
  const [activeTab, setActiveTab]   = useState<'rutas' | 'cobros' | 'clientes'>('rutas')
  const intervalRef = useRef<NodeJS.Timeout>()

  // Auth check
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
      setPositions(todayRes.data.live_positions ?? posRes.data ?? [])
      setAlerts(alertsRes.data)
      setLastUpdate(new Date())
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
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="text-center">
        <span className="text-6xl">💧</span>
        <p className="text-gray-500 mt-4 font-medium">Cargando panel TROMEN...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F0F7FC' }}>

      {/* ── NAVBAR ── */}
      <nav className="text-white px-6 py-4 flex items-center justify-between shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">💧</span>
          <div>
            <h1 className="font-bold text-lg tracking-wider">TROMEN</h1>
            <p className="text-blue-200 text-xs">Panel Administrativo · Catriel</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-blue-200 text-xs capitalize">{user?.role}</p>
          </div>
          <p className="text-blue-200 text-xs hidden md:block">
            Actualizado {formatDistanceToNow(lastUpdate, { locale: es, addSuffix: true })}
          </p>
          <button onClick={() => router.push('/clientes')}
           className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all">
           👥 Clientes
</button>
          <button onClick={() => router.push('/rutas/nueva')}
           className="bg-green-500 hover:bg-green-600 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all">
            + Nueva ruta
            <button onClick={() => router.push('/productos')}
  className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all">
  🛒 Productos
</button>
</button>
          <button onClick={loadData}
            className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all">
            ↻ Actualizar
          </button>
          <button onClick={handleLogout}
            className="bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm transition-all">
            Salir
          </button>
        </div>
      </nav>

      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-screen-2xl mx-auto w-full">

        {/* ── ALERTAS ── */}
        {alerts && (alerts.overdue_clients > 0 || alerts.stopped_routes > 0 || alerts.pending_closings > 0) && (
          <div className="flex flex-wrap gap-3">
            {alerts.overdue_clients > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 flex items-center gap-2">
                <span>⚠️</span>
                <span className="text-orange-700 text-sm font-semibold">
                  {alerts.overdue_clients} cliente{alerts.overdue_clients > 1 ? 's' : ''} con saldo vencido
                </span>
              </div>
            )}
            {alerts.stopped_routes > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 flex items-center gap-2">
                <span>🚨</span>
                <span className="text-red-700 text-sm font-semibold">
                  {alerts.stopped_routes} repartidor{alerts.stopped_routes > 1 ? 'es' : ''} sin movimiento
                </span>
              </div>
            )}
            {alerts.pending_closings > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 flex items-center gap-2">
                <span>💰</span>
                <span className="text-yellow-700 text-sm font-semibold">
                  {alerts.pending_closings} cierre{alerts.pending_closings > 1 ? 's' : ''} con diferencia
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── STATS CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            emoji="🚚" label="Rutas activas"
            value={summary?.routes_active ?? 0}
            sub={`${summary?.total_routes ?? 0} total hoy`}
          />
          <StatCard
            emoji="💧" label="Entregas"
            value={`${summary?.completed_stops ?? 0}/${summary?.total_stops ?? 0}`}
            sub={`${pct}% completado`}
            color="#1A7A4A"
          />
          <StatCard
            emoji="💰" label="Total cobrado"
            value={`$${Number(summary?.total_collected ?? 0).toLocaleString('es-AR')}`}
            sub={`de $${Number(summary?.total_expected ?? 0).toLocaleString('es-AR')} esperado`}
            color="#0A5C8A"
          />
          <StatCard
            emoji="✅" label="Rutas completadas"
            value={summary?.routes_done ?? 0}
            sub={`${summary?.routes_pending ?? 0} pendientes`}
            color="#1A7A4A"
          />
        </div>

        {/* ── BARRA PROGRESO GENERAL ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-gray-700">Progreso general del día</h3>
            <span className="text-2xl font-bold" style={{ color: '#0A5C8A' }}>{pct}%</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-4 rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0A5C8A, #1A8FBF)' }} />
          </div>
          <div className="flex gap-4 mt-3 flex-wrap">
            {repartidores.map(r => (
              <RepBadge key={r.user_id} name={r.repartidor} status={r.route_status} />
            ))}
          </div>
        </div>

        {/* ── MAPA + TABLA ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* MAPA */}
          <div className="bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-700">🗺️ Posición en tiempo real</h3>
              <span className="text-xs text-gray-400">
                {positions.length} repartidor{positions.length !== 1 ? 'es' : ''} activo{positions.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ height: '400px' }}>
              <Map
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                  latitude: -37.879,
                  longitude: -67.799,
                  zoom: 12,
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/streets-v12"
              >
                {positions.map((pos) => (
                  <Marker
                    key={pos.user_id}
                    latitude={Number(pos.latitude)}
                    longitude={Number(pos.longitude)}
                    onClick={() => setSelectedRep(
                      selectedRep === pos.user_id ? null : pos.user_id
                    )}
                  >
                    <div className="relative cursor-pointer">
                      <div className="w-10 h-10 rounded-full border-3 border-white shadow-lg flex items-center justify-center text-white text-sm font-bold"
                        style={{
                          background: STATUS_COLOR[pos.route_status] ?? '#888',
                          border: '3px solid white',
                        }}>
                        {pos.repartidor.charAt(0).toUpperCase()}
                      </div>
                      {selectedRep === pos.user_id && (
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl p-3 w-48 z-10 border border-blue-100">
                          <p className="font-bold text-gray-800 text-sm">{pos.repartidor}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {STATUS_LABEL[pos.route_status] ?? pos.route_status}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Velocidad: {Number(pos.speed ?? 0).toFixed(0)} km/h
                          </p>
                          <p className="text-xs text-gray-400">
                            {pos.recorded_at
                              ? formatDistanceToNow(new Date(pos.recorded_at), { locale: es, addSuffix: true })
                              : '—'}
                          </p>
                        </div>
                      )}
                    </div>
                  </Marker>
                ))}
              </Map>
            </div>
            {positions.length === 0 && (
              <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                Sin posiciones GPS registradas hoy
              </div>
            )}
          </div>

          {/* PANEL DERECHO CON TABS */}
          <div className="bg-white rounded-2xl shadow-sm border border-blue-50 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              {(['rutas', 'cobros', 'clientes'] as const).map(tab => (
                <button key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3 text-sm font-semibold transition-all capitalize"
                  style={{
                    color: activeTab === tab ? '#0A5C8A' : '#aaa',
                    borderBottom: activeTab === tab ? '2px solid #0A5C8A' : '2px solid transparent',
                  }}>
                  {tab === 'rutas' ? '🚚 Rutas' : tab === 'cobros' ? '💰 Cobros' : '👥 Clientes'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto" style={{ maxHeight: '380px' }}>

              {/* TAB RUTAS */}
              {activeTab === 'rutas' && (
                <div className="divide-y divide-gray-50">
                  {repartidores.length === 0
                    ? <p className="text-center text-gray-400 py-12 text-sm">Sin rutas activas hoy</p>
                    : repartidores.map(r => (
                     <div key={r.user_id} className="p-4 hover:bg-blue-50/50 transition-colors cursor-pointer"
  onClick={() => router.push(`/rutas/${r.route_id}`)}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-gray-800">{r.repartidor}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="w-2 h-2 rounded-full"
                                style={{ background: STATUS_COLOR[r.route_status] ?? '#888' }} />
                              <span className="text-xs text-gray-500">
                                {STATUS_LABEL[r.route_status] ?? r.route_status}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-700">
                              ${Number(r.total_collected ?? 0).toLocaleString('es-AR')}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">cobrado</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{r.delivered ?? 0}/{r.total_deliveries ?? 0} entregas</span>
                            <span>
                              {r.total_deliveries > 0
                                ? Math.round(((r.delivered ?? 0) / r.total_deliveries) * 100)
                                : 0}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full"
                              style={{
                                width: `${r.total_deliveries > 0
                                  ? Math.round(((r.delivered ?? 0) / r.total_deliveries) * 100)
                                  : 0}%`,
                                background: STATUS_COLOR[r.route_status] ?? '#888',
                              }} />
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* TAB COBROS */}
              {activeTab === 'cobros' && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['💵', 'Efectivo', repartidores.reduce((s, r) => s + Number(r.cash_total ?? 0), 0), '#27AE60'],
                      ['🏦', 'Transferencia', repartidores.reduce((s, r) => s + Number(r.transfer_total ?? 0), 0), '#2980B9'],
                      ['📒', 'Fiado', repartidores.reduce((s, r) => s + Number(r.credit_total ?? 0), 0), '#E67E22'],
                    ].map(([e, l, v, c]) => (
                      <div key={l as string} className="rounded-xl p-3 text-center"
                        style={{ background: (c as string) + '12' }}>
                        <p className="text-xl">{e as string}</p>
                        <p className="text-xs text-gray-500 mt-1">{l as string}</p>
                        <p className="font-bold mt-1" style={{ color: c as string }}>
                          ${Number(v).toLocaleString('es-AR')}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {repartidores.map(r => (
                      <div key={r.user_id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{r.repartidor}</p>
                          <p className="text-xs text-gray-400">
                            {r.delivered ?? 0} entregas cobradas
                          </p>
                        </div>
                        <p className="font-bold text-blue-700">
                          ${Number(r.total_collected ?? 0).toLocaleString('es-AR')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB CLIENTES */}
              {activeTab === 'clientes' && (
                <ClientBalances />
              )}
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="text-center text-gray-400 text-xs pb-4">
          BYF Soluciones · TROMEN · Panel Administrativo · Se actualiza cada 30 segundos
        </div>
      </div>
    </div>
  )
}

// ── COMPONENTE SALDOS CLIENTES ────────────────────────────────
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

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="text-gray-400 text-sm">Cargando saldos...</div>
    </div>
  )

  const withBalance = clients.filter(c => Number(c.current_balance) > 0)

  return (
    <div className="divide-y divide-gray-50">
      {withBalance.length === 0
        ? <p className="text-center text-gray-400 py-12 text-sm">Sin saldos pendientes 🎉</p>
        : withBalance.map(c => (
          <div key={c.id} className="p-4 hover:bg-orange-50/50 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-gray-800 text-sm">{c.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.zone}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-orange-600">
                  ${Number(c.current_balance).toLocaleString('es-AR')}
                </p>
                <p className="text-xs text-gray-400">saldo deudor</p>
              </div>
            </div>
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-1.5 bg-orange-400 rounded-full"
                  style={{
                    width: `${Math.min(100, (Number(c.current_balance) / Number(c.credit_limit)) * 100)}%`
                  }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Límite: ${Number(c.credit_limit).toLocaleString('es-AR')} ·
                Disponible: ${Number(c.available_credit).toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        ))
      }
    </div>
  )
}
