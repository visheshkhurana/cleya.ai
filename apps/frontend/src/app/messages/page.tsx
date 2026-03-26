'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import MobileNav from '@/components/MobileNav';

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
  };
}

interface ConversationItem {
  partnerId: string;
  partner: Partner;
  lastMessage: string;
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

export default function MessagesPage() {
  const router = useRouter();
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
          setMessages(prev => [...prev, msg]);
          loadConversations();
        }
        if (data.type === 'dm:typing') setTyping(true);
        if (data.type === 'dm:stop_typing') setTyping(false);
        if (data.type === 'dm:read') {
          setMessages(prev => prev.map(m => ({ ...m, readAt: m.readAt || new Date().toISOString() })));
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

  const getPartnerDisplay = (partner: Partner) => {
    return partner.profile?.currentRole || partner.name || partner.email.split('@')[0];
  };

  const selectedConvo = conversations.find(c => c.partnerId === selectedPartner);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
        <div className="w-10 h-10 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans flex flex-col" style={{ background: '#0F172A' }}>
      <header className="sticky top-0 z-10 border-b border-white/5" style={{ background: 'rgba(13,11,26,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm hidden sm:block">← Back</button>
            <h1 className="font-semibold text-white text-sm">Messages</h1>
          </div>
          <div className="sm:hidden"><MobileNav /></div>
        </div>
      </header>

      <div className="flex-1 flex max-w-5xl mx-auto w-full">
        <div className={`w-full sm:w-80 border-r border-white/5 flex-shrink-0 ${selectedPartner ? 'hidden sm:block' : ''}`}>
          <div className="p-3 border-b border-white/5">
            <p className="text-xs font-medium uppercase tracking-wider text-white/30">Conversations</p>
          </div>
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-5xl mb-4">💬</p>
              <p className="text-sm text-white/40">No messages yet</p>
              <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>
                Accept a match to start messaging
              </p>
              <button onClick={() => router.push('/matches')}
                className="mt-4 px-4 py-2 rounded-lg text-xs font-medium text-teal-300 border border-teal-500/20 hover:bg-teal-500/5 transition">
                View Matches
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
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'rgba(13,148,136,0.15)', color: '#5EEAD4' }}>
                      {getPartnerDisplay(convo.partner)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white truncate">{getPartnerDisplay(convo.partner)}</p>
                        {convo.unreadCount > 0 && (
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: '#0D9488' }}>
                            {convo.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>{convo.lastMessage}</p>
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
                <p className="text-sm text-white/40">Select a conversation to start messaging</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-white/5 flex items-center gap-3">
                <button onClick={() => setSelectedPartner(null)} className="sm:hidden text-white/30 hover:text-white/60">
                  ←
                </button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'rgba(13,148,136,0.15)', color: '#5EEAD4' }}>
                  {selectedConvo ? getPartnerDisplay(selectedConvo.partner)[0]?.toUpperCase() : '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {selectedConvo ? getPartnerDisplay(selectedConvo.partner) : ''}
                  </p>
                  {typing && <p className="text-[10px]" style={{ color: '#5EEAD4' }}>typing...</p>}
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
                        background: isMe ? '#0D9488' : '#1E293B',
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
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 border border-white/5 focus:border-teal-500/30 focus:outline-none transition"
                    style={{ background: 'rgba(30,41,59,0.6)' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim() || sending}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-30"
                    style={{ background: '#0D9488' }}>
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
