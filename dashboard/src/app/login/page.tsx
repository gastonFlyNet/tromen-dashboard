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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #0D1F33 0%, #1A2E4A 50%, #2D7DD2 100%)',
      fontFamily: 'Inter, sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Círculos decorativos */}
      <div style={{ position: 'absolute', width: 500, height: 500, top: -120, right: -120, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, bottom: -80, left: -80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, padding: '0 24px' }}>
        {/* CARD */}
        <div style={{ background: 'white', borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

          {/* HEADER CON LOGO */}
          <div style={{
            background: 'linear-gradient(135deg, #1A2E4A, #2D7DD2)',
            padding: '36px 32px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <img src="/tromen-logo.png" alt="TROMEN"
              style={{ height: 90, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }} />
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 10, letterSpacing: '0.08em', fontWeight: 500 }}>
              PANEL ADMINISTRATIVO · CATRIEL
            </p>
          </div>

          {/* FORMULARIO */}
          <div style={{ padding: '28px 32px 32px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', marginBottom: 20 }}>Iniciar sesión</h2>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <p style={{ color: '#C0392B', fontSize: 13 }}>{error}</p>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#1A1A1A', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
                placeholder="admin@tromen.com" required
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Contraseña</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#1A1A1A', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}
                placeholder="••••••••" required
              />
            </div>

            <button onClick={handleLogin} disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 10, fontWeight: 700, color: 'white', fontSize: 14,
                background: loading ? '#aaa' : 'linear-gradient(135deg, #1A2E4A, #2D7DD2)',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(26,46,74,0.3)',
                fontFamily: 'Inter, sans-serif',
              }}>
              {loading ? 'Ingresando...' : 'Ingresar al panel'}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 20 }}>
          BYF Soluciones · TROMEN v1.0
        </p>
      </div>
    </div>
  )
}
