import PricingClient from './PricingClient';

// Root-cause fix for /pricing ChunkLoadError reports: render this route
// dynamically so Next.js never serves a cached HTML payload that points
// to JS chunk hashes removed by a newer deploy. The PricingErrorBoundary
// and global ChunkLoadError handler in ClientProviders remain as a
// belt-and-suspenders safety net for in-flight navigations during a
// deploy.
export const dynamic = 'force-dynamic';

const faqs = [
  {
    q: 'How does the AI matching work?',
    a: 'Cleya uses a conversational AI to understand your goals, industry, stage, and preferences. Our matching engine then scores compatibility across multiple dimensions — sector fit, stage alignment, geographic proximity, and complementary strengths — to surface the most relevant connections.',
  },
  {
    q: 'Can I try before I pay?',
    a: 'Yes! Every user gets 10 free curated introductions every month. The allowance refreshes automatically. Once you need more, upgrade to the Professional plan for unlimited introductions and premium features.',
  },
  {
    q: 'What makes Cleya different from LinkedIn?',
    a: 'LinkedIn is a broadcast platform — you connect with thousands but rarely get meaningful introductions. Cleya is curated and AI-driven. Every match comes with context, mutual interest confirmation, and facilitated warm intros. Quality over quantity.',
  },
  {
    q: 'Is my data safe?',
    a: 'Absolutely. We use end-to-end encryption for messages, never share your data with third parties, and comply with Indian data protection regulations. Your contact information is only revealed after both parties accept a match.',
  },
  {
    q: 'Do you offer enterprise plans?',
    a: 'Yes. For accelerators, VCs, and large teams, we offer custom enterprise plans with dedicated support, SSO, custom matching rules, and API access. Contact us at enterprise@cleya.ai.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. All paid plans are month-to-month with no lock-in. You can cancel or downgrade at any time from your account settings.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.a,
    },
  })),
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <PricingClient />
    </>
  );
}
