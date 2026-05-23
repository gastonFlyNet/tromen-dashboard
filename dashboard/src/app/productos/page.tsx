'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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

  return (
    <div className="min-h-screen" style={{ background: '#F0F7FC' }}>

      {/* NAVBAR */}
      <nav className="text-white px-6 py-4 flex items-center justify-between shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="text-blue-200 hover:text-white text-sm mr-2">← Volver</button>
          <span className="text-2xl">🛒</span>
          <div>
            <h1 className="font-bold text-lg">Productos y precios</h1>
            <p className="text-blue-200 text-xs">TROMEN · Catriel</p>
          </div>
        </div>
        <button onClick={openNew}
          className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-bold transition-all">
          + Nuevo producto
        </button>
      </nav>

      <div className="p-4 md:p-6 max-w-4xl mx-auto">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm mb-4">{error}</div>
        )}

        {/* INFO */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="text-blue-800 font-semibold text-sm">Precios que ve el repartidor</p>
            <p className="text-blue-600 text-xs mt-1">
              Estos precios aparecen en la app del repartidor al registrar una entrega.
              Podés editarlos en cualquier momento y se actualizan automáticamente.
            </p>
          </div>
        </div>

        {/* LISTA */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Cargando productos...</div>
        ) : (
          <div className="space-y-3">
            {products.map(p => (
              <div key={p.id} className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${p.active ? 'border-blue-50' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-center gap-4">
                  {/* Orden */}
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                    {p.sort_order}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-800">{p.name}</p>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        por {p.unit}
                      </span>
                      {p.has_empty_return && (
                        <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                          🫙 devuelve envase
                        </span>
                      )}
                      {!p.active && (
                        <span className="text-xs bg-red-50 text-red-400 px-2 py-0.5 rounded-full">Inactivo</span>
                      )}
                    </div>
                  </div>

                  {/* Precio editable rápido */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-blue-700 text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                      className="text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all">
                      Editar
                    </button>
                    <button onClick={() => handleToggleActive(p)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
                        p.active
                          ? 'text-red-400 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}>
                      {p.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {products.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <p className="text-4xl mb-3">🛒</p>
                <p>No hay productos cargados</p>
                <button onClick={openNew}
                  className="mt-4 bg-blue-600 text-white rounded-xl px-6 py-2 text-sm font-bold">
                  + Agregar primer producto
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-800">
                {editing ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Nombre *</label>
                <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Ej: Bidón de agua 20L"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Unidad</label>
                  <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Precio $ *</label>
                  <input type="number" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="0.00"
                    value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Orden en app</label>
                  <input type="number" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="1"
                    value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50">
                    <input type="checkbox" className="w-4 h-4 accent-blue-600"
                      checked={form.has_empty_return}
                      onChange={e => setForm(f => ({ ...f, has_empty_return: e.target.checked }))} />
                    <span className="text-sm text-gray-700">🫙 Devuelve envase</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-bold">
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
