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

      const descargarExcel = async () => {
    if (!ventas || ventas.length === 0) return
    const ExcelJS = (window as any).ExcelJS || await new Promise<any>((resolve, reject) => {
      const sc = document.createElement('script')
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'
      sc.onload = () => resolve((window as any).ExcelJS)
      sc.onerror = reject
      document.body.appendChild(sc)
    })

    const AZUL = 'FF0D1B3E', CELESTE = 'FF38BDF8', VERDE = 'FF2ECC40'
    const GRISCLARO = 'FFF0F4F8', AMARILLO = 'FFFFF3CD'
    const wb = new ExcelJS.Workbook()
    wb.creator = 'TROMEN - Grupo B&F'

    const fechaCorta = (v: Venta) => v.delivered_at
      ? new Date(v.delivered_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
      : fecha
    const horaCorta = (v: Venta) => v.delivered_at
      ? new Date(v.delivered_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
      : ''

    const COLS = ['Fecha', 'Hora', 'Cliente', 'Dirección', 'Forma de pago', 'Efectivo', 'Transferencia', 'Cta corriente', 'Total', 'Notas']
    const MONEY_COLS = [6, 7, 8, 9]

    const crearHoja = (titulo: string, lista: Venta[]) => {
      const ws = wb.addWorksheet(titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, ''), {
        views: [{ state: 'frozen', ySplit: 4 }],
      })
      ws.mergeCells('A1:J1')
      const t = ws.getCell('A1')
      t.value = 'TROMEN · Agua Mineral Natural'
      t.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      t.alignment = { vertical: 'middle', horizontal: 'center' }
      t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
      ws.getRow(1).height = 30
      ws.mergeCells('A2:J2')
      const s = ws.getCell('A2')
      s.value = `${titulo} · ${fecha}`
      s.font = { name: 'Arial', size: 11, color: { argb: 'FFFFFFFF' } }
      s.alignment = { vertical: 'middle', horizontal: 'center' }
      s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2236' } }
      ws.getRow(2).height = 19
      ws.getRow(3).height = 6
      const hr = ws.getRow(4)
      COLS.forEach((h, i) => {
        const cell = hr.getCell(i + 1)
        cell.value = h
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CELESTE } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      hr.height = 20
      lista.forEach((v: Venta, idx: number) => {
        const row = ws.addRow([
          fechaCorta(v), horaCorta(v), v.cliente ?? '', v.direccion ?? '',
          v.payment_method ? (PAY_LABEL[v.payment_method] ?? v.payment_method) : '',
          num(v.cash_received), num(v.transfer_amount), num(v.credit_amount), num(v.actual_amount),
          v.notes ?? '',
        ])
        row.eachCell((cell: any, col: number) => {
          cell.font = { name: 'Arial', size: 10 }
          if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRISCLARO } }
          if (MONEY_COLS.includes(col)) {
            cell.numFmt = '"$"#,##0'
            cell.alignment = { horizontal: 'right' }
          }
        })
      })
      const tot = totalesPorPago(lista)
      const totRow = ws.addRow(['', '', '', '', 'TOTALES', tot.efectivo, tot.transfer, tot.credito, tot.total, ''])
      totRow.eachCell((cell: any, col: number) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: AZUL } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } }
        if (MONEY_COLS.includes(col)) { cell.numFmt = '"$"#,##0'; cell.alignment = { horizontal: 'right' } }
      })
      totRow.height = 22
      ws.columns = [
        { width: 12 }, { width: 8 }, { width: 26 }, { width: 28 }, { width: 16 },
        { width: 13 }, { width: 14 }, { width: 14 }, { width: 13 }, { width: 24 },
      ]
      return ws
    }

    const reparto = ventas.filter(v => !v.es_deposito)
    const deposito = ventas.filter(v => v.es_deposito)
    const porRepartidor: Record<string, Venta[]> = {}
    reparto.forEach(v => {
      if (!porRepartidor[v.repartidor]) porRepartidor[v.repartidor] = []
      porRepartidor[v.repartidor].push(v)
    })
    Object.entries(porRepartidor).forEach(([nombre, lista]) => crearHoja(nombre || 'Repartidor', lista))
    if (deposito.length > 0) crearHoja('Venta en depósito', deposito)

    const wsT = wb.addWorksheet('TOTAL')
    wsT.mergeCells('A1:B1')
    const tt = wsT.getCell('A1')
    tt.value = 'TROMEN · Resumen general'
    tt.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    tt.alignment = { vertical: 'middle', horizontal: 'center' }
    tt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    wsT.getRow(1).height = 30
    wsT.mergeCells('A2:B2')
    const ts = wsT.getCell('A2')
    ts.value = `Cierre del día ${fecha}`
    ts.font = { name: 'Arial', size: 11, color: { argb: 'FFFFFFFF' } }
    ts.alignment = { vertical: 'middle', horizontal: 'center' }
    ts.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2236' } }
    wsT.getRow(2).height = 19
    wsT.getRow(3).height = 6
    const tTotal = totalesPorPago(ventas)
    const rows = [
      ['Ventas de reparto', totalesPorPago(reparto).total],
      ['Ventas de depósito', totalesPorPago(deposito).total],
      ['', ''],
      ['Total efectivo', tTotal.efectivo],
      ['Total transferencia', tTotal.transfer],
      ['Total cuenta corriente', tTotal.credito],
    ]
    rows.forEach(r => {
      const row = wsT.addRow(r)
      row.getCell(1).font = { name: 'Arial', size: 11 }
      row.getCell(2).font = { name: 'Arial', size: 11 }
      row.getCell(2).numFmt = '"$"#,##0'
      row.getCell(2).alignment = { horizontal: 'right' }
    })
    const totalRow = wsT.addRow(['TOTAL GENERAL', tTotal.total])
    totalRow.eachCell((cell: any) => {
      cell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } }
    })
    totalRow.getCell(2).numFmt = '"$"#,##0'
    totalRow.getCell(2).alignment = { horizontal: 'right' }
    totalRow.height = 26
    wsT.columns = [{ width: 30 }, { width: 20 }]

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Resumen_TROMEN_${fecha}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
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
