const FIXED_COLORS: Record<string, string> = {
  'juan@tromen.com':   '#3B82F6',
  'miguel@tromen.com': '#10B981',
}

export function getRepColor(userId: string, email?: string): string {
  if (email && FIXED_COLORS[email]) return FIXED_COLORS[email]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 45%)`
}