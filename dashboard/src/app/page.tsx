'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Map, { Marker, Source, Layer } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { dashboardApi, gpsApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
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

// ── TIPOS ─────────────────────────────────────────────────────
interface Summary {
  total_routes: number; routes_active: number; routes_done: number
  routes_pending: number; total_stops: number; completed_stops: number
  total_collected: number; total_expected: number
}
interface Repartidor {
  user_id: string; repartidor: string; route_status: string; route_id: string
  total_deliveries: number; delivered: number; not_delivered: number
  total_collected: number; cash_total: number; transfer_total: number; credit_total: number
}
interface Position {
  user_id: string; repartidor: string; latitude: number; longitude: number
  speed: number; recorded_at: string; route_status: string
}
interface Alert { overdue_clients: number; stopped_routes: number; pending_closings: number }
interface Product { id: string; name: string; price: number }
interface Client { id: string; name: string; address: string; phone: string; balance: number }

// ── PALETA ────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  en_curso: '#0A5C8A', completada: '#1A7A4A', pendiente: '#E67E22', cancelada: '#C0392B',
}
const STATUS_LABEL: Record<string, string> = {
  en_curso: 'En curso', completada: 'Completada', pendiente: 'Pendiente', cancelada: 'Cancelada',
}
const METHODS = [
  { value: 'efectivo',         label: 'Efectivo',      color: '#27AE60' },
  { value: 'transferencia',    label: 'Transferencia', color: '#2980B9' },
  { value: 'cuenta_corriente', label: 'Fiado',         color: '#E67E22' },
  { value: 'mixto',            label: 'Mixto',         color: '#5A7A8A' },
]

// ── STAT CARD ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color, emoji }: {
  label: string; value: string | number; sub?: string; color?: string; emoji: string
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

