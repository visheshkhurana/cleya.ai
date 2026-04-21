'use client';
import Link from 'next/link';
import Image from 'next/image';
import { MessageSquare, Sparkles, Share2, Rocket, TrendingUp, Target } from 'lucide-react';
import PublicNav from '@/components/PublicNav';
import AppShell from '@/components/AppShell';

const team: { name: string; role: string; bio: string; imageUrl?: string }[] = [
  { name: 'Vishesh Khurana', role: 'Vibe Coder', bio: 'Turning ideas into products with AI-powered development. Passionate about building fast and shipping faster.' },
  { name: 'Jivraj Singh Sachar', role: 'Vibe Coder', bio: 'Podcaster (Indian Silicon Valley), angel investor, and Forbes 30 Under 30 Asia. GP at ISV Capital, building with AI and vibes.' },
];

const highlights = [
  { value: 'Multi-City', label: 'Presence across India\'s key startup hubs' },
  { value: 'AI-Powered', label: 'Semantic matching beyond keywords' },
  { value: 'Curated', label: 'Members-only, invite-driven network' },
  { value: 'Cross-Role', label: 'Founders, investors & operators matched' },
];

export default function AboutPage() {
  return (
    <AppShell className="font-sans">
      <PublicNav />

      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16 space-y-16">
        <div className="text-center space-y-4">
          <h1 className="font-sans text-4xl sm:text-5xl font-bold text-white tracking-tight">About Cleya.ai</h1>
          <p className="text-lg leading-relaxed max-w-xl mx-auto" style={{ color: '#94A3B8' }}>
            The AI Superconnector for India&apos;s startup ecosystem.
          </p>
        </div>

        <section className="rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(15,22,41,0.8)' }}>
          <h2 className="text-xl font-bold text-white mb-4">Our Mission</h2>
          <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
            Cleya.ai exists to accelerate India&apos;s startup ecosystem by making meaningful professional connections effortless.
            We use AI to understand what founders, investors, and operators are truly looking for — then match them with the right people at the right time.
            Our vision is a world where no promising startup fails because the founder couldn&apos;t find the right investor, co-founder, or mentor.
          </p>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {highlights.map((h, i) => (
            <div key={i} className="text-center rounded-2xl border border-white/5 p-5" style={{ background: 'rgba(15,22,41,0.8)' }}>
              <div className="text-lg sm:text-xl font-bold" style={{ color: '#9B95FF' }}>{h.value}</div>
              <div className="text-[11px] mt-1 leading-relaxed" style={{ color: '#94A3B8' }}>{h.label}</div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(15,22,41,0.8)' }}>
          <h2 className="text-xl font-bold text-white mb-4">How It Works</h2>
          <div className="space-y-4">
            {[
              { Icon: MessageSquare, title: 'Chat with Cleya', desc: 'Have a natural conversation with our AI. Tell us about your background, goals, and who you want to connect with.' },
              { Icon: Sparkles, title: 'AI Matching', desc: 'Our algorithms analyze compatibility across multiple dimensions — industry, stage, goals, and complementary strengths.' },
              { Icon: Share2, title: 'Warm Introductions', desc: 'When both parties are interested, Cleya facilitates a warm introduction with context for both sides.' },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-xl border border-brand-violet/20 shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.18), rgba(78,205,196,0.12))' }}
                >
                  <step.Icon className="w-5 h-5" style={{ color: '#9B95FF' }} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 p-8" style={{ background: 'rgba(15,22,41,0.8)' }}>
          <h2 className="text-xl font-bold text-white mb-4">Who Is Cleya For?</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { Icon: Rocket, title: 'Founders', desc: 'Find investors, co-founders, and key hires aligned with your stage and sector.' },
              { Icon: TrendingUp, title: 'Investors', desc: 'Discover vetted deal flow and portfolio synergies matched to your thesis.' },
              { Icon: Target, title: 'Operators', desc: 'Connect with high-growth startups hiring now for leadership roles.' },
            ].map((p, i) => (
              <div key={i} className="text-center p-5 rounded-xl border border-white/5" style={{ background: 'rgba(108,99,255,0.05)' }}>
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-2xl border border-brand-violet/20 mb-3"
                  style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.22), rgba(78,205,196,0.14))' }}
                >
                  <p.Icon className="w-6 h-6" style={{ color: '#9B95FF' }} strokeWidth={1.75} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{p.title}</h3>
                <p className="text-xs" style={{ color: '#94A3B8' }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-6 text-center">Meet the Team</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {team.map((t, i) => (
              <div key={i} className="rounded-2xl border border-white/5 p-5 text-center w-full sm:basis-[calc(33.333%_-_0.75rem)]" style={{ background: 'rgba(15,22,41,0.8)' }}>
                {t.imageUrl ? (
                  <Image src={t.imageUrl} alt={t.name} width={64} height={64} className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" sizes="64px" />
                ) : (
                  <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-bold"
                    style={{ background: 'rgba(108,99,255,0.15)', color: '#9B95FF' }}>
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                )}
                <h3 className="text-sm font-semibold text-white">{t.name}</h3>
                <p className="text-xs font-medium mt-0.5" style={{ color: '#9B95FF' }}>{t.role}</p>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: '#94A3B8' }}>{t.bio}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-brand-violet/15 p-8 text-center" style={{ background: 'rgba(108,99,255,0.06)' }}>
          <h2 className="text-lg font-bold text-white mb-2">Get in Touch</h2>
          <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
            Have questions or want to partner with us?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:hello@cleya.ai"
              className="text-sm font-medium transition hover:text-white/60" style={{ color: '#9B95FF' }}>
              hello@cleya.ai
            </a>
            <span className="hidden sm:inline text-white/20">|</span>
            <a href="mailto:enterprise@cleya.ai"
              className="text-sm font-medium transition hover:text-white/60" style={{ color: '#9B95FF' }}>
              enterprise@cleya.ai
            </a>
          </div>
        </section>

        <div className="text-center pt-4">
          <Link href="/"
            className="inline-flex px-8 py-3 rounded-[10px] text-white font-medium text-sm transition-all hover:scale-[1.02]"
            style={{ background: '#6C63FF', boxShadow: '0 0 30px rgba(108,99,255,0.25)' }}>
            Join Cleya.ai →
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
