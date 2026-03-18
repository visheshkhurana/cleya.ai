import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        boardy: {
          50: '#F0EBFF',
          100: '#DDD3FF',
          200: '#BBA8FF',
          300: '#9B80FF',
          400: '#8B5CF6',
          500: '#6D28D9',
          600: '#5B21B6',
          700: '#4E2FD8',
          800: '#3D23B8',
          900: '#2D1899',
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
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'boardy-gradient': 'linear-gradient(135deg, #0B0918 0%, #13112A 50%, #0B0918 100%)',
        'hero-gradient': 'radial-gradient(ellipse at center top, #2D1899 0%, #0B0918 60%)',
        'card-gradient': 'linear-gradient(180deg, rgba(109,40,217,0.12) 0%, rgba(109,40,217,0.04) 100%)',
      },
      boxShadow: {
        'boardy': '0 0 40px rgba(109, 40, 217, 0.25)',
        'boardy-sm': '0 0 20px rgba(109, 40, 217, 0.15)',
        'boardy-glow': '0 0 60px rgba(109, 40, 217, 0.3)',
        'bubble': '0 2px 8px rgba(0,0,0,0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
