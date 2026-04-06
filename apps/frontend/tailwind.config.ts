import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#080D1A',
        surface: '#0F1629',
        card: '#1A2035',
        raised: '#252B42',
        brand: {
          violet: '#6C63FF',
          teal: '#4ECDC4',
          'violet-hover': '#9B95FF',
          'violet-pressed': '#2D2A5E',
          'teal-hover': '#7EDDD6',
        },
        muted: '#7A8BA5',
        'text-secondary': '#9CA3AF',
        'text-tertiary': '#6B7280',
        border: '#1E2640',
        gold: '#F59E0B',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'DM Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display': ['40px', { lineHeight: '1.1', fontWeight: '500' }],
        'h1': ['32px', { lineHeight: '1.2', fontWeight: '600' }],
        'h2': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '1.6', fontWeight: '400' }],
        'label': ['11px', { lineHeight: '1', fontWeight: '600', letterSpacing: '0.05em' }],
        'mono-sm': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
      },
      backgroundImage: {
        'canvas-gradient': 'linear-gradient(135deg, #080D1A 0%, #0F1629 50%, #080D1A 100%)',
        'hero-gradient': 'radial-gradient(ellipse at center top, #1A2035 0%, #080D1A 60%)',
        'card-gradient': 'linear-gradient(180deg, rgba(108,99,255,0.06) 0%, rgba(78,205,196,0.03) 100%)',
        'cta-gradient': 'linear-gradient(135deg, #6C63FF, #4ECDC4)',
      },
      boxShadow: {
        'brand': '0 0 40px rgba(108, 99, 255, 0.2)',
        'brand-sm': '0 0 20px rgba(108, 99, 255, 0.12)',
        'brand-glow': '0 0 60px rgba(108, 99, 255, 0.25)',
        'teal-glow': '0 0 60px rgba(78, 205, 196, 0.2)',
        'bubble': '0 2px 8px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
