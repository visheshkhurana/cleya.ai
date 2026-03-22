'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0B0918' }}>
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#0D9488' }}>
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-bold text-white">Cleo.ai</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/about" className="text-sm text-white/50 hover:text-white/80 transition">About</Link>
          <Link href="/features" className="text-sm text-white/50 hover:text-white/80 transition">Features</Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Get in Touch</h1>
          <p className="text-lg text-white/50">
            Have questions about Cleo? Want to partner with us? We&apos;d love to hear from you.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-white/[0.08] p-8 text-center" style={{ background: 'rgba(26,18,48,0.6)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(13,148,136,0.15)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Message Sent</h2>
            <p className="text-sm text-white/50 mb-6">Thank you for reaching out. We&apos;ll get back to you within 24 hours.</p>
            <Link href="/" className="text-sm font-medium" style={{ color: '#2DD4BF' }}>Back to Home</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-white/[0.08] p-8 space-y-5" style={{ background: 'rgba(26,18,48,0.6)' }}>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#A09FB5' }}>Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 border border-white/[0.08] focus:outline-none focus:border-[#0D9488] transition"
                style={{ background: 'rgba(255,255,255,0.03)' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#A09FB5' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 border border-white/[0.08] focus:outline-none focus:border-[#0D9488] transition"
                style={{ background: 'rgba(255,255,255,0.03)' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#A09FB5' }}>Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} required placeholder="How can we help?" rows={5}
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 border border-white/[0.08] focus:outline-none focus:border-[#0D9488] transition resize-none"
                style={{ background: 'rgba(255,255,255,0.03)' }} />
            </div>
            <button type="submit" className="w-full py-3 rounded-xl text-white font-semibold transition-all duration-200 hover:brightness-110" style={{ background: '#0D9488' }}>
              Send Message
            </button>
          </form>
        )}

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {[
            { icon: '📧', title: 'Email', detail: 'hello@cleo.ai' },
            { icon: '📍', title: 'Location', detail: 'Bangalore, India' },
            { icon: '🕐', title: 'Response Time', detail: 'Within 24 hours' },
          ].map((item, i) => (
            <div key={i} className="text-center p-4 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(26,18,48,0.4)' }}>
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="text-sm font-medium text-white mb-1">{item.title}</p>
              <p className="text-xs text-white/40">{item.detail}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/[0.06] mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center">
          <p className="text-xs text-white/30">&copy; 2025 Cleo.ai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
