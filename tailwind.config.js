/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        inter: ['var(--font-inter)', 'sans-serif'],
      },
      colors: {
        // Tokens semánticos (apuntan a las variables de globals.css)
        bg:         'var(--bg)',
        surface:    'var(--surface)',
        'surface-2':'var(--surface-2)',
        'surface-3':'var(--surface-3)',
        line:       'var(--border)',
        'line-strong':'var(--border-strong)',
        content:    'var(--text)',
        muted:      'var(--text-muted)',
        faint:      'var(--text-faint)',

        // Marca y estados
        primary:    '#1A8FBF',
        'primary-deep': '#0A5C8A',
        secondary:  '#1A8FBF',
        accent:     '#E8F4FD',
        success:    '#2ecc71',
        warning:    '#e67e22',
        danger:     '#e74c3c',
      },
      boxShadow: {
        card: 'var(--shadow-sm)',
        elevated: 'var(--shadow)',
      },
      borderRadius: {
        xl: 'var(--radius)',
      },
    },
  },
  plugins: [],
}
