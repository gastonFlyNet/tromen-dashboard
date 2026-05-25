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

  return (
    <div className="min-h-screen" style={{ background: '#F0F7FC' }}>

      {/* NAVBAR */}
      <nav className="text-white px-6 py-4 flex items-center justify-between shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="text-blue-200 hover:text-white text-sm mr-2">← Volver</button>
          <span className="text-2xl">👥</span>
          <div>
            <h1 className="font-bold text-lg">Clientes</h1>
            <p className="text-blue-200 text-xs">TROMEN · Catriel</p>
          </div>
        </div>
        <button onClick={openNew}
          className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-bold transition-all">
          + Nuevo cliente
        </button>
      </nav>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">

        {/* BUSCADOR */}
        <div className="mb-4">
          <input
            className="w-full border border-blue-100 rounded-xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="🔍 Buscar por nombre, dirección o zona..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            ['Total clientes', clients.length, '👥', '#0A5C8A'],
            ['Con coordenadas GPS', clients.filter(c => c.latitude && c.longitude).length, '📍', '#1A7A4A'],
            ['Con saldo pendiente', clients.filter(c => Number(c.balance ?? c.current_balance) > 0).length, '💰', '#E67E22'],
          ].map(([l, v, e, c]) => (
            <div key={l as string} className="bg-white rounded-2xl p-4 shadow-sm border border-blue-50 text-center">
              <p className="text-2xl">{e as string}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: c as string }}>{v as number}</p>
              <p className="text-xs text-gray-400 mt-1">{l as string}</p>
            </div>
          ))}
        </div>

        {/* LISTA */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">👥</p>
            <p>{search ? 'Sin resultados para esa búsqueda' : 'No hay clientes cargados'}</p>
            {!search && (
              <button onClick={openNew}
                className="mt-4 bg-blue-600 text-white rounded-xl px-6 py-2 text-sm font-bold">
                + Agregar primer cliente
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-blue-50 flex items-start gap-4 cursor-pointer hover:border-blue-200 transition-all" onClick={() => router.push(`/clientes/${c.id}`)}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: '#0A5C8A' }}>
                  {c.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-800">{c.name}</p>
                    {c.zone && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{c.zone}</span>
                    )}
                    {c.latitude && c.longitude
                      ? <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">📍 GPS OK</span>
                      : <span className="text-xs bg-red-50 text-red-400 px-2 py-0.5 rounded-full">Sin GPS</span>
                    }
                    {Number(c.balance ?? c.current_balance) > 0 && (
                      <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                        💰 ${Number(c.balance ?? c.current_balance).toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">📍 {c.address}</p>
                  {c.phone && <p className="text-xs text-gray-400 mt-0.5">📞 {c.phone}</p>}
                  {c.latitude && c.longitude && (
                    <p className="text-xs text-gray-300 mt-0.5">
                      {Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(c) }}
                    className="text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all">
                    Editar
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(c.id) }}
                    className="text-red-400 hover:bg-red-50 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all">
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CLIENTE */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg text-gray-800">
                {editing ? 'Editar cliente' : 'Nuevo cliente'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>
              )}

              {[
                { key: 'name',    label: 'Nombre *',     placeholder: 'Almacén Don Carlos' },
                { key: 'address', label: 'Dirección *',  placeholder: 'Av. Roca 1234' },
                { key: 'zone',    label: 'Zona',         placeholder: 'Centro, Norte, Sur...' },
                { key: 'phone',   label: 'Teléfono',     placeholder: '2994000000' },
                { key: 'email',   label: 'Email',        placeholder: 'cliente@email.com' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              {/* COORDENADAS GPS */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Coordenadas GPS
                  </label>
                  <button onClick={getCoords}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold">
                    🔍 Buscar por dirección
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Latitud</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="-37.8855"
                      value={form.latitude}
                      onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Longitud</label>
                    <input
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="-68.0783"
                      value={form.longitude}
                      onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Tip: En Google Maps, hacé clic derecho sobre la dirección y copiá las coordenadas
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  saldo pendiente
                </label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="0"
                  type="number"
                  value={form.balance}
                  onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notas</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300 h-20 resize-none"
                  placeholder="Observaciones del cliente..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50">
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR BORRADO */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-3xl text-center mb-3">⚠️</p>
            <h3 className="font-bold text-center text-gray-800 mb-2">¿Borrar este cliente?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Esta acción no se puede deshacer. Se eliminarán todos los datos del cliente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-600">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold">
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
