'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import FadeIn from '@/components/FadeIn'

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
    <div className="flex min-h-screen bg-[#0f1117] text-white">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        <FadeIn>
          <div className="max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-1">Cambiar contraseña</h1>
            <p className="text-sm text-gray-400 mb-6">
              {userName ? `Sesión: ${userName}` : 'Actualizá tu contraseña de acceso'}
            </p>

            <div className="bg-[#1a1d27] rounded-xl p-6 space-y-4 border border-white/5">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Contraseña actual</label>
                <input
                  type="password"
                  value={current}
                  onChange={e => setCurrent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-white/10 focus:border-[#38bdf8] outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Contraseña nueva</label>
                <input
                  type="password"
                  value={nueva}
                  onChange={e => setNueva(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-white/10 focus:border-[#38bdf8] outline-none"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Repetir contraseña nueva</label>
                <input
                  type="password"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0f1117] border border-white/10 focus:border-[#38bdf8] outline-none"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
              )}
              {ok && (
                <div className="text-sm text-[#34d399] bg-[#34d399]/10 rounded-lg px-3 py-2">
                  Contraseña actualizada correctamente
                </div>
              )}

              <button
                onClick={guardar}
                disabled={saving}
                className="w-full py-2.5 rounded-lg bg-[#38bdf8] text-[#0f1117] font-semibold hover:bg-[#0ea5e9] transition disabled:opacity-50"
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
