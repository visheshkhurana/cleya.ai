'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Stats {
  responseRate: number;
  avgResponseTimeHours: number;
  lastActiveAt: string | null;
  introsThisMonth: number;
  acceptanceRate: number;
  totalIntros: number;
  hidden?: boolean;
}

export default function InvestorMetrics({ userId }: { userId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getInvestorStats(userId)
      .then((res: any) => setStats(res?.data || null))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading || !stats || stats.hidden) return null;
  if (!stats.totalIntros) return null;

  const fmtActive = (iso: string | null) => {
    if (!iso) return null;
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 1) return 'Active today';
    if (days < 7) return `Active ${days}d ago`;
    if (days < 30) return `Active ${Math.floor(days / 7)}w ago`;
    return `Active ${Math.floor(days / 30)}mo ago`;
  };
  const active = fmtActive(stats.lastActiveAt);

  return (
    <div className="rounded-xl border p-3" style={{ background: 'rgba(108,99,255,0.04)', borderColor: 'rgba(108,99,255,0.1)' }}>
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Investor activity</p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Metric label="Response rate" value={`${Math.round(stats.responseRate * 100)}%`} />
        <Metric label="Avg response" value={stats.avgResponseTimeHours > 0 ? `${stats.avgResponseTimeHours}h` : '—'} />
        <Metric label="Acceptance" value={`${Math.round(stats.acceptanceRate * 100)}%`} />
        <Metric label="Intros / mo" value={`${stats.introsThisMonth}`} />
      </div>
      {active && <p className="text-[10px] text-white/40 mt-2">⚡ {active}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-white/40">{label}</div>
      <div className="text-sm font-semibold text-white/80 font-mono">{value}</div>
    </div>
  );
}
