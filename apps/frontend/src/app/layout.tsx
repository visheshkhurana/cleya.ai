import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { ClerkProvider } from "@clerk/nextjs";

const CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cleya.ai"),
  title: "Cleya.ai — Your AI Networker for Indian Startups",
  description:
    "Cleya meets thousands of founders, investors, and operators on your behalf — and introduces you to the few worth your time.",
  keywords: [
    "AI networker",
    "AI networking",
    "founder introductions",
    "investor introductions",
    "professional networking",
    "startup networking",
    "warm introductions",
    "India startups",
    "seed funding India",
  ],
  openGraph: {
    type: "website",
    url: "https://cleya.ai",
    siteName: "Cleya.ai",
    title: "Cleya.ai — Your AI Networker for Indian Startups",
    description:
      "Your AI Networker for India's startup ecosystem. Cleya meets thousands of people on your behalf and curates the few worth your time.",
    images: [
      {
        url: "https://cleya.ai/og-image.png",
        width: 1200,
        height: 630,
        alt: "Cleya.ai — Your AI Networker for Indian Startups",
      },
    ],
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    site: "@cleyaai",
    creator: "@cleyaai",
    title: "Cleya.ai — Your AI Networker for Indian Startups",
    description:
      "Cleya meets thousands of founders, investors, and operators on your behalf — and introduces you to the few worth your time.",
    images: ["https://cleya.ai/og-image.png"],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://cleya.ai" },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080D1A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${dmMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Google Analytics 4 — loaded by BootstrapClient only after marketing consent */}
        {RECAPTCHA_SITE_KEY && (
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="min-h-screen" suppressHydrationWarning>
        {CLERK_PUBLISHABLE_KEY ? (
          <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
            <ClientProviders>
              <main id="main-content" tabIndex={-1} style={{ outline: "none" }}>
                {children}
              </main>
            </ClientProviders>
          </ClerkProvider>
        ) : (
          <ClientProviders>
            <main id="main-content" tabIndex={-1} style={{ outline: "none" }}>
              {children}
            </main>
          </ClientProviders>
        )}
        <Script
          id="organization-schema"
          type="application/ld+json"
          strategy="afterInteractive"
        >{`{"@context":"https://schema.org","@type":"Organization","name":"Cleya.ai","alternateName":"Cleya","url":"https://cleya.ai","logo":"https://cleya.ai/icon.svg","description":"Your AI Networker for India's startup ecosystem. Cleya meets thousands of founders, investors, and operators on your behalf and introduces you to the few worth your time.","foundingDate":"2025","founders":[{"@type":"Person","name":"Vishesh Khurana","jobTitle":"Founder & CEO"}],"address":{"@type":"PostalAddress","addressLocality":"India","addressCountry":"IN"},"contactPoint":{"@type":"ContactPoint","email":"hello@cleya.ai","contactType":"customer service"},"sameAs":["https://www.linkedin.com/company/cleya-ai"]}`}</Script>
        <Script
          id="software-schema"
          type="application/ld+json"
          strategy="afterInteractive"
        >{`{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Cleya.ai","applicationCategory":"BusinessApplication","operatingSystem":"Web","url":"https://cleya.ai","description":"AI-powered warm introductions for India's startup ecosystem — connecting founders, investors, and operators.","aggregateRating":{"@type":"AggregateRating","ratingValue":"4.8","ratingCount":"50","bestRating":"5"},"offers":[{"@type":"Offer","price":"0","priceCurrency":"INR","name":"Free"},{"@type":"Offer","price":"999","priceCurrency":"INR","name":"Professional"},{"@type":"Offer","price":"2999","priceCurrency":"INR","name":"Growth"}]}`}</Script>
        <Script
          id="faq-schema"
          type="application/ld+json"
          strategy="afterInteractive"
        >{`{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is Cleya.ai?","acceptedAnswer":{"@type":"Answer","text":"Cleya.ai is your AI Networker for India's startup ecosystem. Cleya meets thousands of founders, investors, and operators on your behalf and introduces you to the few worth your time."}},{"@type":"Question","name":"How does Cleya.ai introduce founders to investors?","acceptedAnswer":{"@type":"Answer","text":"Cleya.ai analyses your goals, stage, and profile, then quietly screens thousands of people across the network on your behalf and curates a small list of high-signal introductions worth your time."}},{"@type":"Question","name":"Is Cleya.ai free to use?","acceptedAnswer":{"@type":"Answer","text":"Cleya.ai offers a free tier with curated introductions every month. Professional (₹999/mo) and Growth (₹2999/mo) plans unlock unlimited introductions, priority curation, and advanced analytics."}},{"@type":"Question","name":"Who can join Cleya.ai?","acceptedAnswer":{"@type":"Answer","text":"Cleya.ai is designed for startup founders, angel investors, VCs, operators, and professionals in India's startup ecosystem who want to build meaningful professional connections."}}]}`}</Script>
        <Script
          id="website-schema"
          type="application/ld+json"
          strategy="afterInteractive"
        >{`{"@context":"https://schema.org","@type":"WebSite","name":"Cleya.ai","url":"https://cleya.ai","potentialAction":{"@type":"SearchAction","target":"https://cleya.ai/search?q={search_term_string}","query-input":"required name=search_term_string"}}`}</Script>
      </body>
    </html>
  );
}
