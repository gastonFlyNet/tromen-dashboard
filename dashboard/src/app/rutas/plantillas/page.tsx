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

const D = {
  bg: '#0f1117', surface: '#151b27', surface2: '#1a2236',
  border: '#1e2d40', text: '#f1f5f9', muted: '#64748b',
  accent: '#38bdf8', blue: '#0A5C8A',
}

const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]
const weekdayLabel = (n: number) => WEEKDAYS.find(w => w.value === n)?.label ?? '—'

export default function PlantillasPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<any[]>([])
  const [repartidores, setRepartidores] = useState<any[]>([])
  const [geofences, setGeofences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [weekday, setWeekday] = useState<number>(1)
  const [templateName, setTemplateName] = useState('')
  const [clients, setClients] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any[]>([])
  const [selectedGeofences, setSelectedGeofences] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [generateConfirm, setGenerateConfirm] = useState<any | null>(null)
  const [generateDate, setGenerateDate] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tpls, users, geo] = await Promise.all([
        apiFetch('/api/route-templates'),
        apiFetch('/api/users?role=repartidor'),
        apiFetch('/api/geofences'),
      ])
      setTemplates(Array.isArray(tpls) ? tpls : [])
      setRepartidores(Array.isArray(users) ? users : users.users ?? [])
      setGeofences(Array.isArray(geo) ? geo.filter((g: any) => g.active) : [])
    } catch {
      setError('Error cargando las plantillas')
    } finally { setLoading(false) }
  }

  const loadClients = async () => {
    try {
      const data = await apiFetch('/api/clients?active=true')
      setClients(Array.isArray(data) ? data : data.clients ?? [])
    } catch {}
  }

  const openNew = async () => {
    setEditingId(null)
    setUserId('')
    setWeekday(1)
    setTemplateName('')
    setSelected([])
    setSelectedGeofences([])
    setSearch('')
    setError('')
    await loadClients()
    setShowModal(true)
  }

  const openEdit = async (templateId: string) => {
    setError('')
    await loadClients()
    try {
      const tpl = await apiFetch(`/api/route-templates/${templateId}`)
      setEditingId(tpl.id)
      setUserId(tpl.user_id)
      setWeekday(tpl.weekday)
      setTemplateName(tpl.name ?? '')
      setSelected((tpl.stops ?? []).map((s: any) => ({
        id: s.client_id,
        name: s.client_name,
        address: s.address,
        expected_amount: String(s.expected_amount ?? '0'),
      })))
      setSelectedGeofences((tpl.geofences ?? []).map((g: any) => g.id))
      setShowModal(true)
    } catch {
      setError('No se pudo abrir la plantilla')
    }
  }

  const toggleClient = (client: any) => {
    setSelected(prev => {
      const exists = prev.find(c => c.id === client.id)
      if (exists) return prev.filter(c => c.id !== client.id)
      return [...prev, { ...client, expected_amount: '0' }]
    })
  }

  const toggleGeofence = (gid: string) => {
    setSelectedGeofences(prev =>
      prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid]
    )
  }

  const moveUp = (i: number) => {
    if (i === 0) return
    setSelected(prev => {
      const arr = [...prev]
      ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
      return arr
    })
  }
  const moveDown = (i: number) => {
    setSelected(prev => {
      if (i === prev.length - 1) return prev
      const arr = [...prev]
      ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
      return arr
    })
  }

  const handleSave = async () => {
    if (!userId) return setError('Seleccioná un repartidor')
    if (selected.length === 0) return setError('Seleccioná al menos un cliente')
    setSaving(true)
    setError('')
    try {
      const stops = selected.map((c, i) => ({
        client_id: c.id,
        expected_amount: parseFloat(c.expected_amount || '0'),
        stop_order: i + 1,
      }))
      if (editingId) {
        await apiFetch(`/api/route-templates/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ name: templateName || null, stops, geofence_ids: selectedGeofences }),
        })
      } else {
        await apiFetch('/api/route-templates', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, weekday, name: templateName || null, stops, geofence_ids: selectedGeofences }),
        })
      }
      setShowModal(false)
      loadData()
    } catch (err: any) {
      setError(err.message ?? 'No se pudo guardar la plantilla')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/route-templates/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null)
      loadData()
    } catch { setError('No se pudo borrar') }
  }

  const handleGenerate = async () => {
    if (!generateConfirm) return
    try {
      await apiFetch(`/api/route-templates/${generateConfirm.id}/generate`, {
        method: 'POST',
        body: JSON.stringify({ route_date: generateDate }),
      })
      setGenerateConfirm(null)
      setMsg('✓ Ruta generada correctamente')
      setTimeout(() => setMsg(''), 3500)
    } catch (err: any) {
      setGenerateConfirm(null)
      setError(err.message?.includes('ya tiene una ruta')
        ? 'Ese repartidor ya tiene una ruta para esa fecha'
        : 'No se pudo generar la ruta')
      setTimeout(() => setError(''), 4000)
    }
  }

  const filteredClients = clients.filter(c =>
    !selected.find(s => s.id === c.id) && (
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.address?.toLowerCase().includes(search.toLowerCase())
    )
  )

  const modalInput = {
    width: '100%', borderRadius: 10, padding: '10px 14px', fontSize: 13,
    background: '#fff', border: '1px solid #d1d5db', color: '#1f2937',
    outline: 'none', fontFamily: 'inherit', marginTop: 4,
  }
  const modalLabel = {
    fontSize: 11, fontWeight: 600, color: '#6b7280',
    textTransform: 'uppercase' as const, letterSpacing: '0.5px',
  }

  return (
    <div style={{ minHeight: '100vh', background: D.bg, display: 'flex', flexDirection: 'row' }}>

      <Sidebar />

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>

      <nav style={{ background: D.surface, borderBottom: `1px solid ${D.border}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>📋</span>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: D.text, margin: 0 }}>Plantillas de ruta</h1>
            <p style={{ fontSize: 11, color: D.muted, margin: 0 }}>Rutas fijas por día de la semana</p>
          </div>
        </div>
        <button onClick={openNew}
          style={{ background: '#16a34a', color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          + Nueva plantilla
        </button>
      </nav>

      {msg && (
        <div style={{ position: 'fixed', top: 70, right: 20, zIndex: 50, background: '#16a34a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>
          {msg}
        </div>
      )}

      <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>

        {error && !showModal && (
          <div style={{ background: '#7f1d1d', color: '#fecaca', border: '1px solid #b91c1c', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ background: `${D.accent}10`, border: `1px solid ${D.accent}30`, borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 22 }}>💡</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: D.text, margin: 0 }}>¿Cómo funcionan las plantillas?</p>
            <p style={{ fontSize: 12, color: D.muted, marginTop: 4 }}>
              Creá una plantilla con los clientes y geocercas de un repartidor para un día fijo.
              Después, con un clic en "Generar ruta", se crea la ruta real con todas las paradas y geocercas.
            </p>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: D.muted, padding: 60, fontSize: 13 }}>Cargando plantillas...</p>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: D.muted }}>
            <p style={{ fontSize: 40, margin: 0 }}>📋</p>
            <p style={{ marginTop: 12 }}>No hay plantillas creadas todavía</p>
            <button onClick={openNew}
              style={{ marginTop: 16, background: D.blue, color: '#fff', borderRadius: 10, padding: '8px 20px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Crear primera plantilla
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {templates.map(t => (
              <div key={t.id} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: `${D.accent}18`, color: D.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0, textAlign: 'center', lineHeight: 1.1 }}>
                    {weekdayLabel(t.weekday).slice(0, 3)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: D.text, margin: 0 }}>
                      {weekdayLabel(t.weekday)} · {t.repartidor}
                    </p>
                    <p style={{ fontSize: 12, color: D.muted, marginTop: 2 }}>
                      {t.name ? `${t.name} · ` : ''}{t.stops_count ?? 0} parada(s)
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => { setGenerateConfirm(t); setGenerateDate(new Date().toISOString().slice(0, 10)) }}
                      style={{ background: '#16a34a', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      ⚡ Generar ruta
                    </button>
                    <button onClick={() => openEdit(t.id)}
                      style={{ background: 'none', color: D.accent, borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, border: `1px solid ${D.border}`, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Editar
                    </button>
                    <button onClick={() => setDeleteConfirm(t.id)}
                      style={{ background: 'none', color: '#f87171', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, border: `1px solid ${D.border}`, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Borrar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', margin: 0 }}>
                {editingId ? 'Editar plantilla' : 'Nueva plantilla'}
              </h2>
              <button onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={modalLabel}>Repartidor *</label>
                  <select
                    style={{ ...modalInput, opacity: editingId ? 0.6 : 1 }}
                    value={userId}
                    disabled={!!editingId}
                    onChange={e => setUserId(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {repartidores.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={modalLabel}>Día de la semana *</label>
                  <select
                    style={{ ...modalInput, opacity: editingId ? 0.6 : 1 }}
                    value={weekday}
                    disabled={!!editingId}
                    onChange={e => setWeekday(Number(e.target.value))}>
                    {WEEKDAYS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={modalLabel}>Nombre (opcional)</label>
                <input style={modalInput} placeholder="Ej: Ruta Centro"
                  value={templateName} onChange={e => setTemplateName(e.target.value)} />
              </div>

              {editingId && (
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                  El repartidor y el día no se pueden cambiar al editar. Si necesitás cambiarlos, borrá la plantilla y creá una nueva.
                </p>
              )}

              {/* GEOCERCAS */}
              <div>
                <label style={modalLabel}>Geocercas de la ruta ({selectedGeofences.length})</label>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
                  {geofences.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 14 }}>No hay geocercas activas</p>
                  ) : geofences.map((g: any) => (
                    <label key={g.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                      <input type="checkbox"
                        checked={selectedGeofences.includes(g.id)}
                        onChange={() => toggleGeofence(g.id)}
                        style={{ width: 16, height: 16, accentColor: '#0A5C8A' }} />
                      <span style={{ fontSize: 13, color: '#1f2937' }}>{g.name}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
                        {g.radius_meters ? (Number(g.radius_meters) >= 1000 ? `${(Number(g.radius_meters)/1000).toFixed(1)} km` : `${g.radius_meters} m`) : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* PARADAS */}
              <div>
                <label style={modalLabel}>Paradas en orden ({selected.length})</label>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginTop: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {selected.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 20 }}>
                      Agregá clientes desde la lista de abajo
                    </p>
                  ) : selected.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: D.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.address}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button onClick={() => moveUp(i)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 11, padding: '0 4px' }}>▲</button>
                        <button onClick={() => moveDown(i)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 11, padding: '0 4px' }}>▼</button>
                      </div>
                      <button onClick={() => toggleClient(c)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={modalLabel}>Agregar clientes</label>
                <input style={modalInput} placeholder="🔍 Buscar cliente..."
                  value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {filteredClients.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 16 }}>
                      {search ? 'Sin resultados' : 'Todos los clientes ya están agregados'}
                    </p>
                  ) : filteredClients.map(c => (
                    <button key={c.id} onClick={() => toggleClient(c)}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #f3f4f6', background: 'none', border: 'none', borderBottomWidth: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {c.name?.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', margin: 0 }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.address}</p>
                      </div>
                      <span style={{ color: '#16a34a', fontSize: 18, flexShrink: 0 }}>+</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 600, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 700, border: 'none', background: saving ? '#9ca3af' : '#0A5C8A', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {generateConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 380, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <p style={{ fontSize: 28, textAlign: 'center', margin: 0 }}>⚡</p>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', textAlign: 'center', marginTop: 8, marginBottom: 6 }}>Generar ruta del día</h3>
            <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>
              Se creará la ruta de <strong>{generateConfirm.repartidor}</strong> con {generateConfirm.stops_count ?? 0} parada(s).
            </p>
            <label style={modalLabel}>Fecha de la ruta</label>
            <input type="date" style={modalInput} value={generateDate} onChange={e => setGenerateDate(e.target.value)} />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setGenerateConfirm(null)}
                style={{ flex: 1, borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 600, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={handleGenerate}
                style={{ flex: 1, borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                Generar ruta
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 360, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <p style={{ fontSize: 28, textAlign: 'center', margin: 0 }}>⚠️</p>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', textAlign: 'center', marginTop: 8, marginBottom: 6 }}>¿Borrar esta plantilla?</h3>
            <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 18 }}>
              Esto no afecta las rutas ya generadas. Solo se elimina la plantilla.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 600, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                style={{ flex: 1, borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, border: 'none', background: '#C0392B', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
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
