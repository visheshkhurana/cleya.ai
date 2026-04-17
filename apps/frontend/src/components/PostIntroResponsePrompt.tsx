'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Pending {
  matchId: string;
  otherUser: { headline?: string; companyName?: string; persona?: string };
  acceptedAt: string;
}

export default function PostIntroResponsePrompt() {
  const [items, setItems] = useState<Pending[]>([]);
  const [active, setActive] = useState<Pending | null>(null);
  const [responded, setResponded] = useState<boolean | null>(null);
  const [quality, setQuality] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getPendingFeedback()
      .then((res: any) => {
        const data = res?.data || res || [];
        if (Array.isArray(data) && data.length > 0) {
          setItems(data);
          setActive(data[0]);
        }
      })
      .catch(() => null);
  }, []);

  const submit = async () => {
    if (!active || responded === null) return;
    setSubmitting(true);
    try {
      await api.submitIntroResponse(active.matchId, responded, quality > 0 ? quality : undefined);
      setDismissed((prev) => new Set(prev).add(active.matchId));
      const next = items.find((i) => !dismissed.has(i.matchId) && i.matchId !== active.matchId);
      setActive(next || null);
      setResponded(null);
      setQuality(0);
    } catch {
      setActive(null);
    } finally {
      setSubmitting(false);
    }
  };

  const skip = () => {
    if (!active) return;
    setDismissed((prev) => new Set(prev).add(active.matchId));
    const next = items.find((i) => !dismissed.has(i.matchId) && i.matchId !== active.matchId);
    setActive(next || null);
    setResponded(null);
    setQuality(0);
  };

  if (!active) return null;
  const otherLabel = active.otherUser?.headline || active.otherUser?.companyName || 'your recent match';

  return (
    <div className="rounded-xl border p-4 mb-4" style={{ background: 'rgba(108,99,255,0.06)', borderColor: 'rgba(108,99,255,0.15)' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/70 mb-2">
            <span className="font-semibold">Quick check:</span> did <span className="text-white/90">{otherLabel}</span> respond to your intro?
          </p>

          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setResponded(true)}
              className="px-3 py-1 rounded-full text-[11px] font-medium transition"
              style={{
                background: responded === true ? 'rgba(78,205,196,0.2)' : 'rgba(255,255,255,0.04)',
                color: responded === true ? '#4ECDC4' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${responded === true ? 'rgba(78,205,196,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              ✓ Yes
            </button>
            <button
              onClick={() => setResponded(false)}
              className="px-3 py-1 rounded-full text-[11px] font-medium transition"
              style={{
                background: responded === false ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                color: responded === false ? '#F87171' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${responded === false ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              ✗ No
            </button>
          </div>

          {responded === true && (
            <div className="mb-3">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">How was the conversation?</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuality(s)}
                    className="text-lg transition"
                    style={{ filter: s <= quality ? 'none' : 'grayscale(1) opacity(0.3)' }}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>
          )}

          {responded !== null && (
            <button
              onClick={submit}
              disabled={submitting || (responded === true && quality === 0)}
              className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white transition disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}
            >
              {submitting ? 'Saving…' : 'Submit'}
            </button>
          )}
        </div>

        <button onClick={skip} className="text-white/30 hover:text-white/50 text-sm">✕</button>
      </div>
    </div>
  );
}
