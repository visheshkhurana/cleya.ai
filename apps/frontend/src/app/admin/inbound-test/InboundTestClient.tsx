'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import AppShell from '@/components/AppShell';
import AppNav from '@/components/AppNav';
import AppFooter from '@/components/AppFooter';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface PendingRow {
  matchId: string;
  userId: string;
  userName: string;
  userEmail: string;
  partnerName: string;
  createdAt: string;
}

interface SimResult {
  webhookStatus: number;
  webhookResponse: any;
  sentTo: string;
  previewPayload: any;
}

interface DnsCheck {
  domain: string | null;
  mxRecords: Array<{ exchange: string; priority: number }>;
  pointsToResend: boolean;
  secretConfigured: boolean;
  status: 'ok' | 'wrong_target' | 'no_mx' | 'lookup_failed' | 'no_secret' | 'not_configured';
  message: string;
}

async function adminFetch(path: string, init?: RequestInit): Promise<any> {
  const csrf = (document.cookie.split('; ').find((c) => c.startsWith('cleo_csrf=')) || '').split('=')[1];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}),
    ...((init?.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  return json.data ?? json;
}

export default function InboundTestClient() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [selectedKey, setSelectedKey] = useState<string>('');
  const [intent, setIntent] = useState<'accept' | 'decline'>('accept');
  const [bodyText, setBodyText] = useState('');
  const [draft, setDraft] = useState<{ preview: any; replyTo: string } | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dns, setDns] = useState<DnsCheck | null>(null);
  const [dnsLoading, setDnsLoading] = useState(false);

  useEffect(() => {
    api.getMe()
      .then((u: any) => {
        if (!u) { router.push('/?action=login'); return; }
        if (!['MANAGER', 'ADMIN'].includes(u.role)) { router.push('/'); return; }
        setAuthChecked(true);
        load();
        checkDns();
      })
      .catch(() => router.push('/?action=login'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkDns() {
    setDnsLoading(true);
    try {
      const data: DnsCheck = await adminFetch('/admin/inbound/dns-check');
      setDns(data);
    } catch (e: any) {
      setDns({
        domain: null,
        mxRecords: [],
        pointsToResend: false,
        secretConfigured: false,
        status: 'lookup_failed',
        message: e?.message || 'DNS check failed',
      });
    } finally {
      setDnsLoading(false);
    }
  }

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const rows: PendingRow[] = await adminFetch('/admin/inbound/pending-matches');
      setPending(rows || []);
      if (rows && rows.length > 0) setSelectedKey(`${rows[0].matchId}::${rows[0].userId}`);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load pending matches');
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(
    () => pending.find((r) => `${r.matchId}::${r.userId}` === selectedKey),
    [pending, selectedKey],
  );

  const defaultBody = intent === 'accept'
    ? 'yes please make the intro'
    : 'no thanks, not the right fit right now';

  async function previewDraft() {
    if (!selected) return;
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const data = await adminFetch('/admin/inbound/simulate', {
        method: 'POST',
        body: JSON.stringify({
          matchId: selected.matchId,
          userId: selected.userId,
          intent,
          bodyText: bodyText || undefined,
          dryRun: true,
        }),
      });
      setDraft(data);
    } catch (e: any) {
      setErr(e?.message || 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function fireSimulation() {
    if (!selected) return;
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const data: SimResult = await adminFetch('/admin/inbound/simulate', {
        method: 'POST',
        body: JSON.stringify({
          matchId: selected.matchId,
          userId: selected.userId,
          intent,
          bodyText: bodyText || undefined,
        }),
      });
      setResult(data);
      // Refresh pending list — the row should disappear if response was recorded
      load();
    } catch (e: any) {
      setErr(e?.message || 'Simulation failed');
    } finally {
      setBusy(false);
    }
  }

  if (!authChecked) return null;

  return (
    <AppShell>
      <AppNav />
      <main className="min-h-screen px-4 py-8" style={{ background: '#0A0F1F' }}>
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">Inbound email simulator</h1>
            <p className="text-sm text-white/60 mt-1">
              Verify the reply-by-email pipeline without waiting for DNS to propagate. Pick a pending match,
              choose what the user "would" reply, then preview the payload or fire it through the real webhook.
            </p>
          </div>

          {dns && (() => {
            const ok = dns.status === 'ok';
            const warn = dns.status === 'no_secret';
            const bg = ok ? 'rgba(16,185,129,0.06)' : warn ? 'rgba(245,158,11,0.06)' : 'rgba(220,38,38,0.06)';
            const border = ok ? 'rgba(16,185,129,0.3)' : warn ? 'rgba(245,158,11,0.3)' : 'rgba(220,38,38,0.3)';
            const dot = ok ? '#10b981' : warn ? '#f59e0b' : '#ef4444';
            const label = ok ? 'Ready' : warn ? 'Almost ready' : 'Not ready';
            return (
              <div className="rounded-2xl p-4 mb-6" style={{ background: bg, border: `1px solid ${border}` }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: dot }} />
                    <h2 className="text-sm font-semibold text-white">Inbound email DNS — {label}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={checkDns}
                    disabled={dnsLoading}
                    className="text-xs px-3 py-1 rounded-lg text-white/80"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {dnsLoading ? 'Checking…' : 'Re-check'}
                  </button>
                </div>
                <p className="text-xs text-white/70 mt-2">{dns.message}</p>
                {dns.domain && (
                  <p className="text-[11px] text-white/50 mt-2">
                    Domain: <code className="text-white/80">{dns.domain}</code>
                    {' · '}
                    Webhook secret: <code className="text-white/80">{dns.secretConfigured ? 'set' : 'missing'}</code>
                  </p>
                )}
                {dns.mxRecords.length > 0 && (
                  <ul className="mt-2 text-[11px] text-white/60 space-y-0.5">
                    {dns.mxRecords.map((r, i) => (
                      <li key={i}>
                        <span className="text-white/40">priority {r.priority} →</span>{' '}
                        <code className="text-white/85">{r.exchange}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}

          {err && (
            <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5' }}>
              {err}
            </div>
          )}

          <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">
              Pending match recipient
            </label>
            {loading ? (
              <p className="text-white/40 text-sm">Loading…</p>
            ) : pending.length === 0 ? (
              <p className="text-white/50 text-sm">No matches with a pending response right now.</p>
            ) : (
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-white text-sm"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {pending.map((r) => (
                  <option key={`${r.matchId}::${r.userId}`} value={`${r.matchId}::${r.userId}`}>
                    {r.userName} ({r.userEmail}) → {r.partnerName} · {new Date(r.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label="Reply intent">
              <button
                type="button"
                aria-pressed={intent === 'accept'}
                onClick={() => setIntent('accept')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${intent === 'accept' ? 'text-white' : 'text-white/60'}`}
                style={{
                  background: intent === 'accept' ? '#0D9488' : 'rgba(255,255,255,0.05)',
                  border: '1px solid ' + (intent === 'accept' ? '#0D9488' : 'rgba(255,255,255,0.1)'),
                }}
              >
                Reply with “yes”
              </button>
              <button
                type="button"
                aria-pressed={intent === 'decline'}
                onClick={() => setIntent('decline')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${intent === 'decline' ? 'text-white' : 'text-white/60'}`}
                style={{
                  background: intent === 'decline' ? '#475569' : 'rgba(255,255,255,0.05)',
                  border: '1px solid ' + (intent === 'decline' ? '#475569' : 'rgba(255,255,255,0.1)'),
                }}
              >
                Reply with “no”
              </button>
            </div>

            <label className="block text-xs uppercase tracking-wider text-white/50 mt-4 mb-2">
              Reply body (optional — defaults to a natural “{defaultBody}”)
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={3}
              placeholder={defaultBody}
              className="w-full rounded-lg px-3 py-2 text-white text-sm font-mono"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={previewDraft}
                disabled={!selected || busy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                {busy ? '…' : 'Show me the draft'}
              </button>
              <button
                onClick={fireSimulation}
                disabled={!selected || busy}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: '#0D9488', border: '1px solid #0D9488' }}
              >
                {busy ? '…' : 'Fire it through the webhook'}
              </button>
            </div>
          </div>

          {draft && (
            <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(108,99,255,0.04)', border: '1px solid rgba(108,99,255,0.15)' }}>
              <h2 className="text-sm font-semibold text-white mb-2">Draft payload preview</h2>
              <p className="text-xs text-white/60 mb-3">
                This is the exact JSON Resend would POST to <code className="text-white/80">/api/inbound/email</code> when the user replies.
                The To: address is the signed per-match local-part — that's how we route the reply back to the right match.
              </p>
              <p className="text-xs text-white/70 mb-2"><strong>Reply-to address:</strong> <code className="text-white/90">{draft.replyTo}</code></p>
              <pre className="text-[11px] text-white/70 overflow-x-auto p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.4)' }}>
{JSON.stringify(draft.preview, null, 2)}
              </pre>
            </div>
          )}

          {result && (
            <div className="rounded-2xl p-5" style={{ background: result.webhookStatus < 400 ? 'rgba(16,185,129,0.06)' : 'rgba(220,38,38,0.06)', border: '1px solid ' + (result.webhookStatus < 400 ? 'rgba(16,185,129,0.3)' : 'rgba(220,38,38,0.3)') }}>
              <h2 className="text-sm font-semibold text-white mb-2">
                Webhook responded: HTTP {result.webhookStatus}
              </h2>
              <p className="text-xs text-white/70 mb-2"><strong>Sent to:</strong> <code className="text-white/90">{result.sentTo}</code></p>
              <pre className="text-[11px] text-white/70 overflow-x-auto p-3 rounded-lg" style={{ background: 'rgba(0,0,0,0.4)' }}>
{JSON.stringify(result.webhookResponse, null, 2)}
              </pre>
              <p className="text-[11px] text-white/50 mt-3">
                If the response shows <code>intent: "accept"</code> with <code>response: "ACCEPTED"</code>, the
                match was updated and the ack email was queued. Refresh the dropdown above — the row should be gone.
              </p>
            </div>
          )}
        </div>
        <AppFooter />
      </main>
    </AppShell>
  );
}
