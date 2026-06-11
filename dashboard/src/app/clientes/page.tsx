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

  const inputCls =
    'w-full rounded-xl px-4 py-2.5 text-sm mt-1 bg-[var(--surface-3)] ' +
    'border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-faint)] ' +
    'focus:outline-none focus:border-[var(--primary)] transition-colors'
  const labelCls = 'text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide'
  const cardCls =
    'rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]'

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* NAVBAR */}
      <nav className="px-6 py-4 flex items-center justify-between sticky top-0 z-30 border-b border-[var(--border)]"
        style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)', boxShadow: 'var(--shadow)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')}
            className="text-white/70 hover:text-white text-sm mr-2 transition-colors">← Volver</button>
          <span className="text-2xl">👥</span>
          <div>
            <h1 className="font-bold text-lg text-white">Clientes</h1>
            <p className="text-white/60 text-xs">TROMEN · Catriel</p>
          </div>
        </div>
        <button onClick={openNew}
          className="text-white rounded-xl px-4 py-2 text-sm font-bold transition-all hover:brightness-110"
          style={{ background: 'var(--success)' }}>
          + Nuevo cliente
        </button>
      </nav>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">

        {/* BUSCADOR */}
        <div className="mb-5">
          <input
            className={inputCls + ' !mt-0 py-3 shadow-[var(--shadow-sm)]'}
            placeholder="🔍 Buscar por nombre, dirección o zona..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {([
            ['Total clientes', clients.length, '👥', 'var(--primary)'],
            ['Con GPS', clients.filter(c => c.latitude && c.longitude).length, '📍', 'var(--success)'],
            ['Con saldo', clients.filter(c => Number(c.balance ?? c.current_balance) > 0).length, '💰', 'var(--warning)'],
          ] as const).map(([l, v, e, c]) => (
            <div key={l} className={cardCls + ' p-4 text-center'}>
              <p className="text-2xl">{e}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: c }}>{v}</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">{l}</p>
            </div>
          ))}
        </div>

        {/* LISTA */}
        {loading ? (
          <div className="text-center py-20 text-[var(--text-faint)]">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-faint)]">
            <p className="text-4xl mb-3">👥</p>
            <p>{search ? 'Sin resultados para esa búsqueda' : 'No hay clientes cargados'}</p>
            {!search && (
              <button onClick={openNew}
                className="mt-4 text-white rounded-xl px-6 py-2 text-sm font-bold"
                style={{ background: 'var(--primary)' }}>
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
                  className={cardCls + ' p-4 flex items-start gap-4 cursor-pointer transition-colors hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]'}
                  onClick={() => router.push(`/clientes/${c.id}`)}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)' }}>
                    {c.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[var(--text)]">{c.name}</p>
                      {c.zone && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>{c.zone}</span>
                      )}
                      {hasGps
                        ? <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>📍 GPS OK</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>Sin GPS</span>
                      }
                      {balance > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                          💰 ${balance.toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mt-1">📍 {c.address}</p>
                    {c.phone && <p className="text-xs text-[var(--text-faint)] mt-0.5">📞 {c.phone}</p>}
                    {hasGps && (
                      <p className="text-xs text-[var(--text-faint)] mt-0.5">
                        {Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c) }}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all hover:bg-[var(--surface-2)]"
                      style={{ color: 'var(--primary)' }}>
                      Editar
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(c.id) }}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all hover:bg-[var(--danger-soft)]"
                      style={{ color: 'var(--danger)' }}>
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
          <div className="rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--surface)] border border-[var(--border)]"
            style={{ boxShadow: 'var(--shadow)' }}>
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--surface)]">
              <h2 className="font-bold text-lg text-[var(--text)]">
                {editing ? 'Editar cliente' : 'Nuevo cliente'}
              </h2>
              <button onClick={() => setShowModal(false)}
                className="text-[var(--text-faint)] hover:text-[var(--text)] text-xl transition-colors">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="rounded-xl p-3 text-sm"
                  style={{ background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
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
                  <label className={labelCls}>{label}</label>
                  <input
                    className={inputCls}
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              {/* COORDENADAS GPS */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>Coordenadas GPS</label>
                  <button onClick={getCoords}
                    className="text-xs font-semibold hover:brightness-125 transition-all"
                    style={{ color: 'var(--primary)' }}>
                    🔍 Buscar por dirección
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--text-faint)]">Latitud</label>
                    <input className={inputCls} placeholder="-37.8855"
                      value={form.latitude}
                      onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-faint)]">Longitud</label>
                    <input className={inputCls} placeholder="-68.0783"
                      value={form.longitude}
                      onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs text-[var(--text-faint)] mt-1">
                  Tip: En Google Maps, clic derecho sobre la dirección y copiá las coordenadas
                </p>
              </div>

              <div>
                <label className={labelCls}>Saldo pendiente</label>
                <input className={inputCls} placeholder="0" type="number"
                  value={form.balance}
                  onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
              </div>

              <div>
                <label className={labelCls}>Notas</label>
                <textarea className={inputCls + ' h-20 resize-none'}
                  placeholder="Observaciones del cliente..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="p-6 border-t border-[var(--border)] flex gap-3 sticky bottom-0 bg-[var(--surface)]">
              <button onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 text-white rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 hover:brightness-110"
                style={{ background: 'var(--primary)' }}>
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
          <div className="rounded-2xl p-6 max-w-sm w-full bg-[var(--surface)] border border-[var(--border)]"
            style={{ boxShadow: 'var(--shadow)' }}>
            <p className="text-3xl text-center mb-3">⚠️</p>
            <h3 className="font-bold text-center text-[var(--text)] mb-2">¿Borrar este cliente?</h3>
            <p className="text-sm text-[var(--text-muted)] text-center mb-6">
              Esta acción no se puede deshacer. Se eliminarán todos los datos del cliente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-all">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 text-white rounded-xl py-2.5 text-sm font-bold transition-all hover:brightness-110"
                style={{ background: 'var(--danger)' }}>
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
