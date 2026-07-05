'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import FadeIn from '@/components/FadeIn'
import { theme, cardCls } from '@/lib/theme'

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
  pendiente:    { label: 'Pendiente',    color: theme.colors.textMuted, bg: theme.colors.surface2 },
  entregado:    { label: 'Entregado',    color: theme.colors.success,   bg: theme.colors.successSoft },
  no_entregado: { label: 'No entregado', color: theme.colors.error,     bg: theme.colors.errorSoft },
  parcial:      { label: 'Parcial',      color: theme.colors.warning,   bg: theme.colors.warningSoft },
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
    <div style={{ minHeight: '100vh', background: theme.colors.bg, display: 'flex', flexDirection: 'row' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <div className="animate-spin" style={{ width: 40, height: 40, border: `3px solid ${theme.colors.border}`, borderTopColor: theme.colors.accent, borderRadius: '50%', margin: '0 auto' }} />
          <p style={{ color: theme.colors.textFaint, marginTop: 16, fontSize: 14 }}>Cargando historial...</p>
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: theme.colors.bg, display: 'flex', flexDirection: 'row' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-center">
          <p style={{ color: theme.colors.error }}>{error}</p>
          <button onClick={() => router.push('/clientes')} style={{ marginTop: 16, color: theme.colors.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>← Clientes</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: theme.colors.bg, display: 'flex', flexDirection: 'row' }}>

      <Sidebar />

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>

      {/* HEADER */}
      <nav className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/clientes')}
            style={{ color: theme.colors.textFaint, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>← Clientes</button>
          <span className="text-2xl">👤</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: theme.colors.text }}>{client?.name}</h1>
            <p className="text-xs" style={{ color: theme.colors.textFaint }}>{client?.address}</p>
          </div>
        </div>
      </nav>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

        {/* INFO CLIENTE */}
        <div className={cardCls + ' p-5'}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs uppercase font-semibold" style={{ color: theme.colors.textFaint }}>Teléfono</p>
              <p className="font-semibold mt-1" style={{ color: theme.colors.text }}>{client?.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-semibold" style={{ color: theme.colors.textFaint }}>Zona</p>
              <p className="font-semibold mt-1" style={{ color: theme.colors.text }}>{client?.zone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-semibold" style={{ color: theme.colors.textFaint }}>Estado</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold"
                style={{
                  background: client?.active ? theme.colors.successSoft : theme.colors.errorSoft,
                  color: client?.active ? theme.colors.success : theme.colors.error,
                }}>
                {client?.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase font-semibold" style={{ color: theme.colors.textFaint }}>Saldo pendiente</p>
              {editingBalance ? (
                <div className="flex gap-2 mt-1">
                  <input type="number"
                    className="rounded-lg px-2 py-1 text-sm w-24 focus:outline-none transition-colors"
                    style={{ background: theme.colors.surface2, border: `1px solid ${theme.colors.border}`, color: theme.colors.text }}
                    value={newBalance} onChange={e => setNewBalance(e.target.value)} autoFocus />
                  <button onClick={handleSaveBalance} disabled={savingBalance}
                    className="text-white rounded-lg px-2 py-1 text-xs font-bold"
                    style={{ background: theme.colors.brand }}>
                    {savingBalance ? '...' : 'OK'}
                  </button>
                  <button onClick={() => setEditingBalance(false)} className="text-xs px-1" style={{ color: theme.colors.textFaint }}>✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-bold text-lg" style={{ color: Number(client?.balance) > 0 ? theme.colors.warning : theme.colors.success }}>
                    $ {Number(client?.balance ?? 0).toLocaleString('es-AR')}
                  </p>
                  <button onClick={() => { setEditingBalance(true); setNewBalance(String(client?.balance ?? 0)) }}
                    className="text-xs hover:text-[#38BDF8] transition-colors" style={{ color: theme.colors.textFaint }}>✏️</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ESTADÍSTICAS */}
        <FadeIn className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total cobrado', value: `$ ${totalCobrado.toLocaleString('es-AR')}`, color: theme.colors.success, emoji: '💰' },
            { label: 'Total fiado',   value: `$ ${totalFiado.toLocaleString('es-AR')}`,   color: theme.colors.warning, emoji: '📒' },
            { label: 'Entregas',      value: totalEntregas,                                color: theme.colors.accent, emoji: '✅' },
            { label: 'No entregadas', value: totalNoEntregas,                              color: theme.colors.error,  emoji: '❌' },
          ].map(stat => (
            <div key={stat.label} className={cardCls + ' cult-card p-4'}>
              <p className="text-xs uppercase font-semibold" style={{ color: theme.colors.textFaint }}>{stat.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </FadeIn>

        {/* HISTORIAL */}
        <div className={cardCls + ' overflow-hidden'}>
          <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3" style={{ borderColor: theme.colors.border }}>
            <h3 className="font-bold" style={{ color: theme.colors.text }}>📋 Historial de gestiones</h3>
            <div className="flex gap-2 flex-wrap">
              {['all', 'entregado', 'no_entregado', 'pendiente'].map(s => (
                <button key={s}
                  onClick={() => setFilterStatus(s)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                  style={{
                    background: filterStatus === s ? theme.colors.brand : theme.colors.surface2,
                    color: filterStatus === s ? '#fff' : theme.colors.textMuted,
                  }}>
                  {s === 'all' ? 'Todas' : STATUS_CFG[s]?.label ?? s}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16" style={{ color: theme.colors.textFaint }}>
              <p className="text-4xl mb-3">📭</p>
              <p>Sin gestiones registradas</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1E2D40]">
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
                      className="w-full text-left px-5 py-4 transition-colors hover:bg-[#1A2236]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                              {d.route_date
                                ? new Date(d.route_date).toLocaleDateString('es-AR', {
                                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                                  })
                                : 'Fecha no disponible'}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: theme.colors.textFaint }}>
                              {d.repartidor ?? 'Repartidor'} · Parada #{d.stop_order}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {Number(d.actual_amount) > 0 && (
                            <p className="font-bold" style={{ color: theme.colors.accent }}>
                              $ {Number(d.actual_amount).toLocaleString('es-AR')}
                            </p>
                          )}
                          {d.payment_method && (
                            <p className="text-xs" style={{ color: theme.colors.textFaint }}>{METODO_LABEL[d.payment_method] ?? d.payment_method}</p>
                          )}
                          <p className="text-xs mt-1" style={{ color: theme.colors.textFaint }}>{isOpen ? '▲' : '▼'}</p>
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 space-y-4" style={{ background: theme.colors.bg }}>

                        {/* Detalle de pago */}
                        {d.status === 'entregado' && (
                          <div className="rounded-xl p-4 border" style={{ background: theme.colors.surface2, borderColor: theme.colors.border }}>
                            <p className="text-xs font-bold uppercase mb-3" style={{ color: theme.colors.textMuted }}>💰 Detalle de pago</p>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                ['Monto cobrado',   `$ ${Number(d.actual_amount ?? 0).toLocaleString('es-AR')}`],
                                ['Efectivo',        `$ ${Number(d.cash_received ?? 0).toLocaleString('es-AR')}`],
                                ['Transferencia',   `$ ${Number(d.transfer_amount ?? 0).toLocaleString('es-AR')}`],
                                ['Fiado',           `$ ${Number(d.credit_amount ?? 0).toLocaleString('es-AR')}`],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <p className="text-xs" style={{ color: theme.colors.textFaint }}>{label}</p>
                                  <p className="font-semibold text-sm" style={{ color: theme.colors.text }}>{value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notas */}
                        {d.notes && (
                          <div className="rounded-xl p-4 border" style={{ background: theme.colors.surface2, borderColor: theme.colors.border }}>
                            <p className="text-xs font-bold uppercase mb-2" style={{ color: theme.colors.textMuted }}>📝 Notas</p>
                            <p className="text-sm" style={{ color: theme.colors.textMuted }}>{d.notes}</p>
                          </div>
                        )}

                        {/* Motivo no entrega */}
                        {d.rejection_reason && (
                          <div className="rounded-xl p-4 border" style={{ background: theme.colors.errorSoft, borderColor: theme.colors.error }}>
                            <p className="text-xs font-bold uppercase mb-2" style={{ color: theme.colors.error }}>❌ Motivo no entrega</p>
                            <p className="text-sm" style={{ color: theme.colors.error }}>{d.rejection_reason}</p>
                          </div>
                        )}

                        {/* Firma */}
                        {firma && (
                          <div className="rounded-xl p-4 border" style={{ background: theme.colors.surface2, borderColor: theme.colors.border }}>
                            <p className="text-xs font-bold uppercase mb-3" style={{ color: theme.colors.textMuted }}>✍️ Firma del cliente</p>
                            <div className="rounded-lg p-2 border inline-block cursor-pointer" style={{ background: theme.colors.bg, borderColor: theme.colors.border }}
                              onClick={() => openPhoto(firma.file_url)}>
                              <img src={firma.file_url} alt="Firma" className="h-20 object-contain hover:opacity-80" />
                            </div>
                            {firma.created_at && (
                              <p className="text-xs mt-2" style={{ color: theme.colors.textFaint }}>
                                Firmado el {new Date(firma.created_at).toLocaleString('es-AR')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Fotos */}
                        {fotos.length > 0 && (
                          <div className="rounded-xl p-4 border" style={{ background: theme.colors.surface2, borderColor: theme.colors.border }}>
                            <p className="text-xs font-bold uppercase mb-3" style={{ color: theme.colors.textMuted }}>
                              📷 Fotos ({fotos.length})
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {fotos.map((f: any) => (
                                <img
                                  key={f.id}
                                  src={f.file_url}
                                  alt="Evidencia"
                                  className="w-full h-24 object-cover rounded-lg border hover:opacity-80 transition-opacity cursor-pointer"
                                  style={{ borderColor: theme.colors.border }}
                                  onClick={() => openPhoto(f.file_url)}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Horarios */}
                        <div className="rounded-xl p-4 border" style={{ background: theme.colors.surface2, borderColor: theme.colors.border }}>
                          <p className="text-xs font-bold uppercase mb-3" style={{ color: theme.colors.textMuted }}>🕐 Horarios</p>
                          <div className="space-y-1">
                            {d.arrived_at && (
                              <p className="text-xs" style={{ color: theme.colors.textMuted }}>
                                Llegada: {new Date(d.arrived_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                            {d.delivered_at && (
                              <p className="text-xs" style={{ color: theme.colors.textMuted }}>
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
    </div>
  )
}
