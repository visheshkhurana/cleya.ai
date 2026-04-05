'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PublicNav from '@/components/PublicNav';
import AppShell from '@/components/AppShell';

const cityData: Record<string, {
  name: string;
  tagline: string;
  stats: { startups: string; funding: string; unicorns: string };
  investors: string[];
  sectors: string[];
  testimonials: { name: string; role: string; company: string; quote: string }[];
}> = {
  bangalore: {
    name: 'Bangalore',
    tagline: 'The Silicon Valley of India',
    stats: { startups: '12,000+', funding: '$15B+', unicorns: '35+' },
    investors: ['Sequoia India', 'Accel', 'Blume Ventures', 'Lightspeed India', 'Elevation Capital'],
    sectors: ['SaaS', 'Fintech', 'E-commerce', 'AI/ML', 'Deep Tech'],
    testimonials: [
      { name: 'Arjun M.', role: 'Founder', company: 'Fintech Startup', quote: 'Met my lead investor within a week of joining Cleya.' },
      { name: 'Priya K.', role: 'Partner', company: 'Early Stage VC', quote: 'Quality deal flow that I can\'t find anywhere else in the BLR ecosystem.' },
    ],
  },
  mumbai: {
    name: 'Mumbai',
    tagline: "India's Financial Capital",
    stats: { startups: '8,000+', funding: '$8B+', unicorns: '20+' },
    investors: ['Matrix Partners', 'Tiger Global', 'Fireside Ventures', 'DSP Group', 'Kotak PE'],
    sectors: ['Fintech', 'Media & Entertainment', 'Consumer Brands', 'Real Estate Tech', 'Insurance'],
    testimonials: [
      { name: 'Rahul S.', role: 'CEO', company: 'D2C Brand', quote: 'Cleya connected me with the exact investor profile I was looking for.' },
      { name: 'Neha P.', role: 'Angel Investor', company: 'Independent', quote: 'The startup quality on Cleya is remarkable. 3 investments in 2 months.' },
    ],
  },
  delhi: {
    name: 'Delhi NCR',
    tagline: "India's Policy & Startup Powerhouse",
    stats: { startups: '10,000+', funding: '$12B+', unicorns: '25+' },
    investors: ['Peak XV', 'Nexus Venture Partners', 'Info Edge', 'Venture Highway', 'Orios VP'],
    sectors: ['Logistics', 'EdTech', 'HealthTech', 'Agritech', 'B2B Commerce'],
    testimonials: [
      { name: 'Vikram T.', role: 'Founder', company: 'EdTech Startup', quote: 'Found my co-founder through Cleya. Game changer.' },
      { name: 'Ananya B.', role: 'VP', company: 'Growth Stage VC', quote: 'Better quality intros than any networking event in NCR.' },
    ],
  },
  hyderabad: {
    name: 'Hyderabad',
    tagline: 'The Emerging Tech Hub',
    stats: { startups: '4,500+', funding: '$3B+', unicorns: '8+' },
    investors: ['Endiya Partners', 'Pegasus', 'Indian Angel Network', 'ah! Ventures', 'LetsVenture'],
    sectors: ['Pharma Tech', 'AI/ML', 'Cybersecurity', 'Enterprise SaaS', 'Gaming'],
    testimonials: [
      { name: 'Sanjay R.', role: 'CTO', company: 'Health Startup', quote: 'Cleya helped us connect with domain-specific mentors in pharma tech.' },
    ],
  },
  pune: {
    name: 'Pune',
    tagline: 'The Oxford of the East',
    stats: { startups: '3,500+', funding: '$2B+', unicorns: '5+' },
    investors: ['Ventureast', 'Kalaari Capital', '100X.VC', 'Pune Angels', 'TiE Pune'],
    sectors: ['Automotive Tech', 'Manufacturing SaaS', 'CleanTech', 'HRTech', 'PropTech'],
    testimonials: [
      { name: 'Ashish D.', role: 'Founder', company: 'Automotive AI', quote: 'Raised our seed round from investors we met through Cleya.' },
    ],
  },
  chennai: {
    name: 'Chennai',
    tagline: 'The Detroit of India',
    stats: { startups: '3,000+', funding: '$1.5B+', unicorns: '4+' },
    investors: ['Zoho Ventures', 'Chennai Angels', 'Titan Capital', 'Qualcomm Ventures', 'Freshworks'],
    sectors: ['EV Tech', 'Supply Chain', 'Ocean Tech', 'SaaS', 'Climate Tech'],
    testimonials: [
      { name: 'Kavitha N.', role: 'CEO', company: 'Climate Startup', quote: 'Connected with the right mentors in Chennai\'s growing climate tech scene.' },
    ],
  },
};

