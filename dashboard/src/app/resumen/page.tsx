'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import * as XLSX from 'xlsx'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tromen-backend-production.up.railway.app'

const PAY_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia',
  cuenta_corriente: 'Cuenta corriente', mixto: 'Mixto',
}

type Venta = {
  id: string
  actual_amount: string
  payment_method: string | null
  cash_received: string
  transfer_amount: string
  credit_amount: string
  change_given: string | null
  notes: string | null
  delivered_at: string | null
  cliente: string | null
  direccion: string | null
  repartidor: string
  repartidor_id: string
  es_deposito: boolean
}

export default function ResumenPage() {
  const router = useRouter()
  const [fecha, setFecha]     = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [ventas, setVentas]   = useState<Venta[] | null>(null)
  const [error, setError]     = useState('')

  const cargar = async () => {
    setLoading(true)
    setError('')
    setVentas(null)
    try {
      const token = localStorage.getItem('tromen_token')
      const res = await fetch(`${API_URL}/api/dashboard/resumen-diario?date=${fecha}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al traer los datos')
      const data = await res.json()
      setVentas(data.ventas ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Error')
    } finally {
      setLoading(false)
    }
  }

  const num = (v: any) => Number(v ?? 0)

  // Arma las filas de detalle de una lista de ventas
  const filasDetalle = (lista: Venta[]) => lista.map(v => ({
    'Hora':          v.delivered_at ? new Date(v.delivered_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : '',
    'Cliente':       v.cliente ?? '',
    'Dirección':     v.direccion ?? '',
    'Forma de pago': v.payment_method ? (PAY_LABEL[v.payment_method] ?? v.payment_method) : '',
    'Efectivo':      num(v.cash_received),
    'Transferencia': num(v.transfer_amount),
    'Cta corriente': num(v.credit_amount),
    'Total':         num(v.actual_amount),
    'Notas':         v.notes ?? '',
  }))

  // Arma las filas de totales por forma de pago
  const totalesPorPago = (lista: Venta[]) => {
    const efectivo = lista.reduce((s, v) => s + num(v.cash_received), 0)
    const transfer = lista.reduce((s, v) => s + num(v.transfer_amount), 0)
    const credito  = lista.reduce((s, v) => s + num(v.credit_amount), 0)
    const total    = lista.reduce((s, v) => s + num(v.actual_amount), 0)
    return { efectivo, transfer, credito, total }
  }

  const descargarExcel = () => {
    if (!ventas || ventas.length === 0) return
    const wb = XLSX.utils.book_new()

    // Separar por repartidor (no depósito) y depósito
    const reparto = ventas.filter(v => !v.es_deposito)
    const deposito = ventas.filter(v => v.es_deposito)

    // Agrupar reparto por repartidor
    const porRepartidor: Record<string, Venta[]> = {}
    reparto.forEach(v => {
      if (!porRepartidor[v.repartidor]) porRepartidor[v.repartidor] = []
      porRepartidor[v.repartidor].push(v)
    })

    // Una hoja por repartidor
    Object.entries(porRepartidor).forEach(([nombre, lista]) => {
      const filas = filasDetalle(lista)
      const t = totalesPorPago(lista)
      const datos: any[] = [...filas, {},
        { 'Cliente': 'TOTALES', 'Efectivo': t.efectivo, 'Transferencia': t.transfer, 'Cta corriente': t.credito, 'Total': t.total },
      ]
      const ws = XLSX.utils.json_to_sheet(datos)
      const sheetName = nombre.slice(0, 31).replace(/[\\/?*[\]:]/g, '')
      XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Repartidor')
    })

    // Hoja de depósito
    if (deposito.length > 0) {
      const filas = filasDetalle(deposito)
      const t = totalesPorPago(deposito)
      const datos: any[] = [...filas, {},
        { 'Cliente': 'TOTALES', 'Efectivo': t.efectivo, 'Transferencia': t.transfer, 'Cta corriente': t.credito, 'Total': t.total },
      ]
      const ws = XLSX.utils.json_to_sheet(datos)
      XLSX.utils.book_append_sheet(wb, ws, 'Venta en depósito')
    }

    // Hoja TOTAL GENERAL
    const tTotal = totalesPorPago(ventas)
    const resumenRows = [
      { 'Concepto': 'Ventas de reparto', 'Monto': totalesPorPago(reparto).total },
      { 'Concepto': 'Ventas de depósito', 'Monto': totalesPorPago(deposito).total },
      {},
      { 'Concepto': 'Total efectivo', 'Monto': tTotal.efectivo },
      { 'Concepto': 'Total transferencia', 'Monto': tTotal.transfer },
      { 'Concepto': 'Total cuenta corriente', 'Monto': tTotal.credito },
      {},
      { 'Concepto': 'TOTAL GENERAL', 'Monto': tTotal.total },
    ]
    const wsTotal = XLSX.utils.json_to_sheet(resumenRows)
    XLSX.utils.book_append_sheet(wb, wsTotal, 'TOTAL')

    XLSX.writeFile(wb, `Resumen_TROMEN_${fecha}.xlsx`)
  }

  const totalGeneral = ventas ? totalesPorPago(ventas) : null

  // Armar secciones: una por repartidor + una de depósito
  const secciones: { nombre: string, lista: Venta[], deposito: boolean }[] = []
  if (ventas) {
    const reparto = ventas.filter(v => !v.es_deposito)
    const porRep: Record<string, Venta[]> = {}
    reparto.forEach(v => { (porRep[v.repartidor] ??= []).push(v) })
    Object.entries(porRep).forEach(([nombre, lista]) => secciones.push({ nombre, lista, deposito: false }))
    const dep = ventas.filter(v => v.es_deposito)
    if (dep.length > 0) secciones.push({ nombre: 'Venta en depósito', lista: dep, deposito: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', flexDirection: 'row' }}>
      <Sidebar />
      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>
        <nav className="px-6 py-4 flex items-center gap-3 sticky top-0 z-30"
          style={{ background: '#151b27', borderBottom: '1px solid #1e2d40' }}>
          <span className="text-2xl">📊</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#f1f5f9' }}>Resumen diario</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>Ventas del día · descargá el Excel</p>
          </div>
        </nav>

        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
          {/* Selector de fecha + acciones */}
          <div className="rounded-2xl p-5" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
            <label className="text-xs font-semibold uppercase block mb-2" style={{ color: '#64748b' }}>Fecha</label>
            <div className="flex flex-wrap items-center gap-3">
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="rounded-xl px-4 py-2.5 text-sm"
                style={{ background: '#0f1117', border: '1px solid #1e2d40', color: '#f1f5f9' }} />
              <button onClick={cargar} disabled={loading}
                className="rounded-xl px-5 py-2.5 text-sm font-bold"
                style={{ background: '#38bdf8', color: '#0f1117', opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Cargando...' : 'Ver resumen'}
              </button>
              {ventas && ventas.length > 0 && (
                <button onClick={descargarExcel}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold"
                  style={{ background: '#16a34a', color: '#fff' }}>
                  ⬇ Descargar Excel
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl p-4 text-sm" style={{ background: '#3a1a1a', color: '#fca5a5', border: '1px solid #7f1d1d' }}>
              {error}
            </div>
          )}

          {/* Vista previa */}
          {ventas && (
            ventas.length === 0 ? (
              <div className="rounded-2xl p-8 text-center text-sm" style={{ background: '#151b27', border: '1px solid #1e2d40', color: '#64748b' }}>
                No hay ventas registradas para esta fecha
              </div>
            ) : (
              <div className="space-y-5">
                {/* Total general arriba */}
                {totalGeneral && (
                  <div className="rounded-2xl p-5" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold text-sm" style={{ color: '#f1f5f9' }}>Total del día · {ventas.length} ventas</p>
                      <p className="font-bold text-xl" style={{ color: '#16a34a' }}>${totalGeneral.total.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl p-3" style={{ background: '#0f1117' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>Efectivo</p>
                        <p className="font-bold text-sm" style={{ color: '#f1f5f9' }}>${totalGeneral.efectivo.toLocaleString('es-AR')}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: '#0f1117' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>Transferencia</p>
                        <p className="font-bold text-sm" style={{ color: '#f1f5f9' }}>${totalGeneral.transfer.toLocaleString('es-AR')}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: '#0f1117' }}>
                        <p className="text-xs" style={{ color: '#64748b' }}>Cta corriente</p>
                        <p className="font-bold text-sm" style={{ color: '#f1f5f9' }}>${totalGeneral.credito.toLocaleString('es-AR')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Una sección por repartidor + depósito */}
                {secciones.map(sec => {
                  const t = totalesPorPago(sec.lista)
                  return (
                    <div key={sec.nombre} className="rounded-2xl overflow-hidden" style={{ background: '#151b27', border: '1px solid #1e2d40' }}>
                      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1e2d40' }}>
                        <p className="font-bold text-sm" style={{ color: sec.deposito ? '#fbbf24' : '#38bdf8' }}>
                          {sec.deposito ? '🏪 ' : '🚚 '}{sec.nombre}
                        </p>
                        <p className="text-xs" style={{ color: '#64748b' }}>{sec.lista.length} ventas · ${t.total.toLocaleString('es-AR')}</p>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ color: '#64748b', textAlign: 'left' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Hora</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Cliente</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Pago</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Efvo</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Transf</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Cta cte</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.lista.map(v => (
                              <tr key={v.id} style={{ color: '#cbd5e1', borderTop: '1px solid #1e2d40' }}>
                                <td style={{ padding: '8px 12px' }}>{v.delivered_at ? new Date(v.delivered_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : ''}</td>
                                <td style={{ padding: '8px 12px' }}>{v.cliente ?? ''}</td>
                                <td style={{ padding: '8px 12px' }}>{v.payment_method ? (PAY_LABEL[v.payment_method] ?? v.payment_method) : ''}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{num(v.cash_received) > 0 ? '$'+num(v.cash_received).toLocaleString('es-AR') : '-'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{num(v.transfer_amount) > 0 ? '$'+num(v.transfer_amount).toLocaleString('es-AR') : '-'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{num(v.credit_amount) > 0 ? '$'+num(v.credit_amount).toLocaleString('es-AR') : '-'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#f1f5f9' }}>${num(v.actual_amount).toLocaleString('es-AR')}</td>
                              </tr>
                            ))}
                            <tr style={{ borderTop: '2px solid #1e2d40', color: '#f1f5f9', fontWeight: 700 }}>
                              <td style={{ padding: '8px 12px' }} colSpan={3}>TOTALES</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>${t.efectivo.toLocaleString('es-AR')}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>${t.transfer.toLocaleString('es-AR')}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>${t.credito.toLocaleString('es-AR')}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>${t.total.toLocaleString('es-AR')}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
