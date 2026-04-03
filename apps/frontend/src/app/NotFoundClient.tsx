'use client';

import { useEffect, useState } from 'react';

export default function NotFoundClient() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token') || document.cookie.includes('token=');
      setIsLoggedIn(!!token);
    } catch {}
  }, []);

  return (
    <div style={{
      background: '#050510',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', padding: '0 1rem' }}>
        <div style={{
          width: '5rem',
          height: '5rem',
          margin: '0 auto 1.5rem',
          borderRadius: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.25rem',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(78,47,216,0.08))',
          border: '1px solid rgba(59,130,246,0.12)',
        }}>
          🔮
        </div>
        <h1 style={{ fontSize: '3.75rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>404</h1>
        <p style={{ fontSize: '1.25rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>Page not found</p>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.3)', marginBottom: '2rem', maxWidth: '24rem', margin: '0 auto 2rem' }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
          <a href={isLoggedIn ? '/dashboard' : '/'} style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            borderRadius: '1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'white',
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            textDecoration: 'none',
          }}>
            {isLoggedIn ? 'Go to Dashboard' : 'Go to Homepage'}
          </a>
          {isLoggedIn && (
            <a href="/" style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              borderRadius: '1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              textDecoration: 'none',
            }}>
              Back to Home
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
