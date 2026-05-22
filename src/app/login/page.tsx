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
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0A5C8A 0%, #1A8FBF 100%)' }}>

      {/* Círculos decorativos */}
      <div className="absolute w-96 h-96 rounded-full opacity-10 bg-white"
        style={{ top: '-80px', right: '-80px' }} />
      <div className="absolute w-64 h-64 rounded-full opacity-10 bg-white"
        style={{ bottom: '40px', left: '-40px' }} />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
            style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)' }}>
            <span className="text-4xl">💧</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-widest">TROMEN</h1>
          <p className="text-blue-100 mt-1 text-sm">Panel Administrativo · Catriel</p>
        </div>

        <form onSubmit={handleLogin}
          className="bg-white rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Iniciar sesión</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-500 mb-2">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:border-blue-400"
              placeholder="admin@tromen.com" required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-500 mb-2">Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:border-blue-400"
              placeholder="••••••••" required
            />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white text-base transition-all"
            style={{ background: loading ? '#aaa' : '#0A5C8A' }}>
            {loading ? 'Ingresando...' : '💧  Ingresar al panel'}
          </button>
        </form>

        <p className="text-center text-blue-200 text-xs mt-6">BYF Soluciones · v1.0</p>
      </div>
    </div>
  )
}
