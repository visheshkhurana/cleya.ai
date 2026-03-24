import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        boardy: {
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
          400: '#0F172A',
          500: '#0B1120',
        },
        muted: '#94A3B8',
        surface: '#1E293B',
        border: '#334155',
        gold: '#F59E0B',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'boardy-gradient': 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
        'hero-gradient': 'radial-gradient(ellipse at center top, #134E4A 0%, #0F172A 60%)',
        'card-gradient': 'linear-gradient(180deg, rgba(13,148,136,0.12) 0%, rgba(13,148,136,0.04) 100%)',
      },
      boxShadow: {
        'boardy': '0 0 40px rgba(13, 148, 136, 0.25)',
        'boardy-sm': '0 0 20px rgba(13, 148, 136, 0.15)',
        'boardy-glow': '0 0 60px rgba(13, 148, 136, 0.3)',
        'bubble': '0 2px 8px rgba(0,0,0,0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
