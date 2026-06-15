'use client'
import { useEffect, useState } from 'react'
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

const EMPTY_PRODUCT = {
  name: '', unit: 'unidad', price: '', has_empty_return: false, sort_order: '99'
}

const UNITS = ['unidad', 'bidón', 'sifón', 'kg', 'litro', 'botella', 'bolsa', 'caja']

export default function ProductosPage() {
  const router = useRouter()
  const [products, setProducts]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<any>(null)
  const [form, setForm]           = useState({ ...EMPTY_PRODUCT })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/products/all')
      setProducts(Array.isArray(data) ? data : [])
    } catch { setError('No se pudieron cargar los productos') }
    finally { setLoading(false) }
  }

  const openNew = () => {
    setEditing(null)
    setForm({ ...EMPTY_PRODUCT })
    setError('')
    setShowModal(true)
  }

  const openEdit = (p: any) => {
    setEditing(p)
    setForm({
      name: p.name ?? '',
      unit: p.unit ?? 'unidad',
      price: p.price ?? '',
      has_empty_return: p.has_empty_return ?? false,
      sort_order: p.sort_order ?? '99',
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return setError('El nombre es obligatorio')
    if (form.price === '' || isNaN(Number(form.price))) return setError('El precio es obligatorio')
    setSaving(true)
    setError('')
    try {
      const body = {
        name: form.name,
        unit: form.unit,
        price: parseFloat(String(form.price)),
        has_empty_return: form.has_empty_return,
        sort_order: parseInt(String(form.sort_order)) || 99,
      }
      if (editing) {
        await apiFetch(`/api/products/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(body) })
      }
      setShowModal(false)
      loadProducts()
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleToggleActive = async (product: any) => {
    try {
      await apiFetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !product.active }),
      })
      loadProducts()
    } catch { setError('No se pudo actualizar') }
  }

  const handlePriceQuickEdit = async (product: any, newPrice: string) => {
    if (isNaN(Number(newPrice))) return
    try {
      await apiFetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ price: parseFloat(newPrice) }),
      })
      loadProducts()
    } catch {}
  }

  // ---- estilos reutilizables (tokens del design system) ----
  const inputCls =
    'w-full rounded-xl px-4 py-2.5 text-sm mt-1 bg-[var(--surface-3)] ' +
    'border border-[#e5e7eb] text-[#1f2937] placeholder-[#9ca3af] ' +
    'focus:outline-none focus:border-[#0A5C8A] transition-colors'
  const labelCls = 'text-xs font-semibold text-[#6b7280] uppercase tracking-wide'
  const cardCls =
    'rounded-2xl bg-[#ffffff] border border-[#e5e7eb] shadow-[0 1px 3px rgba(0,0,0,0.1)]'

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'row' }}>

      <Sidebar />

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>

      {/* HEADER */}
      <nav className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: '#151b27', borderBottom: '1px solid #1e2d40' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛒</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#f1f5f9' }}>Productos y precios</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>TROMEN · Catriel</p>
          </div>
        </div>
        <button onClick={openNew}
          className="text-white rounded-xl px-4 py-2 text-sm font-bold transition-all hover:brightness-110"
          style={{ background: '#16a34a' }}>
          + Nuevo producto
        </button>
      </nav>

      <div className="p-4 md:p-6 max-w-4xl mx-auto">

        {error && (
          <div className="rounded-xl p-3 text-sm mb-4"
            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #dc2626' }}>
            {error}
          </div>
        )}

        {/* INFO */}
        <div className="rounded-xl p-4 mb-6 flex items-start gap-3"
          style={{ background: '#e0f2fe', border: '1px solid #e5e7eb' }}>
          <span className="text-2xl">💡</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: '#1f2937' }}>Precios que ve el repartidor</p>
            <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
              Estos precios aparecen en la app del repartidor al registrar una entrega.
              Podés editarlos en cualquier momento y se actualizan automáticamente.
            </p>
          </div>
        </div>

        {/* LISTA */}
        {loading ? (
          <div className="text-center py-20 text-[#9ca3af]">Cargando productos...</div>
        ) : (
          <div className="space-y-3">
            {products.map(p => (
              <div key={p.id}
                className={cardCls + ' p-4 transition-all hover:bg-[var(--surface-2)]'}
                style={{ opacity: p.active ? 1 : 0.55 }}>
                <div className="flex items-center gap-4">
                  {/* Orden */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: '#e0f2fe', color: '#0A5C8A' }}>
                    {p.sort_order}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#1f2937]">{p.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--surface-3)', color: '#6b7280' }}>
                        por {p.unit}
                      </span>
                      {p.has_empty_return && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#fef3c7', color: '#d97706' }}>
                          🫙 devuelve envase
                        </span>
                      )}
                      {!p.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#fee2e2', color: '#dc2626' }}>Inactivo</span>
                      )}
                    </div>
                  </div>

                  {/* Precio editable rápido */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[#9ca3af] text-sm">$</span>
                    <input
                      type="number"
                      className="w-28 rounded-xl px-3 py-2 text-sm font-bold text-center bg-[var(--surface-3)] border border-[#e5e7eb] focus:outline-none focus:border-[#0A5C8A] transition-colors"
                      style={{ color: '#0A5C8A' }}
                      defaultValue={Number(p.price)}
                      onBlur={e => {
                        if (e.target.value !== String(Number(p.price))) {
                          handlePriceQuickEdit(p, e.target.value)
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handlePriceQuickEdit(p, (e.target as HTMLInputElement).value)
                          ;(e.target as HTMLInputElement).blur()
                        }
                      }}
                    />
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(p)}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all hover:bg-[var(--surface-2)]"
                      style={{ color: '#0A5C8A' }}>
                      Editar
                    </button>
                    <button onClick={() => handleToggleActive(p)}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all hover:brightness-125"
                      style={{ color: p.active ? '#dc2626' : '#16a34a' }}>
                      {p.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {products.length === 0 && (
              <div className="text-center py-20 text-[#9ca3af]">
                <p className="text-4xl mb-3">🛒</p>
                <p>No hay productos cargados</p>
                <button onClick={openNew}
                  className="mt-4 text-white rounded-xl px-6 py-2 text-sm font-bold"
                  style={{ background: '#0A5C8A' }}>
                  + Agregar primer producto
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl w-full max-w-md bg-white border border-gray-200 shadow-xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-800">
                {editing ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl transition-colors">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="rounded-xl p-3 text-sm bg-red-50 text-red-600 border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre *</label>
                <input
                  className="w-full rounded-xl px-4 py-2.5 text-sm mt-1 bg-white border border-gray-300 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Ej: Bidón de agua 20L"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidad</label>
                  <select
                    className="w-full rounded-xl px-4 py-2.5 text-sm mt-1 bg-white border border-gray-300 text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                    value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Precio $ *</label>
                  <input type="number"
                    className="w-full rounded-xl px-4 py-2.5 text-sm mt-1 bg-white border border-gray-300 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="0.00"
                    value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Orden en app</label>
                  <input type="number"
                    className="w-full rounded-xl px-4 py-2.5 text-sm mt-1 bg-white border border-gray-300 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="1"
                    value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors">
                    <input type="checkbox" className="w-4 h-4 accent-blue-600"
                      checked={form.has_empty_return}
                      onChange={e => setForm(f => ({ ...f, has_empty_return: e.target.checked }))} />
                    <span className="text-sm text-gray-600">🫙 Devuelve envase</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all border border-gray-300 text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 text-white rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 hover:brightness-110"
                style={{ background: '#0A5C8A' }}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}