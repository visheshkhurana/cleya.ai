'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

  useEffect(() => {
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
      setUsers(usersData || []);
    } catch (err) {
      console.error('Admin load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  const maxFunnel = funnel.length > 0 ? Math.max(...funnel.map((f) => f.count), 1) : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-boardy-600 text-white text-sm font-bold flex items-center justify-center">
            B
          </div>
          <h1 className="text-lg font-bold text-gray-900">Boardy Admin</h1>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers, color: 'boardy' },
              { label: 'Complete Profiles', value: stats.completedProfiles, color: 'green' },
              { label: 'Total Matches', value: stats.totalMatches, color: 'blue' },
              { label: 'Accept Rate', value: `${stats.matchAcceptRate}%`, color: 'purple' },
              { label: 'Active Chats', value: stats.activeConversations, color: 'yellow' },
              { label: 'Accepted Matches', value: stats.acceptedMatches, color: 'emerald' },
              { label: 'Total Calls', value: stats.totalCalls, color: 'orange' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Conversion Funnel</h2>
          <div className="space-y-3">
            {funnel.map((step, i) => (
              <div key={step.stage} className="flex items-center gap-4">
                <div className="w-40 text-xs font-medium text-gray-600 text-right">{step.stage}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                  <div
                    className="h-full bg-boardy-500 rounded-full flex items-center justify-end pr-3 transition-all duration-500"
                    style={{ width: `${Math.max((step.count / maxFunnel) * 100, 8)}%` }}
                  >
                    <span className="text-xs font-bold text-white">{step.count}</span>
                  </div>
                </div>
                {i > 0 && funnel[i - 1].count > 0 && (
                  <div className="w-16 text-xs text-gray-400">
                    {Math.round((step.count / funnel[i - 1].count) * 100)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Users</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Persona</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Completeness</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{user.email}</td>
                    <td className="px-6 py-3">
                      {user.profile?.persona ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-boardy-100 text-boardy-700">
                          {user.profile.persona}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3">{user.profile?.companyName || '-'}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-boardy-500 rounded-full h-1.5"
                            style={{ width: `${(user.profile?.completenessScore || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round((user.profile?.completenessScore || 0) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-500">
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
