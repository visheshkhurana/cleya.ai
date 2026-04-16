'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import AppNav from '@/components/AppNav';
import AppFooter from '@/components/AppFooter';
import AppShell from '@/components/AppShell';
import UserAvatar from '@/components/UserAvatar';
import { useTranslation } from '@/lib/i18n';
import { Suspense } from 'react';

interface Partner {
  id: string;
  name?: string;
  email: string;
  profile?: {
    persona?: string;
    headline?: string;
    companyName?: string;
    currentRole?: string;
    location?: string;
    avatarUrl?: string;
  };
}

interface ConversationItem {
  partnerId: string;
  partner: Partner;
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount: number;
}

interface DirectMsg {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt?: string;
  sender: { id: string; name?: string; email: string };
}

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMsg[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [typing, setTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const deepLinkedRef = useRef(false);
  const selectedPartnerRef = useRef<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    api.getMe().then((user) => {
      if (!user) { router.push('/?action=login'); return; }
      api.setToken('authenticated');
      setMe(user);
      loadConversations();
    }).catch(() => router.push('/?action=login'));
  }, []);

  useEffect(() => {
    if (!me) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'dm:new' && data.payload?.message) {
          const msg = data.payload.message;
          const currentPartner = selectedPartnerRef.current;
          if (currentPartner && msg.senderId === currentPartner) {
            setMessages(prev => [...prev, msg]);
          }
          loadConversations();
        }
        if (data.type === 'dm:typing' && data.payload?.userId === selectedPartnerRef.current) setTyping(true);
        if (data.type === 'dm:stop_typing' && data.payload?.userId === selectedPartnerRef.current) setTyping(false);
        if (data.type === 'dm:read') {
          setMessages(prev => prev.map(m => ({ ...m, readAt: m.readAt || new Date().toISOString() })));
        }
        if (data.type === 'match:accepted') {
          loadConversations();
        }
      } catch {}
    };

    return () => { ws.close(); };
  }, [me]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const result = await api.getConversations();
      const convos = Array.isArray(result) ? result : (result?.data || result || []);
      setConversations(convos);

      if (!deepLinkedRef.current) {
        const partnerParam = searchParams.get('partner');
        if (partnerParam) {
          deepLinkedRef.current = true;
          selectPartner(partnerParam);
        }
      }
    } catch {}
    setLoading(false);
  };

  const loadMessages = useCallback(async (partnerId: string) => {
    try {
      const result = await api.getDirectMessages(partnerId);
      const msgs = Array.isArray(result) ? result : (result?.data || result || []);
      setMessages(msgs);
      await api.markConversationRead(partnerId);
      loadConversations();
    } catch {}
  }, []);

  const selectPartner = (partnerId: string) => {
    setSelectedPartner(partnerId);
    selectedPartnerRef.current = partnerId;
    loadMessages(partnerId);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedPartner || sending) return;
    setSending(true);
    try {
      const result = await api.sendDirectMessage(selectedPartner, newMessage.trim());
      const msg = result?.data || result;
      if (msg && msg.id) {
        setMessages(prev => [...prev, msg]);
      }
      setNewMessage('');
      loadConversations();
    } catch {}
    setSending(false);
  };

  const handleTyping = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && selectedPartner) {
      wsRef.current.send(JSON.stringify({ type: 'dm:typing', payload: { recipientId: selectedPartner } }));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        wsRef.current?.send(JSON.stringify({ type: 'dm:stop_typing', payload: { recipientId: selectedPartner } }));
      }, 2000);
    }
  };

  const getPartnerName = (partner: Partner) => {
    return partner.name || partner.profile?.currentRole || partner.email.split('@')[0];
  };

  const getPartnerSubtitle = (partner: Partner) => {
    const parts: string[] = [];
    if (partner.profile?.headline) return partner.profile.headline;
    if (partner.profile?.currentRole) parts.push(partner.profile.currentRole);
    if (partner.profile?.companyName) parts.push(partner.profile.companyName);
    return parts.join(' at ') || partner.profile?.persona || '';
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const selectedConvo = conversations.find(c => c.partnerId === selectedPartner);

  if (loading) {
    return (
      <AppShell className="flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-brand-violet border-t-transparent rounded-full animate-spin" />
      </AppShell>
    );
  }

  return (
    <AppShell className="font-sans flex flex-col">
      <AppNav />

      <div className="flex-1 flex max-w-5xl mx-auto px-6 lg:px-8 w-full">
        <div className={`w-full sm:w-80 border-r border-white/5 flex-shrink-0 ${selectedPartner ? 'hidden sm:block' : ''}`}>
          <div className="p-3 border-b border-white/5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/30">{t('messages.title')}</p>
          </div>
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-5xl mb-4">💬</p>
              <p className="text-sm text-white/40">{t('messages.noConversations')}</p>
              <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
                {t('messages.noConversationsDesc')}
              </p>
              <button onClick={() => router.push('/matches')}
                className="mt-4 px-4 py-2 rounded-lg text-xs font-medium text-brand-violet-hover border border-brand-violet/20 hover:bg-brand-violet/5 transition">
                {t('intro.viewMatches')}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {conversations.map((convo) => (
                <button key={convo.partnerId}
                  onClick={() => selectPartner(convo.partnerId)}
                  className={`w-full p-3 text-left transition hover:bg-white/[0.02] ${
                    selectedPartner === convo.partnerId ? 'bg-white/[0.04]' : ''
                  }`}>
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={getPartnerName(convo.partner)}
                      avatarUrl={convo.partner.profile?.avatarUrl}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white truncate">{getPartnerName(convo.partner)}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px]" style={{ color: '#64748B' }}>{formatTime(convo.lastMessageAt)}</span>
                          {convo.unreadCount > 0 && (
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ background: '#6C63FF' }}>
                              {convo.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      {getPartnerSubtitle(convo.partner) && (
                        <p className="text-[11px] truncate" style={{ color: '#64748B' }}>{getPartnerSubtitle(convo.partner)}</p>
                      )}
                      <p className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>
                        {convo.lastMessage || 'No messages yet — say hello!'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`flex-1 flex flex-col ${!selectedPartner ? 'hidden sm:flex' : ''}`}>
          {!selectedPartner ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-5xl mb-4">💬</p>
                <p className="text-sm text-white/40">{t('messages.selectConversation')}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-white/5 flex items-center gap-3">
                <button onClick={() => { setSelectedPartner(null); selectedPartnerRef.current = null; }} className="sm:hidden text-white/30 hover:text-white/60">
                  ←
                </button>
                <UserAvatar
                  name={selectedConvo ? getPartnerName(selectedConvo.partner) : undefined}
                  avatarUrl={selectedConvo?.partner.profile?.avatarUrl}
                  size="md"
                />
                <div>
                  <p className="text-sm font-medium text-white">
                    {selectedConvo ? getPartnerName(selectedConvo.partner) : ''}
                  </p>
                  {typing ? (
                    <p className="text-[10px]" style={{ color: '#9B95FF' }}>{t('messages.typing')}</p>
                  ) : selectedConvo && getPartnerSubtitle(selectedConvo.partner) ? (
                    <p className="text-[11px]" style={{ color: '#64748B' }}>{getPartnerSubtitle(selectedConvo.partner)}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isMe = msg.senderId === me?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'
                      }`} style={{
                        background: isMe ? '#6C63FF' : 'rgba(15,22,41,0.8)',
                      }}>
                        <p className="text-sm text-white leading-relaxed">{msg.content}</p>
                        <p className="text-[10px] mt-1 text-right" style={{ color: isMe ? 'rgba(255,255,255,0.5)' : '#64748B' }}>
                          {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {isMe && msg.readAt && ' ✓✓'}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={t('messages.typePlaceholder')}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 border border-white/5 focus:border-brand-violet/30 focus:outline-none transition"
                    style={{ background: 'rgba(15,22,41,0.8)' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-30"
                    style={{ background: '#6C63FF' }}>
                    {sending ? '...' : t('messages.send')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <AppFooter />
    </AppShell>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <AppShell className="flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-brand-violet border-t-transparent rounded-full animate-spin" />
      </AppShell>
    }>
      <MessagesContent />
    </Suspense>
  );
}
