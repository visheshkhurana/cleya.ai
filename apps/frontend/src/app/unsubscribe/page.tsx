'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleUnsubscribe = async () => {
    if (!id) {
      setStatus('error');
      setMessage('Invalid unsubscribe link.');
      return;
    }

    setStatus('loading');
    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const resp = await fetch(`${backendUrl}/api/webhooks/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (resp.ok) {
        setStatus('success');
        setMessage('You have been successfully unsubscribed.');
      } else {
        const data = await resp.json().catch(() => ({}));
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Could not connect to the server. Please try again later.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }}>
      <div style={{
        maxWidth: 480,
        padding: '48px 32px',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#111', marginBottom: 16 }}>
          Cleya.ai
        </h1>

        {status === 'idle' && (
          <>
            <p style={{ color: '#555', fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
              Click the button below to unsubscribe from our emails.
            </p>
            <button
              onClick={handleUnsubscribe}
              style={{
                background: '#111',
                color: '#fff',
                border: 'none',
                padding: '12px 32px',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Unsubscribe
            </button>
          </>
        )}

        {status === 'loading' && (
          <p style={{ color: '#555', fontSize: 16 }}>Processing...</p>
        )}

        {status === 'success' && (
          <p style={{ color: '#0D9488', fontSize: 16, lineHeight: 1.6 }}>{message}</p>
        )}

        {status === 'error' && (
          <p style={{ color: '#DC2626', fontSize: 16, lineHeight: 1.6 }}>{message}</p>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p>Loading...</p>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
