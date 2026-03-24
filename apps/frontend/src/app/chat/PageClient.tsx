'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { analytics } from '@/lib/posthog';
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

const ONBOARDING_STEP_MAP: Record<string, number> = {
  welcome: 1,
  persona_select: 1,
  founder_details: 2,
  talent_details: 2,
  investor_details: 2,
  event_details: 2,
  deal_partner_details: 2,
  other_details: 2,
  founder_priority: 3,
  founder_fundraising: 3,
  talent_target_role: 3,
  common_details: 4,
  attribution: 5,
  completion: 5,
};
const ONBOARDING_TOTAL_STEPS = 5;
const ONBOARDING_STEP_LABELS = ['Welcome', 'Profile', 'Goals', 'Details', 'Finish'];

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
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    api.getMe().then((user) => {
      if (!user) {
        sessionStorage.setItem('cleo_login_toast', 'Please log in to access the chat');
        window.location.href = '/?action=login';
        return;
      }
      api.setToken('authenticated');
      startChat();
    }).catch(() => {
      sessionStorage.setItem('cleo_login_toast', 'Please log in to access the chat');
      window.location.href = '/?action=login';
    });
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
        setIsOnboarded(true);
        setMessages([{
          sender: 'AI',
          content: `Welcome back! I'm Cleya, your AI networking assistant. Ask me anything — I can help you find connections, improve your profile, suggest networking strategies, or answer questions about India's startup ecosystem.`,
          createdAt: new Date(),
        }]);
        setCurrentNode({ id: 'ai_chat', type: 'ai_response' });
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
      analytics.onboardingStarted();
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
          analytics.onboardingCompleted(data.node.metadata?.persona || 'unknown');
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
    if (isOnboarded) {
      handleAIChat(inputText.trim());
    } else {
      sendMessage({ textInput: inputText.trim() });
    }
    setInputText('');
  };

  const handleAIChat = async (msg: string) => {
    const userMsg: Message = { sender: 'USER', content: msg, createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setAiLoading(true);
    setTyping(true);
    try {
      const history = messages.map(m => ({ role: m.sender === 'AI' ? 'assistant' as const : 'user' as const, content: m.content }));
      const result = await api.sendAIChat(msg, history);
      setMessages(prev => [...prev, { sender: 'AI', content: result.content, createdAt: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { sender: 'AI', content: "Sorry, I couldn't process that right now. Please try again!", createdAt: new Date() }]);
    } finally {
      setAiLoading(false);
      setTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
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
    <div className="min-h-screen flex flex-col" style={{ background: '#0F172A' }}>
      <header className="px-4 py-3 flex items-center gap-3 sticky top-0 z-10 border-b border-white/5"
        style={{ background: 'rgba(13,11,26,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
          C
        </div>
        <div className="flex-1">
          <h1 className="font-semibold text-white text-sm">Cleya.ai</h1>
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
            onClick={() => { api.logout().then(() => { localStorage.removeItem(CHAT_STORAGE_KEY); window.location.href = '/'; }); }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20"
          >
            Sign out
          </button>
        </div>
      </header>

      {!isOnboarded && currentNode && (
        <div className="px-4 py-3 border-b border-white/5" style={{ background: 'rgba(13,11,26,0.95)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/60">
              Step {ONBOARDING_STEP_MAP[currentNode.id] || 1} of {ONBOARDING_TOTAL_STEPS}
            </span>
            <span className="text-xs text-white/40">
              {ONBOARDING_STEP_LABELS[(ONBOARDING_STEP_MAP[currentNode.id] || 1) - 1]}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${((ONBOARDING_STEP_MAP[currentNode.id] || 1) / ONBOARDING_TOTAL_STEPS) * 100}%`,
                background: 'linear-gradient(90deg, #0D9488, #5EEAD4)',
              }} />
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-4 py-6 space-y-1">
        {messages.length === 0 && !typing && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4"
              style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)', boxShadow: '0 4px 20px rgba(13,148,136,0.3)' }}>
              C
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Hey! I'm Cleya.</h3>
            <p className="text-sm text-white/40 max-w-xs mb-6">Let's get you connected with the right people in India's startup ecosystem.</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {['I\u2019m a founder raising funds', 'I\u2019m looking to invest', 'I\u2019m exploring new roles'].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { sendMessage({ textInput: prompt }); }}
                  className="px-3 py-2 rounded-xl text-xs text-white/60 border border-white/10 hover:border-teal-500/30 hover:text-white/80 transition"
                  style={{ background: 'rgba(13,148,136,0.06)' }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
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

      {(currentNode?.type === 'ai_response' || isOnboarded) && (
        <form onSubmit={handleTextSubmit} className="px-4 py-4 border-t border-white/5">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value.slice(0, 500))}
              placeholder="Message Cleya..."
              className="input-dark flex-1"
              disabled={aiLoading}
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || aiLoading}
              className="px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}
            >
              ↑
            </button>
          </div>
          {inputText.length > 0 && (
            <p className="text-[10px] text-right mt-1" style={{ color: inputText.length >= 480 ? '#f59e0b' : 'rgba(255,255,255,0.2)' }}>
              {inputText.length}/500
            </p>
          )}
        </form>
      )}
    </div>
  );
}
