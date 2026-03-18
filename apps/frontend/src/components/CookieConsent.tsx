'use client';

import { useState, useEffect } from 'react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('cleo_cookie_consent');
    if (!accepted) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cleo_cookie_consent', 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cleo_cookie_consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        width: '100%',
        maxWidth: '480px',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          background: '#1A1730',
          border: '1px solid rgba(13,148,136,0.2)',
          borderRadius: '16px',
          padding: '20px 24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '20px', marginTop: '2px' }} aria-hidden="true">🍪</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#fff', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
              We use cookies
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', lineHeight: 1.5, marginBottom: '16px' }}>
              We use essential cookies to make Cleo work. We'd also like to use analytics cookies to understand how you use our platform and improve your experience.{' '}
              <a href="/privacy" style={{ color: '#0D9488', textDecoration: 'underline' }}>Privacy Policy</a>
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleAccept}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  background: '#0D9488',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                Accept all
              </button>
              <button
                onClick={handleDecline}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Essential only
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
