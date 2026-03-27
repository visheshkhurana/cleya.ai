'use client';
import Link from 'next/link';
import PublicNav from '@/components/PublicNav';

const features = [
  {
    icon: '🤖',
    title: 'AI-Powered Matching',
    description: 'Our matching engine combines rule-based scoring, intent alignment, and semantic similarity to find the most relevant connections for you.',
  },
  {
    icon: '🤝',
    title: 'Warm Introductions',
    description: 'No cold outreach. Cleya facilitates double-opt-in warm introductions with personalized context, so both sides are prepared and excited to connect.',
  },
  {
    icon: '🎯',
    title: 'Persona-Specific Profiles',
    description: 'Whether you\'re a founder raising capital, an investor seeking deals, or talent looking for your next role — your profile is tailored to your goals.',
  },
  {
    icon: '📊',
    title: 'Smart Match Scoring',
    description: 'Every match comes with a quality label and AI-generated reasoning explaining exactly why you should connect.',
  },
  {
    icon: '🔒',
    title: 'Trust & Vouches',
    description: 'Build trust through vouches from successful connections. See mutual connections and community endorsements on every profile.',
  },
  {
    icon: '💼',
    title: 'Deal Room',
    description: 'Founders and investors get a private space to share pitch decks, metrics, and schedule calls — all in one place after a mutual connection.',
  },
  {
    icon: '📱',
    title: 'Mobile-First Design',
    description: 'Built for India\'s mobile-first users. Every feature works beautifully on phones, tablets, and desktops.',
  },
  {
    icon: '🔔',
    title: 'Smart Notifications',
    description: 'Stay updated via WhatsApp or email. Control exactly what notifications you receive and how often.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0F172A' }}>
      <PublicNav />

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Everything you need to <span style={{ color: '#5EEAD4' }}>grow your network</span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Cleya combines AI intelligence with human warmth to create meaningful professional connections in India&apos;s startup ecosystem.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.08] p-6 hover:border-white/[0.15] transition-all duration-300"
              style={{ background: 'rgba(30,41,59,0.6)' }}>
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-16">
          <Link href="/?action=signup"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-white font-semibold transition-all duration-200 hover:brightness-110"
            style={{ background: '#0D9488' }}>
            Get Started Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </main>

      <footer className="border-t border-white/[0.06] mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center">
          <p className="text-xs text-white/30">&copy; 2025 Cleya.ai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
