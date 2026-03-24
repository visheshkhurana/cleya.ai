'use client';
import { useState } from 'react';
import Link from 'next/link';

const FAQ_ITEMS = [
  { q: 'How does Cleya.ai match me with the right people?', a: 'Cleya uses AI-powered matching that considers your industry, stage, goals, and preferences to find highly relevant connections. Our algorithm achieves 94% match accuracy.' },
  { q: 'Is Cleya.ai free to use?', a: 'Yes, Cleya.ai is free for all members. We offer a premium tier with advanced features for power users.' },
  { q: 'How do I get verified on Cleya?', a: 'You can verify your profile by connecting your LinkedIn account or verifying your work email. Verified profiles get higher match priority.' },
  { q: 'Can I invite others to join Cleya?', a: 'Absolutely! Use your unique referral link from the dashboard to invite colleagues, founders, and investors to join the platform.' },
  { q: 'How do introductions work?', a: 'When you and another member are matched, Cleya facilitates a warm introduction. Both parties must accept the match before contact details are shared.' },
  { q: 'What data do you collect and how is it used?', a: 'We collect profile and conversation data to improve your matches. We never sell your data. See our Privacy Policy for full details.' },
  { q: 'How quickly will I get a response to my message?', a: 'Our team typically responds within 24-48 hours on business days. For urgent matters, email us directly at hello@cleya.ai.' },
];

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0F172A' }}>
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto" role="navigation" aria-label="Contact page navigation">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0D9488' }}>
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-bold text-white">Cleya.ai</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/about" className="text-sm text-white/50 hover:text-white/80 transition">About</Link>
          <Link href="/features" className="text-sm text-white/50 hover:text-white/80 transition">Features</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16" role="main">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Get in Touch</h1>
          <p className="text-lg text-white/50">
            Have questions about Cleya? Want to partner with us? We&apos;d love to hear from you.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-white/[0.08] p-8 text-center" style={{ background: 'rgba(30,41,59,0.6)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(13,148,136,0.15)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Message Sent</h2>
            <p className="text-sm text-white/50 mb-6">Thank you for reaching out. We&apos;ll get back to you within 24-48 hours.</p>
            <Link href="/" className="text-sm font-medium" style={{ color: '#5EEAD4' }}>Back to Home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.08] p-8 space-y-5" style={{ background: 'rgba(30,41,59,0.6)' }}>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Name</label>
                <input id="contact-name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 border border-white/[0.08] focus:outline-none focus:border-[#0D9488] transition"
                  style={{ background: 'rgba(255,255,255,0.03)' }} />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Email</label>
                <input id="contact-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 border border-white/[0.08] focus:outline-none focus:border-[#0D9488] transition"
                  style={{ background: 'rgba(255,255,255,0.03)' }} />
              </div>
            </div>
            <div>
              <label htmlFor="contact-subject" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Subject</label>
              <select id="contact-subject" value={subject} onChange={e => setSubject(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl text-sm text-white border border-white/[0.08] focus:outline-none focus:border-[#0D9488] transition appearance-none"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <option value="" disabled>Select a topic</option>
                <option value="general">General Inquiry</option>
                <option value="partnership">Partnership Opportunity</option>
                <option value="support">Technical Support</option>
                <option value="feedback">Platform Feedback</option>
                <option value="press">Press & Media</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#94A3B8' }}>Message</label>
              <textarea id="contact-message" value={message} onChange={e => setMessage(e.target.value)} required placeholder="How can we help?" rows={5}
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 border border-white/[0.08] focus:outline-none focus:border-[#0D9488] transition resize-none"
                style={{ background: 'rgba(255,255,255,0.03)' }} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold transition-all duration-200 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: '#0D9488' }}>
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {[
            { icon: '📧', title: 'Email', detail: 'hello@cleya.ai' },
            { icon: '📍', title: 'Location', detail: 'Bangalore, India' },
            { icon: '🕐', title: 'Response Time', detail: '24-48 hours' },
          ].map((item, i) => (
            <div key={i} className="text-center p-4 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(30,41,59,0.4)' }}>
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="text-sm font-medium text-white mb-1">{item.title}</p>
              <p className="text-xs text-white/40">{item.detail}</p>
            </div>
          ))}
        </div>

        <section className="mt-16" aria-label="Frequently asked questions">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: 'rgba(30,41,59,0.4)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  aria-expanded={openFaq === i}
                >
                  <span className="text-sm font-medium text-white pr-4">{item.q}</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"
                    className={`shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] mt-16" role="contentinfo">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center">
          <p className="text-xs text-white/30">&copy; 2026 Cleya.ai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