export default function CityPage() {
  const params = useParams();
  const citySlug = params.city as string;
  const city = cityData[citySlug];

  if (!city) {
    return (
      <AppShell>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">City Not Found</h1>
          <p className="mb-6" style={{ color: '#94A3B8' }}>We haven&apos;t launched in this city yet.</p>
          <Link href="/" className="px-6 py-3 rounded-xl text-white font-medium text-sm" style={{ background: '#3B82F6' }}>
            Back to Home
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PublicNav />

      <section className="py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center top, rgba(59,130,246,0.15) 0%, transparent 60%)' }} />
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] mb-4" style={{ color: '#93C5FD' }}>
            Cleya.ai in {city.name}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-4">
            Connect with {city.name} Startups
          </h1>
          <p className="text-xl mb-2" style={{ color: '#CBD5E1' }}>{city.tagline}</p>
          <p className="text-base mb-8" style={{ color: '#94A3B8' }}>
            Join {city.stats.startups} founders | {city.stats.funding} in funding raised
          </p>
          <Link href="/"
            className="inline-block px-8 py-3 rounded-[10px] text-white font-medium text-sm transition-all hover:scale-[1.02]"
            style={{ background: '#3B82F6', boxShadow: '0 0 30px rgba(59,130,246,0.25)' }}>
            Join {city.name} Community →
          </Link>
        </div>
      </section>

      <section className="py-12 border-y border-white/[0.04]">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-8">
            {[
              { value: city.stats.startups, label: 'Startups' },
              { value: city.stats.funding, label: 'Funding Raised' },
              { value: city.stats.unicorns, label: 'Unicorns' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold" style={{ color: '#93C5FD' }}>{s.value}</div>
                <div className="text-sm mt-1" style={{ color: '#94A3B8' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Top Investors in {city.name}</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {city.investors.map((investor) => (
              <div key={investor} className="px-5 py-3 rounded-xl border border-white/5"
                style={{ background: 'rgba(10,10,26,0.8)' }}>
                <span className="text-sm font-medium text-white">{investor}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Hot Sectors in {city.name}</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {city.sectors.map((sector) => (
              <span key={sector} className="px-4 py-2 rounded-full text-sm font-medium border"
                style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.15)', color: '#93C5FD' }}>
                {sector}
              </span>
            ))}
          </div>
        </div>
      </section>

      {city.testimonials.length > 0 && (
        <section className="py-16 border-t border-white/[0.04]">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white text-center mb-10">Success Stories from {city.name}</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {city.testimonials.map((t, i) => (
                <div key={i} className="rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(10,10,26,0.8)' }}>
                  <p className="text-sm italic mb-4" style={{ color: '#CBD5E1' }}>&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#93C5FD' }}>
                      {t.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{t.name}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{t.role} · {t.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-20 text-center" style={{ background: 'rgba(59,130,246,0.06)' }}>
        <div className="max-w-xl mx-auto px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-3">
            Ready to join {city.name}&apos;s startup ecosystem?
          </h2>
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
            Get introduced to the right investors, founders, and operators in {city.name}.
          </p>
          <Link href="/"
            className="inline-block px-8 py-3 rounded-[10px] text-white font-medium text-sm transition-all hover:scale-[1.02]"
            style={{ background: '#3B82F6', boxShadow: '0 0 30px rgba(59,130,246,0.25)' }}>
            Apply for Early Access →
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/[0.04] py-8 text-center">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            {Object.entries(cityData).filter(([slug]) => slug !== citySlug).map(([slug, c]) => (
              <Link key={slug} href={`/cities/${slug}`}
                className="text-sm hover:text-blue-300 transition" style={{ color: '#94A3B8' }}>
                {c.name}
              </Link>
            ))}
          </div>
          <p className="text-xs" style={{ color: '#64748B' }}>Cleya.ai — AI-powered networking for India&apos;s startup ecosystem</p>
        </div>
      </footer>
    </AppShell>
  );
}
