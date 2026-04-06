'use client';
import PublicNav from '@/components/PublicNav';
import AppShell from '@/components/AppShell';

export default function PrivacyPage() {
  return (
    <AppShell>
      <PublicNav />

      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-16">
        <h1 className="font-sans text-3xl sm:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm mb-12" style={{ color: '#94A3B8' }}>Last updated: March 18, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p className="mb-3">When you use Cleya.ai, we collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information (email address, password)</li>
              <li>Profile information (name, role, company, industry, skills, interests, bio, LinkedIn URL)</li>
              <li>Conversation data from onboarding and AI chat interactions</li>
              <li>Match preferences and feedback you provide</li>
              <li>Communication preferences and notification settings</li>
            </ul>
            <p className="mt-3">We also automatically collect usage data such as pages visited, features used, IP address, browser type, device information, and interaction patterns to improve our matching algorithms and user experience.</p>
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
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations and enforce our Terms of Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. AI and Data Processing</h2>
            <p>Cleya.ai uses artificial intelligence to analyze your profile data and match you with relevant professionals. This includes:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Generating vector embeddings from your profile information for similarity matching</li>
              <li>Processing conversation data to understand your networking goals</li>
              <li>Using OpenAI services to power chat interactions and generate introductions</li>
              <li>Automated decision-making for match scoring (you may request human review of any match decision)</li>
            </ul>
            <p className="mt-2">Your data is processed in accordance with our data processing agreements with third-party AI providers. We do not sell your personal data to third parties. AI outputs are suggestions only and do not constitute professional advice.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Legal Basis for Processing (GDPR)</h2>
            <p className="mb-2">If you are located in the European Economic Area (EEA) or United Kingdom, we process your data under the following legal bases:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-white">Contractual necessity:</strong> To provide our matching and introduction services as described in our Terms of Service.</li>
              <li><strong className="text-white">Legitimate interest:</strong> To improve our algorithms, prevent fraud, and ensure platform security.</li>
              <li><strong className="text-white">Consent:</strong> For optional marketing communications and non-essential analytics. You may withdraw consent at any time.</li>
              <li><strong className="text-white">Legal obligation:</strong> To comply with applicable laws and regulations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Sharing</h2>
            <p>We share your information only in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-white">With matched professionals:</strong> When you accept a match, your contact information is shared with the other party.</li>
              <li><strong className="text-white">Service providers:</strong> We use third-party services for hosting, email delivery, analytics, and AI processing. These providers are contractually bound to protect your data.</li>
              <li><strong className="text-white">Legal requirements:</strong> When required by law, subpoena, court order, or to protect our rights, safety, or property.</li>
              <li><strong className="text-white">Business transfers:</strong> In connection with a merger, acquisition, or sale of assets, your data may be transferred to the successor entity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data Security</h2>
            <p>We implement industry-standard security measures including:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Encryption of data in transit (TLS/HTTPS) and at rest</li>
              <li>Secure password hashing (bcrypt with appropriate cost factor)</li>
              <li>JWT-based authentication with token expiration and CSRF protection</li>
              <li>Rate limiting on authentication endpoints</li>
              <li>Input validation and sanitization</li>
              <li>Regular security reviews and vulnerability assessments</li>
            </ul>
            <p className="mt-2">While we take reasonable precautions, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security of your data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Cookies and Tracking Technologies</h2>
            <p className="mb-2">Cleya.ai uses the following technologies:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-white">Essential cookies:</strong> Required for authentication and session management. These cannot be disabled.</li>
              <li><strong className="text-white">Local storage:</strong> Used to maintain your authentication session and user preferences.</li>
              <li><strong className="text-white">Analytics (optional):</strong> When enabled, we use PostHog for anonymous usage analytics to improve the platform. You may opt out in Settings.</li>
            </ul>
            <p className="mt-2">We do not use third-party advertising cookies or cross-site tracking technologies.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. International Data Transfers</h2>
            <p>Your data may be processed in countries outside your country of residence, including the United States (for AI processing via OpenAI) and India (for hosting and operations). When we transfer data internationally, we ensure appropriate safeguards are in place, including standard contractual clauses approved by relevant data protection authorities.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you deactivate your account, we retain your data for 30 days before permanent deletion, unless required by law to retain it longer. Anonymized and aggregated data may be retained indefinitely for analytical purposes. You may request immediate data deletion at any time by contacting our Data Protection Officer.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Your Rights</h2>
            <p className="mb-2">Depending on your jurisdiction, you may have the following rights:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-white">Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-white">Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong className="text-white">Erasure:</strong> Request deletion of your personal data (&quot;right to be forgotten&quot;).</li>
              <li><strong className="text-white">Data portability:</strong> Request your data in a structured, machine-readable format (JSON or CSV).</li>
              <li><strong className="text-white">Restriction:</strong> Request restriction of processing of your personal data.</li>
              <li><strong className="text-white">Objection:</strong> Object to processing of your data based on legitimate interests.</li>
              <li><strong className="text-white">Withdraw consent:</strong> Where processing is based on consent, withdraw it at any time.</li>
              <li><strong className="text-white">Non-discrimination:</strong> Exercise your privacy rights without receiving discriminatory treatment.</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact our Data Protection Officer at <a href="mailto:dpo@cleya.ai" className="underline" style={{ color: '#93C5FD' }}>dpo@cleya.ai</a>. We will respond to your request within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. California Privacy Rights (CCPA)</h2>
            <p className="mb-2">If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>The right to know what personal information we collect, use, and disclose.</li>
              <li>The right to request deletion of your personal information.</li>
              <li>The right to opt out of the sale of your personal information (we do not sell personal data).</li>
              <li>The right to non-discrimination for exercising your CCPA rights.</li>
            </ul>
            <p className="mt-2">To submit a CCPA request, email <a href="mailto:privacy@cleya.ai" className="underline" style={{ color: '#93C5FD' }}>privacy@cleya.ai</a> with the subject &quot;CCPA Request.&quot;</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Indian Data Protection</h2>
            <p>Cleya.ai complies with applicable Indian data protection laws, including the Digital Personal Data Protection Act, 2023 (DPDPA). As a data fiduciary, we process your personal data only for legitimate purposes with your consent. You have the right to access, correct, and erase your data, and to nominate a representative to exercise these rights on your behalf. You may file a complaint with the Data Protection Board of India if you believe your rights have been violated.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Children&apos;s Privacy</h2>
            <p>Cleya.ai is not intended for use by anyone under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a person under 18, we will take steps to delete such information promptly. If you believe a child has provided us with personal information, please contact us immediately at <a href="mailto:privacy@cleya.ai" className="underline" style={{ color: '#93C5FD' }}>privacy@cleya.ai</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">14. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on the Platform and updating the &quot;Last updated&quot; date. For significant changes, we will provide additional notice via email or in-app notification. Your continued use of the Platform after such changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">15. Data Protection Officer</h2>
            <p className="mb-2">Our Data Protection Officer can be reached at:</p>
            <p>Email: <a href="mailto:dpo@cleya.ai" className="underline" style={{ color: '#93C5FD' }}>dpo@cleya.ai</a></p>
            <p className="mt-2">For general privacy inquiries: <a href="mailto:privacy@cleya.ai" className="underline" style={{ color: '#93C5FD' }}>privacy@cleya.ai</a></p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/[0.04] py-8">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>&copy; {new Date().getFullYear()} Cleya.ai. All rights reserved.</p>
        </div>
      </footer>
    </AppShell>
  );
}
