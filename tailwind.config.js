/** @type {import('tailwindcss').Config} */

// Helper: cor a partir de uma tripla RGB em CSS var, preservando o
// modificador de opacidade do Tailwind (bg-brand/10, text-ink-2/60 etc).
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        plane: token('plane'),
        surface: token('surface'),
        surface2: token('surface-2'),
        surface3: token('surface-3'),
        line: token('line'),
        lineStrong: token('line-strong'),

        ink: token('ink'),
        ink2: token('ink-2'),
        ink3: token('ink-3'),

        brand: token('brand'),
        brandHover: token('brand-hover'),
        brandInk: token('brand-ink'),

        stage1: token('stage-1'),
        stage2: token('stage-2'),
        stage3: token('stage-3'),
        stage4: token('stage-4'),
        stage5: token('stage-5'),

        series1: token('series-1'),
        series2: token('series-2'),
        series3: token('series-3'),

        good: token('good'),
        critical: token('critical'),
      },
      borderRadius: {
        card: '14px',
        control: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 1px 3px rgb(0 0 0 / 0.04)',
        pop: '0 12px 32px -8px rgb(0 0 0 / 0.35), 0 2px 8px rgb(0 0 0 / 0.18)',
      },
      fontSize: {
        micro: ['10.5px', { lineHeight: '14px', letterSpacing: '0.06em' }],
        kpi: ['30px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}
