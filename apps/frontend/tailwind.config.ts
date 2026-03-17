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
          400: '#8160FF',
          500: '#6C47FF',
          600: '#5E3AEC',
          700: '#4E2FD8',
          800: '#3D23B8',
          900: '#2D1899',
        },
        dark: {
          50: '#2A2440',
          100: '#1F1A35',
          200: '#17132A',
          300: '#100D1F',
          400: '#0D0B1A',
          500: '#0A0815',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
      },
      backgroundImage: {
        'boardy-gradient': 'linear-gradient(135deg, #0D0B1A 0%, #1A1033 50%, #0D0B1A 100%)',
        'hero-gradient': 'radial-gradient(ellipse at center top, #2D1899 0%, #0D0B1A 60%)',
        'card-gradient': 'linear-gradient(180deg, rgba(108,71,255,0.12) 0%, rgba(108,71,255,0.04) 100%)',
      },
      boxShadow: {
        'boardy': '0 0 40px rgba(108, 71, 255, 0.25)',
        'boardy-sm': '0 0 20px rgba(108, 71, 255, 0.15)',
        'bubble': '0 2px 8px rgba(0,0,0,0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
