import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — Cleya.ai',
  description: 'Simple, transparent pricing for AI-powered networking. Start free, upgrade when you need more matches and premium features.',
  alternates: { canonical: 'https://cleya.ai/pricing' },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
