'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { analytics } from '@/lib/posthog';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChoiceButtons } from '@/components/chat/ChoiceButtons';
import { DynamicForm } from '@/components/forms/DynamicForm';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import AppShell from '@/components/AppShell';

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
  metadata?: Record<string, any>;
}

const CHAT_STORAGE_KEY = 'cleo_chat_state';

const ONBOARDING_STEP_MAP: Record<string, number> = {
  welcome: 1,
  persona_select: 1,
  founder_open: 2,
  founder_company_name: 2,
  founder_headline: 2,
  founder_role: 2,
  founder_stage: 2,
  talent_open: 2,
  talent_current_role: 2,
  talent_looking_for: 2,
  talent_experience: 2,
  investor_open: 2,
  investor_fund_name: 2,
  investor_role: 2,
  investor_focus: 2,
  event_name: 2,
  event_role: 2,
  event_headline: 2,
  deal_partner_role: 2,
  deal_partner_focus: 2,
  other_role: 2,
  other_headline: 2,
  other_company: 2,
  founder_deep_dive: 3,
  founder_traction: 3,
  founder_priority: 3,
  founder_raise_amount: 3,
  founder_raised_so_far: 3,
  founder_close_date: 3,
  investor_type: 3,
  investor_stage: 3,
  investor_check_size: 3,
  investor_portfolio: 3,
  talent_target_role: 3,
  talent_stage_pref: 3,
  talent_work_style: 3,
  event_stage: 3,
  event_description: 3,
  founder_industries: 4,
  founder_location: 4,
  founder_linkedin: 4,
  investor_industries: 4,
  investor_location: 4,
  investor_linkedin: 4,
  talent_industries: 4,
  talent_location: 4,
  talent_linkedin: 4,
  event_location: 4,
  deal_partner_location: 4,
  deal_partner_sectors: 4,
  other_industries: 4,
  other_location: 4,
  attribution: 5,
  profile_confirmation: 6,
  completion: 6,
};
const ONBOARDING_TOTAL_STEPS = 6;
const ONBOARDING_STEP_LABELS = ['Welcome', 'About You', 'Details', 'Preferences', 'Source', 'Done'];

