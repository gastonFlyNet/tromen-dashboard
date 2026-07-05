'use client'
import { useEffect, useState } from 'react'
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

const EMPTY_CLIENT = {
  name: '', address: '', zone: '', phone: '', email: '',
  latitude: '', longitude: '', balance: '0', notes: '', remito: false,
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

      const exportarExcel = async () => {
    const ExcelJS = (window as any).ExcelJS || await new Promise<any>((resolve, reject) => {
      const sc = document.createElement('script')
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'
      sc.onload = () => resolve((window as any).ExcelJS)
      sc.onerror = reject
      document.body.appendChild(sc)
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'TROMEN - Grupo B&F'
    const ws = wb.addWorksheet('Clientes', {
      views: [{ state: 'frozen', ySplit: 4 }],
    })

    const AZUL = 'FF0D1B3E'
    const CELESTE = 'FF38BDF8'
    const GRISCLARO = 'FFF0F4F8'

    // Fila 1: titulo (6 columnas ahora, sin ID)
    ws.mergeCells('A1:F1')
    const titulo = ws.getCell('A1')
    titulo.value = 'TROMEN · Agua Mineral Natural'
    titulo.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } }
    titulo.alignment = { vertical: 'middle', horizontal: 'center' }
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    ws.getRow(1).height = 32

    ws.mergeCells('A2:F2')
    const sub = ws.getCell('A2')
    sub.value = `Listado de clientes · ${new Date().toLocaleDateString('es-AR')} · Total: ${clients.length}`
    sub.font = { name: 'Arial', size: 11, color: { argb: 'FFFFFFFF' } }
    sub.alignment = { vertical: 'middle', horizontal: 'center' }
    sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2236' } }
    ws.getRow(2).height = 20

    ws.getRow(3).height = 6

    // Fila 4: encabezados (sin ID)
    const headers = ['Nombre', 'Dirección', 'Teléfono', 'Zona', 'Deuda', 'Saldo a favor']
    const headerRow = ws.getRow(4)
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = h
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CELESTE } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } }
    })
    headerRow.height = 22

    // Datos (sin ID)
    clients.forEach((c: any, idx: number) => {
      const row = ws.addRow([
        c.name ?? '', c.address ?? '', c.phone ?? '',
        c.zone ?? c.trade_name ?? '', Number(c.balance ?? 0), Number(c.credit_balance ?? 0),
      ])
      row.eachCell((cell: any, col: number) => {
        cell.font = { name: 'Arial', size: 10 }
        cell.alignment = { vertical: 'middle' }
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRISCLARO } }
        if (col === 5 || col === 6) {
          cell.numFmt = '"$"#,##0'
          cell.alignment = { vertical: 'middle', horizontal: 'right' }
        }
      })
      if (Number(c.balance ?? 0) > 0) row.getCell(5).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFD32F2F' } }
      if (Number(c.credit_balance ?? 0) > 0) row.getCell(6).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF2E7D32' } }
    })

    // Anchos (sin ID, mas espacio para nombre y direccion)
    ws.columns = [
      { width: 32 }, { width: 34 }, { width: 18 },
      { width: 28 }, { width: 15 }, { width: 16 },
    ]

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes_tromen_${new Date().toISOString().slice(0,10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

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
      balance: c.balance ?? '0', notes: c.notes ?? '', remito: c.remito ?? false,
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
    <div style={{ minHeight: '100vh', background: theme.colors.bg, display: 'flex', flexDirection: 'row' }}>

      <Sidebar />

      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>

      {/* HEADER */}
      <nav className="px-6 py-4 flex items-center justify-between sticky top-0 z-30"
        style={{ background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">👥</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: theme.colors.text }}>Clientes</h1>
            <p className="text-xs" style={{ color: theme.colors.textFaint }}>TROMEN · Catriel</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarExcel}
            className="cult-btn text-white rounded-xl px-4 py-2 text-sm font-bold hover:brightness-110 transition-all"
            style={{ background: theme.colors.brand }}>
            Exportar Excel
          </button>
          <button onClick={openNew}
            className="cult-btn text-white rounded-xl px-4 py-2 text-sm font-bold hover:brightness-110 transition-all"
            style={{ background: theme.colors.success }}>
            + Nuevo cliente
          </button>
        </div>
      </nav>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">

        {/* BUSCADOR */}
        <div className="mb-5">
          <input
            className={inputCls + ' !mt-0 py-3'}
            placeholder="🔍 Buscar por nombre, dirección o zona..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* STATS */}
        <FadeIn className="grid grid-cols-3 gap-3 mb-6">
          {([
            ['Total clientes', clients.length, '👥', theme.colors.accent],
            ['Con GPS', clients.filter(c => c.latitude && c.longitude).length, '📍', theme.colors.success],
            ['Con saldo', clients.filter(c => Number(c.balance ?? c.current_balance) > 0).length, '💰', theme.colors.warning],
          ] as const).map(([l, v, e, c]) => (
            <div key={l} className={cardCls + ' cult-card p-4 text-center'}>
              <p className="text-2xl">{e}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: c }}><CountUp end={v} /></p>
              <p className="text-xs mt-1" style={{ color: theme.colors.textFaint }}>{l}</p>
            </div>
          ))}
        </FadeIn>

        {/* LISTA */}
        {loading ? (
          <div className="text-center py-20" style={{ color: theme.colors.textFaint }}>Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: theme.colors.textFaint }}>
            <p className="text-4xl mb-3">👥</p>
            <p>{search ? 'Sin resultados para esa búsqueda' : 'No hay clientes cargados'}</p>
            {!search && (
              <button onClick={openNew}
                className="mt-4 text-white rounded-xl px-6 py-2 text-sm font-bold hover:brightness-110 transition-all"
                style={{ background: theme.colors.brand }}>
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
                  className={cardCls + ' cult-card p-4 flex items-start gap-4 cursor-pointer transition-colors hover:bg-[#1A2236]'}
                  onClick={() => router.push(`/clientes/${c.id}`)}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${theme.colors.brand}, ${theme.colors.brandLight})` }}>
                    {c.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold" style={{ color: theme.colors.text }}>{c.name}</p>
                      {c.remito && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: theme.colors.warningSoft, color: theme.colors.warning }}>📄 Remito</span>
                      )}
                      {c.zone && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: theme.colors.accentSoft, color: theme.colors.accent }}>{c.zone}</span>
                      )}
                      {hasGps
                        ? <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: theme.colors.successSoft, color: theme.colors.success }}>📍 GPS OK</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: theme.colors.errorSoft, color: theme.colors.error }}>Sin GPS</span>
                      }
                      {balance > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: theme.colors.warningSoft, color: theme.colors.warning }}>
                          💰 ${balance.toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>📍 {c.address}</p>
                    {c.phone && <p className="text-xs mt-0.5" style={{ color: theme.colors.textFaint }}>📞 {c.phone}</p>}
                    {hasGps && (
                      <p className="text-xs mt-0.5" style={{ color: theme.colors.textFaint }}>
                        {Number(c.latitude).toFixed(5)}, {Number(c.longitude).toFixed(5)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c) }}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[#1A2236]"
                      style={{ color: theme.colors.accent }}>
                      Editar
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(c.id) }}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[#3a1a1a]"
                      style={{ color: theme.colors.error }}>
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
          <div className={cardCls + ' w-full max-w-lg max-h-[90vh] overflow-y-auto'}>
            <div className="p-6 border-b flex items-center justify-between sticky top-0"
              style={{ borderColor: theme.colors.border, background: theme.colors.surface }}>
              <h2 className="font-bold text-lg" style={{ color: theme.colors.text }}>
                {editing ? 'Editar cliente' : 'Nuevo cliente'}
              </h2>
              <button onClick={() => setShowModal(false)}
                className="text-xl transition-colors hover:text-[#F1F5F9]" style={{ color: theme.colors.textFaint }}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="rounded-xl p-3 text-sm border"
                  style={{ background: theme.colors.errorSoft, color: theme.colors.error, borderColor: theme.colors.error }}>
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
                    style={{ color: theme.colors.accent }}>
                    🔍 Buscar por dirección
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs" style={{ color: theme.colors.textFaint }}>Latitud</label>
                    <input className={inputCls} placeholder="-37.8855"
                      value={form.latitude}
                      onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs" style={{ color: theme.colors.textFaint }}>Longitud</label>
                    <input className={inputCls} placeholder="-68.0783"
                      value={form.longitude}
                      onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs mt-1" style={{ color: theme.colors.textFaint }}>
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

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-colors"
                style={{
                  background: form.remito ? theme.colors.accentSoft : theme.colors.surface2,
                  borderColor: form.remito ? theme.colors.accent : theme.colors.border,
                }}>
                <input type="checkbox" checked={form.remito}
                  onChange={e => setForm(f => ({ ...f, remito: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: theme.colors.accent }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: theme.colors.text }}>📄 Factura con remito</p>
                  <p className="text-xs" style={{ color: theme.colors.textMuted }}>Este cliente se factura de forma diferente</p>
                </div>
              </label>
            </div>
            <div className="p-6 border-t flex gap-3 sticky bottom-0"
              style={{ borderColor: theme.colors.border, background: theme.colors.surface }}>
              <button onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold transition-colors border hover:bg-[#1A2236]"
                style={{ borderColor: theme.colors.border, color: theme.colors.textMuted }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 text-white rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50 hover:brightness-110"
                style={{ background: theme.colors.brand }}>
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
          <div className={cardCls + ' p-6 max-w-sm w-full'}>
            <p className="text-3xl text-center mb-3">⚠️</p>
            <h3 className="font-bold text-center mb-2" style={{ color: theme.colors.text }}>¿Borrar este cliente?</h3>
            <p className="text-sm text-center mb-6" style={{ color: theme.colors.textMuted }}>
              Esta acción no se puede deshacer. Se eliminarán todos los datos del cliente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold border transition-colors hover:bg-[#1A2236]"
                style={{ borderColor: theme.colors.border, color: theme.colors.textMuted }}>
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 text-white rounded-xl py-2.5 text-sm font-bold transition-all hover:brightness-110"
                style={{ background: theme.colors.error }}>
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
