'use client';

export default function PrivacyPage() {
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
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm mb-12" style={{ color: '#A09FB5' }}>Last updated: March 18, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#A09FB5' }}>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p className="mb-3">When you use Cleo.ai, we collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information (email address, password)</li>
              <li>Profile information (name, role, company, industry, skills, interests, bio, LinkedIn URL)</li>
              <li>Conversation data from onboarding and AI chat interactions</li>
              <li>Match preferences and feedback you provide</li>
            </ul>
            <p className="mt-3">We also automatically collect usage data such as pages visited, features used, and interaction patterns to improve our matching algorithms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Provide, maintain, and improve our AI-powered matching services</li>
              <li>Generate intelligent match recommendations using our proprietary algorithms</li>
              <li>Facilitate introductions between matched professionals</li>
              <li>Send you notifications about matches, introductions, and platform updates</li>
              <li>Analyze usage patterns to improve match accuracy and user experience</li>
              <li>Communicate with you about your account and our services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. AI and Data Processing</h2>
            <p>Cleo.ai uses artificial intelligence to analyze your profile data and match you with relevant professionals. This includes:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Generating vector embeddings from your profile information for similarity matching</li>
              <li>Processing conversation data to understand your networking goals</li>
              <li>Using OpenAI services to power chat interactions and generate introductions</li>
            </ul>
            <p className="mt-2">Your data is processed in accordance with our data processing agreements with third-party AI providers. We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Sharing</h2>
            <p>We share your information only in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-white">With matched professionals:</strong> When you accept a match, your contact information is shared with the other party.</li>
              <li><strong className="text-white">Service providers:</strong> We use third-party services for hosting, email delivery, and AI processing.</li>
              <li><strong className="text-white">Legal requirements:</strong> When required by law, subpoena, or to protect our rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Encryption of data in transit (TLS/HTTPS)</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>JWT-based authentication with token expiration</li>
              <li>Rate limiting on authentication endpoints</li>
              <li>Input validation and sanitization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you deactivate your account, we retain your data for 30 days before permanent deletion, unless required by law to retain it longer. You may request data deletion at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access, update, or delete your personal information</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of non-essential communications</li>
              <li>Request information about how your data is processed</li>
              <li>Withdraw consent for data processing at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Cookies</h2>
            <p>Cleo.ai uses local storage to maintain your authentication session. We do not use third-party tracking cookies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact Us</h2>
            <p>For privacy-related inquiries, please contact us at <a href="mailto:privacy@cleo.ai" className="underline" style={{ color: '#8B5CF6' }}>privacy@cleo.ai</a>.</p>
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
