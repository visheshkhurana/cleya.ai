'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Stats {
  totalUsers: number;
  activeConversations: number;
  completedProfiles: number;
  totalMatches: number;
  acceptedMatches: number;
  matchAcceptRate: number;
  totalCalls: number;
}

interface FunnelStep {
  stage: string;
  count: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!api.getToken()) {
      router.push('/');
      return;
    }
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsData, funnelData, usersData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminFunnel(),
        api.getAdminUsers(),
      ]);
      setStats(statsData);
      setFunnel(funnelData.funnel || []);
      setUsers(Array.isArray(usersData) ? usersData : usersData?.users || []);
    } catch (err: any) {
      console.error('Admin load failed:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0a1e]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-purple-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0a1e]">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const maxFunnel = funnel.length > 0 ? Math.max(...funnel.map((f) => f.count), 1) : 1;

  return (
    <div className="min-h-screen bg-[#0f0a1e]">
      <header className="bg-[#1a1230]/80 backdrop-blur-sm border-b border-purple-500/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-purple-500/20">
              B
            </div>
            <h1 className="text-lg font-bold text-white">Boardy Admin</h1>
          </div>
          <button
            onClick={() => { api.clearToken(); router.push('/'); }}
            className="text-sm text-purple-300/60 hover:text-purple-200 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: '👥' },
              { label: 'Complete Profiles', value: stats.completedProfiles, icon: '✅' },
              { label: 'Total Matches', value: stats.totalMatches, icon: '🤝' },
              { label: 'Accept Rate', value: `${stats.matchAcceptRate}%`, icon: '📈' },
              { label: 'Active Chats', value: stats.activeConversations, icon: '💬' },
              { label: 'Accepted Matches', value: stats.acceptedMatches, icon: '🎉' },
              { label: 'Total Calls', value: stats.totalCalls, icon: '📞' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-[#1a1230]/60 backdrop-blur-sm rounded-xl border border-purple-500/10 p-5 hover:border-purple-500/20 transition"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{stat.icon}</span>
                  <p className="text-xs font-medium text-purple-300/60 uppercase tracking-wider">{stat.label}</p>
                </div>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-[#1a1230]/60 backdrop-blur-sm rounded-xl border border-purple-500/10 p-6">
          <h2 className="text-sm font-semibold text-white mb-6">Conversion Funnel</h2>
          <div className="space-y-3">
            {funnel.map((step, i) => (
              <div key={step.stage} className="flex items-center gap-4">
                <div className="w-44 text-xs font-medium text-purple-300/70 text-right">{step.stage}</div>
                <div className="flex-1 bg-purple-900/20 rounded-full h-8 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full flex items-center justify-end pr-3 transition-all duration-700"
                    style={{ width: `${Math.max((step.count / maxFunnel) * 100, 8)}%` }}
                  >
                    <span className="text-xs font-bold text-white">{step.count}</span>
                  </div>
                </div>
                {i > 0 && funnel[i - 1].count > 0 && (
                  <div className="w-16 text-xs text-purple-400/50">
                    {Math.round((step.count / funnel[i - 1].count) * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1a1230]/60 backdrop-blur-sm rounded-xl border border-purple-500/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-purple-500/10">
            <h2 className="text-sm font-semibold text-white">Users ({users.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-purple-900/10">
                  <th className="text-left px-6 py-3 text-xs font-medium text-purple-300/60 uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-purple-300/60 uppercase">Persona</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-purple-300/60 uppercase">Company</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-purple-300/60 uppercase">Completeness</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-purple-300/60 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/5">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-purple-900/10 transition">
                    <td className="px-6 py-3 font-medium text-white">{user.email}</td>
                    <td className="px-6 py-3">
                      {user.profile?.persona ? (
                        <span className="px-2.5 py-1 rounded-full text-xs bg-purple-500/15 text-purple-300 border border-purple-500/20">
                          {user.profile.persona}
                        </span>
                      ) : (
                        <span className="text-purple-400/30">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-purple-200/70">{user.profile?.companyName || '-'}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-purple-900/20 rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full h-1.5 transition-all"
                            style={{ width: `${(user.profile?.completenessScore || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-purple-300/50">
                          {Math.round((user.profile?.completenessScore || 0) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-purple-300/40">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
