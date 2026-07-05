'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
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

export default function CambiarPasswordPage() {
  const router = useRouter()
  const [userName, setUserName]   = useState('')
  const [current, setCurrent]     = useState('')
  const [nueva, setNueva]         = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [ok, setOk]               = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('tromen_user')
    if (!u) { router.push('/login'); return }
    try { setUserName(JSON.parse(u).name ?? '') } catch {}
  }, [])

  const guardar = async () => {
    setError(''); setOk(false)
    if (nueva.length < 6) { setError('La nueva contraseña debe tener al menos 6 caracteres'); return }
    if (nueva !== confirmar) { setError('Las contraseñas nuevas no coinciden'); return }
    if (nueva === current) { setError('La nueva contraseña debe ser distinta a la actual'); return }
    setSaving(true)
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: nueva }),
      })
      setOk(true)
      setCurrent(''); setNueva(''); setConfirmar('')
    } catch (e: any) {
      let msg = 'No se pudo cambiar la contraseña'
      try { msg = JSON.parse(e.message).error ?? msg } catch {}
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: theme.colors.bg, color: theme.colors.text }}>
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        <FadeIn>
          <div className="max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-1" style={{ color: theme.colors.text }}>Cambiar contraseña</h1>
            <p className="text-sm mb-6" style={{ color: theme.colors.textFaint }}>
              {userName ? `Sesión: ${userName}` : 'Actualizá tu contraseña de acceso'}
            </p>

            <div className={cardCls + ' p-6 space-y-4'}>
              <div>
                <label className={labelCls + ' block mb-1 normal-case'}>Contraseña actual</label>
                <input
                  type="password"
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  className={inputCls + ' !mt-0'}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className={labelCls + ' block mb-1 normal-case'}>Contraseña nueva</label>
                <input
                  type="password"
                  value={nueva}
                  onChange={e => setNueva(e.target.value)}
                  className={inputCls + ' !mt-0'}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className={labelCls + ' block mb-1 normal-case'}>Repetir contraseña nueva</label>
                <input
                  type="password"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  className={inputCls + ' !mt-0'}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="text-sm rounded-lg px-3 py-2" style={{ color: theme.colors.error, background: theme.colors.errorSoft }}>{error}</div>
              )}
              {ok && (
                <div className="text-sm rounded-lg px-3 py-2" style={{ color: theme.colors.success, background: theme.colors.successSoft }}>
                  Contraseña actualizada correctamente
                </div>
              )}

              <button
                onClick={guardar}
                disabled={saving}
                className="w-full py-2.5 rounded-lg font-semibold hover:brightness-110 transition-all disabled:opacity-50"
                style={{ background: theme.colors.accent, color: theme.colors.bg }}
              >
                {saving ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </div>
          </div>
        </FadeIn>
      </main>
    </div>
  )
}
