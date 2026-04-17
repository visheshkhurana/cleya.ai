'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Item {
  key: string;
  label: string;
  done: boolean;
  weight: number;
}

interface Strength {
  score: number;
  checklist: Item[];
  isComplete: boolean;
}

export default function ProfileStrengthBar({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Strength | null>(null);
  const [open, setOpen] = useState(!compact);

  useEffect(() => {
    api.getProfileStrength().then((res: any) => setData(res?.data || res)).catch(() => null);
  }, []);

  if (!data) return null;
  const score = data.score;
  const color = score >= 100 ? '#4ECDC4' : score >= 75 ? '#9B95FF' : score >= 50 ? '#FBBF24' : '#F87171';

  return (
    <div className="rounded-xl border border-white/5 p-4" style={{ background: 'rgba(15,22,41,0.8)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Profile strength</span>
          {data.isComplete && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(78,205,196,0.15)', color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.3)' }}>
              🏆 Complete
            </span>
          )}
        </div>
        <span className="text-sm font-mono font-semibold" style={{ color }}>{score}%</span>
      </div>

      <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
      </div>

      {compact && (
        <button onClick={() => setOpen(!open)} className="text-[11px] text-white/40 hover:text-white/60 transition">
          {open ? 'Hide checklist ↑' : 'Show checklist ↓'}
        </button>
      )}

      {open && (
        <ul className="space-y-1.5 mt-2">
          {data.checklist.map((it) => (
            <li key={it.key} className="flex items-center gap-2 text-[11px]">
              <span style={{ color: it.done ? '#4ECDC4' : 'rgba(255,255,255,0.2)' }}>{it.done ? '✓' : '○'}</span>
              <span className={it.done ? 'text-white/60 line-through' : 'text-white/70'}>{it.label}</span>
              <span className="ml-auto text-[10px] text-white/30">+{it.weight}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
