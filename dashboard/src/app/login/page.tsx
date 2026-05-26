'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await authApi.login(email, password)
      if (data.user.role === 'repartidor') {
        setError('No tenés permisos para acceder al panel administrativo.')
        return
      }
      localStorage.setItem('tromen_token', data.token)
      localStorage.setItem('tromen_user', JSON.stringify(data.user))
      router.push('/')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Error de conexión')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #063D5E 0%, #0A5C8A 50%, #1A8FBF 100%)' }}>

      {/* Círculos decorativos */}
      <div className="absolute rounded-full"
        style={{ width: 500, height: 500, top: -120, right: -120, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
      <div className="absolute rounded-full"
        style={{ width: 300, height: 300, bottom: -80, left: -80, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} />
      <div className="absolute rounded-full"
        style={{ width: 200, height: 200, top: '40%', right: '15%', background: 'rgba(255,255,255,0.03)' }} />

      <div className="relative z-10 w-full max-w-md px-6">

        {/* LOGO */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-2" style={{ minHeight: 140 }}>
            <img src="/tromen-logo.png" alt="TROMEN"
              style={{ height: 300, objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.3))', maxWidth: '280px' }} />
          </div>
          <p className="text-blue-200 mt-3 text-sm font-medium tracking-wide">Panel Administrativo · Catriel</p>
        </div>

        {/* FORM */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Iniciar sesión</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
              placeholder="admin@tromen.com" required
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm"
              placeholder="••••••••" required
            />
          </div>

          <button type="submit" onClick={handleLogin} disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all"
            style={{ background: loading ? '#aaa' : 'linear-gradient(135deg, #0A5C8A, #1A8FBF)', boxShadow: '0 4px 16px rgba(10,92,138,0.3)' }}>
            {loading ? 'Ingresando...' : 'Ingresar al panel'}
          </button>
        </div>

        <p className="text-center text-blue-300 text-xs mt-6">BYF Soluciones · TROMEN v1.0</p>
      </div>
    </div>
  )
}