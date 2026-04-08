'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { ChannelSidebar } from '@/components/admin/control-tower/ChannelSidebar';
import { ChatPanel } from '@/components/admin/control-tower/ChatPanel';
import { InsightsPanel } from '@/components/admin/control-tower/InsightsPanel';
import { CommandPalette } from '@/components/admin/control-tower/CommandPalette';
import { Channel, ChatMessage, Thread, AGENT_CHANNELS, AGENT_MAP } from '@/components/admin/control-tower/types';

interface Stats {
  totalUsers: number;
  activeConversations: number;
  completedProfiles: number;
  totalMatches: number;
  acceptedMatches: number;
  matchAcceptRate: number;
  totalCalls: number;
  totalMessages: number;
}

interface CommData {
  calls: any[];
  messages: any[];
  callStats: { total: number; completed: number; failed: number; inProgress: number };
  messageStats: { totalSMS: number; totalWhatsApp: number; delivered: number; failed: number; total: number };
}

export default function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [userRole, setUserRole] = useState('');

  const [stats, setStats] = useState<Stats | null>(null);
  const [commData, setCommData] = useState<CommData | null>(null);
  const [dealData, setDealData] = useState<any>(null);
  const [eventData, setEventData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [whatsappData, setWhatsappData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [channels, setChannels] = useState<Channel[]>(AGENT_CHANNELS);
  const [activeChannelId, setActiveChannelId] = useState('founder-room');
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [agentLoading, setAgentLoading] = useState(false);
  const [insightsCollapsed, setInsightsCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [threadReplies, setThreadReplies] = useState<Record<string, ChatMessage[]>>({});
  const [agentChatHistory, setAgentChatHistory] = useState<Record<string, { role: string; content: string }[]>>({});

  const messageIdCounter = useRef(0);

  const genId = () => `msg-${Date.now()}-${++messageIdCounter.current}`;

  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];
  const channelMessages = messages[activeChannelId] || [];

  useEffect(() => {
    api.getMe().then((user) => {
      if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
        api.setToken('authenticated');
        setAuthenticated(true);
        setUserRole(user.role);
        loadDashboard();
      }
    }).catch(() => {}).finally(() => setCheckingAuth(false));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadAgentPresence();
    const presenceInterval = setInterval(loadAgentPresence, 30000);
    return () => clearInterval(presenceInterval);
  }, [authenticated]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const data = await api.login(loginEmail, loginPassword);
      if (data.mfaRequired) {
        setMfaRequired(true);
        setLoginLoading(false);
        return;
      }
      if (data.user?.role !== 'ADMIN' && data.user?.role !== 'MANAGER') {
        setLoginError('Access denied. Admin or manager credentials required.');
        api.logout();
        return;
      }
      api.setToken('authenticated');
      setAuthenticated(true);
      setUserRole(data.user.role);
      loadDashboard();
    } catch (err: any) {
      setLoginError(err.message || 'Invalid credentials');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError('');
    setLoginLoading(true);
    try {
      const data = await api.mfaValidate(mfaCode);
      if (data.user?.role !== 'ADMIN' && data.user?.role !== 'MANAGER') {
        setMfaError('Access denied. Admin or manager credentials required.');
        api.logout();
        return;
      }
      api.setToken('authenticated');
      setAuthenticated(true);
      setUserRole(data.user.role);
      setMfaRequired(false);
      loadDashboard();
    } catch (err: any) {
      setMfaError(err.message || 'Invalid MFA code');
    } finally {
      setLoginLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const [statsData] = await Promise.all([
        api.getAdminStats(),
      ]);
      setStats(statsData);
    } catch (err: any) {
      console.error('Admin load failed:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentPresence = async () => {
    try {
      const statuses = await api.getAgentStatuses();
      if (Array.isArray(statuses)) {
        setChannels(prev => prev.map(ch => {
          if (ch.type !== 'agent' || !ch.agentId) return ch;
          const status = statuses.find((s: any) => s.agentId === ch.agentId);
          if (!status) return ch;
          return {
            ...ch,
            presence: status.status === 'running' ? 'running' as const :
                     status.enabled ? 'active' as const : 'idle' as const,
          };
        }));
      }
    } catch {
      // non-fatal
    }
  };

  const loadComms = useCallback(async () => {
    try {
      const data = await api.getAdminCommunications();
      setCommData(data);
    } catch (err: any) {
      console.error('Failed to load communications:', err);
    }
  }, []);

  const loadDeals = useCallback(async () => {
    try {
      const data = await api.getAdminDeals();
      setDealData(data);
    } catch (err: any) {
      console.error('Failed to load deals:', err);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const data = await api.getAdminEvents();
      setEventData(data);
    } catch (err: any) {
      console.error('Failed to load events:', err);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await api.getAdminAnalytics('30d');
      setAnalyticsData(data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
    }
  }, []);

  const loadWhatsApp = useCallback(async () => {
    try {
      const [actRes, usersRes] = await Promise.all([
        fetch('/api/admin/whatsapp/activity', { credentials: 'include' }),
        fetch('/api/admin/whatsapp/users', { credentials: 'include' }),
      ]);
      const actJson = await actRes.json();
      const usersJson = await usersRes.json();
      const waData: any = {};
      if (actJson.success) Object.assign(waData, actJson.data);
      if (usersJson.success) waData.users = usersJson.data;
      setWhatsappData(waData);
    } catch (err: any) {
      console.error('Failed to load WhatsApp:', err);
    }
  }, []);

  const activeChannelIdRef = useRef(activeChannelId);
  useEffect(() => { activeChannelIdRef.current = activeChannelId; }, [activeChannelId]);

  const addMessage = useCallback((channelId: string, msg: ChatMessage) => {
    setMessages(prev => ({
      ...prev,
      [channelId]: [...(prev[channelId] || []), msg],
    }));
    if (channelId !== activeChannelIdRef.current && msg.sender !== 'user') {
      setChannels(prev => prev.map(ch =>
        ch.id === channelId ? { ...ch, unreadCount: (ch.unreadCount || 0) + 1, hasNewActivity: true } : ch
      ));
    }
  }, []);

  const addSystemMessage = useCallback((channelId: string, content: string) => {
    addMessage(channelId, {
      id: genId(),
      channelId,
      sender: 'system',
      content,
      timestamp: new Date(),
      type: 'system-event',
    });
  }, [addMessage]);

  const resolveAgentId = useCallback((channelId: string, mentions?: string[]): string | null => {
    if (mentions && mentions.length > 0) {
      return mentions[0];
    }
    const channel = channels.find(c => c.id === channelId);
    if (channel?.type === 'agent' && channel.agentId) {
      return channel.agentId;
    }
    if (channelId === 'founder-room') {
      return 'nexus';
    }
    if (channelId === 'all-agents') {
      return null;
    }
    return null;
  }, [channels]);

  const handleSendMessage = useCallback(async (content: string, mentions?: string[], targetChannelId?: string) => {
    const channelId = targetChannelId || activeChannelId;
    const userMsg: ChatMessage = {
      id: genId(),
      channelId,
      sender: 'user',
      content,
      timestamp: new Date(),
      type: 'chat',
      mentions,
    };
    addMessage(channelId, userMsg);

    if (channelId === 'all-agents') {
      setAgentLoading(true);
      const agentIds = Object.keys(AGENT_MAP);
      for (const agentId of agentIds) {
        try {
          const history = agentChatHistory[agentId] || [];
          const result = await api.sendAgentMessage(agentId, content, history);
          const agent = AGENT_MAP[agentId];
          addMessage(channelId, {
            id: genId(),
            channelId,
            sender: 'agent',
            agentId,
            agentName: agent?.name || agentId,
            agentEmoji: agent?.emoji,
            content: result.content,
            timestamp: new Date(),
            type: 'chat',
          });
          setAgentChatHistory(prev => ({
            ...prev,
            [agentId]: [...(prev[agentId] || []), { role: 'user', content }, { role: 'assistant', content: result.content }],
          }));
        } catch (err: any) {
          addMessage(channelId, {
            id: genId(),
            channelId,
            sender: 'agent',
            agentId,
            agentName: AGENT_MAP[agentId]?.name || agentId,
            agentEmoji: AGENT_MAP[agentId]?.emoji,
            content: `Error: ${err.message}`,
            timestamp: new Date(),
            type: 'error',
          });
        }
      }
      setAgentLoading(false);
      return;
    }

    const targetAgentId = resolveAgentId(channelId, mentions);
    if (!targetAgentId) return;

    setAgentLoading(true);
    try {
      const history = agentChatHistory[targetAgentId] || [];
      const result = await api.sendAgentMessage(targetAgentId, content, history);
      const agent = AGENT_MAP[targetAgentId];
      addMessage(channelId, {
        id: genId(),
        channelId,
        sender: 'agent',
        agentId: targetAgentId,
        agentName: agent?.name || targetAgentId,
        agentEmoji: agent?.emoji,
        content: result.content,
        timestamp: new Date(),
        type: 'chat',
      });
      setAgentChatHistory(prev => ({
        ...prev,
        [targetAgentId]: [...(prev[targetAgentId] || []), { role: 'user', content }, { role: 'assistant', content: result.content }],
      }));
    } catch (err: any) {
      addMessage(channelId, {
        id: genId(),
        channelId,
        sender: 'agent',
        agentId: targetAgentId,
        agentName: AGENT_MAP[targetAgentId]?.name || targetAgentId,
        agentEmoji: AGENT_MAP[targetAgentId]?.emoji,
        content: `Error: ${err.message}`,
        timestamp: new Date(),
        type: 'error',
      });
    }
    setAgentLoading(false);
  }, [activeChannelId, addMessage, resolveAgentId, agentChatHistory]);

  const handleOpenThread = useCallback((message: ChatMessage) => {
    setActiveThread({
      parentMessage: message,
      replies: threadReplies[message.id] || [],
    });
  }, [threadReplies]);

  const handleCloseThread = useCallback(() => {
    setActiveThread(null);
  }, []);

  const handleSendThreadReply = useCallback(async (content: string, threadId: string) => {
    if (!activeThread) return;

    const userReply: ChatMessage = {
      id: genId(),
      channelId: activeThread.parentMessage.channelId,
      sender: 'user',
      content,
      timestamp: new Date(),
      type: 'chat',
      threadId,
    };

    setActiveThread(prev => prev ? {
      ...prev,
      replies: [...prev.replies, userReply],
    } : null);
    setThreadReplies(prev => ({
      ...prev,
      [threadId]: [...(prev[threadId] || []), userReply],
    }));

    setMessages(prev => {
      const ch = activeThread.parentMessage.channelId;
      const msgs = prev[ch] || [];
      return {
        ...prev,
        [ch]: msgs.map(m => m.id === threadId ? { ...m, threadCount: (m.threadCount || 0) + 1 } : m),
      };
    });

    const parentAgentId = activeThread.parentMessage.agentId;
    const channelId = activeThread.parentMessage.channelId;
    const targetAgentId = parentAgentId || resolveAgentId(channelId);
    if (!targetAgentId) return;

    setAgentLoading(true);
    try {
      const history = agentChatHistory[targetAgentId] || [];
      const result = await api.sendAgentMessage(targetAgentId, content, history);
      const agent = AGENT_MAP[targetAgentId];
      const agentReply: ChatMessage = {
        id: genId(),
        channelId,
        sender: 'agent',
        agentId: targetAgentId,
        agentName: agent?.name || targetAgentId,
        agentEmoji: agent?.emoji,
        content: result.content,
        timestamp: new Date(),
        type: 'chat',
        threadId,
      };
      setActiveThread(prev => prev ? { ...prev, replies: [...prev.replies, agentReply] } : null);
      setThreadReplies(prev => ({
        ...prev,
        [threadId]: [...(prev[threadId] || []), agentReply],
      }));
      setAgentChatHistory(prev => ({
        ...prev,
        [targetAgentId]: [...(prev[targetAgentId] || []), { role: 'user', content }, { role: 'assistant', content: result.content }],
      }));
    } catch (err: any) {
      const errorReply: ChatMessage = {
        id: genId(),
        channelId,
        sender: 'agent',
        content: `Error: ${err.message}`,
        timestamp: new Date(),
        type: 'error',
        threadId,
      };
      setActiveThread(prev => prev ? { ...prev, replies: [...prev.replies, errorReply] } : null);
      setThreadReplies(prev => ({
        ...prev,
        [threadId]: [...(prev[threadId] || []), errorReply],
      }));
    }
    setAgentLoading(false);
  }, [activeThread, resolveAgentId, agentChatHistory]);

  const handleSelectChannel = useCallback((channelId: string) => {
    setActiveChannelId(channelId);
    setActiveThread(null);
    setChannels(prev => prev.map(ch =>
      ch.id === channelId ? { ...ch, unreadCount: 0, hasNewActivity: false } : ch
    ));
  }, []);

  const handleRunAgent = useCallback(async (agentId: string) => {
    try {
      addSystemMessage(agentId, `Agent ${AGENT_MAP[agentId]?.name || agentId} has been triggered to run.`);
      const result = await api.runAgent(agentId);
      const agent = AGENT_MAP[agentId];
      addMessage(agentId, {
        id: genId(),
        channelId: agentId,
        sender: 'agent',
        agentId,
        agentName: agent?.name || agentId,
        agentEmoji: agent?.emoji,
        content: result?.output || result?.message || `${agent?.name || agentId} run completed successfully.`,
        timestamp: new Date(),
        type: 'run-output',
      });
    } catch (err: any) {
      addMessage(agentId, {
        id: genId(),
        channelId: agentId,
        sender: 'agent',
        agentId,
        agentName: AGENT_MAP[agentId]?.name || agentId,
        agentEmoji: AGENT_MAP[agentId]?.emoji,
        content: `Run failed: ${err.message}`,
        timestamp: new Date(),
        type: 'error',
      });
    }
  }, [addSystemMessage, addMessage]);

  const handleAskAgent = useCallback((agentId: string, question: string) => {
    setActiveChannelId(agentId);
    setActiveThread(null);
    setChannels(prev => prev.map(ch =>
      ch.id === agentId ? { ...ch, unreadCount: 0 } : ch
    ));
    handleSendMessage(question, undefined, agentId);
  }, [handleSendMessage]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D1A' }}>
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D1A' }}>
        <div className="w-full max-w-sm mx-auto px-6">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg, #6366F1, #4ECDC4)' }}>
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <h1 className="text-xl font-bold text-white mb-1">Control Tower</h1>
            <p className="text-sm text-white/40">Cleya.ai Administration</p>
          </div>
          {mfaRequired ? (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <p className="text-sm text-white/60 text-center">Enter the 6-digit code from your authenticator app</p>
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">MFA Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white text-center tracking-[0.5em] placeholder-white/30 outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="000000"
                  autoFocus
                />
              </div>
              {mfaError && (
                <div className="text-sm text-red-400 text-center py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)' }}>
                  {mfaError}
                </div>
              )}
              <button
                type="submit"
                disabled={loginLoading || mfaCode.length !== 6}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366F1, #4ECDC4)' }}
              >
                {loginLoading ? 'Verifying...' : 'Verify'}
              </button>
              <button
                type="button"
                onClick={() => { setMfaRequired(false); setMfaCode(''); setMfaError(''); }}
                className="w-full text-sm text-white/40 hover:text-white/60 transition"
              >
                Back to login
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="admin@cleya.ai"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="Password"
                />
              </div>
              {loginError && (
                <div className="text-sm text-red-400 text-center py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)' }}>
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366F1, #4ECDC4)' }}
              >
                {loginLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D1A' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-indigo-300">Loading Control Tower...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080D1A' }}>
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => { setAuthenticated(false); setError(null); setLoading(true); }}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: '#080D1A', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header className="h-11 flex-shrink-0 flex items-center px-4 border-b border-white/[0.06]" style={{ background: 'rgba(8,13,26,0.95)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366F1, #4ECDC4)' }}>
            <span className="text-white text-[10px] font-bold">C</span>
          </div>
          <span className="text-xs font-semibold text-white/70">Control Tower</span>
          <span className="text-[10px] text-white/20 ml-1">Cleya.ai</span>
        </div>
        <button
          onClick={() => { api.logout().then(() => { setAuthenticated(false); setLoading(true); }); }}
          className="text-[11px] text-white/30 hover:text-red-300 transition px-2 py-1"
        >
          Sign out
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <ChannelSidebar
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={handleSelectChannel}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        <ChatPanel
          channel={activeChannel}
          messages={channelMessages}
          onSendMessage={handleSendMessage}
          isLoading={agentLoading}
          thread={activeThread}
          onOpenThread={handleOpenThread}
          onCloseThread={handleCloseThread}
          onSendThreadReply={handleSendThreadReply}
        />

        <InsightsPanel
          channel={activeChannel}
          collapsed={insightsCollapsed}
          onToggle={() => setInsightsCollapsed(!insightsCollapsed)}
          stats={stats}
          commData={commData}
          dealData={dealData}
          eventData={eventData}
          analyticsData={analyticsData}
          whatsappData={whatsappData}
          onLoadComms={loadComms}
          onLoadDeals={loadDeals}
          onLoadEvents={loadEvents}
          onLoadAnalytics={loadAnalytics}
          onLoadWhatsApp={loadWhatsApp}
        />
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectChannel={handleSelectChannel}
        onRunAgent={handleRunAgent}
        onAskAgent={handleAskAgent}
      />
    </div>
  );
}
