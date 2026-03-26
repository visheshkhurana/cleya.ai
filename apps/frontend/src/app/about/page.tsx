'use client';
import Link from 'next/link';

const team = [
  { name: 'Rahul Sharma', role: 'Founder & CEO', bio: 'Ex-product lead at a unicorn. Building the networking layer for India\'s startup ecosystem.' },
  { name: 'Priya Patel', role: 'Head of Investor Relations', bio: 'Former VC associate. Connects founders with the right capital partners.' },
  { name: 'Arjun Mehta', role: 'Head of Engineering', bio: 'Full-stack engineer passionate about AI/ML and matchmaking algorithms.' },
];

const stats = [
  { value: '6', label: 'Cities' },
  { value: '12,000+', label: 'Professionals' },
  { value: '94%', label: 'Match Accuracy' },
  { value: '5,000+', label: 'Intros Made' },
];

const backers = ['Sequoia Scouts', 'Antler India', 'TiE Delhi', 'Nasscom', 'T-Hub'];

export default function AboutPage() {
  return (
    <div className="min-h-screen font-sans" style={{ background: '#0F172A' }}>
      <nav className="border-b border-white/[0.06]" style={{ background: 'rgba(11,9,24,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-boardy-400">
              <circle cx="8" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="16" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-white font-semibold text-lg tracking-tight">Cleya.ai</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="hidden sm:inline-block px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">Pricing</Link>
            <Link href="/blog" className="hidden sm:inline-block px-3 py-2 text-sm text-white/50 hover:text-white transition-colors">Blog</Link>
            <Link href="/" className="px-5 py-2.5 text-sm font-medium text-white rounded-[10px] transition-all hover:scale-[1.02]"
              style={{ background: '#0D9488' }}>
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-16">
        <div className="text-center space-y-4">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight">About Cleya.ai</h1>
          <p className="text-lg leading-relaxed max-w-xl mx-auto" style={{ color: '#94A3B8' }}>
            The AI Superconnector for India&apos;s startup ecosystem.
          </p>
        </div>

        <section className="rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(30,41,59,0.6)' }}>
          <h2 className="text-xl font-bold text-white mb-4">Our Mission</h2>
          <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
            Cleya.ai exists to accelerate India&apos;s startup ecosystem by making meaningful professional connections effortless.
            We use AI to understand what founders, investors, and talent are truly looking for — then match them with the right people at the right time.
            Our vision is a world where no promising startup fails because the founder couldn&apos;t find the right investor, co-founder, or mentor.
          </p>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="text-center rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(30,41,59,0.4)' }}>
              <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#5EEAD4' }}>{s.value}</div>
              <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>{s.label}</div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(30,41,59,0.6)' }}>
          <h2 className="text-xl font-bold text-white mb-4">How It Works</h2>
          <div className="space-y-4">
            {[
              { icon: '💬', title: 'Chat with Cleya', desc: 'Have a natural conversation with our AI. Tell us about your background, goals, and who you want to connect with.' },
              { icon: '🧠', title: 'AI Matching', desc: 'Our algorithms analyze compatibility across multiple dimensions — industry, stage, goals, and complementary strengths.' },
              { icon: '🤝', title: 'Warm Introductions', desc: 'When both parties are interested, Cleya facilitates a warm introduction with context for both sides.' },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="text-2xl mt-0.5">{step.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(30,41,59,0.6)' }}>
          <h2 className="text-xl font-bold text-white mb-4">Who Is Cleya For?</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: '🚀', title: 'Founders', desc: 'Find investors, co-founders, and key hires aligned with your stage and sector.' },
              { icon: '💰', title: 'Investors', desc: 'Discover vetted deal flow and portfolio synergies matched to your thesis.' },
              { icon: '🎯', title: 'Talent & Operators', desc: 'Connect with high-growth startups hiring now for leadership roles.' },
            ].map((p, i) => (
              <div key={i} className="text-center p-4 rounded-xl border border-white/5" style={{ background: 'rgba(13,148,136,0.05)' }}>
                <span className="text-3xl">{p.icon}</span>
                <h3 className="text-sm font-semibold text-white mt-2 mb-1">{p.title}</h3>
                <p className="text-xs" style={{ color: '#94A3B8' }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 text-center">Meet the Team</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {team.map((t, i) => (
              <div key={i} className="rounded-2xl border border-white/5 p-5 text-center" style={{ background: 'rgba(30,41,59,0.6)' }}>
                <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-bold"
                  style={{ background: 'rgba(13,148,136,0.15)', color: '#5EEAD4' }}>
                  {t.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="text-sm font-semibold text-white">{t.name}</h3>
                <p className="text-xs font-medium mt-0.5" style={{ color: '#5EEAD4' }}>{t.role}</p>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: '#94A3B8' }}>{t.bio}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 p-8 text-center" style={{ background: 'rgba(30,41,59,0.4)' }}>
          <h2 className="text-lg font-bold text-white mb-4">Backed & Supported By</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {backers.map((b, i) => (
              <div key={i} className="px-4 py-2 rounded-lg border border-white/5"
                style={{ background: 'rgba(13,148,136,0.05)' }}>
                <span className="text-sm font-medium text-white/80">{b}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-teal-500/15 p-8 text-center" style={{ background: 'rgba(13,148,136,0.06)' }}>
          <h2 className="text-lg font-bold text-white mb-2">Get in Touch</h2>
          <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
            Have questions or want to partner with us?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:hello@cleya.ai"
              className="text-sm font-medium transition hover:text-teal-200" style={{ color: '#5EEAD4' }}>
              hello@cleya.ai
            </a>
            <span className="hidden sm:inline text-white/20">|</span>
            <a href="mailto:enterprise@cleya.ai"
              className="text-sm font-medium transition hover:text-teal-200" style={{ color: '#5EEAD4' }}>
              enterprise@cleya.ai
            </a>
          </div>
        </section>

        <div className="text-center pt-4">
          <Link href="/"
            className="inline-flex px-8 py-3 rounded-[10px] text-white font-medium text-sm transition-all hover:scale-[1.02]"
            style={{ background: '#0D9488', boxShadow: '0 0 30px rgba(13,148,136,0.25)' }}>
            Join Cleya.ai →
          </Link>
        </div>
      </div>
    </div>
  );
}
