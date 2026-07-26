/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      /**
       * Ningun color se escribe aca. Todo apunta a las variables CSS de
       * tokens.css, que son las mismas que las variables de Figma. Un cambio
       * de tema es un cambio de clase, no de clases de utilidad.
       */
      colors: {
        surface: {
          page: 'var(--surface-page)',
          card: 'var(--surface-card)',
          subtle: 'var(--surface-subtle)',
          hover: 'var(--surface-hover)',
          accent: 'var(--surface-accent-subtle)'
        },
        ink: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          accent: 'var(--text-accent)',
          inverse: 'var(--text-on-accent)'
        },
        line: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          accent: 'var(--border-accent)'
        },
        accent: {
          DEFAULT: 'var(--accent-solid)',
          hover: 'var(--accent-hover)'
        },
        trust: {
          'verified-bg': 'var(--trust-verified-bg)',
          'verified-border': 'var(--trust-verified-border)',
          'verified-solid': 'var(--trust-verified-solid)',
          'verified-text': 'var(--trust-verified-text)',
          'pending-bg': 'var(--trust-pending-bg)',
          'pending-border': 'var(--trust-pending-border)',
          'pending-solid': 'var(--trust-pending-solid)',
          'pending-text': 'var(--trust-pending-text)',
          'stale-bg': 'var(--trust-stale-bg)',
          'stale-border': 'var(--trust-stale-border)',
          'stale-solid': 'var(--trust-stale-solid)',
          'stale-text': 'var(--trust-stale-text)'
        },
        score: {
          track: 'var(--score-track)',
          fill: 'var(--score-fill)',
          text: 'var(--score-text)'
        }
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        // Los paneles apilados que dan el caracter a la pagina
        panel: 'var(--radius-panel)'
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        display: 'var(--font-display)'
      },
      fontSize: {
        display: ['clamp(2.25rem, 5vw, 3.5rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }]
      },
      maxWidth: {
        panel: '72rem'
      },
      boxShadow: {
        panel: '0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -12px rgb(0 0 0 / 0.08)',
        card: '0 1px 2px rgb(0 0 0 / 0.04)'
      }
    }
  },
  plugins: []
};
