'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PublicNav from '@/components/PublicNav';
import AppShell from '@/components/AppShell';

const blogPosts: Record<string, {
  title: string;
  author: string;
  authorRole: string;
  date: string;
  category: string;
  readTime: string;
  content: string[];
}> = {
  'how-to-raise-seed-funding-india-2026': {
    title: 'How to Raise Seed Funding in India: Complete Guide 2026',
    author: 'Rahul Sharma',
    authorRole: 'Founder & CEO, Cleya.ai',
    date: '2026-03-20',
    category: 'Fundraising',
    readTime: '12 min read',
    content: [
      'Raising seed funding in India has evolved dramatically. In 2026, the Indian startup ecosystem is more mature, more competitive, and more rewarding than ever. This guide covers everything you need to know as a first-time founder.',
      '## 1. Define Your Funding Stage\n\nBefore approaching investors, be crystal clear about your stage. Pre-seed (idea to early traction, typically ₹25L - ₹2Cr) is different from Seed (product-market fit signals, typically ₹2Cr - ₹15Cr). Most founders make the mistake of approaching the wrong stage of investors.',
      '## 2. Build Your Deck\n\nYour pitch deck should be 10-12 slides max. Cover: Problem, Solution, Market Size (TAM/SAM/SOM), Business Model, Traction, Team, Competition, Go-to-Market, Financial Projections, and Ask. Indian investors particularly value traction metrics and unit economics.',
      '## 3. Warm Intros Over Cold Outreach\n\nCold emails to investors have a ~2% response rate. Warm introductions through mutual connections have a ~40% response rate. This is exactly why platforms like Cleya.ai exist — to create warm, contextual introductions between founders and the right investors.',
      '## 4. Know Your Investors\n\nResearch each investor thoroughly. Know their thesis, portfolio, check size, and what stage they invest at. In India, key seed-stage investors include Sequoia Surge, Accel, Blume Ventures, and dozens of active angel investors.',
      '## 5. Prepare for Due Diligence\n\nHave your incorporation documents, cap table, financial statements, and key contracts ready. Indian investors are increasingly sophisticated and will ask for comprehensive documentation.',
      '## Key Takeaways\n\n- Start networking 3-6 months before you need to raise\n- Target 50-100 investors for a typical seed round\n- Warm intros dramatically increase your success rate\n- Have your data room ready before first meetings\n- India\'s seed ecosystem is thriving — the right capital is out there',
    ],
  },
  'top-angel-investors-india-fintech': {
    title: 'Top 50 Angel Investors in Indian Fintech',
    author: 'Priya Patel',
    authorRole: 'Head of Investor Relations',
    date: '2026-03-15',
    category: 'Investors',
    readTime: '8 min read',
    content: [
      'India\'s fintech sector has attracted over $20 billion in funding, and angel investors play a crucial role in the early-stage ecosystem. Here are the most active angels in Indian fintech right now.',
      '## What Makes a Great Fintech Angel?\n\nThe best fintech angels bring more than capital. They bring regulatory expertise (critical in India\'s evolving fintech landscape), network access to banks and NBFCs, and product insights from building or scaling fintech companies.',
      '## Top Categories\n\nWe\'ve organized our list by specialization:\n- **Payments & UPI**: Angels with deep expertise in India\'s payments revolution\n- **Lending & Credit**: Focused on digital lending, BNPL, and credit scoring\n- **Insurance**: InsurTech-focused angels\n- **WealthTech**: Investment and wealth management focused\n- **Crypto/Web3 Finance**: Blockchain and DeFi focused',
      '## How to Connect\n\nThe best way to connect with angel investors is through warm introductions. Platforms like Cleya.ai match founders with the most relevant investors based on sector, stage, and mutual interests — so your first conversation already has context.',
      '## Final Thoughts\n\nAngel investing in Indian fintech is at an all-time high. The key is finding the right angel whose expertise aligns with your specific vertical and stage. Quality of connection matters more than quantity of introductions.',
    ],
  },
  'ai-matching-future-networking': {
    title: 'Why AI-Powered Matching Is the Future of Professional Networking',
    author: 'Cleya Team',
    authorRole: 'Product Team',
    date: '2026-03-10',
    category: 'Product',
    readTime: '6 min read',
    content: [
      'Traditional networking is broken. Events cost thousands, LinkedIn connections are superficial, and cold outreach has abysmal response rates. AI-powered matching is changing everything.',
      '## The Problem with Traditional Networking\n\nProfessionals spend an average of 6-8 hours per week on networking activities, but only 10% of those interactions lead to meaningful outcomes. The signal-to-noise ratio is terrible.',
      '## How AI Changes the Game\n\nAI matching analyzes dozens of dimensions — sector expertise, stage alignment, geographic proximity, complementary skills, investment thesis alignment, and even communication style compatibility — to surface the most relevant connections.',
      '## The Cleya Approach\n\nAt Cleya.ai, we use conversational AI to build rich professional profiles, then apply our matching engine to find high-compatibility connections. Every match comes with a compatibility score and explanation, and both sides must opt in before any contact information is shared.',
      '## Results So Far\n\nOur platform achieves a 94% match relevance score (based on user feedback), and matched pairs are 5x more likely to have a productive conversation compared to random networking.',
    ],
  },
  'bangalore-startup-ecosystem-guide': {
    title: "The Definitive Guide to Bangalore's Startup Ecosystem",
    author: 'Arjun Mehta',
    authorRole: 'Community Manager, South India',
    date: '2026-03-05',
    category: 'Ecosystem',
    readTime: '15 min read',
    content: [
      'Bangalore is India\'s undisputed startup capital, home to 35+ unicorns and over 12,000 startups. This comprehensive guide covers everything you need to know about building in Bangalore.',
      '## Why Bangalore?\n\nBangalore offers a unique combination of deep tech talent (thanks to IISc, IIMs, and dozens of engineering colleges), established VC presence, and a culture that celebrates entrepreneurship. The city produces more startups per capita than any other Indian city.',
      '## Key Ecosystems Within Bangalore\n\n- **Koramangala**: The OG startup hub — Flipkart, Swiggy, and dozens of other unicorns started here\n- **HSR Layout**: The new hotspot for early-stage startups\n- **Indiranagar**: Where founders meet for coffee and close deals\n- **Whitefield/Marathahalli**: Tech parks and corporate innovation labs',
      '## Top Accelerators\n\nBangalore is home to several world-class accelerators including Antler India, Entrepreneur First, and numerous industry-specific programs. These programs offer capital, mentorship, and network access.',
      '## Connecting in Bangalore\n\nThe best way to tap into Bangalore\'s startup ecosystem is through curated introductions. Cleya.ai has a strong presence in Bangalore, matching founders with investors, co-founders, and talent across the city.',
    ],
  },
  'founder-investor-warm-intro-guide': {
    title: 'The Art of the Warm Intro: How Founders Should Approach Investors',
    author: 'Meera Iyer',
    authorRole: 'Partner, Early Stage VC',
    date: '2026-02-28',
    category: 'Fundraising',
    readTime: '10 min read',
    content: [
      'As a VC, I receive 50+ cold emails per week. I respond to maybe 2. But when a trusted connection introduces me to a founder? I take that meeting 90% of the time. Here\'s how founders can maximize their warm intro strategy.',
      '## Why Warm Intros Work\n\nA warm introduction carries implicit social proof. When someone I trust vouches for a founder, it tells me three things: the founder is credible, the opportunity is relevant to my thesis, and the person is worth my time.',
      '## Finding the Right Connector\n\nNot all warm intros are equal. The best connectors are people who know both you and the investor well, can articulate why the introduction makes sense, and are respected in the ecosystem.',
      '## How to Ask for an Intro\n\nAlways make it easy for your connector. Send them a forwardable email that includes: a one-line ask, why this specific investor is relevant, your traction highlights, and what stage/amount you\'re raising.',
      '## The Cleya Advantage\n\nPlatforms like Cleya.ai automate the warm intro process. Instead of spending weeks finding mutual connections, Cleya\'s AI identifies the best matches and facilitates introductions with context for both sides. It\'s like having a super-connector working for you 24/7.',
    ],
  },
};

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const post = blogPosts[slug];

  if (!post) {
    return (
      <AppShell className="flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold gradient-text mb-4">Post Not Found</h1>
          <Link href="/blog" className="px-6 py-3 rounded-xl text-white font-medium text-sm cta-shimmer" style={{ background: '#3B82F6' }}>
            Back to Blog
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell className="font-sans">
      <PublicNav />

      <article className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: '#3B82F6' }}>
              {post.category}
            </span>
            <span className="text-xs" style={{ color: '#64748B' }}>{post.readTime}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-6">{post.title}</h1>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#93C5FD' }}>
              {post.author[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{post.author}</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                {post.authorRole} · {new Date(post.date).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          {post.content.map((block, i) => {
            if (block.startsWith('## ')) {
              const lines = block.split('\n');
              const heading = lines[0].replace('## ', '');
              const body = lines.slice(1).join('\n').trim();
              return (
                <div key={i}>
                  <h2 className="text-xl font-bold text-white mt-8 mb-3">{heading}</h2>
                  {body.split('\n').filter(Boolean).map((line, j) => (
                    <p key={j} className="text-sm leading-relaxed mb-3" style={{ color: '#CBD5E1' }}>
                      {line.startsWith('- ') ? (
                        <span className="flex items-start gap-2">
                          <span style={{ color: '#3B82F6' }}>•</span>
                          <span>{line.replace('- ', '')}</span>
                        </span>
                      ) : line}
                    </p>
                  ))}
                </div>
              );
            }
            return (
              <p key={i} className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>{block}</p>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-blue-500/15 p-6" style={{ background: 'rgba(59,130,246,0.06)' }}>
          <h3 className="text-lg font-semibold text-white mb-2">Ready to put these insights into action?</h3>
          <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
            Join Cleya.ai and connect with the right investors, founders, and operators for your startup.
          </p>
          <Link href="/"
            className="inline-block px-6 py-3 rounded-xl text-white font-medium text-sm transition hover:scale-[1.02]"
            style={{ background: '#3B82F6' }}>
            Get Started Free →
          </Link>
        </div>
      </article>
    </AppShell>
  );
}
