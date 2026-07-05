'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import CountUp from '@/components/CountUp'
import FadeIn from '@/components/FadeIn'
import { theme, cardCls, inputCls, labelCls } from '@/lib/theme'

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

const STOCK_MIN = 10

export default function StockPage() {
  const router = useRouter()
  const [products, setProducts]     = useState<any[]>([])
  const [history, setHistory]       = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [movType, setMovType]       = useState<'entrada' | 'salida'>('entrada')
  const [quantity, setQuantity]     = useState<string>('')
  const [reason, setReason]         = useState<string>('')
  const [notes, setNotes]           = useState<string>('')
  const [filterProduct, setFilterProduct] = useState<string>('')
  const [error, setError]           = useState<string>('')
  const [successMsg, setSuccessMsg] = useState<string>('')
  const [destino, setDestino]       = useState<'repartidor' | 'deposito'>('repartidor')
  const [repartidorId, setRepartidorId] = useState<string>('')
  const [repartidores, setRepartidores] = useState<any[]>([])

  const loadData = useCallback(async () => {
    try {
      const [stockRes, histRes, usersRes] = await Promise.all([
        apiFetch('/api/products/stock'),
        apiFetch('/api/products/stock/history?limit=100'),
        apiFetch('/api/users').catch(() => []),
      ])
      setProducts(Array.isArray(stockRes) ? stockRes : [])
      setHistory(Array.isArray(histRes) ? histRes : [])
      const reps = (Array.isArray(usersRes) ? usersRes : []).filter((u: any) => u.role === 'repartidor' || u.role === 'supervisor')
      setRepartidores(reps)
    } catch (err: any) {
      setError('Error cargando datos de stock')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    loadData()
  }, [loadData])

  const handleMovement = async () => {
    if (!selectedProduct) return setError('Seleccioná un producto')
    if (!quantity || parseInt(quantity) < 1) return setError('Ingresá una cantidad válida')
    if (movType === 'salida' && destino === 'repartidor' && !repartidorId) return setError('Seleccioná qué repartidor se lleva el stock')
    setSaving(true)
    setError('')
    try {
      await apiFetch('/api/products/stock/movement', {
        method: 'POST',
        body: JSON.stringify({
          product_id: selectedProduct,
          type: movType,
          quantity: parseInt(quantity),
          reason: reason || null,
          notes: notes || null,
          destino: movType === 'salida' ? destino : undefined,
          repartidor_id: movType === 'salida' && destino === 'repartidor' ? (repartidorId || undefined) : undefined,
        }),
      })
      setSuccessMsg(`${movType === 'entrada' ? 'Entrada' : 'Salida'} registrada correctamente`)
      setQuantity('')
      setReason('')
      setNotes('')
      setTimeout(() => setSuccessMsg(''), 3000)
      loadData()
    } catch (err: any) {
      try { setError(JSON.parse(err.message).error) } catch { setError(err.message) }
    } finally { setSaving(false) }
  }

  const filteredHistory = filterProduct
    ? history.filter(h => h.product_name === filterProduct)
    : history

  const totalStock = products.reduce((s, p) => s + (p.stock_quantity ?? 0), 0)
  const lowStock   = products.filter(p => (p.stock_quantity ?? 0) <= STOCK_MIN)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: theme.colors.bg }}>
      <div className="text-center">
        <span className="text-5xl">📦</span>
        <p className="mt-3" style={{ color: theme.colors.textFaint }}>Cargando stock...</p>
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
          <span className="text-2xl">📦</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: theme.colors.text }}>Stock Interno</h1>
            <p className="text-xs" style={{ color: theme.colors.textFaint }}>Control de inventario · TROMEN</p>
          </div>
        </div>
        <button onClick={loadData}
          className="cult-btn rounded-lg px-3 py-1.5 text-sm font-semibold"
          style={{ background: theme.colors.accentSoft, color: theme.colors.accent }}>
          ↻ Actualizar
        </button>
      </nav>

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

        {/* STATS */}
        <FadeIn className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={cardCls + ' cult-card p-5'}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.colors.textFaint }}>Total en stock</p>
            <p className="text-3xl font-bold mt-1" style={{ color: theme.colors.accent }}><CountUp end={totalStock} /></p>
            <p className="text-xs mt-1" style={{ color: theme.colors.textFaint }}>unidades totales</p>
          </div>
          <div className={cardCls + ' cult-card p-5'}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.colors.textFaint }}>Productos</p>
            <p className="text-3xl font-bold mt-1" style={{ color: theme.colors.success }}><CountUp end={products.length} /></p>
            <p className="text-xs mt-1" style={{ color: theme.colors.textFaint }}>en catálogo activo</p>
          </div>
          <div className={cardCls + ' cult-card p-5'}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.colors.textFaint }}>Stock bajo</p>
            <p className="text-3xl font-bold mt-1" style={{ color: lowStock.length > 0 ? theme.colors.error : theme.colors.success }}>
              <CountUp end={lowStock.length} />
            </p>
            <p className="text-xs mt-1" style={{ color: theme.colors.textFaint }}>productos con poco stock</p>
          </div>
          <div className={cardCls + ' cult-card p-5'}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.colors.textFaint }}>Movimientos</p>
            <p className="text-3xl font-bold mt-1" style={{ color: theme.colors.accent }}><CountUp end={history.length} /></p>
            <p className="text-xs mt-1" style={{ color: theme.colors.textFaint }}>registrados en total</p>
          </div>
        </FadeIn>

        {/* ALERTA STOCK BAJO */}
        {lowStock.length > 0 && (
          <div className="rounded-xl px-5 py-3 flex items-center gap-3 border" style={{ background: theme.colors.errorSoft, borderColor: theme.colors.error }}>
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: theme.colors.error }}>Stock bajo en: {lowStock.map(p => p.name).join(', ')}</p>
              <p className="text-xs mt-0.5" style={{ color: theme.colors.error }}>Considerá registrar una entrada de stock.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* STOCK ACTUAL */}
          <div className={cardCls + ' lg:col-span-2'}>
            <div className="px-5 py-4 border-b" style={{ borderColor: theme.colors.border }}>
              <h3 className="font-bold" style={{ color: theme.colors.text }}>📋 Stock actual por producto</h3>
            </div>
            <div className="divide-y divide-[#1E2D40]">
              {products.length === 0
                ? <p className="text-center py-12 text-sm" style={{ color: theme.colors.textFaint }}>Sin productos en catálogo</p>
                : products.map(p => {
                  const stock = p.stock_quantity ?? 0
                  const isLow = stock <= STOCK_MIN
                  const pct = Math.min(100, (stock / 100) * 100)
                  return (
                    <div key={p.id} className="p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm" style={{ color: theme.colors.text }}>{p.name}</p>
                          {isLow && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: theme.colors.errorSoft, color: theme.colors.error }}>
                              Stock bajo
                            </span>
                          )}
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: theme.colors.surface2 }}>
                          <div className="h-2 rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: isLow ? theme.colors.error : theme.colors.accent
                            }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 w-24">
                        <p className="font-bold text-lg" style={{ color: isLow ? theme.colors.error : theme.colors.accent }}>
                          {stock}
                        </p>
                        <p className="text-xs" style={{ color: theme.colors.textFaint }}>{p.unit}</p>
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>

          {/* FORMULARIO MOVIMIENTO */}
          <div className={cardCls}>
            <div className="px-5 py-4 border-b" style={{ borderColor: theme.colors.border }}>
              <h3 className="font-bold" style={{ color: theme.colors.text }}>➕ Registrar movimiento</h3>
            </div>
            <div className="p-5 space-y-4">

              {/* Tipo */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMovType('entrada')}
                  className="cult-btn py-2.5 rounded-xl text-sm font-bold transition-colors"
                  style={{
                    background: movType === 'entrada' ? theme.colors.success : theme.colors.surface2,
                    color: movType === 'entrada' ? 'white' : theme.colors.textMuted
                  }}>
                  ⬆️ Entrada
                </button>
                <button onClick={() => setMovType('salida')}
                  className="cult-btn py-2.5 rounded-xl text-sm font-bold transition-colors"
                  style={{
                    background: movType === 'salida' ? theme.colors.error : theme.colors.surface2,
                    color: movType === 'salida' ? 'white' : theme.colors.textMuted
                  }}>
                  ⬇️ Salida
                </button>
              </div>

              {/* Producto */}
              <div>
                <label className={labelCls}>Producto</label>
                <select
                  className={inputCls}
                  value={selectedProduct}
                  onChange={e => setSelectedProduct(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (stock: {p.stock_quantity ?? 0})</option>
                  ))}
                </select>
              </div>

              {/* Destino (solo salida) */}
              {movType === 'salida' && (
                <div>
                  <label className={labelCls}>Destino de la salida</label>
                  <div className="grid grid-cols-2 gap-2 mb-2 mt-1">
                    <button type="button" onClick={() => setDestino('repartidor')}
                      className="rounded-xl py-2 text-sm font-semibold transition-all"
                      style={{ background: destino === 'repartidor' ? theme.colors.brand : theme.colors.surface2, color: destino === 'repartidor' ? 'white' : theme.colors.textMuted }}>
                      🚚 Repartidor
                    </button>
                    <button type="button" onClick={() => setDestino('deposito')}
                      className="rounded-xl py-2 text-sm font-semibold transition-all"
                      style={{ background: destino === 'deposito' ? theme.colors.brand : theme.colors.surface2, color: destino === 'deposito' ? 'white' : theme.colors.textMuted }}>
                      🏪 Venta depósito
                    </button>
                  </div>
                  {destino === 'repartidor' && (
                    <select
                      className={inputCls + ' !mt-0'}
                      value={repartidorId}
                      onChange={e => setRepartidorId(e.target.value)}>
                      <option value="">¿Qué repartidor?</option>
                      {repartidores.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Cantidad */}
              <div>
                <label className={labelCls}>Cantidad</label>
                <input type="number" min="1"
                  className={inputCls}
                  placeholder="0"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)} />
              </div>

              {/* Motivo */}
              <div>
                <label className={labelCls}>Motivo</label>
                <input type="text"
                  className={inputCls}
                  placeholder="Compra, ajuste, pérdida..."
                  value={reason}
                  onChange={e => setReason(e.target.value)} />
              </div>

              {/* Notas */}
              <div>
                <label className={labelCls}>Notas (opcional)</label>
                <textarea rows={2}
                  className={inputCls + ' resize-none'}
                  placeholder="Observaciones..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)} />
              </div>

              {error && (
                <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: theme.colors.errorSoft, color: theme.colors.error }}>
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="rounded-xl px-4 py-2.5 text-sm font-semibold" style={{ background: theme.colors.successSoft, color: theme.colors.success }}>
                  ✓ {successMsg}
                </div>
              )}

              <button onClick={handleMovement} disabled={saving}
                className="cult-btn w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: movType === 'entrada' ? theme.colors.success : theme.colors.error }}>
                {saving ? 'Guardando...' : `Registrar ${movType}`}
              </button>
            </div>
          </div>
        </div>

        {/* HISTORIAL */}
        <div className={cardCls}>
          <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3" style={{ borderColor: theme.colors.border }}>
            <h3 className="font-bold" style={{ color: theme.colors.text }}>🕒 Historial de movimientos</h3>
            <select
              className={inputCls + ' !mt-0 !w-auto'}
              value={filterProduct}
              onChange={e => setFilterProduct(e.target.value)}>
              <option value="">Todos los productos</option>
              {Array.from(new Set(history.map(h => h.product_name))).map(name => (
                <option key={name as string} value={name as string}>{name as string}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: theme.colors.bg }}>
                  <th className="px-5 py-3 text-xs font-semibold uppercase" style={{ color: theme.colors.textFaint }}>Fecha</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase" style={{ color: theme.colors.textFaint }}>Producto</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase" style={{ color: theme.colors.textFaint }}>Tipo</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase" style={{ color: theme.colors.textFaint }}>Cantidad</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase" style={{ color: theme.colors.textFaint }}>Motivo</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase" style={{ color: theme.colors.textFaint }}>Destino</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase" style={{ color: theme.colors.textFaint }}>Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2D40]">
                {filteredHistory.length === 0
                  ? <tr><td colSpan={7} className="text-center py-12" style={{ color: theme.colors.textFaint }}>Sin movimientos registrados</td></tr>
                  : filteredHistory.map(h => (
                    <tr key={h.id} className="transition-colors hover:bg-[#1A2236]">
                      <td className="px-5 py-3 text-xs whitespace-nowrap" style={{ color: theme.colors.textFaint }}>
                        {new Date(h.created_at).toLocaleDateString('es-AR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{ color: theme.colors.text }}>{h.product_name}</td>
                      <td className="px-5 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{
                            background: h.type === 'entrada' ? theme.colors.successSoft : theme.colors.errorSoft,
                            color: h.type === 'entrada' ? theme.colors.success : theme.colors.error
                          }}>
                          {h.type === 'entrada' ? '⬆️ Entrada' : '⬇️ Salida'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold" style={{ color: h.type === 'entrada' ? theme.colors.success : theme.colors.error }}>
                        {h.type === 'entrada' ? '+' : '-'}{h.quantity} {h.unit}
                      </td>
                      <td className="px-5 py-3" style={{ color: theme.colors.textFaint }}>{h.reason ?? '—'}</td>
                      <td className="px-5 py-3 text-xs" style={{ color: theme.colors.textFaint }}>
                        {h.type === 'salida' && h.destino === 'repartidor' ? `🚚 ${h.repartidor_name ?? 'Repartidor'}`
                          : h.type === 'salida' && h.destino === 'deposito' ? '🏪 Depósito'
                          : '—'}
                      </td>
                      <td className="px-5 py-3" style={{ color: theme.colors.textFaint }}>{h.user_name}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
