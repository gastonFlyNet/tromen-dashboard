'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

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

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:    { label: 'Pendiente',    color: '#5A7A8A', bg: '#EEF4F8' },
  entregado:    { label: 'Entregado',    color: '#1DB954', bg: '#E8F5EE' },
  no_entregado: { label: 'No entregado', color: '#C0392B', bg: '#FDECEA' },
  parcial:      { label: 'Parcial',      color: '#E67E22', bg: '#FEF3E2' },
}

const METODO_LABEL: Record<string, string> = {
  efectivo:         '💵 Efectivo',
  transferencia:    '🏦 Transferencia',
  cuenta_corriente: '📒 Fiado',
  mixto:            '🔀 Mixto',
}

export default function ClienteDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [client, setClient]           = useState<any>(null)
  const [deliveries, setDeliveries]   = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [editingBalance, setEditingBalance] = useState(false)
  const [newBalance, setNewBalance]   = useState('')
  const [savingBalance, setSavingBalance] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [clientData, deliveriesData] = await Promise.all([
        apiFetch(`/api/clients/${id}`),
        apiFetch(`/api/clients/${id}/deliveries`),
      ])
      setClient(clientData)
      setDeliveries(Array.isArray(deliveriesData) ? deliveriesData : [])
    } catch (err: any) {
      setError(err.message ?? 'Error cargando datos')
    } finally { setLoading(false) }
  }

  const handleSaveBalance = async () => {
    setSavingBalance(true)
    try {
      await apiFetch(`/api/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ balance: parseFloat(newBalance || '0') }),
      })
      setClient((c: any) => ({ ...c, balance: parseFloat(newBalance || '0') }))
      setEditingBalance(false)
    } catch { setError('No se pudo actualizar el saldo') }
    finally { setSavingBalance(false) }
  }

  const openPhoto = (fileUrl: string) => {
    const w = window.open()
    if (w) {
      w.document.write(`
        <html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;">
          <img src="${fileUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;"/>
        </body></html>
      `)
    }
  }

  const filtered = filterStatus === 'all'
    ? deliveries
    : deliveries.filter(d => d.status === filterStatus)

  const totalCobrado = deliveries
    .filter(d => d.status === 'entregado')
    .reduce((s, d) => s + Number(d.actual_amount ?? 0), 0)

  const totalFiado = deliveries
    .filter(d => d.status === 'entregado')
    .reduce((s, d) => s + Number(d.credit_amount ?? 0), 0)

  const totalEntregas = deliveries.filter(d => d.status === 'entregado').length
  const totalNoEntregas = deliveries.filter(d => d.status === 'no_entregado').length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F7FC' }}>
      <div className="text-center">
        <div className="text-4xl mb-4">💧</div>
        <p className="text-gray-400">Cargando historial...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F7FC' }}>
      <div className="text-center">
        <p className="text-red-500">{error}</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600">← Volver</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: '#F0F7FC' }}>

      {/* NAVBAR */}
      <nav className="text-white px-6 py-4 flex items-center justify-between shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/clientes')}
            className="text-blue-200 hover:text-white text-sm mr-2">← Clientes</button>
          <span className="text-2xl">👤</span>
          <div>
            <h1 className="font-bold text-lg">{client?.name}</h1>
            <p className="text-blue-200 text-xs">{client?.address}</p>
          </div>
        </div>
      </nav>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

        {/* INFO CLIENTE */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Teléfono</p>
              <p className="font-semibold text-gray-800 mt-1">{client?.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Zona</p>
              <p className="font-semibold text-gray-800 mt-1">{client?.zone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Estado</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${client?.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {client?.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Saldo pendiente</p>
              {editingBalance ? (
                <div className="flex gap-2 mt-1">
                  <input type="number"
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={newBalance} onChange={e => setNewBalance(e.target.value)} autoFocus />
                  <button onClick={handleSaveBalance} disabled={savingBalance}
                    className="bg-blue-600 text-white rounded-lg px-2 py-1 text-xs font-bold">
                    {savingBalance ? '...' : 'OK'}
                  </button>
                  <button onClick={() => setEditingBalance(false)} className="text-gray-400 text-xs px-1">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <p className={`font-bold text-lg ${Number(client?.balance) > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                    $ {Number(client?.balance ?? 0).toLocaleString('es-AR')}
                  </p>
                  <button onClick={() => { setEditingBalance(true); setNewBalance(String(client?.balance ?? 0)) }}
                    className="text-gray-400 hover:text-blue-600 text-xs">✏️</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ESTADÍSTICAS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total cobrado', value: `$ ${totalCobrado.toLocaleString('es-AR')}`, color: '#1DB954', emoji: '💰' },
            { label: 'Total fiado',   value: `$ ${totalFiado.toLocaleString('es-AR')}`,   color: '#E67E22', emoji: '📒' },
            { label: 'Entregas',      value: totalEntregas,                                color: '#0A5C8A', emoji: '✅' },
            { label: 'No entregadas', value: totalNoEntregas,                              color: '#C0392B', emoji: '❌' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-4 shadow-sm border border-blue-50">
              <p className="text-xs text-gray-400 uppercase font-semibold">{stat.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* HISTORIAL */}
        <div className="bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-bold text-gray-700">📋 Historial de gestiones</h3>
            <div className="flex gap-2 flex-wrap">
              {['all', 'entregado', 'no_entregado', 'pendiente'].map(s => (
                <button key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>
                  {s === 'all' ? 'Todas' : STATUS_CFG[s]?.label ?? s}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📭</p>
              <p>Sin gestiones registradas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(d => {
                const cfg = STATUS_CFG[d.status] ?? STATUS_CFG.pendiente
                const isOpen = expanded === d.id
                const fotos = (d.evidence ?? []).filter((e: any) =>
                  e.type === 'foto_entrega' || e.type === 'foto_ausente' || e.type === 'foto_venta_calle')
                const firma = (d.evidence ?? []).find((e: any) => e.type === 'firma_digital')

                return (
                  <div key={d.id}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : d.id)}
                      className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {d.route_date
                                ? new Date(d.route_date).toLocaleDateString('es-AR', {
                                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                                  })
                                : 'Fecha no disponible'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {d.repartidor ?? 'Repartidor'} · Parada #{d.stop_order}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {Number(d.actual_amount) > 0 && (
                            <p className="font-bold text-blue-700">
                              $ {Number(d.actual_amount).toLocaleString('es-AR')}
                            </p>
                          )}
                          {d.payment_method && (
                            <p className="text-xs text-gray-400">{METODO_LABEL[d.payment_method] ?? d.payment_method}</p>
                          )}
                          <p className="text-xs text-gray-300 mt-1">{isOpen ? '▲' : '▼'}</p>
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 bg-gray-50 space-y-4">

                        {/* Detalle de pago */}
                        {d.status === 'entregado' && (
                          <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-3">💰 Detalle de pago</p>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                ['Monto esperado',  `$ ${Number(d.expected_amount ?? 0).toLocaleString('es-AR')}`],
                                ['Monto cobrado',   `$ ${Number(d.actual_amount ?? 0).toLocaleString('es-AR')}`],
                                ['Efectivo',        `$ ${Number(d.cash_received ?? 0).toLocaleString('es-AR')}`],
                                ['Transferencia',   `$ ${Number(d.transfer_amount ?? 0).toLocaleString('es-AR')}`],
                                ['Fiado',           `$ ${Number(d.credit_amount ?? 0).toLocaleString('es-AR')}`],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <p className="text-xs text-gray-400">{label}</p>
                                  <p className="font-semibold text-gray-800 text-sm">{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notas */}
                        {d.notes && (
                          <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">📝 Notas</p>
                            <p className="text-sm text-gray-700">{d.notes}</p>
                          </div>
                        )}

                        {/* Motivo no entrega */}
                        {d.rejection_reason && (
                          <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                            <p className="text-xs font-bold text-red-500 uppercase mb-2">❌ Motivo no entrega</p>
                            <p className="text-sm text-red-700">{d.rejection_reason}</p>
                          </div>
                        )}

                        {/* Firma */}
                        {firma && (
                          <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-3">✍️ Firma del cliente</p>
                            <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 inline-block cursor-pointer"
                              onClick={() => openPhoto(firma.file_url)}>
                              <img src={firma.file_url} alt="Firma" className="h-20 object-contain hover:opacity-80" />
                            </div>
                            {firma.created_at && (
                              <p className="text-xs text-gray-400 mt-2">
                                Firmado el {new Date(firma.created_at).toLocaleString('es-AR')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Fotos */}
                        {fotos.length > 0 && (
                          <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-3">
                              📷 Fotos ({fotos.length})
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {fotos.map((f: any) => (
                                <img
                                  key={f.id}
                                  src={f.file_url}
                                  alt="Evidencia"
                                  className="w-full h-24 object-cover rounded-lg border border-gray-100 hover:opacity-80 transition-opacity cursor-pointer"
                                  onClick={() => openPhoto(f.file_url)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Horarios */}
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-3">🕐 Horarios</p>
                          <div className="space-y-1">
                            {d.arrived_at && (
                              <p className="text-xs text-gray-500">
                                Llegada: {new Date(d.arrived_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                            {d.delivered_at && (
                              <p className="text-xs text-gray-500">
                                Entrega: {new Date(d.delivered_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