function getEstimatedTime(currentStep: number): string {
  const remaining = ONBOARDING_TOTAL_STEPS - currentStep;
  if (remaining <= 0) return 'Almost done!';
  if (remaining <= 1) return '~30 seconds left';
  if (remaining <= 2) return '~1 minute left';
  return `~${remaining} minutes left`;
}

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
  const [redirecting, setRedirecting] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
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

  const loadAIChatHistory = async () => {
    try {
      const historyData = await api.getAIChatHistory();
      if (historyData.messages && historyData.messages.length > 0) {
        const historicalMessages: Message[] = historyData.messages.map((m: any) => ({
          sender: m.sender as 'AI' | 'USER',
          content: m.content,
          createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
        }));
        setMessages([
          {
            sender: 'AI',
            content: `Welcome back! I'm Cleya, your AI networking assistant. Ask me anything — I can help you find connections, improve your profile, suggest networking strategies, or answer questions about India's startup ecosystem.`,
            createdAt: new Date(),
          },
          ...historicalMessages,
        ]);
      } else {
        setMessages([{
          sender: 'AI',
          content: `Welcome back! I'm Cleya, your AI networking assistant. Ask me anything — I can help you find connections, improve your profile, suggest networking strategies, or answer questions about India's startup ecosystem.`,
          createdAt: new Date(),
        }]);
      }
    } catch {
      setMessages([{
        sender: 'AI',
        content: `Welcome back! I'm Cleya, your AI networking assistant. Ask me anything — I can help you find connections, improve your profile, suggest networking strategies, or answer questions about India's startup ecosystem.`,
        createdAt: new Date(),
      }]);
    }
  };

  const startChat = async () => {
    try {
      const existingProfile = await api.getProfile().catch(() => null);
      if (existingProfile?.isComplete) {
        setIsOnboarded(true);
        await loadAIChatHistory();
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
    const userContent = input.textInput || input.choiceValue || (input.formData ? 'Submitted details' : '');
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
          setShowCompletion(true);
          setCurrentNode(null);
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
      const result = await api.sendAIChat(msg, []);
      setMessages(prev => [...prev, { sender: 'AI', content: result.content, createdAt: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { sender: 'AI', content: "Sorry, I couldn't process that right now. Please try again!", createdAt: new Date() }]);
    } finally {
      setAiLoading(false);
      setTyping(false);
    }
  };

  const handleViewMatches = () => {
    setRedirecting(true);
    window.location.href = '/dashboard';
  };

  if (loading) {
    return (
      <AppShell className="flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 glow-pulse"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <p className="text-sm text-white/40">Starting conversation...</p>
        </div>
      </AppShell>
    );
  }

  if (showCompletion && !redirecting) {
    return (
      <AppShell className="flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', boxShadow: '0 8px 32px rgba(59,130,246,0.4)' }}>
            <span className="text-4xl">🎉</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">You're all set!</h2>
          <p className="text-sm text-white/50 mb-2 leading-relaxed">
            Your profile has been created and Cleya is already looking for great connections for you.
          </p>
          <p className="text-sm text-white/40 mb-8 leading-relaxed">
            We'll notify you as soon as we find people worth connecting with. In the meantime, check out your dashboard.
          </p>
          <button
            onClick={handleViewMatches}
            className="px-8 py-4 rounded-2xl font-semibold text-white text-sm transition-all duration-200 hover:scale-105 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}
          >
            View your matches →
          </button>
          <button
            onClick={() => { setShowCompletion(false); setIsOnboarded(true); loadAIChatHistory(); setCurrentNode({ id: 'ai_chat', type: 'ai_response' }); }}
            className="block mx-auto mt-4 text-xs text-white/30 hover:text-white/50 transition"
          >
            or chat with Cleya
          </button>
        </div>
      </AppShell>
    );
  }

  const currentStep = currentNode ? (ONBOARDING_STEP_MAP[currentNode.id] || 1) : 1;

  return (
    <AppShell className="flex flex-col overflow-x-hidden">
      <header className="glass-header">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
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
        <div className="px-6 lg:px-8 py-3 border-b border-white/5" style={{ background: 'rgba(5,5,16,0.9)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-white/60">
              Step {currentStep} of {ONBOARDING_TOTAL_STEPS}
            </span>
            <span className="text-xs text-white/40">
              {getEstimatedTime(currentStep)}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${(currentStep / ONBOARDING_TOTAL_STEPS) * 100}%`,
                background: 'linear-gradient(90deg, #3B82F6, #93C5FD)',
              }} />
          </div>
          <div className="flex justify-between mt-1.5">
            {ONBOARDING_STEP_LABELS.map((label, i) => (
              <span key={label} className={`text-[9px] ${i + 1 <= currentStep ? 'text-blue-400/60' : 'text-white/15'}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden chat-scroll px-6 lg:px-8 py-6 space-y-1 w-full">
        {messages.length === 0 && !typing && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}>
              C
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Hey! I'm Cleya.</h3>
            <p className="text-sm text-white/40 max-w-xs mb-6">Let's get you connected with the right people in India's startup ecosystem.</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {['I\u2019m a founder raising funds', 'I\u2019m looking to invest', 'I\u2019m exploring new roles'].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { sendMessage({ textInput: prompt }); }}
                  className="px-3 py-2 rounded-xl text-xs text-white/60 border border-white/10 hover:border-blue-500/30 hover:text-white/80 transition"
                  style={{ background: 'rgba(59,130,246,0.06)' }}
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
        <div className="px-6 lg:px-8 py-4 border-t border-white/5">
          <button
            onClick={() => sendMessage({ textInput: 'Continue' })}
            className="btn-primary"
          >
            Continue →
          </button>
        </div>
      )}

      {(currentNode?.type === 'ai_response' || isOnboarded) && !redirecting && (
        <form onSubmit={handleTextSubmit} className="px-6 lg:px-8 py-4 border-t border-white/5">
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
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
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
    </AppShell>
  );
}
