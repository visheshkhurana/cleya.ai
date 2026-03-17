import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cleo.ai — AI Superconnector',
  description: 'AI-powered networking and matchmaking platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
