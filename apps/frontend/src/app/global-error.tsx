'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const isHydrationError =
      error.message?.includes('Hydration') ||
      error.message?.includes('hydrat') ||
      error.message?.includes('server HTML') ||
      error.message?.includes('client content');

    if (isHydrationError) {
      reset();
      return;
    }
    console.error('Global error:', error);
  }, [error, reset]);

  return (
    <html>
      <body style={{ background: '#080D1A', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '16px' }}>Something went wrong</h1>
          <button onClick={() => reset()} style={{ padding: '12px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
