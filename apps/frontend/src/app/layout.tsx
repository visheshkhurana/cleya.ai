import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, DM_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

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
  title: "Cleya.ai — AI Superconnector for Indian Startups",
  description:
    "Meet the right investors, founders, and operators. AI-powered warm intros for India's startup ecosystem.",
  keywords: [
    "AI networking",
    "founder matching",
    "investor matching",
    "professional networking",
    "startup networking",
    "AI matchmaking",
    "India startups",
    "seed funding India",
  ],
  openGraph: {
    type: "website",
    url: "https://cleya.ai",
    siteName: "Cleya.ai",
    title: "Cleya.ai — AI Superconnector for Indian Startups",
    description:
      "Members-only AI-powered networking for founders, investors, and operators building meaningful connections across India's startup ecosystem.",
    images: [
      {
        url: "https://cleya.ai/og-image.png",
        width: 1200,
        height: 630,
        alt: "Cleya.ai — AI Superconnector for Indian Startups",
      },
    ],
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    site: "@cleyaai",
    creator: "@cleyaai",
    title: "Cleya.ai — AI Superconnector for Indian Startups",
    description:
      "Meet the right investors, founders, and operators. AI-powered warm intros for India's startup ecosystem.",
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
        <Script
          id="organization-schema"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Cleya.ai",
              alternateName: "Cleya",
              url: "https://cleya.ai",
              logo: "https://cleya.ai/icon.svg",
              description:
                "AI-powered professional networking platform for India's startup ecosystem. Connecting founders, investors, and operators through intelligent matchmaking and warm introductions.",
              foundingDate: "2025",
              founders: [
                {
                  "@type": "Person",
                  name: "Rahul Sharma",
                  jobTitle: "Founder & CEO",
                },
              ],
              address: {
                "@type": "PostalAddress",
                addressLocality: "Bangalore",
                addressCountry: "IN",
              },
              contactPoint: {
                "@type": "ContactPoint",
                email: "hello@cleya.ai",
                contactType: "customer service",
              },
              sameAs: [],
            }),
          }}
        />
        <Script
          id="software-schema"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Cleya.ai",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: "https://cleya.ai",
              description:
                "AI-powered warm introductions for India's startup ecosystem — connecting founders, investors, and operators.",
              offers: [
                {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "INR",
                  name: "Free",
                },
                {
                  "@type": "Offer",
                  price: "999",
                  priceCurrency: "INR",
                  name: "Professional",
                },
                {
                  "@type": "Offer",
                  price: "2999",
                  priceCurrency: "INR",
                  name: "Growth",
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-screen" suppressHydrationWarning>
        <ClientProviders>
          <main id="main-content" tabIndex={-1} style={{ outline: "none" }}>
            {children}
          </main>
        </ClientProviders>
      </body>
    </html>
  );
}
