'use client';
import AppShell from '@/components/AppShell';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import NotificationCenter from '../../components/NotificationCenter';
import AppNav from '@/components/AppNav';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: any[];
  createdAt?: string;
}

export default function SecretaryPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    api.getMe().then(data => {
      if (!data) { router.push('/?action=login'); return; }
      setUser(data);
    }).catch(() => router.push('/?action=login'));
  }, [router]);

  useEffect(() => {
    if (!user) return;
    api.secretaryHistory(50).then(data => {
      if (data && Array.isArray(data)) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          role: m.role === 'AI' ? 'assistant' : m.role === 'SYSTEM' ? 'assistant' : 'user',
          content: m.content,
          createdAt: m.createdAt,
        })));
      }
      setHistoryLoaded(true);
    }).catch(() => setHistoryLoaded(true));
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const data = await api.secretaryChat(msg);
      if (data) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.content,
          actions: data.actions,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't process that. Please try again.",
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading]);

  const executeAction = async (action: any, idx: number) => {
    setActionLoading(`${idx}`);
    try {
      const data = await api.secretaryAction(action);
      if (data) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.success
            ? `Done! ${data.message}`
            : `Could not complete: ${data.message}`,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Failed to execute that action. Please try again.",
      }]);
    } finally {
      setActionLoading(null);
    }
  };

  const getDigest = async () => {
    setDigestLoading(true);
    try {
      const data = await api.secretaryDigest();
      if (data) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.digest || data,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Couldn't generate your digest right now.",
      }]);
    } finally {
      setDigestLoading(false);
    }
  };

  const clearHistory = async () => {
    await api.secretaryClearHistory();
    setMessages([]);
  };

  const formatContent = (text: string) => {
    return text
      .replace(/```action[\s\S]*?```/g, '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/•/g, '<br/>•')
      .trim();
  };

  const quickPrompts = [
    { label: "What's my schedule today?", icon: '📅' },
    { label: 'Show me my daily digest', icon: '☀️' },
    { label: 'Help me schedule a meeting', icon: '🤝' },
    { label: 'Draft a follow-up email', icon: '✉️' },
    { label: 'Prepare me for my next call', icon: '📞' },
    { label: 'Who should I connect with?', icon: '🎯' },
  ];

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-cleya-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AppShell className="flex flex-col">
      <AppNav rightContent={<NotificationCenter />} />

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <div className="px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center">
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">Cleya Secretary</p>
              <p className="text-[#5eead4] text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5eead4] inline-block" />
                AI Assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={getDigest} disabled={digestLoading}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs hover:bg-white/10 hover:text-white transition-all disabled:opacity-40"
              title="Get daily digest">
              {digestLoading ? '...' : '☀️ Digest'}
            </button>
            <button onClick={clearHistory}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs hover:bg-white/10 hover:text-white/60 transition-all"
              title="Clear chat history">
              🗑
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {messages.length === 0 && historyLoaded && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3B82F6]/20 to-[#8B5CF6]/20 border border-[#3B82F6]/20 flex items-center justify-center mb-6">
                <span className="text-4xl">🤖</span>
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">
                Hi{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! I'm your AI Secretary
              </h2>
              <p className="text-white/40 text-sm max-w-md mb-8">
                I help you schedule meetings, send follow-ups, prepare for calls, and manage your networking on Cleya.ai. What can I help with?
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg">
                {quickPrompts.map((p, i) => (
                  <button key={i} onClick={() => sendMessage(p.label)}
                    className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/60 text-xs hover:bg-white/[0.08] hover:text-white hover:border-[#3B82F6]/30 transition-all text-left">
                    <span className="mr-1">{p.icon}</span> {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white'
                  : 'bg-[rgba(10,10,26,0.8)] text-white/80 border border-white/[0.06]'
              }`}>
                <div className="text-sm leading-relaxed whitespace-pre-line"
                  dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                    <p className="text-xs text-white/40 font-medium">Suggested Actions:</p>
                    {msg.actions.map((action: any, j: number) => (
                      <button key={j} onClick={() => executeAction(action, i * 100 + j)}
                        disabled={actionLoading === `${i * 100 + j}`}
                        className="w-full text-left px-3 py-2 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 text-[#5eead4] text-xs hover:bg-[#3B82F6]/20 transition-all disabled:opacity-40">
                        {actionLoading === `${i * 100 + j}` ? 'Executing...' : (
                          <>
                            {action.type === 'schedule_meeting' && `📅 Schedule: ${action.title}`}
                            {action.type === 'send_followup' && `✉️ Send follow-up to ${action.to}`}
                            {!['schedule_meeting', 'send_followup'].includes(action.type) && `▶️ ${action.type}`}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[rgba(10,10,26,0.8)] border border-white/[0.06] rounded-2xl px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#5eead4] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#5eead4] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#5eead4] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.06] px-4 py-3">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your secretary anything..."
              className="flex-1 px-4 py-3 rounded-xl bg-[rgba(10,10,26,0.8)] border border-white/[0.08] text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-transparent"
              disabled={loading}
            />
            <button type="submit" disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
