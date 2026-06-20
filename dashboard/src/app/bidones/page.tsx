'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tromen-backend-production.up.railway.app'

type Registro = {
  id: string
  cantidad: number
  foto_url: string | null
  notes: string | null
  created_at: string
  producto: string | null
  cliente: string | null
  repartidor: string | null
}
type PorMarca = { producto: string | null; total: number }

export default function BidonesPage() {
  const hoy = new Date().toISOString().slice(0, 10)
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(hace30)
  const [to, setTo]     = useState(hoy)
  const [loading, setLoading]   = useState(false)
  const [registros, setRegistros] = useState<Registro[]>([])
  const [porMarca, setPorMarca]   = useState<PorMarca[]>([])
  const [fotoModal, setFotoModal] = useState<string | null>(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('tromen_token')
      const res = await fetch(`${API_URL}/api/bidones-mal-estado?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setRegistros(data.registros ?? [])
      setPorMarca(data.por_marca ?? [])
    } catch {
      setRegistros([]); setPorMarca([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const totalRotos = porMarca.reduce((s, m) => s + Number(m.total), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>
        <nav className="px-6 py-4 flex items-center gap-3 sticky top-0 z-30"
          style={{ background: '#151b27', borderBottom: '1px solid #1e2d40' }}>
          <span className="text-2xl">🪣</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#f1f5f9' }}>Bidones en mal estado</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>Cambios registrados por los repartidores</p>
          </div>
        </nav>

        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
          {/* Filtro de fechas */}
          <div className="rounded-2xl p-5 flex flex-wrap items-end gap-3" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
            <div>
              <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#64748b' }}>Desde</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="rounded-xl px-3 py-2 text-sm" style={{ background: '#0f1117', border: '1px solid #1e2d40', color: '#f1f5f9' }} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#64748b' }}>Hasta</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="rounded-xl px-3 py-2 text-sm" style={{ background: '#0f1117', border: '1px solid #1e2d40', color: '#f1f5f9' }} />
            </div>
            <button onClick={cargar} disabled={loading}
              className="rounded-xl px-5 py-2 text-sm font-bold"
              style={{ background: '#38bdf8', color: '#0f1117', opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Cargando...' : 'Filtrar'}
            </button>
          </div>

          {/* Conteo por marca */}
          {porMarca.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-sm" style={{ color: '#f1f5f9' }}>Total por marca</p>
                <p className="font-bold text-xl" style={{ color: '#f97316' }}>{totalRotos} bidones</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {porMarca.map((m, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: '#0f1117' }}>
                    <p className="text-xs" style={{ color: '#64748b' }}>{m.producto ?? 'Sin marca'}</p>
                    <p className="font-bold text-lg" style={{ color: '#f1f5f9' }}>{m.total}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de registros */}
          {registros.length === 0 ? (
            <div className="rounded-2xl p-8 text-center text-sm" style={{ background: '#151b27', border: '1px solid #1e2d40', color: '#64748b' }}>
              No hay bidones en mal estado en este período
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registros.map(r => (
                <div key={r.id} className="rounded-2xl overflow-hidden" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
                  <div className="flex">
                    {r.foto_url && (
                      <img src={r.foto_url} alt="bidón"
                        onClick={() => setFotoModal(r.foto_url)}
                        style={{ width: 90, height: 90, objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }} />
                    )}
                    <div className="p-3 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm" style={{ color: '#f1f5f9' }}>{r.producto ?? 'Bidón'}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#7c2d12', color: '#fed7aa' }}>x{r.cantidad}</span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>👤 {r.cliente ?? 'Sin cliente'}</p>
                      <p className="text-xs" style={{ color: '#64748b' }}>🚚 {r.repartidor ?? '-'}</p>
                      <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                        {new Date(r.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                      </p>
                      {r.notes && <p className="text-xs mt-1 italic" style={{ color: '#94a3b8' }}>{r.notes}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de foto ampliada */}
      {fotoModal && (
        <div onClick={() => setFotoModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <img src={fotoModal} alt="bidón" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 12 }} />
        </div>
      )}
    </div>
  )
}
