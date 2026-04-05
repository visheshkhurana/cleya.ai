import type { Metadata } from 'next';
import BlogPostClient from './BlogPostClient';

const blogMeta: Record<string, { title: string; description: string; author: string; date: string; category: string }> = {
  'how-to-raise-seed-funding-india-2026': {
    title: 'How to Raise Seed Funding in India: Complete Guide 2026',
    description: 'Step-by-step guide for first-time founders raising seed funding in India — from building your pitch deck to closing the round. Covers investors, warm intros, and due diligence.',
    author: 'Rahul Sharma',
    date: '2026-03-20',
    category: 'Fundraising',
  },
  'top-angel-investors-india-fintech': {
    title: 'Top 50 Angel Investors in Indian Fintech',
    description: 'Curated list of the most active angel investors funding fintech startups in India in 2026, organized by specialization — Payments, Lending, Insurance, WealthTech, and Crypto.',
    author: 'Priya Patel',
    date: '2026-03-15',
    category: 'Investors',
  },
  'ai-matching-future-networking': {
    title: 'Why AI-Powered Matching Is the Future of Professional Networking',
    description: 'How AI is replacing traditional networking events and cold outreach with intelligent, high-relevance professional matchmaking. Data on response rates, match quality, and ROI.',
    author: 'Cleya Team',
    date: '2026-03-10',
    category: 'Product',
  },
  'bangalore-startup-ecosystem-guide': {
    title: "The Definitive Guide to Bangalore's Startup Ecosystem",
    description: "Everything you need to know about building, fundraising, and scaling in India's startup capital — key hubs, accelerators, investors, and talent pools in Bangalore.",
    author: 'Arjun Mehta',
    date: '2026-03-05',
    category: 'Ecosystem',
  },
  'founder-investor-warm-intro-guide': {
    title: 'The Art of the Warm Intro: How Founders Should Approach Investors',
    description: 'Warm intros convert at 40% vs 2% for cold emails. Learn how to find the right connectors, craft forwardable emails, and maximize your investor meeting rate.',
    author: 'Meera Iyer',
    date: '2026-02-28',
    category: 'Fundraising',
  },
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = blogMeta[slug];
  if (!meta) {
    return { title: 'Post Not Found — Cleya.ai' };
  }
  return {
    title: `${meta.title} — Cleya.ai Blog`,
    description: meta.description,
    alternates: { canonical: `https://cleya.ai/blog/${slug}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `https://cleya.ai/blog/${slug}`,
      type: 'article',
      publishedTime: meta.date,
      authors: [meta.author],
      siteName: 'Cleya.ai',
      images: ['https://cleya.ai/og-image.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(blogMeta).map((slug) => ({ slug }));
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const meta = blogMeta[slug];

  // Build JSON-LD for this article
  const articleSchema = meta
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: meta.title,
        description: meta.description,
        author: { '@type': 'Person', name: meta.author },
        publisher: {
          '@type': 'Organization',
          name: 'Cleya.ai',
          url: 'https://cleya.ai',
        },
        datePublished: meta.date,
        mainEntityOfPage: `https://cleya.ai/blog/${slug}`,
        image: 'https://cleya.ai/og-image.png',
      }
    : null;

  return (
    <>
      {articleSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />
      )}
      <BlogPostClient />
    </>
  );
}
