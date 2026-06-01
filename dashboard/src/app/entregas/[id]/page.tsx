'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://tromen-backend-production.up.railway.app'

async function apiFetch(path: string) {
  const token = localStorage.getItem('tromen_token')
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const METODO_LABEL: Record<string, string> = {
  efectivo:         '💵 Efectivo',
  transferencia:    '🏦 Transferencia bancaria',
  cuenta_corriente: '📒 Cuenta corriente (fiado)',
  mixto:            '🔀 Pago mixto',
}

const STATUS_COLOR: Record<string, string> = {
  entregado:    '#1A7A4A',
  no_entregado: '#C0392B',
  pendiente:    '#E67E22',
  parcial:      '#2980B9',
}

const STATUS_LABEL: Record<string, string> = {
  entregado:    'Entregado',
  no_entregado: 'No entregado',
  pendiente:    'Pendiente',
  parcial:      'Parcial',
}

export default function EntregaDetallePage() {
  const router  = useRouter()
  const params  = useParams()
  const id      = params?.id as string

  const [delivery, setDelivery] = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    apiFetch(`/api/deliveries/${id}`)
      .then(data => setDelivery(data))
      .catch(() => setError('No se pudo cargar la entrega'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="text-center">
        <span className="text-5xl">💧</span>
        <p className="text-gray-400 mt-3">Cargando entrega...</p>
      </div>
    </div>
  )

  if (error || !delivery) return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="text-center">
        <p className="text-4xl mb-3">❌</p>
        <p className="text-gray-500">{error || 'Entrega no encontrada'}</p>
        <button onClick={() => router.back()}
          className="mt-4 text-blue-600 text-sm font-semibold">← Volver</button>
      </div>
    </div>
  )

  const firma  = delivery.evidence?.find((e: any) => e.type === 'firma_digital')
  const fotos = delivery.evidence?.filter((e: any) => e.type === 'foto_entrega' || e.type === 'foto_ausente' || e.type === 'foto_venta_calle') ?? []
  const totalCobrado = Number(delivery.actual_amount ?? 0)

  return (
    <div className="min-h-screen" style={{ background: '#F0F7FC' }}>

      {/* NAVBAR */}
      <nav className="text-white px-6 py-4 flex items-center justify-between shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0A5C8A, #1A8FBF)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="text-blue-200 hover:text-white text-sm mr-2">← Volver</button>
          <span className="text-2xl">📋</span>
          <div>
            <h1 className="font-bold text-lg">{delivery.client_name}</h1>
            <p className="text-blue-200 text-xs">
              {delivery.repartidor} · {new Date(delivery.route_date).toLocaleDateString('es-AR', {
                weekday: 'long', day: 'numeric', month: 'long'
              })}
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-bold"
          style={{
            background: (STATUS_COLOR[delivery.status] ?? '#888') + '30',
            color: STATUS_COLOR[delivery.status] ?? '#888',
            border: `1px solid ${STATUS_COLOR[delivery.status] ?? '#888'}`,
          }}>
          {STATUS_LABEL[delivery.status] ?? delivery.status}
        </span>
      </nav>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

        {/* INFO CLIENTE + RESUMEN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Datos del cliente */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
            <h3 className="font-bold text-gray-700 mb-4">👤 Cliente</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Nombre</span>
                <span className="text-sm font-semibold text-gray-800">{delivery.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Dirección</span>
                <span className="text-sm text-gray-800 text-right max-w-48">{delivery.address}</span>
              </div>
              {delivery.phone && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Teléfono</span>
                  <a href={`tel:${delivery.phone}`}
                    className="text-sm font-semibold text-blue-600">{delivery.phone}</a>
                </div>
              )}
              {delivery.arrived_at && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Hora de llegada</span>
                  <span className="text-sm text-gray-800">
                    {new Date(delivery.arrived_at).toLocaleTimeString('es-AR',
                      { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {delivery.delivered_at && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Hora de entrega</span>
                  <span className="text-sm text-gray-800">
                    {new Date(delivery.delivered_at).toLocaleTimeString('es-AR',
                      { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {delivery.rejection_reason && (
                <div className="mt-3 bg-red-50 rounded-xl p-3 border border-red-100">
                  <p className="text-xs font-semibold text-red-600">Motivo de no entrega:</p>
                  <p className="text-sm text-red-700 mt-1">{delivery.rejection_reason}</p>
                </div>
              )}
              {delivery.notes && (
                <div className="mt-3 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500">Notas:</p>
                  <p className="text-sm text-gray-700 mt-1">{delivery.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Resumen de pago */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
            <h3 className="font-bold text-gray-700 mb-4">💰 Resumen de pago</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                
                <span className="text-sm font-semibold text-gray-800">
                  ${Number(delivery.expected_amount ?? 0).toLocaleString('es-AR')}
                </span>
              </div>
              {delivery.payment_method && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Método de pago</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {METODO_LABEL[delivery.payment_method] ?? delivery.payment_method}
                  </span>
                </div>
              )}
              {Number(delivery.cash_received) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">💵 Efectivo</span>
                  <span className="text-sm font-semibold text-green-700">
                    ${Number(delivery.cash_received).toLocaleString('es-AR')}
                  </span>
                </div>
              )}
              {Number(delivery.transfer_amount) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">🏦 Transferencia</span>
                  <span className="text-sm font-semibold text-blue-700">
                    ${Number(delivery.transfer_amount).toLocaleString('es-AR')}
                  </span>
                </div>
              )}
              {Number(delivery.credit_amount) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">📒 Fiado</span>
                  <span className="text-sm font-semibold text-orange-600">
                    ${Number(delivery.credit_amount).toLocaleString('es-AR')}
                  </span>
                </div>
              )}
              {Number(delivery.change_given) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Vuelto</span>
                  <span className="text-sm font-semibold text-gray-600">
                    ${Number(delivery.change_given).toLocaleString('es-AR')}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <span className="font-bold text-gray-700">Total cobrado</span>
                <span className="text-2xl font-bold" style={{ color: '#0A5C8A' }}>
                  ${totalCobrado.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FIRMA DIGITAL */}
        {firma && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
            <h3 className="font-bold text-gray-700 mb-4">✍️ Firma del cliente</h3>
            <div className="flex flex-col items-center">
              <div className="border-2 border-blue-100 rounded-2xl overflow-hidden bg-gray-50 w-full max-w-lg">
                <img
                  src={firma.file_url}
                  alt="Firma del cliente"
                  className="w-full object-contain"
                  style={{ maxHeight: '200px', background: 'white' }}
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-xs text-gray-400">
                  Firmado el {new Date(firma.captured_at).toLocaleDateString('es-AR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FOTOS DE EVIDENCIA */}
        {fotos.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
            <h3 className="font-bold text-gray-700 mb-4">
              📷 Fotos de evidencia
              <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {fotos.length}
              </span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {fotos.map((f: any) => (
                <div key={f.id} className="relative group cursor-pointer"
                  onClick={() => setLightbox(f.file_url)}>
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                    <img
                      src={f.file_url}
                      alt={f.type}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all flex items-center justify-center">
                    <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">🔍</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-center capitalize">
                    {f.type.replace(/_/g, ' ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SIN EVIDENCIA */}
        {!firma && fotos.length === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-blue-50 text-center">
            <p className="text-3xl mb-3">📂</p>
            <p className="text-gray-400 text-sm">Sin evidencia registrada para esta entrega</p>
          </div>
        )}

        {/* HISTORIAL DE PAGOS */}
        {delivery.payments?.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-50">
            <h3 className="font-bold text-gray-700 mb-4">🧾 Registro de pagos</h3>
            <div className="divide-y divide-gray-50">
              {delivery.payments.map((p: any) => (
                <div key={p.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {METODO_LABEL[p.method] ?? p.method}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(p.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <p className="font-bold text-blue-700">
                    ${Number(p.amount).toLocaleString('es-AR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* LIGHTBOX FOTOS */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300">✕</button>
          <img src={lightbox} alt="Evidencia"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
