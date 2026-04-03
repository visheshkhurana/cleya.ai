'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import MobileNav from '@/components/MobileNav';
import AppFooter from '@/components/AppFooter';
import { resetUser } from '@/lib/posthog';
import { setUser as setSentryUser } from '@/lib/sentry';

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ matchNotify: true, introNotify: true, weeklyDigest: true, whatsappMatchNotify: true, whatsappIntroNotify: true, whatsappWeeklyDigest: true });
  const [notifSaving, setNotifSaving] = useState(false);
  const [zoomStatus, setZoomStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [zoomLoading, setZoomLoading] = useState(false);
  const [waOptedIn, setWaOptedIn] = useState(false);
  const [waPhone, setWaPhone] = useState('');
  const [waPhoneInput, setWaPhoneInput] = useState('');
  const [waLoading, setWaLoading] = useState(false);
  const [waMsg, setWaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.getMe().then((user) => {
      if (!user) { router.push('/?action=login'); return; }
      api.setToken('authenticated');
    }).catch(() => { router.push('/?action=login'); return; });
    api.getSettings()
      .then(data => {
        setSettings(data);
        if (data.notificationPrefs) {
          setNotifPrefs({
            matchNotify: data.notificationPrefs.matchNotify ?? true,
            introNotify: data.notificationPrefs.introNotify ?? true,
            weeklyDigest: data.notificationPrefs.weeklyDigest ?? true,
            whatsappMatchNotify: data.notificationPrefs.whatsappMatchNotify ?? true,
            whatsappIntroNotify: data.notificationPrefs.whatsappIntroNotify ?? true,
            whatsappWeeklyDigest: data.notificationPrefs.whatsappWeeklyDigest ?? true,
          });
        }
        setLoading(false);
      })
      .catch(() => { router.push('/?action=login'); });

    api.zoomStatus().then(data => {
      if (data) setZoomStatus(data);
    }).catch(() => {});

    api.whatsappStatus().then(data => {
      if (data) {
        setWaOptedIn(data.whatsappOptedIn || false);
        setWaPhone(data.whatsappPhone || '');
        setWaPhoneInput(data.whatsappPhone || '');
      }
    }).catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get('zoom') === 'connected') {
      setZoomStatus({ configured: true, connected: true });
      window.history.replaceState({}, '', '/settings');
    }
  }, [router]);

  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    setPasswordLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordMsg({ type: 'success', text: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password' });
    }
    setPasswordLoading(false);
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await api.deleteAccount();
      await api.logout();
      router.push('/');
    } catch {
      setDeleteLoading(false);
    }
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    setExportLoading(true);
    try {
      await api.exportMyData(format);
    } catch {
    } finally {
      setExportLoading(false);
    }
  };

  const handleLogout = () => {
    resetUser();
    setSentryUser(null);
    api.logout().then(() => router.push('/'));
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#050510',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>Loading...</div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '6px',
    display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#050510' }}>
      <nav className="sticky top-0 z-10 border-b border-white/5 px-4 sm:px-8 py-3 flex items-center justify-between" style={{ background: 'rgba(5,5,16,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/dashboard')}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>C</div>
          <span className="text-white font-semibold text-sm sm:text-base">Cleya.ai</span>
        </div>
        <div className="hidden sm:flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-white/50 hover:text-white/80 transition bg-transparent border-0 cursor-pointer">Dashboard</button>
          <button onClick={() => router.push('/profile')} className="text-sm text-white/50 hover:text-white/80 transition bg-transparent border-0 cursor-pointer">Profile</button>
          <span className="text-sm font-semibold" style={{ color: '#3B82F6' }}>Settings</span>
        </div>
        <div className="sm:hidden"><MobileNav /></div>
      </nav>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px' }} className="sm:!p-10">
        <h1 className="text-xl sm:text-[28px] font-bold text-white mb-2">Settings</h1>
        <p className="text-sm text-white/40 mb-8 sm:mb-10">Manage your account and preferences</p>

        {/* Account Info */}
        <section style={{
          background: 'rgba(10,10,26,0.8)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '24px',
        }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>👤</span> Account
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <div style={{ ...inputStyle, background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.5)' }}>{settings?.email}</div>
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <div style={{ ...inputStyle, background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.5)' }}>{settings?.phone || 'Not set'}</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Persona</label>
                <div style={{
                  padding: '6px 12px',
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: '8px',
                  color: '#93C5FD',
                  fontSize: '13px',
                  display: 'inline-block',
                }}>
                  {settings?.profile?.persona || 'Not set'}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Member since</label>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                  {settings?.createdAt ? new Date(settings.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Change Password */}
        <section style={{
          background: 'rgba(10,10,26,0.8)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '24px',
        }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🔒</span> Change Password
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                style={inputStyle}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label style={labelStyle}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={inputStyle}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={inputStyle}
                placeholder="Confirm new password"
              />
            </div>
            {passwordMsg && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                background: passwordMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${passwordMsg.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                color: passwordMsg.type === 'success' ? '#6ee7b7' : '#fca5a5',
              }}>
                {passwordMsg.text}
              </div>
            )}
            <button
              onClick={handleChangePassword}
              disabled={passwordLoading || !currentPassword || !newPassword}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: passwordLoading || !currentPassword || !newPassword ? 0.5 : 1,
                width: 'fit-content',
              }}
            >
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </section>

        {/* Session */}
        <section style={{
          background: 'rgba(10,10,26,0.8)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '24px',
        }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🚪</span> Session
          </h2>
          <button
            onClick={handleLogout}
            style={{
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Log Out
          </button>
        </section>

        {/* Export Data */}
        <section style={{
          background: 'rgba(10,10,26,0.8)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '28px',
          marginBottom: '24px',
        }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📦</span> Export My Data
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
            Download all your data including profile, matches, messages, notifications, and feedback. Available in JSON or CSV format.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleExportData('json')}
              disabled={exportLoading}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: exportLoading ? 0.5 : 1,
              }}
            >
              {exportLoading ? 'Exporting...' : 'Export as JSON'}
            </button>
            <button
              onClick={() => handleExportData('csv')}
              disabled={exportLoading}
              style={{
                padding: '12px 24px',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                opacity: exportLoading ? 0.5 : 1,
              }}
            >
              {exportLoading ? 'Exporting...' : 'Export as CSV'}
            </button>
          </div>
        </section>

        {/* Notification Preferences */}
        <section style={{
          background: 'rgba(10,10,26,0.8)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '28px',
        }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📬</span> Notification Preferences
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginBottom: '20px' }}>
            Choose how you want to be notified about matches and introductions.
          </p>
          <h4 style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Email</h4>
          <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
            {[
              { key: 'matchNotify' as const, label: 'New match notifications' },
              { key: 'introNotify' as const, label: 'Introduction updates' },
              { key: 'weeklyDigest' as const, label: 'Weekly digest' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifPrefs[key]}
                  onChange={async (e) => {
                    const updated = { ...notifPrefs, [key]: e.target.checked };
                    setNotifPrefs(updated);
                    setNotifSaving(true);
                    try {
                      await api.updateNotificationPrefs({ [key]: e.target.checked });
                    } catch {}
                    setNotifSaving(false);
                  }}
                  className="rounded border-white/20 bg-white/5 accent-blue-600"
                />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{label}</span>
              </label>
            ))}
          </div>
          <h4 style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>WhatsApp</h4>
          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              { key: 'whatsappMatchNotify' as const, label: 'New match notifications' },
              { key: 'whatsappIntroNotify' as const, label: 'Introduction updates' },
              { key: 'whatsappWeeklyDigest' as const, label: 'Weekly digest (Monday 9 AM)' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifPrefs[key]}
                  onChange={async (e) => {
                    const updated = { ...notifPrefs, [key]: e.target.checked };
                    setNotifPrefs(updated);
                    setNotifSaving(true);
                    try {
                      await api.updateNotificationPrefs({ [key]: e.target.checked });
                    } catch {}
                    setNotifSaving(false);
                  }}
                  className="rounded border-white/20 bg-white/5 accent-blue-600"
                />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{label}</span>
              </label>
            ))}
          </div>
          {notifSaving && (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '8px' }}>Saving...</p>
          )}
        </section>

        {/* WhatsApp Integration */}
        <section style={{
          background: 'rgba(10,10,26,0.8)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '28px',
          marginTop: '24px',
        }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>💬</span> WhatsApp Notifications
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.5 }}>
            Get real-time match notifications, meeting reminders, and introductions delivered to your WhatsApp.
          </p>

          {waOptedIn ? (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', borderRadius: '12px',
                background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)',
                marginBottom: '16px',
              }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: '#10b981', flexShrink: 0,
                }} />
                <div>
                  <p style={{ color: '#6ee7b7', fontSize: '14px', fontWeight: 500, margin: 0 }}>WhatsApp notifications active</p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '2px 0 0 0' }}>
                    Receiving on {waPhone || 'your number'}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setWaLoading(true);
                  setWaMsg(null);
                  try {
                    await api.whatsappOptOut();
                    setWaOptedIn(false);
                    setWaMsg({ type: 'success', text: 'WhatsApp notifications turned off' });
                  } catch (err: any) {
                    setWaMsg({ type: 'error', text: err.message || 'Failed to opt out' });
                  }
                  setWaLoading(false);
                }}
                disabled={waLoading}
                style={{
                  padding: '10px 20px', borderRadius: '10px', fontSize: '13px',
                  background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                  opacity: waLoading ? 0.5 : 1,
                }}
              >
                {waLoading ? 'Processing...' : 'Turn Off WhatsApp Notifications'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={labelStyle}>WhatsApp Number</label>
                  <input
                    type="tel"
                    value={waPhoneInput}
                    onChange={e => setWaPhoneInput(e.target.value)}
                    style={inputStyle}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginBottom: '14px', lineHeight: 1.5 }}>
                By enabling, you agree to receive WhatsApp messages from Cleya.ai. You can opt out anytime.
              </p>
              <button
                onClick={async () => {
                  if (!waPhoneInput.trim()) {
                    setWaMsg({ type: 'error', text: 'Please enter your WhatsApp number' });
                    return;
                  }
                  setWaLoading(true);
                  setWaMsg(null);
                  try {
                    await api.whatsappOptIn(waPhoneInput.trim());
                    setWaOptedIn(true);
                    setWaPhone(waPhoneInput.trim());
                    setWaMsg({ type: 'success', text: 'WhatsApp notifications enabled!' });
                  } catch (err: any) {
                    setWaMsg({ type: 'error', text: err.message || 'Failed to enable WhatsApp' });
                  }
                  setWaLoading(false);
                }}
                disabled={waLoading || !waPhoneInput.trim()}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #25D366, #128C7E)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: waLoading || !waPhoneInput.trim() ? 0.5 : 1,
                }}
              >
                {waLoading ? 'Enabling...' : 'Enable WhatsApp Notifications'}
              </button>
            </div>
          )}

          {waMsg && (
            <div style={{
              marginTop: '12px', padding: '10px 14px', borderRadius: '10px', fontSize: '13px',
              background: waMsg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${waMsg.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              color: waMsg.type === 'success' ? '#6ee7b7' : '#fca5a5',
            }}>
              {waMsg.text}
            </div>
          )}
        </section>

        {/* Integrations */}
        <section style={{
          background: 'rgba(10,10,26,0.8)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px',
          padding: '28px',
          marginTop: '24px',
        }}>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Integrations</h2>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginBottom: '20px' }}>Connect external services to enhance your Cleya experience.</p>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: '#2D8CFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', color: '#fff', fontWeight: 700,
              }}>Z</div>
              <div>
                <p style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>Zoom</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                  {zoomStatus?.connected
                    ? 'Connected — meetings will include Zoom links'
                    : zoomStatus?.configured
                      ? 'Available — connect to create Zoom meetings automatically'
                      : 'Not configured — ask your admin to set up Zoom'}
                </p>
              </div>
            </div>
            {zoomStatus?.configured && (
              zoomStatus.connected ? (
                <button
                  onClick={async () => {
                    setZoomLoading(true);
                    try {
                      await api.zoomDisconnect();
                      setZoomStatus({ configured: true, connected: false });
                    } catch {} finally { setZoomLoading(false); }
                  }}
                  disabled={zoomLoading}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                    background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                  }}>
                  {zoomLoading ? '...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    setZoomLoading(true);
                    try {
                      const data = await api.zoomConnect();
                      if (data?.authUrl) {
                        window.location.href = data.authUrl;
                      }
                    } catch {} finally { setZoomLoading(false); }
                  }}
                  disabled={zoomLoading}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                    background: 'rgba(59,130,246,0.1)', color: '#5eead4',
                    border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer',
                  }}>
                  {zoomLoading ? '...' : 'Connect Zoom'}
                </button>
              )
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section style={{
          background: 'rgba(10,10,26,0.8)',
          border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: '16px',
          padding: '28px',
        }}>
          <h2 style={{ color: '#ef4444', fontSize: '18px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span> Danger Zone
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
            Once you delete your account, all your data including matches, conversations, and profile will be permanently removed. This action cannot be undone.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                padding: '12px 24px',
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Delete Account
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ color: '#fca5a5', fontSize: '13px' }}>Are you sure?</span>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                style={{
                  padding: '10px 20px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: deleteLoading ? 0.5 : 1,
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </div>
      <AppFooter />
    </div>
  );
}
