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

const EMPTY_CLIENT = {
  name: '', address: '', zone: '', phone: '', email: '',
  latitude: '', longitude: '', balance: '0', notes: '',
}

export default function ClientesPage() {
  const router = useRouter()
  const [clients, setClients]       = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<any>(null)
  const [form, setForm]             = useState({ ...EMPTY_CLIENT })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    loadClients()
  }, [])

  const loadClients = async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/api/clients')
      setClients(Array.isArray(data) ? data : data.clients ?? [])
    } catch { setError('No se pudieron cargar los clientes') }
    finally { setLoading(false) }
  }

  const openNew = () => {
    setEditing(null)
    setForm({ ...EMPTY_CLIENT })
    setError('')
    setShowModal(true)
  }

  const openEdit = (c: any) => {
    setEditing(c)
    setForm({
      name: c.name ?? '', address: c.address ?? '', zone: c.zone ?? '',
      phone: c.phone ?? '', email: c.email ?? '',
      latitude: c.latitude ?? '', longitude: c.longitude ?? '',
      balance: c.balance ?? '0', notes: c.notes ?? '',
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return setError('El nombre es obligatorio')
    if (!form.address.trim()) return setError('La dirección es obligatoria')
    setSaving(true)
    setError('')
    try {
      const body = {
        ...form,
        latitude:  form.latitude  ? parseFloat(form.latitude)  : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        balance: parseFloat(form.balance || '0'),
      }
      if (editing) {
        await apiFetch(`/api/clients/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiFetch('/api/clients', { method: 'POST', body: JSON.stringify(body) })
      }
      setShowModal(false)
      loadClients()
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/clients/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null)
      loadClients()
    } catch { setError('No se pudo eliminar el cliente') }
  }

  const getCoords = async () => {
    if (!form.address || !form.address.trim()) return setError('Ingresá una dirección primero')
    try {
      const q = encodeURIComponent(`${form.address}, Catriel, Río Negro, Argentina`)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`)
      const data = await res.json()
      if (data.length > 0) {
        setForm(f => ({ ...f, latitude: data[0].lat, longitude: data[0].lon }))
        setError('')
      } else {
        setError('No se encontraron coordenadas para esa dirección. Ingresalas manualmente.')
      }
    } catch { setError('Error buscando coordenadas') }
  }

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.address?.toLowerCase().includes(search.toLowerCase()) ||
    c.zone?.toLowerCase().includes(search.toLowerCase())
  )

  const inputCls =
    'w-full rounded-xl px-4 py-2.5 text-sm mt-1 bg-[var(--surface-3)] ' +
    'border border-[#e5e7eb] text-[#1f2937] placeholder-[#9ca3af] ' +
    'focus:outline-none focus:border-[#0A5C8A] transition-colors'
  const labelCls = 'text-xs font-semibold text-[#6b7280] uppercase tracking-wide'
  const cardCls =
    'rounded-2xl bg-[#ffffff] border border-[#e5e7eb] shadow-[0 1px 3px rgba(0,0,0,0.1)]'

  // ---- estilos claros para los modales ----
  const modalInputCls =
    'w-full rounded-xl px-4 py-2.5 text-sm mt-1 bg-white border border-gray-300 ' +
    'text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors'
  const modalLabelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wide'

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'row' }}>

      <Sidebar />

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>

      {/* HEADER */}
      <nav className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: '#151b27', borderBottom: '1px solid #1e2d40' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">👥</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#f1f5f9' }}>Clientes</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>TROMEN · Catriel</p>
          </div>
        </div>
        <button onClick={openNew}
          className="text-white rounded-xl px-4 py-2 text-sm font-bold transition-all hover:brightness-110"
          style={{ background: '#16a34a' }}>
          + Nuevo cliente
        </button>
      </nav>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">

        {/* BUSCADOR */}
        <div className="mb-5">
          <input
            className={inputCls + ' !mt-0 py-3 shadow-[0 1px 3px rgba(0,0,0,0.1)]'}
            placeholder="🔍 Buscar por nombre, dirección o zona..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {([
            ['Total clientes', clients.length, '👥', '#0A5C8A'],
            ['Con GPS', clients.filter(c => c.latitude && c.longitude).length, '📍', '#16a34a'],
            ['Con saldo', clients.filter(c => Number(c.balance ?? c.current_balance) > 0).length, '💰', '#d97706'],
          ] as const).map(([l, v, e, c]) => (
            <div key={l} className={cardCls + ' p-4 text-center'}>
              <p className="text-2xl">{e}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: c }}>{v}</p>
              <p className="text-xs text-[#9ca3af] mt-1">{l}</p>
            </div>
          ))}
        </div>

        {/* LISTA */}
        {loading ? (
          <div className="text-center py-20 text-[#9ca3af]">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#9ca3af]">
            <p className="text-4xl mb-3">👥</p>
            <p>{search ? 'Sin resultados para esa búsqueda' : 'No hay clientes cargados'}</p>
            {!search && (
              <button onClick={openNew}
                className="mt-4 text-white rounded-xl px-6 py-2 text-sm font-bold"
                style={{ background: '#0A5C8A' }}>
                + Agregar primer cliente
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => {
              const hasGps = c.latitude && c.longitude
              const balance = Number(c.balance ?? c.current_balance)
              return (
                <div key={c.id}
                  className={cardCls + ' p-4 flex items-start gap-4 cursor-pointer transition-colors hover:bg-[var(--surface-2)] hover:border-[#d1d5db]'}
                  onClick={() => router.push(`/clientes/${c.id}`)}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)' }}>
                    {c.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#1f2937]">{c.name}</p>
                      {c.zone && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#e0f2fe', color: '#0A5C8A' }}>{c.zone}</span>
                      )}
                      {hasGps
                        ? <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: '#dcfce7', color: '#16a34a' }}>📍 GPS OK</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: '#fee2e2', color: '#dc2626' }}>Sin GPS</span>
                      }
                      {balance > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#fef3c7', color: '#d97706' }}>
                          💰 ${balance.toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#6b7280] mt-1">📍 {c.address}</p>
                    {c.phone && <p className="text-xs text-[#9ca3af] mt-0.5">📞 {c.phone}</p>}
                    {hasGps && (
                      <p className="text-xs text-[#9ca3af] mt-0.5">
                        {Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c) }}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all hover:bg-[var(--surface-2)]"
                      style={{ color: '#0A5C8A' }}>
                      Editar
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(c.id) }}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all hover:bg-[#fee2e2]"
                      style={{ color: '#dc2626' }}>
                      Borrar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL CLIENTE */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.65)' }}>
          <div className="rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-bold text-lg text-gray-800">
                {editing ? 'Editar cliente' : 'Nuevo cliente'}
              </h2>
              <button onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="rounded-xl p-3 text-sm bg-red-50 text-red-600 border border-red-200">
                  {error}
                </div>
              )}

              {[
                { key: 'name',    label: 'Nombre *',     placeholder: 'Almacén Don Carlos' },
                { key: 'address', label: 'Dirección *',  placeholder: 'Av. Roca 1234' },
                { key: 'zone',    label: 'Zona',         placeholder: 'Centro, Norte, Sur...' },
                { key: 'phone',   label: 'Teléfono',     placeholder: '2994000000' },
                { key: 'email',   label: 'Email',        placeholder: 'cliente@email.com' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className={modalLabelCls}>{label}</label>
                  <input
                    className={modalInputCls}
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              {/* COORDENADAS GPS */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={modalLabelCls}>Coordenadas GPS</label>
                  <button onClick={getCoords}
                    className="text-xs font-semibold hover:brightness-125 transition-all"
                    style={{ color: '#0A5C8A' }}>
                    🔍 Buscar por dirección
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Latitud</label>
                    <input className={modalInputCls} placeholder="-37.8855"
                      value={form.latitude}
                      onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Longitud</label>
                    <input className={modalInputCls} placeholder="-68.0783"
                      value={form.longitude}
                      onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Tip: En Google Maps, clic derecho sobre la dirección y copiá las coordenadas
                </p>
              </div>

              <div>
                <label className={modalLabelCls}>Saldo pendiente</label>
                <input className={modalInputCls} placeholder="0" type="number"
                  value={form.balance}
                  onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
              </div>

              <div>
                <label className={modalLabelCls}>Notas</label>
                <textarea className={modalInputCls + ' h-20 resize-none'}
                  placeholder="Observaciones del cliente..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all border border-gray-300 text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 text-white rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 hover:brightness-110"
                style={{ background: '#0A5C8A' }}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR BORRADO */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.65)' }}>
          <div className="rounded-2xl p-6 max-w-sm w-full bg-white border border-gray-200 shadow-xl">
            <p className="text-3xl text-center mb-3">⚠️</p>
            <h3 className="font-bold text-center text-gray-800 mb-2">¿Borrar este cliente?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Esta acción no se puede deshacer. Se eliminarán todos los datos del cliente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition-all">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 text-white rounded-xl py-2.5 text-sm font-bold transition-all hover:brightness-110"
                style={{ background: '#C0392B' }}>
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}