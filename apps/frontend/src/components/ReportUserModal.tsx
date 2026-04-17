'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const CATEGORIES: Array<{ value: 'FAKE' | 'SPAM' | 'SCAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'OTHER'; label: string; description: string }> = [
  { value: 'FAKE', label: 'Fake profile', description: 'This account appears fake or impersonates someone else' },
  { value: 'SPAM', label: 'Spam', description: 'Sending unwanted promotional or repetitive content' },
  { value: 'SCAM', label: 'Scam or fraud', description: 'Attempting to defraud, phish, or extract money' },
  { value: 'HARASSMENT', label: 'Harassment', description: 'Threatening, abusive, or intimidating behaviour' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate content', description: 'Sexual, violent, or offensive content' },
  { value: 'OTHER', label: 'Other', description: 'Something else' },
];

export default function ReportUserModal({
  open, onClose, targetUserId, targetType = 'PROFILE', targetRefId, targetName,
}: {
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  targetType?: 'PROFILE' | 'MESSAGE' | 'MATCH' | 'INTRODUCTION';
  targetRefId?: string;
  targetName?: string;
}) {
  const [category, setCategory] = useState<typeof CATEGORIES[number]['value']>('SPAM');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.createReport({ targetUserId, targetType, targetRefId: targetRefId || null, category, details: details.trim() || null });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit report');
    }
    setSubmitting(false);
  };

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0F1629', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        {done ? (
          <div>
            <h3 style={{ color: '#fff', fontSize: 18, margin: '0 0 8px' }}>Thanks for letting us know</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '0 0 20px' }}>Our team will review this report and take action if needed.</p>
            <button onClick={onClose} style={{ padding: '10px 20px', background: '#6C63FF', color: '#fff', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
          </div>
        ) : (
          <>
            <h3 style={{ color: '#fff', fontSize: 18, margin: '0 0 4px' }}>Report {targetName || 'user'}</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: '0 0 16px' }}>Reports are confidential and reviewed by our trust &amp; safety team.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {CATEGORIES.map(c => (
                <label key={c.value} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 10, cursor: 'pointer', background: category === c.value ? 'rgba(108,99,255,0.1)' : 'transparent', border: `1px solid ${category === c.value ? 'rgba(108,99,255,0.3)' : 'rgba(255,255,255,0.05)'}` }}>
                  <input type="radio" name="cat" checked={category === c.value} onChange={() => setCategory(c.value)} style={{ marginTop: 3 }} />
                  <div>
                    <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{c.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{c.description}</div>
                  </div>
                </label>
              ))}
            </div>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Additional details (optional)</label>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Tell us what happened…"
              style={{ width: '100%', background: 'rgba(15,22,41,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, resize: 'vertical' }}
            />
            {error && <p style={{ color: '#fca5a5', fontSize: 12, marginTop: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={onClose} disabled={submitting} style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submit} disabled={submitting} style={{ padding: '10px 18px', background: '#ef4444', color: '#fff', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>{submitting ? 'Submitting…' : 'Submit report'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
