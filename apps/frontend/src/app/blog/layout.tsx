import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog — Cleya.ai | Startup Insights & Guides',
  description: 'Guides, research, and insights from India\'s startup ecosystem. Fundraising tips, investor lists, and networking strategies.',
  alternates: { canonical: 'https://cleya.ai/blog' },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
