'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
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
    <div style={{ minHeight: '100vh', background: theme.colors.bg, display: 'flex', flexDirection: 'row' }}>

      <Sidebar />

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>

      {/* HEADER */}
      <nav className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛒</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: theme.colors.text }}>Productos y precios</h1>
            <p className="text-xs" style={{ color: theme.colors.textFaint }}>TROMEN · Catriel</p>
          </div>
        </div>
        <button onClick={openNew}
          className="cult-btn text-white rounded-xl px-4 py-2 text-sm font-bold hover:brightness-110 transition-all"
          style={{ background: theme.colors.success }}>
          + Nuevo producto
        </button>
      </nav>

      <div className="p-4 md:p-6 max-w-4xl mx-auto">

        {error && (
          <div className="rounded-xl p-3 text-sm mb-4 border"
            style={{ background: theme.colors.errorSoft, color: theme.colors.error, borderColor: theme.colors.error }}>
            {error}
          </div>
        )}

        {/* INFO */}
        <div className="rounded-xl p-4 mb-6 flex items-start gap-3 border"
          style={{ background: theme.colors.accentSoft, borderColor: theme.colors.border }}>
          <span className="text-2xl">💡</span>
          <div>
            <p className="font-semibold text-sm" style={{ color: theme.colors.text }}>Precios que ve el repartidor</p>
            <p className="text-xs mt-1" style={{ color: theme.colors.textMuted }}>
              Estos precios aparecen en la app del repartidor al registrar una entrega.
              Podés editarlos en cualquier momento y se actualizan automáticamente.
            </p>
          </div>
        </div>

        {/* LISTA */}
        {loading ? (
          <div className="text-center py-20" style={{ color: theme.colors.textFaint }}>Cargando productos...</div>
        ) : (
          <FadeIn className="space-y-3">
            {products.map(p => (
              <div key={p.id}
                className={cardCls + ' cult-card p-4'}
                style={{ opacity: p.active ? 1 : 0.55 }}>
                <div className="flex items-center gap-4">
                  {/* Orden */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: theme.colors.accentSoft, color: theme.colors.accent }}>
                    {p.sort_order}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold" style={{ color: theme.colors.text }}>{p.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: theme.colors.surface2, color: theme.colors.textMuted }}>
                        por {p.unit}
                      </span>
                      {p.has_empty_return && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: theme.colors.warningSoft, color: theme.colors.warning }}>
                          🫙 devuelve envase
                        </span>
                      )}
                      {!p.active && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: theme.colors.errorSoft, color: theme.colors.error }}>Inactivo</span>
                      )}
                    </div>
                  </div>

                  {/* Precio editable rápido */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm" style={{ color: theme.colors.textFaint }}>$</span>
                    <input
                      type="number"
                      className="w-28 rounded-xl px-3 py-2 text-sm font-bold text-center transition-colors focus:outline-none"
                      style={{ background: theme.colors.surface2, border: `1px solid ${theme.colors.border}`, color: theme.colors.accent }}
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
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[#1A2236]"
                      style={{ color: theme.colors.accent }}>
                      Editar
                    </button>
                    <button onClick={() => handleToggleActive(p)}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all hover:brightness-125"
                      style={{ color: p.active ? theme.colors.error : theme.colors.success }}>
                      {p.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {products.length === 0 && (
              <div className="text-center py-20" style={{ color: theme.colors.textFaint }}>
                <p className="text-4xl mb-3">🛒</p>
                <p>No hay productos cargados</p>
                <button onClick={openNew}
                  className="mt-4 text-white rounded-xl px-6 py-2 text-sm font-bold hover:brightness-110 transition-all"
                  style={{ background: theme.colors.brand }}>
                  + Agregar primer producto
                </button>
              </div>
            )}
          </FadeIn>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={cardCls + ' w-full max-w-md'}>
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: theme.colors.border }}>
              <h2 className="font-bold text-lg" style={{ color: theme.colors.text }}>
                {editing ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => setShowModal(false)}
                className="text-xl transition-colors hover:text-[#F1F5F9]" style={{ color: theme.colors.textFaint }}>✕</button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="rounded-xl p-3 text-sm border"
                  style={{ background: theme.colors.errorSoft, color: theme.colors.error, borderColor: theme.colors.error }}>
                  {error}
                </div>
              )}
              <div>
                <label className={labelCls}>Nombre *</label>
                <input
                  className={inputCls}
                  placeholder="Ej: Bidón de agua 20L"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Unidad</label>
                  <select
                    className={inputCls}
                    value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Precio $ *</label>
                  <input type="number"
                    className={inputCls}
                    placeholder="0.00"
                    value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Orden en app</label>
                  <input type="number"
                    className={inputCls}
                    placeholder="1"
                    value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-colors hover:bg-[#1A2236]"
                    style={{ borderColor: theme.colors.border }}>
                    <input type="checkbox" className="w-4 h-4 accent-[#38BDF8]"
                      checked={form.has_empty_return}
                      onChange={e => setForm(f => ({ ...f, has_empty_return: e.target.checked }))} />
                    <span className="text-sm" style={{ color: theme.colors.textMuted }}>🫙 Devuelve envase</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3" style={{ borderColor: theme.colors.border }}>
              <button onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold transition-colors border hover:bg-[#1A2236]"
                style={{ borderColor: theme.colors.border, color: theme.colors.textMuted }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 text-white rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 hover:brightness-110"
                style={{ background: theme.colors.brand }}>
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
