'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Factor {
  key: string;
  label: string;
  value: number;
  weight: number;
}

interface Explanation {
  matchId: string;
  overallScore: number;
  factors: Factor[];
  rationale: string;
  summary: string;
  mutualConnections: number;
  recentActivity: string | null;
}

export default function WhyMatchModal({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const [data, setData] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMatchExplanation(matchId).then((res: any) => {
      setData(res?.data || res);
    }).catch(() => null).finally(() => setLoading(false));
  }, [matchId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 p-6 fade-up" style={{ background: 'rgba(15,22,41,0.95)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Why this match?</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg">✕</button>
        </div>

        {loading && <p className="text-white/40 text-sm">Loading…</p>}

        {!loading && data && (
          <>
            <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.1)' }}>
              <p className="text-xs text-white/70 leading-relaxed">{data.summary}</p>
            </div>

            <div className="space-y-2.5 mb-5">
              {data.factors.map((f) => (
                <div key={f.key}>
                  <div className="flex justify-between text-[11px] text-white/50 mb-1">
                    <span>{f.label}</span>
                    <span className="font-mono">{Math.round(f.value * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round(f.value * 100)}%`,
                        background: f.value >= 0.7 ? 'linear-gradient(90deg, #6C63FF, #4ECDC4)' : 'rgba(108,99,255,0.4)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {data.rationale && data.rationale !== data.summary && (
              <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(78,205,196,0.05)', border: '1px solid rgba(78,205,196,0.1)' }}>
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">AI rationale</p>
                <p className="text-xs text-white/70 leading-relaxed italic">{data.rationale}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-[11px] text-white/50">
              {data.mutualConnections > 0 && (
                <span className="flex items-center gap-1">🤝 {data.mutualConnections} mutual</span>
              )}
              {data.recentActivity && (
                <span className="flex items-center gap-1">⚡ {data.recentActivity}</span>
              )}
              <span className="ml-auto font-mono">Overall {Math.round(data.overallScore * 100)}%</span>
            </div>
          </>
        )}

        {!loading && !data && (
          <p className="text-white/40 text-sm">Couldn&apos;t load explanation.</p>
        )}
      </div>
    </div>
  );
}
