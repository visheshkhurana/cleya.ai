'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChoiceButtons } from '@/components/chat/ChoiceButtons';
import { DynamicForm } from '@/components/forms/DynamicForm';
import { TypingIndicator } from '@/components/chat/TypingIndicator';

interface Message {
  sender: 'AI' | 'USER';
  content: string;
  nodeId?: string;
  createdAt?: Date;
}

interface FlowNode {
  id: string;
  type: string;
  content?: string;
  choices?: { label: string; value: string; next: string }[];
  formSchema?: any[];
  next?: string | null;
}

const CHAT_STORAGE_KEY = 'cleo_chat_state';

function saveChatState(conversationId: string, messages: Message[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ conversationId, messages, savedAt: Date.now() }));
  } catch {}
}

function loadChatState(): { conversationId: string; messages: Message[] } | null {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentNode, setCurrentNode] = useState<FlowNode | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        api.setToken(urlToken);
        window.history.replaceState({}, '', '/chat');
      }
    }
    startChat();
  }, []);

  useEffect(() => {
    if (conversationId && messages.length > 0) {
      saveChatState(conversationId, messages);
    }
  }, [conversationId, messages]);

  const startChat = async () => {
    try {
      const existingProfile = await api.getProfile().catch(() => null);
      if (existingProfile?.isComplete) {
        setMessages([{
          sender: 'AI',
          content: `Welcome back! Your profile is already set up as a ${(existingProfile.persona || '').replace(/_/g, ' ') || 'member'}. You can update your details from the Profile page, or head to your Dashboard to find matches.`,
          createdAt: new Date(),
        }]);
        setCurrentNode({
          id: 'profile_complete',
          type: 'profile_complete',
        });
        setLoading(false);
        return;
      }

      const saved = loadChatState();
      if (saved && saved.conversationId && saved.messages.length > 0) {
        try {
          const convData = await api.getConversation(saved.conversationId);
          setConversationId(saved.conversationId);
          setMessages(saved.messages.map((m: any) => ({
            ...m,
            createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
          })));
          if (convData.node) {
            setCurrentNode(convData.node);
          }
          setLoading(false);
          return;
        } catch {
          localStorage.removeItem(CHAT_STORAGE_KEY);
        }
      }

      const data = await api.startConversation('onboarding_v1');
      setConversationId(data.conversationId);
      setCurrentNode(data.node);
      if (data.messages) {
        setMessages(data.messages.map((m: any) => ({
          sender: m.sender,
          content: m.content,
          nodeId: m.nodeId,
          createdAt: m.createdAt,
        })));
      }
    } catch (err: any) {
      console.error('Failed to start chat:', err);
      if (err.message?.includes('token') || err.message?.includes('Unauthorized')) {
        window.location.href = '/';
      }
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (input: {
    choiceValue?: string;
    formData?: Record<string, any>;
    textInput?: string;
  }) => {
    if (!conversationId) return;
    const userContent = input.textInput || input.choiceValue || (input.formData ? 'Submitted form' : '');
    if (userContent) {
      setMessages((prev) => [...prev, { sender: 'USER', content: userContent, createdAt: new Date() }]);
    }
    setTyping(true);
    setCurrentNode(null);
    try {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
      const data = await api.sendMessage(conversationId, input);
      if (data.errors) { setCurrentNode(currentNode); setTyping(false); return; }
      if (data.node) {
        setCurrentNode(data.node);
        if (data.node.content) {
          setMessages((prev) => [...prev, { sender: 'AI', content: data.node.content, createdAt: new Date() }]);
        }
        if (data.node.metadata?.action === 'complete_onboarding' || data.node.next === null) {
          localStorage.removeItem(CHAT_STORAGE_KEY);
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 3000);
        }
      }
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setTyping(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage({ textInput: inputText.trim() });
    setInputText('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0B1A' }}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 glow-pulse"
            style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <p className="text-sm text-white/40">Starting conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0D0B1A' }}>
      <header className="px-4 py-3 flex items-center gap-3 sticky top-0 z-10 border-b border-white/5"
        style={{ background: 'rgba(13,11,26,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
          C
        </div>
        <div className="flex-1">
          <h1 className="font-semibold text-white text-sm">Cleo.ai</h1>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <p className="text-xs text-white/40">Active now</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
          >
            Dashboard
          </button>
          <button
            onClick={() => { api.clearToken(); localStorage.removeItem(CHAT_STORAGE_KEY); window.location.href = '/'; }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
          >
            Sign out
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-4 py-6 space-y-1">
        {messages.map((msg, i) => (
          <ChatBubble key={i} sender={msg.sender} content={msg.content} timestamp={msg.createdAt} />
        ))}
        {typing && <TypingIndicator />}
        {currentNode && !typing && (
          <div className="mt-3 fade-up">
            {currentNode.type === 'choices' && currentNode.choices && (
              <ChoiceButtons
                choices={currentNode.choices}
                onSelect={(value) => sendMessage({ choiceValue: value })}
              />
            )}
            {currentNode.type === 'form' && currentNode.formSchema && (
              <DynamicForm
                fields={currentNode.formSchema}
                onSubmit={(data) => sendMessage({ formData: data })}
              />
            )}
            {currentNode.type === 'profile_complete' && (
              <div className="flex gap-2 justify-center mt-4">
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition"
                  style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
                  Go to Dashboard
                </button>
                <button
                  onClick={() => window.location.href = '/profile'}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/60 border border-white/10 hover:border-white/20 hover:text-white/80 transition">
                  Edit Profile
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {currentNode?.type === 'message' && currentNode.next && (
        <div className="px-4 py-4 border-t border-white/5">
          <button
            onClick={() => sendMessage({ textInput: 'Continue' })}
            className="btn-primary"
          >
            Continue →
          </button>
        </div>
      )}

      {currentNode?.type === 'ai_response' && (
        <form onSubmit={handleTextSubmit} className="px-4 py-4 border-t border-white/5">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message Cleo..."
              className="input-dark flex-1"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}
            >
              ↑
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
