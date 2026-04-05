import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us — Cleya.ai',
  description: 'Get in touch with the Cleya.ai team. Questions about AI-powered networking, partnerships, press, or technical support — we\'d love to hear from you.',
  alternates: { canonical: 'https://cleya.ai/contact' },
  openGraph: {
    title: 'Contact Us — Cleya.ai',
    description: 'Get in touch with the Cleya.ai team for questions, partnerships, press inquiries, or support.',
    url: 'https://cleya.ai/contact',
    siteName: 'Cleya.ai',
    images: ['https://cleya.ai/og-image.png'],
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
