'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import AppNav from '@/components/AppNav';
import AppFooter from '@/components/AppFooter';

interface Report {
  id: string;
  category: string;
  targetType: string;
  targetRefId?: string | null;
  details?: string | null;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
  moderatorNotes?: string | null;
  reporter: { id: string; name?: string; email: string };
  target: { id: string; name?: string; email: string; isActive: boolean };
}

const STATUS_TABS = ['PENDING', 'REVIEWING', 'DISMISSED', 'WARNED', 'SUSPENDED', 'BANNED'];

export default function ReportsClient() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    api.getMe().then((u: any) => {
      if (!u) { router.push('/?action=login'); return; }
      if (!['MANAGER', 'ADMIN'].includes(u.role)) { router.push('/'); return; }
      load(statusFilter);
    }).catch(() => router.push('/?action=login'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(statusFilter); /* eslint-disable-next-line */ }, [statusFilter]);

  const load = async (status: string) => {
    setLoading(true);
    setError('');
    try {
      const res: any = await api.adminGetReports(status);
      setReports(res?.data || res || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load reports');
    }
    setLoading(false);
  };

  const act = async (id: string, payload: { status: 'DISMISSED' | 'WARNED' | 'SUSPENDED' | 'BANNED' | 'REVIEWING'; notes?: string; suspend?: boolean; ban?: boolean }) => {
    setActingOn(id);
    try {
      await api.adminResolveReport(id, {
        status: payload.status,
        moderatorNotes: payload.notes,
        suspendUser: payload.suspend,
        banUser: payload.ban,
      });
      await load(statusFilter);
    } catch (e: any) {
      setError(e?.message || 'Failed to update report');
    }
    setActingOn(null);
  };

  return (
    <AppShell className="font-sans">
      <AppNav />
      <div className="max-w-6xl mx-auto px-6 py-8 w-full">
        <h1 className="text-2xl font-semibold text-white mb-1">Trust &amp; Safety — Reports</h1>
        <p className="text-sm text-white/50 mb-6">Review user-submitted reports and take moderation action.</p>

        <div className="flex gap-2 mb-6 flex-wrap">
          {STATUS_TABS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
              style={{
                background: statusFilter === s ? '#6C63FF' : 'rgba(255,255,255,0.04)',
                color: statusFilter === s ? '#fff' : 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >{s}</button>
          ))}
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-violet border-t-transparent rounded-full animate-spin" /></div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-white/40 py-10 text-center">No reports in this state.</p>
        ) : (
          <div className="space-y-3">
            {reports.map(r => (
              <div key={r.id} className="rounded-xl border border-white/[0.08] p-4" style={{ background: 'rgba(15,22,41,0.6)' }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>{r.category}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase text-white/50" style={{ background: 'rgba(255,255,255,0.04)' }}>{r.targetType}</span>
                      <span className="text-[11px] text-white/40">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-white">
                      <b>Target:</b> {r.target.name || r.target.email} ({r.target.email}){!r.target.isActive && <span className="ml-2 text-amber-400 text-xs">(suspended)</span>}
                    </p>
                    <p className="text-xs text-white/50 mt-0.5">
                      <b>Reporter:</b> {r.reporter.name || r.reporter.email} ({r.reporter.email})
                    </p>
                    {r.details && (
                      <p className="text-xs text-white/70 mt-2 whitespace-pre-wrap" style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 8 }}>{r.details}</p>
                    )}
                    {r.moderatorNotes && (
                      <p className="text-[11px] text-white/50 mt-2"><b>Notes:</b> {r.moderatorNotes}</p>
                    )}
                  </div>
                </div>
                {r.status === 'PENDING' || r.status === 'REVIEWING' ? (
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/5">
                    <button onClick={() => act(r.id, { status: 'REVIEWING' })} disabled={actingOn === r.id} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>Mark reviewing</button>
                    <button onClick={() => act(r.id, { status: 'DISMISSED', notes: 'No action required' })} disabled={actingOn === r.id} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}>Dismiss</button>
                    <button onClick={() => act(r.id, { status: 'WARNED', notes: 'User warned' })} disabled={actingOn === r.id} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>Warn</button>
                    <button onClick={() => { if (confirm('Suspend this user (deactivate account)?')) act(r.id, { status: 'SUSPENDED', notes: 'Account suspended', suspend: true }); }} disabled={actingOn === r.id} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>Suspend user</button>
                    <button onClick={() => { if (confirm('Permanently ban this user?')) act(r.id, { status: 'BANNED', notes: 'Account banned', ban: true }); }} disabled={actingOn === r.id} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#ef4444', color: '#fff' }}>Ban user</button>
                  </div>
                ) : (
                  <p className="text-[11px] text-white/40 mt-3"><b>Status:</b> {r.status}{r.resolvedAt ? ` · resolved ${new Date(r.resolvedAt).toLocaleString()}` : ''}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <AppFooter />
    </AppShell>
  );
}
