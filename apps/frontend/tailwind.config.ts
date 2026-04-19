import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Refreshed palette — warmer indigo base instead of cold navy. Cards/surfaces
        // are slightly lighter to read brighter, and accents are pushed toward higher
        // chroma so the UI vibes instead of feeling murky.
        canvas: '#0B0820',
        navy: '#100A2E',
        surface: '#15102E',
        card: '#1E1745',
        raised: '#2A2156',
        primary: {
          DEFAULT: '#8B5CF6',
          hover: '#A78BFA',
          pressed: '#7C3AED',
        },
        brand: {
          violet: '#8B7BFF',
          teal: '#5DECDC',
          magenta: '#FF6B9D',
          'violet-hover': '#B0A4FF',
          'violet-pressed': '#332B6E',
          'teal-hover': '#8AF5E8',
        },
        muted: '#7A8BA5',
        'text-secondary': '#9CA3AF',
        'text-tertiary': '#6B7280',
        border: '#1E2640',
        gold: {
          DEFAULT: '#C9A962',
          hover: '#D4B976',
          pressed: '#B5944E',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
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
        'canvas-gradient': 'linear-gradient(135deg, #0B0820 0%, #15102E 50%, #0B0820 100%)',
        'hero-gradient': 'radial-gradient(ellipse at center top, #1E1745 0%, #0B0820 60%)',
        'navy-gradient': 'linear-gradient(180deg, #100A2E 0%, #0B0820 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(139,123,255,0.10) 0%, rgba(93,236,220,0.05) 100%)',
        'cta-gradient': 'linear-gradient(135deg, #8B7BFF 0%, #5DECDC 50%, #FF6B9D 100%)',
        'gold-gradient': 'linear-gradient(135deg, #D4B976 0%, #C9A962 50%, #B5944E 100%)',
      },
      boxShadow: {
        'brand': '0 0 40px rgba(139, 123, 255, 0.30)',
        'brand-sm': '0 0 20px rgba(139, 123, 255, 0.18)',
        'brand-glow': '0 0 60px rgba(139, 123, 255, 0.35)',
        'teal-glow': '0 0 60px rgba(93, 236, 220, 0.28)',
        'magenta-glow': '0 0 60px rgba(255, 107, 157, 0.28)',
        'gold-glow': '0 0 30px rgba(201, 169, 98, 0.35)',
        'bubble': '0 2px 8px rgba(0,0,0,0.3)',
      },
      spacing: {
        '4.5': '1.125rem',
      },
    },
  },
  plugins: [],
};

export default config;
