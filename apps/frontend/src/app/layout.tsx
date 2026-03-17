import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Boardy AI — Smart Networking',
  description: 'AI-powered networking and matchmaking platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
