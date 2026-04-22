import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Cleya.ai — Your AI Networker for Indian Startups',
  description: 'Learn about Cleya.ai — our mission, team, and how we use AI to connect founders, investors, and operators across India\'s startup ecosystem.',
  alternates: { canonical: 'https://cleya.ai/about' },
  openGraph: {
    title: 'About Cleya.ai — Your AI Networker for Indian Startups',
    description: 'Learn about Cleya.ai — our mission, team, and how we use AI to connect founders, investors, and operators.',
    url: 'https://cleya.ai/about',
    siteName: 'Cleya.ai',
    images: ['https://cleya.ai/og-image.png'],
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
