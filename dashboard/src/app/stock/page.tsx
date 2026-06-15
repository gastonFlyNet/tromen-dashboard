'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1117' }}>
      <div className="text-center">
        <span className="text-5xl">📦</span>
        <p className="text-gray-400 mt-3">Cargando stock...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'row' }}>

      <Sidebar />

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>

      {/* HEADER */}
      <nav className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: '#151b27', borderBottom: '1px solid #1e2d40' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">📦</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#f1f5f9' }}>Stock Interno</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>Control de inventario · TROMEN</p>
          </div>
        </div>
        <button onClick={loadData}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all"
          style={{ background: 'rgba(56,189,248,0.14)', color: '#38bdf8' }}>
          ↻ Actualizar
        </button>
      </nav>

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total en stock</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#0A5C8A' }}>{totalStock}</p>
            <p className="text-xs text-gray-400 mt-1">unidades totales</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Productos</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#1A7A4A' }}>{products.length}</p>
            <p className="text-xs text-gray-400 mt-1">en catálogo activo</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Stock bajo</p>
            <p className="text-3xl font-bold mt-1" style={{ color: lowStock.length > 0 ? '#C0392B' : '#1A7A4A' }}>
              {lowStock.length}
            </p>
            <p className="text-xs text-gray-400 mt-1">productos con poco stock</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Movimientos</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#0A5C8A' }}>{history.length}</p>
            <p className="text-xs text-gray-400 mt-1">registrados en total</p>
          </div>
        </div>

        {/* ALERTA STOCK BAJO */}
        {lowStock.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-red-700 font-semibold text-sm">Stock bajo en: {lowStock.map(p => p.name).join(', ')}</p>
              <p className="text-red-500 text-xs mt-0.5">Considerá registrar una entrada de stock.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* STOCK ACTUAL */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-blue-50">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-700">📋 Stock actual por producto</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {products.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">Sin productos en catálogo</p>
                : products.map(p => {
                  const stock = p.stock_quantity ?? 0
                  const isLow = stock <= STOCK_MIN
                  const pct = Math.min(100, (stock / 100) * 100)
                  return (
                    <div key={p.id} className="p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-800 text-sm">{p.name}</p>
                          {isLow && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: '#FEE2E2', color: '#991B1B' }}>
                              Stock bajo
                            </span>
                          )}
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-2 rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: isLow ? '#EF4444' : '#0A5C8A'
                            }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 w-24">
                        <p className="font-bold text-lg" style={{ color: isLow ? '#C0392B' : '#0A5C8A' }}>
                          {stock}
                        </p>
                        <p className="text-xs text-gray-400">{p.unit}</p>
                      </div>
                    </div>
                  )
                })
              }
            </div>
          </div>

          {/* FORMULARIO MOVIMIENTO */}
          <div className="bg-white rounded-2xl shadow-sm border border-blue-50">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-700">➕ Registrar movimiento</h3>
            </div>
            <div className="p-5 space-y-4">

              {/* Tipo */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMovType('entrada')}
                  className="py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: movType === 'entrada' ? '#1A7A4A' : '#F0F7FC',
                    color: movType === 'entrada' ? 'white' : '#6b7280'
                  }}>
                  ⬆️ Entrada
                </button>
                <button onClick={() => setMovType('salida')}
                  className="py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: movType === 'salida' ? '#C0392B' : '#F0F7FC',
                    color: movType === 'salida' ? 'white' : '#6b7280'
                  }}>
                  ⬇️ Salida
                </button>
              </div>

              {/* Producto */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Producto</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Destino de la salida</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button type="button" onClick={() => setDestino('repartidor')}
                      className="rounded-xl py-2 text-sm font-semibold transition-all"
                      style={{ background: destino === 'repartidor' ? '#0A5C8A' : '#F0F7FC', color: destino === 'repartidor' ? 'white' : '#6b7280' }}>
                      🚚 Repartidor
                    </button>
                    <button type="button" onClick={() => setDestino('deposito')}
                      className="rounded-xl py-2 text-sm font-semibold transition-all"
                      style={{ background: destino === 'deposito' ? '#0A5C8A' : '#F0F7FC', color: destino === 'deposito' ? 'white' : '#6b7280' }}>
                      🏪 Venta depósito
                    </button>
                  </div>
                  {destino === 'repartidor' && (
                    <select
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Cantidad</label>
                <input type="number" min="1"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="0"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)} />
              </div>

              {/* Motivo */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Motivo</label>
                <input type="text"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Compra, ajuste, pérdida..."
                  value={reason}
                  onChange={e => setReason(e.target.value)} />
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Notas (opcional)</label>
                <textarea rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  placeholder="Observaciones..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)} />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-green-700 text-sm font-semibold">
                  ✓ {successMsg}
                </div>
              )}

              <button onClick={handleMovement} disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: movType === 'entrada' ? '#1A7A4A' : '#C0392B' }}>
                {saving ? 'Guardando...' : `Registrar ${movType}`}
              </button>
            </div>
          </div>
        </div>

        {/* HISTORIAL */}
        <div className="bg-white rounded-2xl shadow-sm border border-blue-50">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-bold text-gray-700">🕒 Historial de movimientos</h3>
            <select
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Motivo</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Destino</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredHistory.length === 0
                  ? <tr><td colSpan={7} className="text-center text-gray-400 py-12">Sin movimientos registrados</td></tr>
                  : filteredHistory.map(h => (
                    <tr key={h.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(h.created_at).toLocaleDateString('es-AR', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-800">{h.product_name}</td>
                      <td className="px-5 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{
                            background: h.type === 'entrada' ? '#D1FAE5' : '#FEE2E2',
                            color: h.type === 'entrada' ? '#065F46' : '#991B1B'
                          }}>
                          {h.type === 'entrada' ? '⬆️ Entrada' : '⬇️ Salida'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold" style={{ color: h.type === 'entrada' ? '#1A7A4A' : '#C0392B' }}>
                        {h.type === 'entrada' ? '+' : '-'}{h.quantity} {h.unit}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{h.reason ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {h.type === 'salida' && h.destino === 'repartidor' ? `🚚 ${h.repartidor_name ?? 'Repartidor'}`
                          : h.type === 'salida' && h.destino === 'deposito' ? '🏪 Depósito'
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{h.user_name}</td>
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