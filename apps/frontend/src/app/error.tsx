'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error caught by error boundary:', error.message, error.stack);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', background: '#080D1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ textAlign: 'center', maxWidth: '600px' }}>
        <h1 style={{ color: 'white', fontSize: '24px', marginBottom: '16px' }}>Something went wrong</h1>
        <pre style={{ color: '#ef4444', fontSize: '12px', textAlign: 'left', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {error.message}
        </pre>
        <button
          onClick={() => reset()}
          style={{ marginTop: '16px', padding: '10px 24px', background: '#6C63FF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
          Try Again
        </button>
      </div>
    </div>
  );
}
