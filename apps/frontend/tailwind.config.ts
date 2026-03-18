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
          50: '#2D2A45',
          100: '#1A1730',
          200: '#13112A',
          300: '#0B0918',
          400: '#0B0918',
          500: '#080714',
        },
        muted: '#A09FB5',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'boardy-gradient': 'linear-gradient(135deg, #0B0918 0%, #13112A 50%, #0B0918 100%)',
        'hero-gradient': 'radial-gradient(ellipse at center top, #134E4A 0%, #0B0918 60%)',
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
