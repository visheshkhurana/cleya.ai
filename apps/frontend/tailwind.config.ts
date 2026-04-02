import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cleya: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        dark: {
          50: '#334155',
          100: '#1E293B',
          200: '#1E293B',
          300: '#0F172A',
          400: '#0A0A0A',
          500: '#050510',
        },
        electric: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        violet: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
        },
        muted: '#94A3B8',
        surface: '#0F0F1A',
        border: '#1A1A2E',
        gold: '#F59E0B',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'cleya-gradient': 'linear-gradient(135deg, #050510 0%, #0A0A1A 50%, #050510 100%)',
        'hero-gradient': 'radial-gradient(ellipse at center top, #1a1a3e 0%, #050510 60%)',
        'card-gradient': 'linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.04) 100%)',
        'cta-gradient': 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
      },
      boxShadow: {
        'cleya': '0 0 40px rgba(59, 130, 246, 0.25)',
        'cleya-sm': '0 0 20px rgba(59, 130, 246, 0.15)',
        'cleya-glow': '0 0 60px rgba(59, 130, 246, 0.3)',
        'violet-glow': '0 0 60px rgba(139, 92, 246, 0.3)',
        'bubble': '0 2px 8px rgba(0,0,0,0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
