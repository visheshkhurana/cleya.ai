import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features — Cleya.ai | AI Matching, Warm Intros & More',
  description: 'Explore Cleya.ai features: AI-powered matching, warm introductions, persona-specific profiles, smart scoring, deal rooms, and mobile-first networking.',
  alternates: { canonical: 'https://cleya.ai/features' },
  openGraph: {
    title: 'Features — Cleya.ai | AI Matching, Warm Intros & More',
    description: 'Explore Cleya.ai features: AI-powered matching, warm introductions, smart scoring, and deal rooms for founders and investors.',
    url: 'https://cleya.ai/features',
    siteName: 'Cleya.ai',
    images: ['https://cleya.ai/og-image.png'],
  },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
