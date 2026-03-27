'use client';
import Link from 'next/link';
import PublicNav from '@/components/PublicNav';

const posts = [
  {
    slug: 'how-to-raise-seed-funding-india-2026',
    title: 'How to Raise Seed Funding in India: Complete Guide 2026',
    excerpt: 'A step-by-step guide for first-time founders looking to raise their seed round in the Indian ecosystem — from building your deck to closing the round.',
    author: 'Rahul Sharma',
    date: '2026-03-20',
    category: 'Fundraising',
    readTime: '12 min read',
  },
  {
    slug: 'top-angel-investors-india-fintech',
    title: 'Top 50 Angel Investors in Indian Fintech',
    excerpt: 'Our curated list of the most active angel investors funding fintech startups in India right now, with check sizes and thesis.',
    author: 'Priya Patel',
    date: '2026-03-15',
    category: 'Investors',
    readTime: '8 min read',
  },
  {
    slug: 'ai-matching-future-networking',
    title: 'Why AI-Powered Matching Is the Future of Professional Networking',
    excerpt: 'Traditional networking events and cold outreach have abysmal ROI. Here\'s how AI is changing the game for founders and investors.',
    author: 'Cleya Team',
    date: '2026-03-10',
    category: 'Product',
    readTime: '6 min read',
  },
  {
    slug: 'bangalore-startup-ecosystem-guide',
    title: 'The Definitive Guide to Bangalore\'s Startup Ecosystem',
    excerpt: 'Everything you need to know about building, fundraising, and scaling in India\'s startup capital — accelerators, investors, and talent hubs.',
    author: 'Arjun Mehta',
    date: '2026-03-05',
    category: 'Ecosystem',
    readTime: '15 min read',
  },
  {
    slug: 'founder-investor-warm-intro-guide',
    title: 'The Art of the Warm Intro: How Founders Should Approach Investors',
    excerpt: 'Cold emails work 2% of the time. Warm intros work 40%. Here\'s how to maximize your chances of getting a meeting with the right investor.',
    author: 'Meera Iyer',
    date: '2026-02-28',
    category: 'Fundraising',
    readTime: '10 min read',
  },
];

const categoryColors: Record<string, string> = {
  Fundraising: '#0D9488',
  Investors: '#3B82F6',
  Product: '#8B5CF6',
  Ecosystem: '#F59E0B',
};

export default function BlogPage() {
  return (
    <div className="min-h-screen font-sans" style={{ background: '#0F172A' }}>
      <PublicNav />

      <section className="pt-16 pb-10 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            Startup Insights
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: '#94A3B8' }}>
            Guides, research, and insights from India&apos;s startup ecosystem
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="space-y-6">
            {posts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`}
                className="block rounded-2xl border border-white/5 p-6 transition hover:border-teal-500/15 group"
                style={{ background: 'rgba(30,41,59,0.6)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ background: categoryColors[post.category] || '#0D9488' }}>
                    {post.category}
                  </span>
                  <span className="text-xs" style={{ color: '#64748B' }}>{post.readTime}</span>
                </div>
                <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-teal-300 transition">
                  {post.title}
                </h2>
                <p className="text-sm leading-relaxed mb-4" style={{ color: '#94A3B8' }}>
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: 'rgba(13,148,136,0.15)', color: '#5EEAD4' }}>
                    {post.author[0]}
                  </div>
                  <span className="text-xs text-white/60">{post.author}</span>
                  <span className="text-xs" style={{ color: '#64748B' }}>·</span>
                  <span className="text-xs" style={{ color: '#64748B' }}>
                    {new Date(post.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.04] py-16 text-center">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to put these insights into action?</h2>
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
            Join Cleya.ai and connect with the right investors for your startup.
          </p>
          <Link href="/"
            className="inline-block px-8 py-3 rounded-[10px] text-white font-medium text-sm transition-all hover:scale-[1.02]"
            style={{ background: '#0D9488', boxShadow: '0 0 30px rgba(13,148,136,0.25)' }}>
            Get Started Free →
          </Link>
        </div>
      </section>
    </div>
  );
}
