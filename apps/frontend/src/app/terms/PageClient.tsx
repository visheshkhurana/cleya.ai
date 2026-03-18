'use client';

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0B0918' }}>
      <nav className="border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: '#6D28D9' }}>C</div>
            <span className="text-white font-semibold">Cleo.ai</span>
          </a>
          <a href="/" className="text-sm hover:text-white transition" style={{ color: '#A09FB5' }}>Back to Home</a>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm mb-12" style={{ color: '#A09FB5' }}>Last updated: March 18, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#A09FB5' }}>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Cleo.ai ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Platform. Cleo.ai reserves the right to update these terms at any time, and continued use constitutes acceptance of any changes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Eligibility</h2>
            <p>To use Cleo.ai, you must be at least 18 years old and a professional in good standing. The Platform is designed for founders, investors, talent, and operators seeking legitimate professional connections. Cleo.ai reserves the right to deny or revoke access at its sole discretion.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You must provide accurate and truthful information in your profile.</li>
              <li>You may not create multiple accounts or impersonate another person.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must notify us immediately of any unauthorized use of your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p className="mb-2">You agree not to use the Platform to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Harass, spam, or send unsolicited communications to other users</li>
              <li>Misrepresent your identity, qualifications, or professional background</li>
              <li>Collect user data for unauthorized purposes</li>
              <li>Engage in any activity that is illegal or violates the rights of others</li>
              <li>Attempt to reverse-engineer, scrape, or interfere with the Platform's systems</li>
              <li>Use the Platform for any form of discrimination</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. AI-Powered Matching</h2>
            <p>Cleo.ai uses artificial intelligence to suggest professional connections. While we strive for high-quality matches, we do not guarantee the outcome of any introduction or business relationship. Match scores and recommendations are algorithmic suggestions and should not be taken as endorsements of any individual or company.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Introductions and Communications</h2>
            <p>When you accept a match, your contact information (including email) may be shared with the matched party. You consent to receiving introductions and communications facilitated by the Platform. You may opt out of non-essential communications at any time through your settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Intellectual Property</h2>
            <p>All content, algorithms, designs, and technology comprising Cleo.ai are the intellectual property of Cleo.ai and its licensors. You retain ownership of the content you submit to the Platform but grant us a license to use it for providing and improving our services.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>Cleo.ai is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the Platform, including but not limited to lost profits, business opportunities, or data. Our total liability shall not exceed the amount you paid to us in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Termination</h2>
            <p>You may deactivate your account at any time through Settings. Cleo.ai reserves the right to suspend or terminate accounts that violate these terms. Upon termination, your data will be handled in accordance with our Privacy Policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Governing Law</h2>
            <p>These terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles. Any disputes shall be resolved through binding arbitration.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:legal@cleo.ai" className="underline" style={{ color: '#8B5CF6' }}>legal@cleo.ai</a>.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>&copy; {new Date().getFullYear()} Cleo.ai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
