'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { theme, cardCls } from '@/lib/theme'

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

  const STATUS_COLOR: Record<string, string> = {
    entregado:    theme.colors.success,
    no_entregado: theme.colors.error,
    pendiente:    theme.colors.warning,
    parcial:      theme.colors.accent,
  }

  const STATUS_LABEL: Record<string, string> = {
    entregado:    'Entregado',
    no_entregado: 'No entregado',
    pendiente:    'Pendiente',
    parcial:      'Parcial',
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: theme.colors.bg }}>
      <div className="text-center">
        <span className="text-5xl">💧</span>
        <p className="mt-3" style={{ color: theme.colors.textFaint }}>Cargando entrega...</p>
      </div>
    </div>
  )

  if (error || !delivery) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: theme.colors.bg }}>
      <div className="text-center">
        <p className="text-4xl mb-3">❌</p>
        <p style={{ color: theme.colors.textFaint }}>{error || 'Entrega no encontrada'}</p>
        <button onClick={() => router.back()}
          className="mt-4 text-sm font-semibold" style={{ color: theme.colors.accent }}>← Volver</button>
      </div>
    </div>
  )

  const firma  = delivery.evidence?.find((e: any) => e.type === 'firma_digital')
  const fotos = delivery.evidence?.filter((e: any) => e.type === 'foto_entrega' || e.type === 'foto_ausente' || e.type === 'foto_venta_calle') ?? []
  const totalCobrado = Number(delivery.actual_amount ?? 0)

  return (
    <div className="min-h-screen" style={{ background: theme.colors.bg }}>

      {/* NAVBAR */}
      <nav className="text-white px-6 py-4 flex items-center justify-between shadow-lg"
        style={{ background: `linear-gradient(135deg, ${theme.colors.brand}, ${theme.colors.brandLight})` }}>
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
            background: (STATUS_COLOR[delivery.status] ?? theme.colors.textFaint) + '30',
            color: STATUS_COLOR[delivery.status] ?? theme.colors.textFaint,
            border: `1px solid ${STATUS_COLOR[delivery.status] ?? theme.colors.textFaint}`,
          }}>
          {STATUS_LABEL[delivery.status] ?? delivery.status}
        </span>
      </nav>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

        {/* INFO CLIENTE + RESUMEN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Datos del cliente */}
          <div className={cardCls + ' p-5'}>
            <h3 className="font-bold mb-4" style={{ color: theme.colors.text }}>👤 Cliente</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: theme.colors.textFaint }}>Nombre</span>
                <span className="text-sm font-semibold" style={{ color: theme.colors.text }}>{delivery.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: theme.colors.textFaint }}>Dirección</span>
                <span className="text-sm text-right max-w-48" style={{ color: theme.colors.text }}>{delivery.address}</span>
              </div>
              {delivery.phone && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: theme.colors.textFaint }}>Teléfono</span>
                  <a href={`tel:${delivery.phone}`}
                    className="text-sm font-semibold" style={{ color: theme.colors.accent }}>{delivery.phone}</a>
                </div>
              )}
              {delivery.arrived_at && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: theme.colors.textFaint }}>Hora de llegada</span>
                  <span className="text-sm" style={{ color: theme.colors.text }}>
                    {new Date(delivery.arrived_at).toLocaleTimeString('es-AR',
                      { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {delivery.delivered_at && (
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: theme.colors.textFaint }}>Hora de entrega</span>
                  <span className="text-sm" style={{ color: theme.colors.text }}>
                    {new Date(delivery.delivered_at).toLocaleTimeString('es-AR',
                      { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {delivery.rejection_reason && (
                <div className="mt-3 rounded-xl p-3 border" style={{ background: theme.colors.errorSoft, borderColor: theme.colors.error }}>
                  <p className="text-xs font-semibold" style={{ color: theme.colors.error }}>Motivo de no entrega:</p>
                  <p className="text-sm mt-1" style={{ color: theme.colors.error }}>{delivery.rejection_reason}</p>
                </div>
              )}
              {delivery.notes && (
                <div className="mt-3 rounded-xl p-3" style={{ background: theme.colors.surface2 }}>
                  <p className="text-xs font-semibold" style={{ color: theme.colors.textMuted }}>Notas:</p>
                  <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>{delivery.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Resumen de pago */}
          <div className={cardCls + ' p-5'}>
            <h3 className="font-bold mb-4" style={{ color: theme.colors.text }}>💰 Resumen de pago</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: theme.colors.border }}>
                <span className="text-sm" style={{ color: theme.colors.textFaint }}>Monto esperado</span>
                <span className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                  ${Number(delivery.expected_amount ?? 0).toLocaleString('es-AR')}
                </span>
              </div>
              {delivery.payment_method && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: theme.colors.textFaint }}>Método de pago</span>
                  <span className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                    {METODO_LABEL[delivery.payment_method] ?? delivery.payment_method}
                  </span>
                </div>
              )}
              {Number(delivery.cash_received) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: theme.colors.textFaint }}>💵 Efectivo</span>
                  <span className="text-sm font-semibold" style={{ color: theme.colors.success }}>
                    ${Number(delivery.cash_received).toLocaleString('es-AR')}
                  </span>
                </div>
              )}
              {Number(delivery.transfer_amount) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: theme.colors.textFaint }}>🏦 Transferencia</span>
                  <span className="text-sm font-semibold" style={{ color: theme.colors.accent }}>
                    ${Number(delivery.transfer_amount).toLocaleString('es-AR')}
                  </span>
                </div>
              )}
              {Number(delivery.credit_amount) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: theme.colors.textFaint }}>📒 Fiado</span>
                  <span className="text-sm font-semibold" style={{ color: theme.colors.warning }}>
                    ${Number(delivery.credit_amount).toLocaleString('es-AR')}
                  </span>
                </div>
              )}
              {Number(delivery.change_given) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: theme.colors.textFaint }}>Vuelto</span>
                  <span className="text-sm font-semibold" style={{ color: theme.colors.textMuted }}>
                    ${Number(delivery.change_given).toLocaleString('es-AR')}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: theme.colors.border }}>
                <span className="font-bold" style={{ color: theme.colors.text }}>Total cobrado</span>
                <span className="text-2xl font-bold" style={{ color: theme.colors.accent }}>
                  ${totalCobrado.toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FIRMA DIGITAL */}
        {firma && (
          <div className={cardCls + ' p-5'}>
            <h3 className="font-bold mb-4" style={{ color: theme.colors.text }}>✍️ Firma del cliente</h3>
            <div className="flex flex-col items-center">
              <div className="border-2 rounded-2xl overflow-hidden w-full max-w-lg" style={{ borderColor: theme.colors.border, background: theme.colors.surface2 }}>
                <img
                  src={firma.file_url}
                  alt="Firma del cliente"
                  className="w-full object-contain"
                  style={{ maxHeight: '200px', background: 'white' }}
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="w-2 h-2 rounded-full" style={{ background: theme.colors.success }} />
                <p className="text-xs" style={{ color: theme.colors.textFaint }}>
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
          <div className={cardCls + ' p-5'}>
            <h3 className="font-bold mb-4" style={{ color: theme.colors.text }}>
              📷 Fotos de evidencia
              <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: theme.colors.accentSoft, color: theme.colors.accent }}>
                {fotos.length}
              </span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {fotos.map((f: any) => (
                <div key={f.id} className="relative group cursor-pointer"
                  onClick={() => setLightbox(f.file_url)}>
                  <div className="aspect-square rounded-xl overflow-hidden border" style={{ background: theme.colors.surface2, borderColor: theme.colors.border }}>
                    <img
                      src={f.file_url}
                      alt={f.type}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all flex items-center justify-center">
                    <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">🔍</span>
                  </div>
                  <p className="text-xs mt-1 text-center capitalize" style={{ color: theme.colors.textFaint }}>
                    {f.type.replace(/_/g, ' ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SIN EVIDENCIA */}
        {!firma && fotos.length === 0 && (
          <div className={cardCls + ' p-8 text-center'}>
            <p className="text-3xl mb-3">📂</p>
            <p className="text-sm" style={{ color: theme.colors.textFaint }}>Sin evidencia registrada para esta entrega</p>
          </div>
        )}

        {/* HISTORIAL DE PAGOS */}
        {delivery.payments?.length > 0 && (
          <div className={cardCls + ' p-5'}>
            <h3 className="font-bold mb-4" style={{ color: theme.colors.text }}>🧾 Registro de pagos</h3>
            <div className="divide-y divide-[#1E2D40]">
              {delivery.payments.map((p: any) => (
                <div key={p.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                      {METODO_LABEL[p.method] ?? p.method}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: theme.colors.textFaint }}>
                      {new Date(p.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <p className="font-bold" style={{ color: theme.colors.accent }}>
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
