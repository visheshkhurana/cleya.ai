import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cleo.ai — AI Superconnector for Founders, Investors & Operators',
  description: 'Cleo.ai is a members-only AI-powered professional networking platform. Matching founders, investors, talent, and partners with 94% accuracy through intelligent conversations. Join 12,000+ professionals.',
  keywords: ['AI networking', 'founder matching', 'investor matching', 'professional networking', 'startup networking', 'AI matchmaking'],
  openGraph: {
    title: 'Cleo.ai — AI Superconnector for Founders, Investors & Operators',
    description: 'Members-only AI-powered networking. 94% match accuracy. Join 12,000+ founders, investors, and operators building meaningful connections through intelligent conversations.',
    url: 'https://boardy-ai-platform.replit.app',
    siteName: 'Cleo.ai',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Cleo.ai — AI Superconnector',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cleo.ai — AI Superconnector for Founders, Investors & Operators',
    description: 'Members-only AI-powered networking. 94% match accuracy. Join 12,000+ founders, investors, and operators.',
    images: ['/og-image.svg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
