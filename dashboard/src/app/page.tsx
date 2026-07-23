'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import CountUp from '@/components/CountUp'
import FadeIn from '@/components/FadeIn'
import Map, { Marker, Source, Layer, Popup } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { dashboardApi, gpsApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
interface Alert { overdue_clients: number; stopped_routes: number; pending_closings: number; out_of_zone: number; out_of_zone_names?: string[]; paused_routes?: number; paused_routes_names?: string[] }
interface Product { id: string; name: string; price: number }
interface Client { id: string; name: string; address: string; phone: string; balance: number }

const STATUS_COLOR: Record<string, string> = {
  en_curso: '#38bdf8', completada: '#4ade80', pendiente: '#fb923c', cancelada: '#f87171',
}
const STATUS_LABEL: Record<string, string> = {
  en_curso: 'En curso', completada: 'Completada', pendiente: 'Pendiente', cancelada: 'Cancelada',
}
const METHODS = [
  { value: 'efectivo',         label: 'Efectivo',      color: '#4ade80' },
  { value: 'transferencia',    label: 'Transferencia', color: '#38bdf8' },
  { value: 'cuenta_corriente', label: 'Fiado',         color: '#fb923c' },
  { value: 'mixto',            label: 'Mixto',         color: '#a78bfa' },
]

const D = {
  bg:      '#0f1117',
  surface: '#151b27',
  surface2:'#1a2236',
  border:  '#1e2d40',
  border2: '#243347',
  text:    '#f1f5f9',
  muted:   '#64748b',
  accent:  '#38bdf8',
  blue:    '#0A5C8A',
}

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: string
}) {
  return (
    <div className="cult-card" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: color ?? D.accent, marginTop: 4, letterSpacing: '-0.5px' }}>{value}</p>
          {sub && <p style={{ fontSize: 10, color: D.muted, marginTop: 2 }}>{sub}</p>}
        </div>
        <span style={{ fontSize: 22, opacity: 0.7 }}>{icon}</span>
      </div>
    </div>
  )
}

