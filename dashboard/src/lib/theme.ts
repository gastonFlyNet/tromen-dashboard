// Design tokens unicos del dashboard TROMEN (tema oscuro).
// Fuente unica de verdad para colores: no redefinir hex sueltos en las paginas.
export const theme = {
  colors: {
    bg: '#0F1117',
    surface: '#151B27',
    surface2: '#1A2236',
    border: '#1E2D40',

    text: '#F1F5F9',
    textMuted: '#94A3B8',
    textFaint: '#64748B',

    // Azul TROMEN: #38BDF8 es el color interactivo/acento (botones, focus, links).
    // #0A5C8A/#1A8FBF quedan para fondos de marca y gradientes, no para acciones.
    accent: '#38BDF8',
    accentSoft: 'rgba(56,189,248,0.14)',
    brand: '#0A5C8A',
    brandLight: '#1A8FBF',

    success: '#16A34A',
    successSoft: 'rgba(22,163,74,0.14)',
    error: '#DC2626',
    errorSoft: 'rgba(220,38,38,0.14)',
    warning: '#D97706',
    warningSoft: 'rgba(217,119,6,0.14)',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
} as const

// Clases reutilizables (equivalentes oscuros de los tokens que ya existian
// en rutas/nueva/page.tsx, ahora compartidos entre paginas).
export const cardCls =
  'rounded-2xl bg-[#151B27] border border-[#1E2D40] shadow-[0_1px_3px_rgba(0,0,0,0.3)]'

export const inputCls =
  'w-full rounded-xl px-4 py-2.5 text-sm mt-1 bg-[#1A2236] ' +
  'border border-[#1E2D40] text-[#F1F5F9] placeholder-[#64748B] ' +
  'focus:outline-none focus:border-[#38BDF8] transition-colors'

export const labelCls = 'text-xs font-semibold text-[#94A3B8] uppercase tracking-wide'

// Header de pagina estandar (patron ya usado de facto en la mayoria de las vistas).
export const pageHeaderCls = 'font-bold text-lg'
