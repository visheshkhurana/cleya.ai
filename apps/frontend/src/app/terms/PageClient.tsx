'use client';
import PublicNav from '@/components/PublicNav';

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#050510' }}>
      <PublicNav />

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-sm mb-12" style={{ color: '#94A3B8' }}>Last updated: March 18, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Cleya.ai (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Platform. Cleya.ai reserves the right to update these terms at any time, and continued use constitutes acceptance of any changes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Eligibility</h2>
            <p>To use Cleya.ai, you must be at least 18 years old and a professional in good standing. The Platform is designed for founders, investors, talent, and operators seeking legitimate professional connections within India&apos;s startup ecosystem and beyond. Cleya.ai reserves the right to deny or revoke access at its sole discretion.</p>
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
              <li>Attempt to reverse-engineer, scrape, or interfere with the Platform&apos;s systems</li>
              <li>Use the Platform for any form of discrimination</li>
              <li>Share confidential information obtained through introductions without consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. AI-Powered Matching</h2>
            <p>Cleya.ai uses artificial intelligence to suggest professional connections. While we strive for high-quality matches, we do not guarantee the outcome of any introduction or business relationship. Match scores and recommendations are algorithmic suggestions and should not be taken as endorsements of any individual or company. AI-generated introductions are suggestions and users exercise their own judgment in pursuing any connection.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Introductions and Communications</h2>
            <p>When you accept a match, your contact information (including email) may be shared with the matched party. You consent to receiving introductions and communications facilitated by the Platform. You may opt out of non-essential communications at any time through your settings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Intellectual Property</h2>
            <p>All content, algorithms, designs, and technology comprising Cleya.ai are the intellectual property of Cleya.ai and its licensors. You retain ownership of the content you submit to the Platform but grant us a non-exclusive, worldwide, royalty-free license to use it for providing and improving our services.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>Cleya.ai is provided &quot;as is&quot; without warranties of any kind, express or implied. We are not liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform, including but not limited to lost profits, business opportunities, or data. Our total liability shall not exceed the amount you paid to us in the 12 months preceding the claim, or INR 10,000, whichever is higher.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Cleya.ai, its affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your use of the Platform, your violation of these Terms, or your violation of any third-party rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Termination</h2>
            <p>You may deactivate your account at any time through Settings. Cleya.ai reserves the right to suspend or terminate accounts that violate these terms, with or without prior notice. Upon termination, your data will be handled in accordance with our Privacy Policy. Sections relating to intellectual property, limitation of liability, indemnification, and governing law shall survive termination.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Dispute Resolution</h2>
            <p>In the event of any dispute arising out of or relating to these Terms, the parties shall first attempt to resolve the dispute through good-faith negotiation for a period of 30 days. If the dispute cannot be resolved through negotiation, it shall be referred to mediation under the rules of the Indian Council of Arbitration. If mediation is unsuccessful, the dispute shall be resolved through binding arbitration conducted in Bangalore, India.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of India. The courts of Bangalore, Karnataka shall have exclusive jurisdiction over any disputes arising from these Terms or your use of the Platform, subject to the dispute resolution clause above.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of any material changes by posting the new Terms on the Platform and updating the &quot;Last updated&quot; date. Your continued use of the Platform after such changes constitutes acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">14. Contact</h2>
            <p>For questions about these terms, contact us at <a href="mailto:legal@cleya.ai" className="underline" style={{ color: '#93C5FD' }}>legal@cleya.ai</a>.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>&copy; {new Date().getFullYear()} Cleya.ai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
