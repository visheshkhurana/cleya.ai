'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

type Action = 'INTERESTED' | 'NOT_INTERESTED' | 'SKIP';

const REASONS_NOT: Array<{ code: string; label: string }> = [
  { code: 'WRONG_STAGE', label: 'Wrong stage' },
  { code: 'WRONG_SECTOR', label: 'Wrong sector' },
  { code: 'NOT_RELEVANT', label: 'Not relevant' },
  { code: 'TOO_EARLY', label: 'Too early' },
  { code: 'OTHER', label: 'Other' },
];

export default function QuickFeedbackChips({ matchId, onSubmit }: { matchId: string; onSubmit?: (action: Action) => void }) {
  const [picked, setPicked] = useState<Action | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (action: Action, reasonCode?: string) => {
    setSubmitting(true);
    try {
      await api.submitQuickFeedback(matchId, action, reasonCode);
      setPicked(action);
      setDone(true);
      onSubmit?.(action);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleClick = (action: Action) => {
    if (action === 'NOT_INTERESTED') {
      setPicked(action);
      setReasonOpen(true);
    } else {
      submit(action);
    }
  };

  if (done && !reasonOpen) {
    return <p className="text-[11px] text-white/40 mt-2">Thanks — we&apos;ll use this to fine-tune your matches.</p>;
  }

  return (
    <div className="mt-3">
      {!reasonOpen && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleClick('INTERESTED')}
            disabled={submitting}
            className="px-3 py-1.5 rounded-full text-[11px] font-medium transition disabled:opacity-40 hover:scale-105"
            style={{ background: 'rgba(78,205,196,0.1)', color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.2)' }}
          >
            👍 Interested
          </button>
          <button
            onClick={() => handleClick('NOT_INTERESTED')}
            disabled={submitting}
            className="px-3 py-1.5 rounded-full text-[11px] font-medium transition disabled:opacity-40 hover:scale-105"
            style={{ background: 'rgba(239,68,68,0.06)', color: '#F87171', border: '1px solid rgba(239,68,68,0.15)' }}
          >
            👎 Not for me
          </button>
          <button
            onClick={() => handleClick('SKIP')}
            disabled={submitting}
            className="px-3 py-1.5 rounded-full text-[11px] font-medium transition disabled:opacity-40 hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            ⏭ Skip
          </button>
        </div>
      )}

      {reasonOpen && picked === 'NOT_INTERESTED' && (
        <div className="space-y-2">
          <p className="text-[11px] text-white/50">Help me learn — why not?</p>
          <div className="flex flex-wrap gap-1.5">
            {REASONS_NOT.map((r) => (
              <button
                key={r.code}
                onClick={() => { submit('NOT_INTERESTED', r.code); setReasonOpen(false); }}
                disabled={submitting}
                className="px-2.5 py-1 rounded-full text-[10px] text-white/60 border border-white/10 hover:border-white/20 transition disabled:opacity-40"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
