'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { theme, inputCls, labelCls } from '@/lib/theme'

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
      background: `linear-gradient(160deg, ${theme.colors.bg} 0%, #142033 50%, ${theme.colors.brand} 100%)`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Círculos decorativos */}
      <div style={{ position: 'absolute', width: 500, height: 500, top: -120, right: -120, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, bottom: -80, left: -80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, padding: '0 24px' }}>
        {/* CARD */}
        <div style={{
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
        }}>

          {/* HEADER CON LOGO */}
          <div style={{
            background: `linear-gradient(135deg, ${theme.colors.brand}, ${theme.colors.brandLight})`,
            padding: '36px 32px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            <img src="/tromen-logo.png" alt="TROMEN"
              style={{ height: 250, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }} />
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 10, letterSpacing: '0.08em', fontWeight: 500 }}>
              PANEL ADMINISTRATIVO · CATRIEL
            </p>
          </div>

          {/* FORMULARIO */}
          <div style={{ padding: '28px 32px 32px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.colors.text, marginBottom: 20 }}>Iniciar sesión</h2>

            {error && (
              <div className="rounded-lg border" style={{ background: theme.colors.errorSoft, borderColor: theme.colors.error, padding: '10px 14px', marginBottom: 16 }}>
                <p style={{ color: theme.colors.error, fontSize: 13 }}>{error}</p>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label className={labelCls} style={{ display: 'block', marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className={inputCls + ' !mt-0'}
                placeholder="admin@tromen.com" required
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label className={labelCls} style={{ display: 'block', marginBottom: 6 }}>Contraseña</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                className={inputCls + ' !mt-0'}
                placeholder="••••••••" required
              />
            </div>

            <button onClick={handleLogin} disabled={loading}
              className="w-full hover:brightness-110 transition-all"
              style={{
                padding: '13px', borderRadius: 10, fontWeight: 700, color: 'white', fontSize: 14,
                background: loading ? theme.colors.textFaint : `linear-gradient(135deg, ${theme.colors.brand}, ${theme.colors.brandLight})`,
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: `0 4px 16px ${theme.colors.brand}4D`,
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
