/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  reactStrictMode: false,
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  transpilePackages: [
    'react-markdown',
    'react-phone-number-input',
    'lenis',
    'three',
    '@react-three/fiber',
    '@react-three/drei',
  ],
  allowedDevOrigins: ['*.replit.dev', '*.kirk.replit.dev'],
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
  async headers() {
    return [
      ...(isDev ? [{
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      }] : [{
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      }]),
    ];
  },
};

module.exports = nextConfig;
