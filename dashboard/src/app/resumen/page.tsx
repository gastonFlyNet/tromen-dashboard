'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { theme, cardCls } from '@/lib/theme'
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
  productos?: { nombre: string, cantidad: number }[]
  devueltos?: { nombre: string, cantidad: number }[]
}
type CambioBidon = {
  cantidad: number
  notes: string | null
  producto: string | null
  cliente: string | null
  repartidor: string | null
}

export default function ResumenPage() {
  const router = useRouter()
  const [fecha, setFecha]     = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [ventas, setVentas]   = useState<Venta[] | null>(null)
  const [cambiosBidon, setCambiosBidon] = useState<CambioBidon[]>([])
  const [error, setError]     = useState('')
  const [gestionSel, setGestionSel] = useState<any | null>(null)
  const [evidencia, setEvidencia] = useState<any | null>(null)
  const [cargandoEvid, setCargandoEvid] = useState(false)
  const [imgAmpliada, setImgAmpliada] = useState<string | null>(null)

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
      setCambiosBidon(data.cambios_bidon ?? [])
    } catch (e: any) {
      setError(e.message ?? 'Error')
    } finally {
      setLoading(false)
    }
  }

  const num = (v: any) => Number(v ?? 0)
  // Abre el modal de evidencia de una gestion (carga fotos + firma on-demand)
  const abrirGestion = async (v: Venta) => {
    setGestionSel(v)
    setEvidencia(null)
    setCargandoEvid(true)
    try {
      const token = localStorage.getItem('tromen_token')
      const res = await fetch(`${API_URL}/api/deliveries/${v.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setEvidencia(data)
      }
    } catch (e) {
      // si falla, el modal muestra que no hay evidencia
    } finally {
      setCargandoEvid(false)
    }
  }
  // Clasifica un producto en una de las columnas: TROMEN, Oeste, 6lt, Otros
  const claseProducto = (nombre: string): 'tromen' | 'oeste' | 'seis' | 'otros' => {
    const n = (nombre ?? '').toLowerCase()
    if (n.includes('tromen')) return 'tromen'
    if (n.includes('oeste')) return 'oeste'
    if (n.includes('6lt') || n.includes('6 lt') || n.includes('6lts')) return 'seis'
    return 'otros'
  }
  // Suma los productos de una venta por columna
  const bidonesDeVenta = (v: Venta) => {
    const r = { tromen: 0, oeste: 0, seis: 0, otros: 0, devueltos: 0 }
    for (const p of (v.productos ?? [])) r[claseProducto(p.nombre)] += Number(p.cantidad ?? 0)
    for (const d of (v.devueltos ?? [])) r.devueltos += Number(d.cantidad ?? 0)
    return r
  }
  // Totales de productos de una lista de ventas
  const totalesBidones = (lista: Venta[]) => {
    const t = { tromen: 0, oeste: 0, seis: 0, otros: 0, devueltos: 0 }
    for (const v of lista) {
      const b = bidonesDeVenta(v)
      t.tromen += b.tromen; t.oeste += b.oeste; t.seis += b.seis
      t.otros += b.otros; t.devueltos += b.devueltos
    }
    return t
  }

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

    const COLS = ['Fecha', 'Hora', 'Cliente', 'Dirección', 'Forma de pago', 'Efectivo', 'Transferencia', 'Cta corriente', 'Total', 'TROMEN', 'Del Oeste', '6lt', 'Otros', 'Devueltos', 'Notas']
    const MONEY_COLS = [6, 7, 8, 9]
    const PROD_COLS = [10, 11, 12, 13, 14]

    const crearHoja = (titulo: string, lista: Venta[]) => {
      const ws = wb.addWorksheet(titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, ''), {
        views: [{ state: 'frozen', ySplit: 4 }],
      })
      ws.mergeCells('A1:O1')
      const t = ws.getCell('A1')
      t.value = 'TROMEN · Agua Mineral Natural'
      t.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
      t.alignment = { vertical: 'middle', horizontal: 'center' }
      t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
      ws.getRow(1).height = 30
      ws.mergeCells('A2:O2')
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
        const b = bidonesDeVenta(v)
        const row = ws.addRow([
          fechaCorta(v), horaCorta(v), v.cliente ?? '', v.direccion ?? '',
          v.payment_method ? (PAY_LABEL[v.payment_method] ?? v.payment_method) : '',
          num(v.cash_received), num(v.transfer_amount), num(v.credit_amount), num(v.actual_amount),
          b.tromen || '', b.oeste || '', b.seis || '', b.otros || '', b.devueltos || '',
          v.notes ?? '',
        ])
        row.eachCell((cell: any, col: number) => {
          cell.font = { name: 'Arial', size: 10 }
          if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRISCLARO } }
          if (MONEY_COLS.includes(col)) {
            cell.numFmt = '"$"#,##0'
            cell.alignment = { horizontal: 'right' }
          }
          if (PROD_COLS.includes(col)) cell.alignment = { horizontal: 'center' }
        })
      })
      const tot = totalesPorPago(lista)
      const tb = totalesBidones(lista)
      const totRow = ws.addRow(['', '', '', '', 'TOTALES', tot.efectivo, tot.transfer, tot.credito, tot.total,
        tb.tromen || '', tb.oeste || '', tb.seis || '', tb.otros || '', tb.devueltos || '', ''])
      totRow.eachCell((cell: any, col: number) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: AZUL } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } }
        if (MONEY_COLS.includes(col)) { cell.numFmt = '"$"#,##0'; cell.alignment = { horizontal: 'right' } }
        if (PROD_COLS.includes(col)) cell.alignment = { horizontal: 'center' }
      })
      totRow.height = 22
      ws.columns = [
        { width: 12 }, { width: 8 }, { width: 26 }, { width: 28 }, { width: 16 },
        { width: 13 }, { width: 14 }, { width: 14 }, { width: 13 },
        { width: 10 }, { width: 11 }, { width: 8 }, { width: 9 }, { width: 11 }, { width: 24 },
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

    // Bidones vendidos discriminados por marca (todas las ventas del dia)
    const tbTotal = totalesBidones(ventas)
    wsT.addRow(['', ''])
    const bTitulo = wsT.addRow(['Bidones vendidos', ''])
    bTitulo.getCell(1).font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    bTitulo.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    bTitulo.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    bTitulo.height = 22
    const bRows: [string, number][] = [
      ['Bidones TROMEN', tbTotal.tromen],
      ['Bidones Del Oeste', tbTotal.oeste],
      ['Bidones 6lt', tbTotal.seis],
      ['Otros productos', tbTotal.otros],
      ['Envases devueltos', tbTotal.devueltos],
    ]
    bRows.forEach(r => {
      const row = wsT.addRow(r)
      row.getCell(1).font = { name: 'Arial', size: 11 }
      row.getCell(2).font = { name: 'Arial', size: 11, bold: true }
      row.getCell(2).alignment = { horizontal: 'right' }
    })
    const bTot = wsT.addRow(['TOTAL BIDONES', tbTotal.tromen + tbTotal.oeste + tbTotal.seis])
    bTot.eachCell((cell: any) => {
      cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: AZUL } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } }
    })
    bTot.getCell(2).alignment = { horizontal: 'right' }
    bTot.height = 22
    wsT.columns = [{ width: 30 }, { width: 20 }]

    // Hoja de cambios por bidon en mal estado
    if (cambiosBidon && cambiosBidon.length > 0) {
      const wsCB = wb.addWorksheet('Cambios de bidon')
      wsCB.mergeCells('A1:E1')
      const cbt = wsCB.getCell('A1')
      cbt.value = 'TROMEN · Cambios por bidón en mal estado'
      cbt.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } }
      cbt.alignment = { vertical: 'middle', horizontal: 'center' }
      cbt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
      wsCB.getRow(1).height = 28
      const cbHead = ['Repartidor', 'Cliente', 'Producto', 'Cantidad', 'Nota']
      const cbHr = wsCB.getRow(2)
      cbHead.forEach((h: string, i: number) => {
        const cell = cbHr.getCell(i + 1)
        cell.value = h
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CELESTE } }
        cell.alignment = { horizontal: 'center' }
      })
      cbHr.height = 20
      let totCambios = 0
      cambiosBidon.forEach((cb: CambioBidon, idx: number) => {
        totCambios += Number(cb.cantidad ?? 0)
        const row = wsCB.addRow([cb.repartidor ?? '', cb.cliente ?? '', cb.producto ?? 'Bidón', Number(cb.cantidad ?? 0), cb.notes ?? ''])
        row.eachCell((cell: any, col: number) => {
          cell.font = { name: 'Arial', size: 10 }
          if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRISCLARO } }
          if (col === 4) cell.alignment = { horizontal: 'center' }
        })
      })
      const cbTot = wsCB.addRow(['', '', 'TOTAL', totCambios, ''])
      cbTot.eachCell((cell: any, col: number) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: AZUL } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } }
        if (col === 4) cell.alignment = { horizontal: 'center' }
      })
      wsCB.columns = [{ width: 22 }, { width: 26 }, { width: 20 }, { width: 10 }, { width: 30 }]
    }

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
    <div style={{ minHeight: '100vh', background: theme.colors.bg, display: 'flex', flexDirection: 'row' }}>
      <Sidebar />
      <div style={{ flex: 1, height: '100vh', overflowY: 'auto' }}>
        <nav className="px-6 py-4 flex items-center gap-3 sticky top-0 z-30"
          style={{ background: theme.colors.surface, borderBottom: `1px solid ${theme.colors.border}` }}>
          <span className="text-2xl">📊</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color: theme.colors.text }}>Resumen diario</h1>
            <p className="text-xs" style={{ color: theme.colors.textFaint }}>Ventas del día · descargá el Excel</p>
          </div>
        </nav>

        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
          {/* Selector de fecha + acciones */}
          <div className={cardCls + ' p-5'}>
            <label className="text-xs font-semibold uppercase block mb-2" style={{ color: theme.colors.textFaint }}>Fecha</label>
            <div className="flex flex-wrap items-center gap-3">
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="rounded-xl px-4 py-2.5 text-sm"
                style={{ background: theme.colors.bg, border: `1px solid ${theme.colors.border}`, color: theme.colors.text }} />
              <button onClick={cargar} disabled={loading}
                className="rounded-xl px-5 py-2.5 text-sm font-bold"
                style={{ background: theme.colors.accent, color: theme.colors.bg, opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Cargando...' : 'Ver resumen'}
              </button>
              {ventas && ventas.length > 0 && (
                <button onClick={descargarExcel}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold"
                  style={{ background: theme.colors.success, color: '#fff' }}>
                  ⬇ Descargar Excel
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl p-4 text-sm border" style={{ background: theme.colors.errorSoft, color: theme.colors.error, borderColor: theme.colors.error }}>
              {error}
            </div>
          )}

          {/* Vista previa */}
          {ventas && (
            ventas.length === 0 ? (
              <div className={cardCls + ' p-8 text-center text-sm'} style={{ color: theme.colors.textFaint }}>
                No hay ventas registradas para esta fecha
              </div>
            ) : (
              <div className="space-y-5">
                {/* Total general arriba */}
                {totalGeneral && (
                  <div className={cardCls + ' p-5'}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold text-sm" style={{ color: theme.colors.text }}>Total del día · {ventas.length} ventas</p>
                      <p className="font-bold text-xl" style={{ color: theme.colors.success }}>${totalGeneral.total.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl p-3" style={{ background: theme.colors.bg }}>
                        <p className="text-xs" style={{ color: theme.colors.textFaint }}>Efectivo</p>
                        <p className="font-bold text-sm" style={{ color: theme.colors.text }}>${totalGeneral.efectivo.toLocaleString('es-AR')}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: theme.colors.bg }}>
                        <p className="text-xs" style={{ color: theme.colors.textFaint }}>Transferencia</p>
                        <p className="font-bold text-sm" style={{ color: theme.colors.text }}>${totalGeneral.transfer.toLocaleString('es-AR')}</p>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: theme.colors.bg }}>
                        <p className="text-xs" style={{ color: theme.colors.textFaint }}>Cta corriente</p>
                        <p className="font-bold text-sm" style={{ color: theme.colors.text }}>${totalGeneral.credito.toLocaleString('es-AR')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Una sección por repartidor + depósito */}
                {secciones.map(sec => {
                  const t = totalesPorPago(sec.lista)
                  const tb = totalesBidones(sec.lista)
                  return (
                    <div key={sec.nombre} className={cardCls + ' overflow-hidden'}>
                      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                        <p className="font-bold text-sm" style={{ color: sec.deposito ? theme.colors.warning : theme.colors.accent }}>
                          {sec.deposito ? '🏪 ' : '🚚 '}{sec.nombre}
                        </p>
                        <p className="text-xs" style={{ color: theme.colors.textFaint }}>{sec.lista.length} ventas · ${t.total.toLocaleString('es-AR')}</p>
                      </div>
                      {(tb.tromen + tb.oeste + tb.seis + tb.otros) > 0 && (
                        <div className="px-5 py-2 flex flex-wrap gap-x-4 gap-y-1" style={{ borderBottom: `1px solid ${theme.colors.border}`, background: theme.colors.bg }}>
                          {tb.tromen > 0 && <span className="text-xs" style={{ color: theme.colors.accent }}>TROMEN: <b style={{ color: theme.colors.text }}>{tb.tromen}</b></span>}
                          {tb.oeste > 0 && <span className="text-xs" style={{ color: theme.colors.accent }}>Del Oeste: <b style={{ color: theme.colors.text }}>{tb.oeste}</b></span>}
                          {tb.seis > 0 && <span className="text-xs" style={{ color: theme.colors.accent }}>6lt: <b style={{ color: theme.colors.text }}>{tb.seis}</b></span>}
                          {tb.otros > 0 && <span className="text-xs" style={{ color: theme.colors.textFaint }}>Otros: <b style={{ color: theme.colors.text }}>{tb.otros}</b></span>}
                          {tb.devueltos > 0 && <span className="text-xs" style={{ color: theme.colors.textFaint }}>Devueltos: <b style={{ color: theme.colors.text }}>{tb.devueltos}</b></span>}
                        </div>
                      )}
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ color: theme.colors.textFaint, textAlign: 'left' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Hora</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Cliente</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600 }}>Pago</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Efvo</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Transf</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Cta cte</th>
                              <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Total</th>
                              <th style={{ padding: '8px 8px', fontWeight: 600, textAlign: 'center', color: theme.colors.accent }}>TROMEN</th>
                              <th style={{ padding: '8px 8px', fontWeight: 600, textAlign: 'center', color: theme.colors.accent }}>Oeste</th>
                              <th style={{ padding: '8px 8px', fontWeight: 600, textAlign: 'center', color: theme.colors.accent }}>6lt</th>
                              <th style={{ padding: '8px 8px', fontWeight: 600, textAlign: 'center' }}>Otros</th>
                              <th style={{ padding: '8px 8px', fontWeight: 600, textAlign: 'center' }}>Devuel</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.lista.map(v => {
                              const bv = bidonesDeVenta(v)
                              return (
                              <tr key={v.id} onClick={() => abrirGestion(v)} style={{ color: '#cbd5e1', borderTop: `1px solid ${theme.colors.border}`, cursor: 'pointer' }}
                                title="Ver evidencia (fotos y firma)">
                                <td style={{ padding: '8px 12px' }}>{v.delivered_at ? new Date(v.delivered_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : ''}</td>
                                <td style={{ padding: '8px 12px' }}>{v.cliente ?? ''}</td>
                                <td style={{ padding: '8px 12px' }}>{v.payment_method ? (PAY_LABEL[v.payment_method] ?? v.payment_method) : ''}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{num(v.cash_received) > 0 ? '$'+num(v.cash_received).toLocaleString('es-AR') : '-'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{num(v.transfer_amount) > 0 ? '$'+num(v.transfer_amount).toLocaleString('es-AR') : '-'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>{num(v.credit_amount) > 0 ? '$'+num(v.credit_amount).toLocaleString('es-AR') : '-'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: theme.colors.text }}>${num(v.actual_amount).toLocaleString('es-AR')}</td>
                                <td style={{ padding: '8px 8px', textAlign: 'center' }}>{bv.tromen || '-'}</td>
                                <td style={{ padding: '8px 8px', textAlign: 'center' }}>{bv.oeste || '-'}</td>
                                <td style={{ padding: '8px 8px', textAlign: 'center' }}>{bv.seis || '-'}</td>
                                <td style={{ padding: '8px 8px', textAlign: 'center' }}>{bv.otros || '-'}</td>
                                <td style={{ padding: '8px 8px', textAlign: 'center' }}>{bv.devueltos || '-'}</td>
                              </tr>
                              )
                            })}
                            <tr style={{ borderTop: `2px solid ${theme.colors.border}`, color: theme.colors.text, fontWeight: 700 }}>
                              <td style={{ padding: '8px 12px' }} colSpan={3}>TOTALES</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>${t.efectivo.toLocaleString('es-AR')}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>${t.transfer.toLocaleString('es-AR')}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>${t.credito.toLocaleString('es-AR')}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>${t.total.toLocaleString('es-AR')}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'center', color: theme.colors.accent }}>{tb.tromen || '-'}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'center', color: theme.colors.accent }}>{tb.oeste || '-'}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'center', color: theme.colors.accent }}>{tb.seis || '-'}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'center' }}>{tb.otros || '-'}</td>
                              <td style={{ padding: '8px 8px', textAlign: 'center' }}>{tb.devueltos || '-'}</td>
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

      {/* Modal de evidencia de gestion */}
      {gestionSel && (
        <div onClick={() => { setGestionSel(null); setEvidencia(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: theme.colors.surface, border: `1px solid ${theme.colors.border}`, borderRadius: 16,
              maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Cabecera */}
            <div style={{ padding: '18px 20px', borderBottom: `1px solid ${theme.colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: theme.colors.surface }}>
              <div>
                <p style={{ color: theme.colors.text, fontWeight: 700, fontSize: 15 }}>{gestionSel.cliente ?? 'Cliente'}</p>
                <p style={{ color: theme.colors.textFaint, fontSize: 12 }}>
                  {gestionSel.repartidor} · {gestionSel.delivered_at ? new Date(gestionSel.delivered_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : ''}
                </p>
              </div>
              <button onClick={() => { setGestionSel(null); setEvidencia(null) }}
                style={{ background: theme.colors.bg, border: `1px solid ${theme.colors.border}`, borderRadius: 8, color: '#cbd5e1',
                  width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Datos de la gestion */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div><p style={{ color: theme.colors.textFaint, fontSize: 11 }}>Total</p><p style={{ color: theme.colors.success, fontWeight: 700 }}>${num(gestionSel.actual_amount).toLocaleString('es-AR')}</p></div>
                <div><p style={{ color: theme.colors.textFaint, fontSize: 11 }}>Pago</p><p style={{ color: theme.colors.text }}>{gestionSel.payment_method ? (PAY_LABEL[gestionSel.payment_method] ?? gestionSel.payment_method) : '-'}</p></div>
                <div><p style={{ color: theme.colors.textFaint, fontSize: 11 }}>Direccion</p><p style={{ color: '#cbd5e1', fontSize: 13 }}>{gestionSel.direccion ?? '-'}</p></div>
              </div>

              {cargandoEvid && <p style={{ color: theme.colors.textFaint, textAlign: 'center', padding: 20 }}>Cargando evidencia...</p>}

              {!cargandoEvid && evidencia && (() => {
                const evs = evidencia.evidence ?? []
                const firma = evs.find((e: any) => e.type === 'firma_digital')
                const fotos = evs.filter((e: any) => e.type !== 'firma_digital')
                if (evs.length === 0) return <p style={{ color: theme.colors.textFaint, textAlign: 'center', padding: 20 }}>Esta gestion no tiene fotos ni firma registradas</p>
                return (
                  <div>
                    {fotos.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ color: theme.colors.accent, fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Fotos ({fotos.length})</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                          {fotos.map((f: any) => (
                            <div key={f.id}>
                              <img src={f.file_url} alt={f.type} onClick={() => setImgAmpliada(f.file_url)} style={{ width: '100%', borderRadius: 8, border: `1px solid ${theme.colors.border}`, cursor: 'zoom-in' }} />
                              <p style={{ color: theme.colors.textFaint, fontSize: 10, marginTop: 3 }}>{f.type === 'foto_ausente' ? 'Cliente ausente' : f.type === 'foto_entrega' ? 'Entrega' : f.type}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {firma && (
                      <div>
                        <p style={{ color: theme.colors.accent, fontSize: 12, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Firma del cliente</p>
                        <img src={firma.file_url} alt="firma" onClick={() => setImgAmpliada(firma.file_url)} style={{ width: '100%', maxWidth: 300, borderRadius: 8, border: `1px solid ${theme.colors.border}`, background: '#fff', cursor: 'zoom-in' }} />
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox: imagen ampliada a pantalla completa */}
      {imgAmpliada && (
        <div onClick={() => setImgAmpliada(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <img src={imgAmpliada} alt="ampliada"
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
          <button onClick={() => setImgAmpliada(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)',
              border: 'none', borderRadius: 8, color: '#fff', width: 40, height: 40, cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
      )}
    </div>
  )
}
