/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#effcfb',
          100: '#d4f8f4',
          200: '#92f2e9',
          300: '#58e2d8',
          400: '#27cfc5',
          500: '#0b9692',
          600: '#087f7c',
          700: '#0c7776',
          800: '#105f60',
          900: '#0b4548',
          // Variantes "next" provisionadas pra migração futura (Fase 2)
          next: {
            500: '#0b9692',
            600: '#087f7c',
          },
        },
        signal: {
          success: {
            50:  '#E8FBF3',
            100: '#CAF5E0',
            300: '#5CEAB0',
            500: '#10E088',
            600: '#0BBF72',
            700: '#088F55',
            900: '#033821',
          },
        },
      },
      backgroundImage: {
        'gradient-brand':       'var(--gradient-brand)',
        'gradient-brand-deep':  'var(--gradient-brand-deep)',
        'gradient-signal-flow': 'var(--gradient-signal-flow)',
      },
      boxShadow: {
        'glow-brand-sm':   'var(--glow-brand-sm)',
        'glow-brand-md':   'var(--glow-brand-md)',
        'glow-brand-lg':   'var(--glow-brand-lg)',
        'glow-success-sm': 'var(--glow-success-sm)',
        'glow-success-md': 'var(--glow-success-md)',
        'elevation-1':     'var(--shadow-elevation-1)',
        'elevation-2':     'var(--shadow-elevation-2)',
        'elevation-3':     'var(--shadow-elevation-3)',
        'elevation-4':     'var(--shadow-elevation-4)',
      },
      borderRadius: {
        xs:    '0.25rem',  // 4px  — pills minúsculas, chips ultra-densos
        '3xl': '1.5rem',   // 24px — hero cards, modais premium
      },
    },
  },
  plugins: [],
}
