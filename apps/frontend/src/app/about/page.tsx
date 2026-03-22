'use client';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen font-sans" style={{ background: '#0B0918' }}>
      <nav className="border-b border-white/[0.06]" style={{ background: 'rgba(11,9,24,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-boardy-400">
              <circle cx="8" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="16" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
              <line x1="11" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-white font-semibold text-lg tracking-tight">Cleo.ai</span>
          </Link>
          <Link href="/" className="px-5 py-2.5 text-sm font-medium text-white rounded-[10px] transition-all hover:scale-[1.02]"
            style={{ background: '#0D9488' }}>
            Get Started
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight">About Cleo.ai</h1>
          <p className="text-lg leading-relaxed max-w-xl mx-auto" style={{ color: '#A09FB5' }}>
            The AI Superconnector for India&apos;s startup ecosystem.
          </p>
        </div>

        <div className="space-y-8">
          <section className="rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(26,18,48,0.6)' }}>
            <h2 className="text-xl font-bold text-white mb-4">Our Mission</h2>
            <p className="text-sm leading-relaxed" style={{ color: '#A09FB5' }}>
              Cleo.ai exists to accelerate India&apos;s startup ecosystem by making meaningful professional connections effortless.
              We use AI to understand what founders, investors, and talent are truly looking for — then match them with the right people at the right time.
            </p>
          </section>

          <section className="rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(26,18,48,0.6)' }}>
            <h2 className="text-xl font-bold text-white mb-4">How It Works</h2>
            <div className="space-y-4">
              {[
                { icon: '💬', title: 'Chat with Cleo', desc: 'Have a natural conversation with our AI. Tell us about your background, goals, and who you want to connect with.' },
                { icon: '🧠', title: 'AI Matching', desc: 'Our algorithms analyze compatibility across multiple dimensions — industry, stage, goals, and complementary strengths.' },
                { icon: '🤝', title: 'Warm Introductions', desc: 'When both parties are interested, Cleo facilitates a warm introduction with context for both sides.' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <span className="text-2xl mt-0.5">{step.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: '#A09FB5' }}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(26,18,48,0.6)' }}>
            <h2 className="text-xl font-bold text-white mb-4">Who Is Cleo For?</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: '🚀', title: 'Founders', desc: 'Find investors, co-founders, and key hires.' },
                { icon: '💰', title: 'Investors', desc: 'Discover vetted deal flow and portfolio synergies.' },
                { icon: '🎯', title: 'Talent', desc: 'Connect with high-growth startups hiring now.' },
              ].map((p, i) => (
                <div key={i} className="text-center p-4 rounded-xl border border-white/5" style={{ background: 'rgba(13,148,136,0.05)' }}>
                  <span className="text-3xl">{p.icon}</span>
                  <h3 className="text-sm font-semibold text-white mt-2 mb-1">{p.title}</h3>
                  <p className="text-xs" style={{ color: '#A09FB5' }}>{p.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="text-center pt-4">
          <Link href="/"
            className="inline-flex px-8 py-3 rounded-[10px] text-white font-medium text-sm transition-all hover:scale-[1.02]"
            style={{ background: '#0D9488', boxShadow: '0 0 30px rgba(13,148,136,0.25)' }}>
            Join Cleo.ai →
          </Link>
        </div>
      </div>
    </div>
  );
}
