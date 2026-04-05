import type { Metadata } from 'next';

const cityMeta: Record<string, { name: string; description: string }> = {
  bangalore: {
    name: 'Bangalore',
    description: "Connect with 12,000+ startups, top VCs, and angel investors in Bangalore — India's Silicon Valley. AI-powered networking by Cleya.ai.",
  },
  mumbai: {
    name: 'Mumbai',
    description: "Join Mumbai's startup ecosystem on Cleya.ai. Connect with 8,000+ startups, fintech investors, and consumer brand founders in India's financial capital.",
  },
  delhi: {
    name: 'Delhi NCR',
    description: "Tap into Delhi NCR's 10,000+ startups. Find investors, co-founders, and talent in logistics, edtech, and B2B commerce on Cleya.ai.",
  },
  hyderabad: {
    name: 'Hyderabad',
    description: 'Connect with Hyderabad\'s emerging tech hub — 4,500+ startups in pharma tech, AI/ML, and cybersecurity. AI networking by Cleya.ai.',
  },
  pune: {
    name: 'Pune',
    description: 'Join Pune\'s growing startup community. Connect with 3,500+ startups in automotive tech, manufacturing SaaS, and cleantech on Cleya.ai.',
  },
  chennai: {
    name: 'Chennai',
    description: 'Network with Chennai\'s 3,000+ startups in EV tech, supply chain, and climate tech. AI-powered introductions by Cleya.ai.',
  },
};

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { city } = await params;
  const meta = cityMeta[city];
  if (!meta) {
    return { title: 'City Not Found — Cleya.ai' };
  }
  return {
    title: `${meta.name} Startup Ecosystem — Cleya.ai`,
    description: meta.description,
    alternates: { canonical: `https://cleya.ai/cities/${city}` },
    openGraph: {
      title: `Connect with ${meta.name} Startups — Cleya.ai`,
      description: meta.description,
      url: `https://cleya.ai/cities/${city}`,
      siteName: 'Cleya.ai',
      images: ['https://cleya.ai/og-image.png'],
    },
  };
}

export default function CityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