function ModalVentaDeposito({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep]               = useState<'cliente' | 'productos' | 'cobro'>('cliente')
  const [tipoCliente, setTipoCliente] = useState<'existente' | 'nuevo'>('existente')
  const [clientes, setClientes]       = useState<Client[]>([])
  const [busqCliente, setBusqCliente] = useState('')
  const [clienteSel, setClienteSel]   = useState<Client | null>(null)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTel, setNuevoTel]       = useState('')
  const [products, setProducts]       = useState<Product[]>([])
  const [items, setItems]             = useState<Record<string, number>>({})
  const [method, setMethod]           = useState('')
  const [cash, setCash]               = useState('')
  const [transfer, setTransfer]       = useState('')
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    apiFetch('/api/clients?active=true').then((d: any) => setClientes(Array.isArray(d) ? d : [])).catch(() => {})
    apiFetch('/api/products').then((d: any) => setProducts(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const total = products.reduce((s, p) => s + (items[p.id] ?? 0) * p.price, 0)
  const cashN = parseFloat(cash || '0')
  const tranN = parseFloat(transfer || '0')
  const creditAuto = method === 'mixto' ? Math.max(0, total - cashN - tranN)
    : method === 'efectivo' ? Math.max(0, total - cashN)
    : method === 'transferencia' ? Math.max(0, total - tranN) : 0

  const clienteValido = tipoCliente === 'existente' ? !!clienteSel : nuevoNombre.trim().length > 0
  const productosValidos = Object.values(items).some(q => q > 0)
  const cobroValido = !!method

  const handleGuardar = async () => {
    setError(''); setSaving(true)
    try {
      let clientId = clienteSel?.id ?? null
      let clientName = clienteSel?.name ?? nuevoNombre.trim()
      if (tipoCliente === 'nuevo') {
        const nuevo = await apiFetch('/api/clients', {
          method: 'POST',
          body: JSON.stringify({ name: nuevoNombre.trim(), address: 'Depósito TROMEN', phone: nuevoTel.trim(), city: 'Catriel' }),
        })
        clientId = nuevo.id
      }
      const itemsArr = products.filter(p => (items[p.id] ?? 0) > 0)
        .map(p => ({ product_id: p.id, name: p.name, qty: items[p.id], price: p.price }))
      await apiFetch('/api/ventas-deposito', {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId, client_name: clientName, items: itemsArr,
          total_amount: total, payment_method: method,
          cash_received: method === 'efectivo' || method === 'mixto' ? cashN : 0,
          transfer_amount: method === 'transferencia' || method === 'mixto' ? tranN : 0,
          credit_amount: method === 'cuenta_corriente' ? total : creditAuto,
          notes,
        }),
      })
      onSaved(); onClose()
    } catch (e: any) { setError('Error: ' + (e.message ?? 'intente de nuevo')) }
    setSaving(false)
  }

  const clientesFiltrados = clientes.filter(c =>
    c.name?.toLowerCase().includes(busqCliente.toLowerCase()) ||
    c.address?.toLowerCase().includes(busqCliente.toLowerCase())
  )

  const inputStyle = {
    background: D.surface2, border: `1px solid ${D.border2}`, borderRadius: 8,
    color: D.text, padding: '10px 14px', fontSize: 13, width: '100%',
    outline: 'none', fontFamily: 'inherit',
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent style={{ background: D.surface, border: `1px solid ${D.border}`, maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, gap: 0 }}>
        <DialogHeader style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${D.border}` }}>
          <DialogTitle style={{ color: D.text, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            🏪 Venta en depósito
            <span style={{ fontSize: 11, fontWeight: 400, color: D.muted }}>TROMEN · Catriel</span>
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', borderBottom: `1px solid ${D.border}` }}>
          {(['cliente', 'productos', 'cobro'] as const).map((s, i) => (
            <button key={s}
              onClick={() => {
                if (s === 'productos' && !clienteValido) return
                if (s === 'cobro' && (!clienteValido || !productosValidos)) return
                setStep(s)
              }}
              style={{ flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                color: step === s ? D.accent : D.muted,
                borderBottom: step === s ? `2px solid ${D.accent}` : '2px solid transparent' }}>
              {i + 1}. {s === 'cliente' ? 'Cliente' : s === 'productos' ? 'Productos' : 'Cobro'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {step === 'cliente' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', background: D.surface2, borderRadius: 8, padding: 3, gap: 3 }}>
                {(['existente', 'nuevo'] as const).map(t => (
                  <button key={t} onClick={() => { setTipoCliente(t); setClienteSel(null); setBusqCliente('') }}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: tipoCliente === t ? D.blue : 'transparent',
                      color: tipoCliente === t ? '#fff' : D.muted }}>
                    {t === 'existente' ? '👥 Existente' : '➕ Nuevo'}
                  </button>
                ))}
              </div>
              {tipoCliente === 'existente' ? (
                <>
                  <input style={inputStyle} placeholder="🔍 Buscar cliente..." value={busqCliente} onChange={e => setBusqCliente(e.target.value)} />
                  <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {clientesFiltrados.length === 0
                      ? <p style={{ color: D.muted, fontSize: 12, textAlign: 'center', padding: 16 }}>Sin resultados</p>
                      : clientesFiltrados.map(c => (
                        <button key={c.id} onClick={() => setClienteSel(c)}
                          style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${clienteSel?.id === c.id ? D.accent : D.border}`, background: clienteSel?.id === c.id ? `${D.accent}15` : D.surface2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: D.text }}>{c.name}</p>
                            <p style={{ fontSize: 10, color: D.muted }}>{c.address}</p>
                          </div>
                          {Number(c.balance) > 0 && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#fb923c', background: '#fb923c22', border: '1px solid #fb923c44', borderRadius: 4, padding: '2px 6px' }}>
                              ${Number(c.balance).toLocaleString('es-AR')}
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nombre *</label>
                    <input style={{ ...inputStyle, marginTop: 4 }} placeholder="Nombre completo" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Teléfono</label>
                    <input style={{ ...inputStyle, marginTop: 4 }} placeholder="Ej: 2994123456" type="tel" value={nuevoTel} onChange={e => setNuevoTel(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'productos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {products.length === 0
                ? <p style={{ color: D.muted, fontSize: 12, textAlign: 'center', padding: 24 }}>Sin productos cargados</p>
                : products.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: D.surface2, borderRadius: 10, border: `1px solid ${D.border}` }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: D.text }}>{p.name}</p>
                      <p style={{ fontSize: 10, color: D.muted }}>${Number(p.price).toLocaleString('es-AR')} c/u</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setItems(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] ?? 0) - 1) }))}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: D.surface, border: `1px solid ${D.border2}`, color: D.text, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ fontSize: 14, fontWeight: 800, color: D.text, minWidth: 20, textAlign: 'center' }}>{items[p.id] ?? 0}</span>
                      <button onClick={() => setItems(prev => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }))}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: D.blue, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                ))}
              {total > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: `${D.accent}12`, border: `1px solid ${D.accent}30`, borderRadius: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: D.muted }}>Total</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: D.accent }}>${total.toLocaleString('es-AR')}</p>
                </div>
              )}
            </div>
          )}

          {step === 'cobro' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '12px 14px', background: `${D.accent}10`, border: `1px solid ${D.accent}25`, borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: D.muted }}>Cliente</span>
                  <span style={{ fontWeight: 600, color: D.text }}>{clienteSel?.name ?? nuevoNombre}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: D.muted }}>Total</span>
                  <span style={{ fontWeight: 800, color: D.accent }}>${total.toLocaleString('es-AR')}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8 }}>Método de pago</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {METHODS.map(m => (
                    <button key={m.value} onClick={() => setMethod(m.value)}
                      style={{ padding: '10px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${method === m.value ? m.color : D.border}`, background: method === m.value ? `${m.color}18` : D.surface2, color: method === m.value ? m.color : D.muted, fontFamily: 'inherit' }}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {(method === 'efectivo' || method === 'mixto') && (
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Efectivo recibido</label>
                  <input type="number" style={{ ...inputStyle, marginTop: 4 }} placeholder="0.00" value={cash} onChange={e => setCash(e.target.value)} />
                </div>
              )}
              {(method === 'transferencia' || method === 'mixto') && (
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transferencia</label>
                  <input type="number" style={{ ...inputStyle, marginTop: 4 }} placeholder="0.00" value={transfer} onChange={e => setTransfer(e.target.value)} />
                </div>
              )}
              {creditAuto > 0 && method !== 'cuenta_corriente' && (
                <div style={{ padding: '10px 12px', background: '#fb923c15', border: '1px solid #fb923c30', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#fb923c' }}>Resta a cuenta corriente: ${creditAuto.toLocaleString('es-AR')}</p>
                </div>
              )}
              {method === 'cuenta_corriente' && (
                <div style={{ padding: '10px 12px', background: '#fb923c15', border: '1px solid #fb923c30', borderRadius: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#fb923c' }}>Todo va a cuenta corriente: ${total.toLocaleString('es-AR')}</p>
                </div>
              )}
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: D.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notas (opcional)</label>
                <textarea style={{ ...inputStyle, marginTop: 4, resize: 'none' } as any} rows={2} placeholder="Observaciones..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              {error && <p style={{ fontSize: 11, color: '#f87171', background: '#f8717120', borderRadius: 8, padding: '10px 12px' }}>{error}</p>}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: `1px solid ${D.border}`, display: 'flex', gap: 8 }}>
          {step !== 'cliente' && (
            <button onClick={() => setStep(step === 'cobro' ? 'productos' : 'cliente')}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${D.border2}`, background: 'none', color: D.muted, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
              ← Atrás
            </button>
          )}
          {step === 'cliente' && (
            <button onClick={onClose}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: `1px solid ${D.border2}`, background: 'none', color: D.muted, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
              Cancelar
            </button>
          )}
          {step !== 'cobro' ? (
            <button
              disabled={(step === 'cliente' && !clienteValido) || (step === 'productos' && !productosValidos)}
              onClick={() => setStep(step === 'cliente' ? 'productos' : 'cobro')}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: ((step === 'cliente' && !clienteValido) || (step === 'productos' && !productosValidos)) ? D.border : D.blue, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
              Siguiente →
            </button>
          ) : (
            <button disabled={saving || !cobroValido} onClick={handleGuardar}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: saving || !cobroValido ? D.border : '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
              {saving ? 'Guardando...' : '✓ Confirmar venta'}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser]               = useState<any>(null)
  const [summary, setSummary]         = useState<Summary | null>(null)
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [positions, setPositions]     = useState<Position[]>([])
  const [alerts, setAlerts]           = useState<Alert | null>(null)
  const [loading, setLoading]         = useState(true)
  const [lastUpdate, setLastUpdate]   = useState<Date>(new Date())
  const [selectedRep, setSelectedRep] = useState<string | null>(null)
  const [repTrack, setRepTrack] = useState<{lat: number, lng: number, estado?: string}[]>([])
  const [ventasGeo, setVentasGeo] = useState<any[]>([])
  const [ventaPopup, setVentaPopup] = useState<any | null>(null)

  // Carga (o limpia) el recorrido del día de un repartidor para dibujarlo en el mapa
  const toggleRepTrack = async (userId: string) => {
    if (selectedRep === userId) { setSelectedRep(null); setRepTrack([]); return }
    setSelectedRep(userId)
    setRepTrack([])
    try {
      const token = localStorage.getItem('tromen_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://tromen-backend-production.up.railway.app'}/api/gps/day-track/${userId}?date=${new Date().toISOString().slice(0,10)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const d = await res.json()
      const pts = d?.points ?? (Array.isArray(d) ? d : [])
      setRepTrack(pts.map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng), estado: p.estado })))
    } catch { setRepTrack([]) }
  }

  // Segmentos del track por estado (para colorear)
  const REP_ESTADO_COLOR: Record<string, string> = { con_ruta: '#16a34a', pausa: '#9ca3af', sin_ruta: '#ef4444' }
  const repSegmentos: { estado: string, coords: [number, number][] }[] = []
  for (let i = 0; i < repTrack.length; i++) {
    const p = repTrack[i]
    const estado = p.estado ?? 'sin_ruta'
    const last = repSegmentos[repSegmentos.length - 1]
    if (last && last.estado === estado) {
      last.coords.push([p.lng, p.lat])
    } else {
      const sc: [number, number][] = []
      if (i > 0) sc.push([repTrack[i-1].lng, repTrack[i-1].lat])
      sc.push([p.lng, p.lat])
      repSegmentos.push({ estado, coords: sc })
    }
  }
  const [showVentaDeposito, setShowVentaDeposito] = useState(false)
  const [fabOpen, setFabOpen]         = useState(false)
  const [ventaOk, setVentaOk]         = useState(false)
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    setUser(JSON.parse(u))
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [todayRes, alertsRes, posRes] = await Promise.all([
        dashboardApi.today(), dashboardApi.alerts(), gpsApi.live(),
      ])
      setSummary(todayRes.data.summary)
      setRepartidores(todayRes.data.by_repartidor ?? [])
      setPositions(todayRes.data.live_positions ?? posRes.data ?? [])
      // Cargar gestiones georreferenciadas del dia para los marcadores del mapa
      try {
        const hoy = new Date().toISOString().slice(0, 10)
        const vgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://tromen-backend-production.up.railway.app'}/api/dashboard/ventas-geo?date=${hoy}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('tromen_token')}` },
        })
        if (vgRes.ok) {
          const vgData = await vgRes.json()
          setVentasGeo(vgData.ventas ?? [])
        }
      } catch (e) { /* sin ventas geo, el mapa sigue funcionando */ }
      setAlerts(alertsRes.data)
      setLastUpdate(new Date())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: D.bg }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
        .dot1{animation:pulse 1.2s ease-in-out infinite}
        .dot2{animation:pulse 1.2s ease-in-out 0.2s infinite}
        .dot3{animation:pulse 1.2s ease-in-out 0.4s infinite}
      `}</style>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <img src="/tromen-logo.png" alt="TROMEN" style={{ width: 240, height: 'auto', objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="dot1" style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8' }} />
          <div className="dot2" style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8' }} />
          <div className="dot3" style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8' }} />
        </div>
        <p style={{ color: '#475569', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Panel Administrativo</p>
      </div>
    </div>
  )

  const navBtnStyle = (accent?: string) => ({
    padding: '6px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${accent ? 'transparent' : D.border2}`,
    background: accent ?? `${D.surface2}`,
    color: accent ? '#fff' : D.muted,
  })

  const sideBtnStyle = (accent?: string) => ({
    padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${accent ? 'transparent' : 'transparent'}`,
    background: accent ?? 'transparent',
    color: accent ? '#fff' : D.text,
    textAlign: 'left' as const,
    width: '100%',
    transition: 'background 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', flexDirection: 'row' }}>

      {showVentaDeposito && (
        <ModalVentaDeposito
          onClose={() => setShowVentaDeposito(false)}
          onSaved={() => { setVentaOk(true); loadData(); setTimeout(() => setVentaOk(false), 3000) }}
        />
      )}

      {ventaOk && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 50, background: '#16a34a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 12, boxShadow: '0 4px 20px rgba(22,163,74,0.4)' }}>
          ✓ Venta registrada correctamente
        </div>
      )}

      {/* SIDEBAR */}
      <aside style={{ width: 220, background: D.surface, borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', flexShrink: 0 }}>
        <div style={{ padding: '20px 18px', borderBottom: `1px solid ${D.border}` }}>
          <img src="/tromen-logo.png" alt="TROMEN" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
          <p style={{ fontSize: 11, color: D.muted, fontWeight: 500, marginTop: 8 }}>Panel Administrativo · Catriel</p>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          <button style={sideBtnStyle()} onClick={() => router.push('/clientes')}>👥 Clientes</button>
          <button style={sideBtnStyle()} onClick={() => router.push('/repartidores')}>🚚 Repartidores</button>
          <button style={sideBtnStyle()} onClick={() => router.push('/resumen')}>📊 Resumen</button>
          <button style={sideBtnStyle()} onClick={() => router.push('/bidones')}>🪣 Cambio de bidones</button>
          <button style={sideBtnStyle()} onClick={() => router.push('/productos')}>📦 Productos</button>
          <button style={sideBtnStyle()} onClick={() => router.push('/stock')}>📊 Stock</button>
          <button style={sideBtnStyle()} onClick={() => router.push('/geocercas')}>🗺️ Geocercas</button>
          <button style={sideBtnStyle()} onClick={() => router.push('/rutas/plantillas')}>📋 Plantillas</button>
          <div style={{ height: 1, background: D.border, margin: '8px 4px' }} />
          <button style={sideBtnStyle('#f97316')} onClick={() => setShowVentaDeposito(true)}>🏪 Venta depósito</button>
          <button style={sideBtnStyle(D.blue)} onClick={() => router.push('/rutas/nueva')}>+ Nueva ruta</button>
        </nav>
        <div style={{ padding: '12px 10px', borderTop: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 10, color: D.muted, padding: '0 8px 4px' }}>
            {formatDistanceToNow(lastUpdate, { locale: es, addSuffix: true })}
          </p>
          <button style={sideBtnStyle()} onClick={loadData}>↻ Actualizar</button>
          <button style={{ ...sideBtnStyle(), color: '#94a3b8' }} onClick={handleLogout}>⏻ Salir</button>
        </div>
      </aside>

      <div style={{ flex: 1, padding: '20px 24px', maxWidth: 1400, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', height: '100vh' }}>

        {/* ALERTAS */}
        {alerts && (alerts.stopped_routes > 0 || (alerts.out_of_zone ?? 0) > 0) && (
          <FadeIn style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {alerts.stopped_routes > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#f8717122', border: '1px solid #f8717155', borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#f87171' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                🛑 {alerts.stopped_routes} ruta(s) sin movimiento GPS
              </div>
            )}
            {(alerts.out_of_zone ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#38bdf822', border: '1px solid #38bdf855', borderRadius: 10, fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                📍 {alerts.out_of_zone} repartidor(es) fuera de zona
              </div>
            )}
          </FadeIn>
        )}

        {/* SALUDO + MI CUENTA */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: D.text }}>
            👋 Hola, {user?.name ?? ''}
          </p>
          <button onClick={() => router.push('/cuenta')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${D.border2}`, background: D.surface2, color: D.text }}>
            🔑 Mi cuenta
          </button>
        </div>

        {/* STAT CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Rutas activas"   value={summary?.routes_active ?? 0}  icon="🚚" color={D.accent} />
          <StatCard label="Entregas"        value={`${summary?.completed_stops ?? 0}/${summary?.total_stops ?? 0}`} sub={`${pct}% completado`} icon="📦" color={D.text} />
          <StatCard label="Cobrado hoy"     value={`$${Number(summary?.total_collected ?? 0).toLocaleString('es-AR')}`} icon="💰" color="#4ade80" />
          <StatCard label="Rutas completas" value={summary?.routes_done ?? 0} icon="✅" color="#a78bfa" />
        </div>

        {/* MAPA + PANEL */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>

          {/* Mapa */}
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: D.text }}>📍 Mapa en tiempo real</p>
              <span style={{ fontSize: 10, fontWeight: 600, color: D.accent, background: `${D.accent}18`, border: `1px solid ${D.accent}30`, borderRadius: 6, padding: '2px 8px' }}>
                {positions.length} activo(s)
              </span>
            </div>
            <div style={{ height: 420, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 5, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 12px', maxWidth: 220, maxHeight: 380, overflowY: 'auto' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: D.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>Repartidores activos</p>
                {positions.length === 0
                  ? <p style={{ fontSize: 11, color: D.muted, marginTop: 8 }}>Sin repartidores activos</p>
                  : positions.map(pos => (
                    <div key={pos.user_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[pos.route_status] ?? '#888', display: 'inline-block', marginTop: 4, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: D.text }}>{pos.repartidor}</p>
                        <p style={{ fontSize: 11, color: D.muted, marginTop: 1 }}>
                          {pos.speed ? `${Number(pos.speed).toFixed(0)} km/h` : 'Detenido'} · {pos.recorded_at ? formatDistanceToNow(new Date(pos.recorded_at), { locale: es, addSuffix: true }) : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
              <Map
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{ longitude: -67.7989, latitude: -37.8785, zoom: 12 }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/dark-v11">
                {positions.map(pos => (
                  <Marker key={pos.user_id} longitude={Number(pos.longitude)} latitude={Number(pos.latitude)}>
                    <div style={{ position: 'relative', cursor: 'pointer' }}
                      onClick={() => toggleRepTrack(pos.user_id)}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: '2px solid #1e2d40', background: STATUS_COLOR[pos.route_status] + '33', boxShadow: `0 0 12px ${STATUS_COLOR[pos.route_status]}66` }}>
                        🚚
                      </div>
                    </div>
                  </Marker>
                ))}
                {/* Marcadores de venta georreferenciados (por tipo de gestion) */}
                {ventasGeo.map(v => {
                  const colorTipo = v.tipo === 'calle' ? '#38bdf8' : v.tipo === 'ausente' ? '#ef4444' : '#16a34a'
                  return (
                    <Marker key={`vg-${v.id}`} longitude={Number(v.longitude)} latitude={Number(v.latitude)}>
                      <div onClick={(e) => { e.stopPropagation(); setVentaPopup(v) }}
                        title={v.cliente ?? 'Venta'}
                        style={{ width: 14, height: 14, borderRadius: '50%', background: colorTipo,
                          border: '2px solid #fff', boxShadow: `0 0 6px ${colorTipo}`, cursor: 'pointer' }} />
                    </Marker>
                  )
                })}
                {ventaPopup && (
                  <Popup longitude={Number(ventaPopup.longitude)} latitude={Number(ventaPopup.latitude)}
                    anchor="bottom" onClose={() => setVentaPopup(null)} closeButton={true}
                    offset={16}>
                    <div style={{ fontSize: 12, minWidth: 160 }}>
                      <p style={{ fontWeight: 700, color: '#0f1117', marginBottom: 4 }}>{ventaPopup.cliente ?? 'Cliente'}</p>
                      <p style={{ color: '#334155' }}>
                        {ventaPopup.tipo === 'calle' ? 'Venta fuera de ruta' : ventaPopup.tipo === 'ausente' ? 'Cliente ausente' : 'Entrega'}
                      </p>
                      <p style={{ color: '#0f1117', fontWeight: 600, marginTop: 2 }}>${Number(ventaPopup.monto ?? 0).toLocaleString('es-AR')}</p>
                      <p style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{ventaPopup.repartidor}</p>
                      <p style={{ color: '#64748b', fontSize: 11 }}>
                        {ventaPopup.delivered_at ? new Date(ventaPopup.delivered_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : ''}
                      </p>
                      {ventaPopup.productos && ventaPopup.productos.length > 0 && (
                        <p style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>
                          {ventaPopup.productos.map((p: any) => `${p.cantidad} ${p.nombre}`).join(', ')}
                        </p>
                      )}
                    </div>
                  </Popup>
                )}
                {repSegmentos.length > 0 && (
                  <Source id="home-rep-track" type="geojson" data={{
                    type: 'FeatureCollection',
                    features: repSegmentos.filter(s => s.coords.length >= 2).map(seg => ({
                      type: 'Feature',
                      properties: { color: REP_ESTADO_COLOR[seg.estado] ?? '#38bdf8' },
                      geometry: { type: 'LineString', coordinates: seg.coords },
                    }))
                  }}>
                    <Layer id="home-rep-track-line" type="line"
                      layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                      paint={{ 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.9 }}
                    />
                  </Source>
                )}
              </Map>
            </div>
            {positions.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, color: D.muted, fontSize: 12 }}>
                Sin posiciones GPS registradas hoy
              </div>
            )}
          </div>

          {/* Panel lateral */}
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${D.border}` }}>
              {[['rutas','🚚 Rutas'],['cobros','💰 Cobros'],['clientes','👥 Clientes']].map(([v,l], idx) => (
                <button key={v} id={`tab-${v}`}
                  onClick={() => {
                    document.querySelectorAll('[id^="tab-"]').forEach((el: any) => {
                      el.style.color = D.muted
                      el.style.borderBottom = '2px solid transparent'
                    })
                    document.querySelectorAll('[id^="panel-"]').forEach((el: any) => el.style.display = 'none')
                    const btn = document.getElementById(`tab-${v}`) as any
                    if (btn) { btn.style.color = D.accent; btn.style.borderBottom = `2px solid ${D.accent}` }
                    const panel = document.getElementById(`panel-${v}`) as any
                    if (panel) panel.style.display = 'block'
                  }}
                  style={{ flex: 1, padding: '11px 0', fontSize: 10, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    color: idx === 0 ? D.accent : D.muted,
                    borderBottom: idx === 0 ? `2px solid ${D.accent}` : '2px solid transparent' }}>
                  {l}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 420 }}>
              {/* Panel Rutas */}
              <div id="panel-rutas">
                {repartidores.length === 0
                  ? <p style={{ textAlign: 'center', color: D.muted, padding: 40, fontSize: 12 }}>Sin rutas activas hoy</p>
                  : repartidores.map(r => {
                    const repPct = r.total_deliveries > 0 ? Math.round(((r.delivered ?? 0) / r.total_deliveries) * 100) : 0
                    return (
                      <div key={r.user_id} style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}`, cursor: 'pointer',
                        background: selectedRep === r.user_id ? `${D.accent}14` : 'transparent' }}
                        onClick={() => toggleRepTrack(r.user_id)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: D.text }}>{r.repartidor}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[r.route_status] ?? '#888', display: 'inline-block' }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR[r.route_status] ?? D.muted,
                                background: `${STATUS_COLOR[r.route_status] ?? '#888'}18`, border: `1px solid ${STATUS_COLOR[r.route_status] ?? '#888'}30`,
                                borderRadius: 4, padding: '1px 6px' }}>
                                {STATUS_LABEL[r.route_status] ?? r.route_status}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: D.accent }}>${Number(r.total_collected ?? 0).toLocaleString('es-AR')}</p>
                            <p style={{ fontSize: 10, color: D.muted, marginTop: 1 }}>cobrado</p>
                          </div>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: D.muted, marginBottom: 4 }}>
                            <span>{r.delivered ?? 0}/{r.total_deliveries ?? 0} entregas</span>
                            <span>{repPct}%</span>
                          </div>
                          <div style={{ height: 4, background: D.border, borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: 4, borderRadius: 99, width: `${repPct}%`, background: STATUS_COLOR[r.route_status] ?? D.accent, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                        {r.route_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push('/rutas/' + r.route_id) }}
                            style={{ marginTop: 10, width: '100%', padding: '7px 0', fontSize: 11, fontWeight: 700,
                              color: D.accent, background: `${D.accent}14`, border: `1px solid ${D.accent}35`,
                              borderRadius: 8, cursor: 'pointer' }}>
                            Editar ruta
                          </button>
                        )}
                      </div>
                    )
                  })}
              </div>

              {/* Panel Cobros */}
              <div id="panel-cobros" style={{ display: 'none', padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                  {[
                    ['💵','Efectivo',      repartidores.reduce((s,r) => s+Number(r.cash_total??0),0),     '#4ade80'],
                    ['🏦','Transferencia', repartidores.reduce((s,r) => s+Number(r.transfer_total??0),0), '#38bdf8'],
                    ['📒','Fiado',         repartidores.reduce((s,r) => s+Number(r.credit_total??0),0),   '#fb923c'],
                  ].map(([e,l,v,c]) => (
                    <div key={l as string} style={{ padding: '10px 8px', borderRadius: 10, border: `1px solid ${(c as string)}25`, background: `${(c as string)}10`, textAlign: 'center' }}>
                      <p style={{ fontSize: 18 }}>{e as string}</p>
                      <p style={{ fontSize: 9, color: D.muted, marginTop: 3 }}>{l as string}</p>
                      <p style={{ fontSize: 12, fontWeight: 800, color: c as string, marginTop: 2 }}>${Number(v).toLocaleString('es-AR')}</p>
                    </div>
                  ))}
                </div>
                {repartidores.map(r => (
                  <div key={r.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: D.surface2, borderRadius: 8, marginBottom: 6 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: D.text }}>{r.repartidor}</p>
                      <p style={{ fontSize: 10, color: D.muted }}>{r.delivered ?? 0} entregas cobradas</p>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: D.accent }}>${Number(r.total_collected ?? 0).toLocaleString('es-AR')}</p>
                  </div>
                ))}
              </div>

              {/* Panel Clientes */}
              <div id="panel-clientes" style={{ display: 'none' }}>
                <ClientBalances />
              </div>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: D.muted, fontSize: 11, paddingBottom: 8 }}>
          BYF Soluciones · TROMEN · Panel Administrativo · Se actualiza cada 30 segundos
        </p>
      </div>

      {/* BOTÓN FLOTANTE (FAB) */}
      <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>

        {/* Panel de alertas con detalle (arriba de las acciones) */}
        {fabOpen && ((alerts?.out_of_zone_names?.length ?? 0) > 0 || (alerts?.paused_routes_names?.length ?? 0) > 0) && (
          <FadeIn style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', maxWidth: 280 }}>
            {(alerts?.out_of_zone_names ?? []).map((nombre, i) => (
              <div key={'oz' + i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#38bdf8', color: '#0f1117', borderRadius: 12, padding: '9px 14px', fontSize: 12, fontWeight: 700, boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
                📍 {nombre} fuera de zona de reparto
              </div>
            ))}
            {(alerts?.paused_routes_names ?? []).map((nombre, i) => (
              <div key={'pr' + i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fbbf24', color: '#0f1117', borderRadius: 12, padding: '9px 14px', fontSize: 12, fontWeight: 700, boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
                ⏸️ {nombre} pausó su ruta
              </div>
            ))}
          </FadeIn>
        )}

        {/* Acciones que se despliegan */}
        {fabOpen && (
          <FadeIn style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
            <button onClick={() => { router.push('/rutas/nueva'); setFabOpen(false) }} className="cult-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: D.blue, color: '#fff', borderRadius: 30, padding: '10px 18px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
              🚚 Nueva ruta
            </button>
            <button onClick={() => { setShowVentaDeposito(true); setFabOpen(false) }} className="cult-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f97316', color: '#fff', borderRadius: 30, padding: '10px 18px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
              🏪 Venta depósito
            </button>
            <button onClick={() => { router.push('/stock'); setFabOpen(false) }} className="cult-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: D.surface2, color: D.text, borderRadius: 30, padding: '10px 18px', fontSize: 13, fontWeight: 700, border: `1px solid ${D.border}`, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
              📊 Stock
            </button>
          </FadeIn>
        )}

        {/* Botón principal redondo */}
        <button onClick={() => setFabOpen(o => !o)}
          style={{ position: 'relative', width: 60, height: 60, borderRadius: '50%', background: D.accent, color: '#0f1117', fontSize: 28, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 20px rgba(56,189,248,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', overflow: 'visible' }}>
          +
          {/* Badge de notificaciones */}
          {alerts && ((alerts.out_of_zone ?? 0) + (alerts.paused_routes ?? 0)) > 0 && !fabOpen && (
            <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 24, height: 24, padding: '0 6px', borderRadius: 12, background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f1117', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
              {(alerts.out_of_zone ?? 0) + (alerts.paused_routes ?? 0)}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <p style={{ color: '#64748b', fontSize: 12 }}>Cargando saldos...</p>
    </div>
  )

  const withBalance = clients.filter(c => Number(c.current_balance) > 0)

  return (
    <div>
      {withBalance.length === 0
        ? <p style={{ textAlign: 'center', color: '#64748b', padding: 40, fontSize: 12 }}>Sin saldos pendientes 🎉</p>
        : withBalance.map(c => (
          <div key={c.id} style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: D.text }}>{c.name}</p>
                <p style={{ fontSize: 10, color: D.muted, marginTop: 2 }}>{c.zone}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#fb923c' }}>${Number(c.current_balance).toLocaleString('es-AR')}</p>
                <p style={{ fontSize: 10, color: D.muted }}>saldo deudor</p>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 3, background: D.border, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: 3, background: '#fb923c', borderRadius: 99, width: `${Math.min(100, (Number(c.current_balance) / Number(c.credit_limit)) * 100)}%` }} />
              </div>
              <p style={{ fontSize: 10, color: D.muted, marginTop: 3 }}>
                Límite: ${Number(c.credit_limit).toLocaleString('es-AR')} · Disponible: ${Number(c.available_credit).toLocaleString('es-AR')}
              </p>
            </div>
          </div>
        ))
      }

    </div>
  )
}