// ── MODAL VENTA DEPÓSITO ──────────────────────────────────────
function ModalVentaDeposito({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep]                   = useState<'cliente' | 'productos' | 'cobro'>('cliente')
  const [tipoCliente, setTipoCliente]     = useState<'existente' | 'nuevo'>('existente')
  const [clientes, setClientes]           = useState<Client[]>([])
  const [busqCliente, setBusqCliente]     = useState('')
  const [clienteSel, setClienteSel]       = useState<Client | null>(null)
  const [nuevoNombre, setNuevoNombre]     = useState('')
  const [nuevoTel, setNuevoTel]           = useState('')
  const [products, setProducts]           = useState<Product[]>([])
  const [items, setItems]                 = useState<Record<string, number>>({})
  const [method, setMethod]               = useState('')
  const [cash, setCash]                   = useState('')
  const [transfer, setTransfer]           = useState('')
  const [notes, setNotes]                 = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')

  useEffect(() => {
    apiFetch('/api/clients?active=true').then((d: any) => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
    apiFetch('/api/products').then((d: any) => setProducts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const total = products.reduce((s, p) => s + (items[p.id] ?? 0) * p.price, 0)
  const cashN = parseFloat(cash || '0')
  const tranN = parseFloat(transfer || '0')
  const creditAuto = method === 'mixto' ? Math.max(0, total - cashN - tranN)
    : method === 'efectivo' ? Math.max(0, total - cashN)
    : method === 'transferencia' ? Math.max(0, total - tranN)
    : 0

  const clienteValido = tipoCliente === 'existente' ? !!clienteSel : nuevoNombre.trim().length > 0
  const productosValidos = Object.values(items).some(q => q > 0)
  const cobroValido = !!method

  const handleGuardar = async () => {
    setError('')
    setSaving(true)
    try {
      // Si es cliente nuevo, crearlo primero
      let clientId = clienteSel?.id ?? null
      let clientName = clienteSel?.name ?? nuevoNombre.trim()
      if (tipoCliente === 'nuevo') {
        const nuevo = await apiFetch('/api/clients', {
          method: 'POST',
          body: JSON.stringify({ name: nuevoNombre.trim(), address: 'Depósito TROMEN', phone: nuevoTel.trim(), city: 'Catriel' }),
        })
        clientId = nuevo.id
      }
      const itemsArr = products
        .filter(p => (items[p.id] ?? 0) > 0)
        .map(p => ({ product_id: p.id, name: p.name, qty: items[p.id], price: p.price }))
      const actualAmount = total
      const cashReceived = method === 'efectivo' || method === 'mixto' ? cashN : 0
      const transferAmount = method === 'transferencia' || method === 'mixto' ? tranN : 0
      const creditAmount = method === 'cuenta_corriente' ? total : creditAuto

      await apiFetch('/api/ventas-deposito', {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          client_name: clientName,
          items: itemsArr,
          total_amount: actualAmount,
          payment_method: method,
          cash_received: cashReceived,
          transfer_amount: transferAmount,
          credit_amount: creditAmount,
          notes,
        }),
      })
      onSaved()
      onClose()
    } catch (e: any) {
      setError('Error al guardar: ' + (e.message ?? 'intente de nuevo'))
    }
    setSaving(false)
  }

  const clientesFiltrados = clientes.filter(c =>
    c.name?.toLowerCase().includes(busqCliente.toLowerCase()) ||
    c.address?.toLowerCase().includes(busqCliente.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-lg text-gray-800">🏪 Venta en depósito</h2>
            <p className="text-xs text-gray-400 mt-0.5">TROMEN · Catriel</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Steps */}
        <div className="flex border-b border-gray-100">
          {(['cliente', 'productos', 'cobro'] as const).map((s, i) => (
            <button key={s} onClick={() => {
              if (s === 'productos' && !clienteValido) return
              if (s === 'cobro' && (!clienteValido || !productosValidos)) return
              setStep(s)
            }}
              className="flex-1 py-3 text-xs font-semibold transition-all"
              style={{
                color: step === s ? '#0A5C8A' : '#aaa',
                borderBottom: step === s ? '2px solid #0A5C8A' : '2px solid transparent',
              }}>
              {i + 1}. {s === 'cliente' ? 'Cliente' : s === 'productos' ? 'Productos' : 'Cobro'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {/* ── STEP CLIENTE ── */}
          {step === 'cliente' && (
            <div className="space-y-4">
              {/* Toggle */}
              <div className="flex bg-gray-100 rounded-xl p-1">
                {(['existente', 'nuevo'] as const).map(t => (
                  <button key={t} onClick={() => { setTipoCliente(t); setClienteSel(null); setBusqCliente('') }}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: tipoCliente === t ? 'white' : 'transparent',
                      color: tipoCliente === t ? '#0A5C8A' : '#888',
                      boxShadow: tipoCliente === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    {t === 'existente' ? '👥 Cliente existente' : '➕ Cliente nuevo'}
                  </button>
                ))}
              </div>

              {tipoCliente === 'existente' ? (
                <>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Buscar cliente..."
                    value={busqCliente}
                    onChange={e => setBusqCliente(e.target.value)}
                  />
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {clientesFiltrados.length === 0
                      ? <p className="text-sm text-gray-400 text-center py-4">Sin resultados</p>
                      : clientesFiltrados.map(c => (
                        <button key={c.id} onClick={() => setClienteSel(c)}
                          className="w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between"
                          style={{
                            background: clienteSel?.id === c.id ? '#EFF6FF' : '#F9FAFB',
                            border: clienteSel?.id === c.id ? '1.5px solid #0A5C8A' : '1.5px solid transparent',
                          }}>
                          <div>
                            <p className="font-semibold text-sm text-gray-800">{c.name}</p>
                            <p className="text-xs text-gray-400">{c.address}</p>
                          </div>
                          {Number(c.balance) > 0 && (
                            <span className="text-xs font-bold text-orange-500 ml-2">
                              Deuda: ${Number(c.balance).toLocaleString('es-AR')}
                            </span>
                          )}
                        </button>
                      ))
                    }
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Nombre *</label>
                    <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Nombre completo"
                      value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Teléfono</label>
                    <input className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="Ej: 2994123456" type="tel"
                      value={nuevoTel} onChange={e => setNuevoTel(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP PRODUCTOS ── */}
          {step === 'productos' && (
            <div className="space-y-3">
              {products.length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">Sin productos cargados</p>
                : products.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">${Number(p.price).toLocaleString('es-AR')} c/u</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setItems(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] ?? 0) - 1) }))}
                        className="w-8 h-8 rounded-full bg-white border border-gray-200 font-bold text-gray-600 hover:bg-gray-100 transition-all flex items-center justify-center">
                        −
                      </button>
                      <span className="w-6 text-center font-bold text-gray-800">{items[p.id] ?? 0}</span>
                      <button onClick={() => setItems(prev => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }))}
                        className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all flex items-center justify-center">
                        +
                      </button>
                    </div>
                  </div>
                ))
              }
              {total > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-gray-700">Total</p>
                    <p className="font-bold text-xl text-blue-700">${total.toLocaleString('es-AR')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP COBRO ── */}
          {step === 'cobro' && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-2">
                <div className="flex justify-between">
                  <p className="text-sm text-gray-600">Cliente</p>
                  <p className="font-semibold text-sm text-gray-800">{clienteSel?.name ?? nuevoNombre}</p>
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="font-bold text-blue-700">${total.toLocaleString('es-AR')}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map(m => (
                    <button key={m.value} onClick={() => setMethod(m.value)}
                      className="py-3 px-4 rounded-xl text-sm font-semibold transition-all border-2"
                      style={{
                        borderColor: method === m.value ? m.color : '#e5e7eb',
                        background: method === m.value ? m.color + '15' : 'white',
                        color: method === m.value ? m.color : '#666',
                      }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {(method === 'efectivo' || method === 'mixto') && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Efectivo recibido</label>
                  <input type="number" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-green-300"
                    placeholder="0.00" value={cash} onChange={e => setCash(e.target.value)} />
                </div>
              )}

              {(method === 'transferencia' || method === 'mixto') && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Transferencia</label>
                  <input type="number" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="0.00" value={transfer} onChange={e => setTransfer(e.target.value)} />
                </div>
              )}

              {creditAuto > 0 && method !== 'cuenta_corriente' && (
                <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                  <p className="text-xs text-orange-600 font-semibold">
                    Resta a cuenta corriente: ${creditAuto.toLocaleString('es-AR')}
                  </p>
                </div>
              )}

              {method === 'cuenta_corriente' && (
                <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                  <p className="text-xs text-orange-600 font-semibold">
                    Todo va a cuenta corriente: ${total.toLocaleString('es-AR')}
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Notas (opcional)</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  rows={2} placeholder="Observaciones..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl p-3">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer botones */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          {step !== 'cliente' && (
            <button onClick={() => setStep(step === 'cobro' ? 'productos' : 'cliente')}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
              ← Atrás
            </button>
          )}
          {step === 'cliente' && (
            <button onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
              Cancelar
            </button>
          )}
          {step !== 'cobro' ? (
            <button
              onClick={() => setStep(step === 'cliente' ? 'productos' : 'cobro')}
              disabled={(step === 'cliente' && !clienteValido) || (step === 'productos' && !productosValidos)}
              className="flex-2 flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: ((step === 'cliente' && !clienteValido) || (step === 'productos' && !productosValidos)) ? '#ccc' : '#0A5C8A' }}>
              Siguiente →
            </button>
          ) : (
            <button onClick={handleGuardar} disabled={saving || !cobroValido}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: saving || !cobroValido ? '#ccc' : '#27AE60' }}>
              {saving ? 'Guardando...' : '✓ Confirmar venta'}
            </button>
          )}
        </div>
      </div>
    </div>
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
  const [showVentaDeposito, setShowVentaDeposito] = useState(false)
  const [ventaOk, setVentaOk]       = useState(false)
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

  const handleLogout = () => { localStorage.clear(); router.push('/login') }

  const pct = summary && summary.total_stops > 0
    ? Math.round((summary.completed_stops / summary.total_stops) * 100) : 0

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

      {/* Modal venta depósito */}
      {showVentaDeposito && (
        <ModalVentaDeposito
          onClose={() => setShowVentaDeposito(false)}
          onSaved={() => { setVentaOk(true); loadData(); setTimeout(() => setVentaOk(false), 3000) }}
        />
      )}

      {/* Toast éxito */}
      {ventaOk && (
        <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg font-semibold text-sm animate-bounce">
          ✓ Venta registrada correctamente
        </div>
      )}

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
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <p className="text-blue-200 text-xs hidden md:block">
            Actualizado {formatDistanceToNow(lastUpdate, { locale: es, addSuffix: true })}
          </p>
          {/* BOTÓN VENTA DEPÓSITO */}
          <button onClick={() => setShowVentaDeposito(true)}
            className="rounded-lg px-3 py-1.5 text-sm font-bold transition-all shadow-md"
            style={{ background: '#E67E22', color: 'white' }}>
            🏪 Venta depósito
          </button>
          <button onClick={() => router.push('/clientes')}
            className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all">
            👥 Clientes
          </button>
          <button onClick={() => router.push('/rutas/nueva')}
            className="bg-green-500 hover:bg-green-600 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all">
            + Nueva ruta
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

      <div className="flex-1 p-4 md:p-6 max-w-screen-xl mx-auto w-full space-y-6">

        {/* ── ALERTAS ── */}
        {alerts && (alerts.overdue_clients > 0 || alerts.stopped_routes > 0) && (
          <div className="flex flex-wrap gap-3">
            {alerts.overdue_clients > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-sm text-orange-700 font-semibold">
                ⚠️ {alerts.overdue_clients} cliente(s) con saldo vencido
              </div>
            )}
            {alerts.stopped_routes > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700 font-semibold">
                🛑 {alerts.stopped_routes} ruta(s) sin movimiento GPS
              </div>
            )}
          </div>
        )}

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Rutas activas"   value={summary?.routes_active ?? 0}  emoji="🚚" color="#0A5C8A" />
          <StatCard label="Entregas"        value={`${summary?.completed_stops ?? 0}/${summary?.total_stops ?? 0}`} sub={`${pct}% completado`} emoji="📦" />
          <StatCard label="Cobrado hoy"     value={`$${Number(summary?.total_collected ?? 0).toLocaleString('es-AR')}`} emoji="💰" color="#27AE60" />
          <StatCard label="Rutas completas" value={summary?.routes_done ?? 0} emoji="✅" color="#1A7A4A" />
        </div>

        {/* ── MAPA + PANEL ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Mapa */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="font-bold text-gray-800">📍 Mapa en tiempo real</p>
              <p className="text-xs text-gray-400">{positions.length} repartidor(es) activo(s)</p>
            </div>
            <div style={{ height: '420px' }}>
              <Map
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{ longitude: -67.7989, latitude: -37.8785, zoom: 12 }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/streets-v12">
                {positions.map(pos => (
                  <Marker key={pos.user_id} longitude={pos.longitude} latitude={pos.latitude}>
                    <div className="relative cursor-pointer" onClick={() =>
                      setSelectedRep(selectedRep === pos.user_id ? null : pos.user_id)}>
                      <div className="w-10 h-10 rounded-full border-3 border-white shadow-lg flex items-center justify-center text-lg"
                        style={{ background: STATUS_COLOR[pos.route_status] ?? '#888', border: '3px solid white' }}>
                        🚚
                      </div>
                      {selectedRep === pos.user_id && (
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-xl p-3 text-xs whitespace-nowrap z-10 border border-blue-100">
                          <p className="font-bold text-gray-800">{pos.repartidor}</p>
                          <p className="text-gray-500 mt-0.5">
                            {pos.speed ? `${Number(pos.speed).toFixed(0)} km/h` : 'Detenido'}
                          </p>
                          <p className="text-gray-400 mt-0.5">
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

          {/* Panel derecho */}
          <div className="bg-white rounded-2xl shadow-sm border border-blue-50 flex flex-col">
            <div className="flex border-b border-gray-100">
              {(['rutas', 'cobros', 'clientes'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3 text-sm font-semibold transition-all capitalize"
                  style={{
                    color: activeTab === tab ? '#0A5C8A' : '#aaa',
                    borderBottom: activeTab === tab ? '2px solid #0A5C8A' : '2px solid transparent',
                  }}>
                  {tab === 'rutas' ? '🚚 Rutas' : tab === 'cobros' ? '💰 Cobros' : '👥 Clientes'}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: '420px' }}>

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
                              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[r.route_status] ?? '#888' }} />
                              <span className="text-xs text-gray-500">{STATUS_LABEL[r.route_status] ?? r.route_status}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-700">${Number(r.total_collected ?? 0).toLocaleString('es-AR')}</p>
                            <p className="text-xs text-gray-400 mt-0.5">cobrado</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{r.delivered ?? 0}/{r.total_deliveries ?? 0} entregas</span>
                            <span>{r.total_deliveries > 0 ? Math.round(((r.delivered ?? 0) / r.total_deliveries) * 100) : 0}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-2 rounded-full" style={{
                              width: `${r.total_deliveries > 0 ? Math.round(((r.delivered ?? 0) / r.total_deliveries) * 100) : 0}%`,
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
                      ['💵', 'Efectivo',      repartidores.reduce((s, r) => s + Number(r.cash_total ?? 0), 0),     '#27AE60'],
                      ['🏦', 'Transferencia', repartidores.reduce((s, r) => s + Number(r.transfer_total ?? 0), 0), '#2980B9'],
                      ['📒', 'Fiado',         repartidores.reduce((s, r) => s + Number(r.credit_total ?? 0), 0),   '#E67E22'],
                    ].map(([e, l, v, c]) => (
                      <div key={l as string} className="rounded-xl p-3 text-center" style={{ background: (c as string) + '12' }}>
                        <p className="text-xl">{e as string}</p>
                        <p className="text-xs text-gray-500 mt-1">{l as string}</p>
                        <p className="font-bold mt-1" style={{ color: c as string }}>${Number(v).toLocaleString('es-AR')}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {repartidores.map(r => (
                      <div key={r.user_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{r.repartidor}</p>
                          <p className="text-xs text-gray-400">{r.delivered ?? 0} entregas cobradas</p>
                        </div>
                        <p className="font-bold text-blue-700">${Number(r.total_collected ?? 0).toLocaleString('es-AR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB CLIENTES */}
              {activeTab === 'clientes' && <ClientBalances />}
            </div>
          </div>
        </div>

        <div className="text-center text-gray-400 text-xs pb-4">
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
                <p className="font-bold text-orange-600">${Number(c.current_balance).toLocaleString('es-AR')}</p>
                <p className="text-xs text-gray-400">saldo deudor</p>
              </div>
            </div>
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-1.5 bg-orange-400 rounded-full"
                  style={{ width: `${Math.min(100, (Number(c.current_balance) / Number(c.credit_limit)) * 100)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Límite: ${Number(c.credit_limit).toLocaleString('es-AR')} · Disponible: ${Number(c.available_credit).toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        ))
      }
    </div>
  )
}
