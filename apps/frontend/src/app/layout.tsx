import type { Metadata, Viewport } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import PostHogProvider from '@/components/PostHogProvider';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

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
    <html lang="en" className={`${dmSans.variable} ${playfairDisplay.variable}`} suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
