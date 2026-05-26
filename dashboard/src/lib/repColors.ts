// Colores fijos por email de repartidor conocido
const FIXED_COLORS: Record<string, string> = {
  'juan@tromen.com':   '#3B82F6',  // azul
  'miguel@tromen.com': '#10B981',  // verde
}

export function getRepColor(userId: string, email?: string): string {
  // Si el email esta en la lista fija, usar ese color
  if (email && FIXED_COLORS[email]) return FIXED_COLORS[email]

  // Para cualquier otro repartidor, generar color consistente por hash del ID
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 45%)`
}