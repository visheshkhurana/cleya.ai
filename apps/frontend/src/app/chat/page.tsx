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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentNode, setCurrentNode] = useState<FlowNode | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, typing]);

  // Start conversation on mount
  useEffect(() => {
    startChat();
  }, []);

  const startChat = async () => {
    try {
      const data = await api.startConversation('onboarding_v1');
      setConversationId(data.conversationId);
      setCurrentNode(data.node);

      if (data.messages) {
        setMessages(
          data.messages.map((m: any) => ({
            sender: m.sender,
            content: m.content,
            nodeId: m.nodeId,
            createdAt: m.createdAt,
          }))
        );
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

    // Add user message to UI
    const userContent =
      input.textInput ||
      input.choiceValue ||
      (input.formData ? 'Submitted form' : '');

    if (userContent) {
      setMessages((prev) => [
        ...prev,
        { sender: 'USER', content: userContent, createdAt: new Date() },
      ]);
    }

    // Show typing indicator
    setTyping(true);
    setCurrentNode(null);

    try {
      // Simulate slight delay for natural feel
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

      const data = await api.sendMessage(conversationId, input);

      if (data.errors) {
        // Form validation errors — re-show form
        setCurrentNode(currentNode);
        setTyping(false);
        return;
      }

      if (data.node) {
        setCurrentNode(data.node);

        if (data.node.content) {
          setMessages((prev) => [
            ...prev,
            { sender: 'AI', content: data.node.content, createdAt: new Date() },
          ]);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-boardy-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-3 animate-pulse">
            B
          </div>
          <p className="text-sm text-gray-500">Starting conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <div className="w-10 h-10 rounded-full bg-boardy-600 flex items-center justify-center text-white font-bold">
          B
        </div>
        <div>
          <h1 className="font-semibold text-gray-900 text-sm">Boardy AI</h1>
          <p className="text-xs text-green-500">Online</p>
        </div>
      </header>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-4 py-4">
        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            sender={msg.sender}
            content={msg.content}
            timestamp={msg.createdAt}
          />
        ))}

        {typing && <TypingIndicator />}

        {/* Interactive elements based on current node */}
        {currentNode && !typing && (
          <div className="mt-2">
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

      {/* Text Input (for message nodes or free text) */}
      {currentNode?.type === 'message' && currentNode.next && (
        <div className="px-4 py-3 bg-white border-t border-gray-200">
          <button
            onClick={() => sendMessage({ textInput: 'Continue' })}
            className="w-full py-3 rounded-xl bg-boardy-600 text-white font-semibold text-sm
                       hover:bg-boardy-700 transition-colors"
          >
            Continue →
          </button>
        </div>
      )}

      {currentNode?.type === 'ai_response' && (
        <form onSubmit={handleTextSubmit} className="px-4 py-3 bg-white border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm
                         focus:outline-none focus:ring-2 focus:ring-boardy-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-5 py-3 rounded-xl bg-boardy-600 text-white font-semibold text-sm
                         hover:bg-boardy-700 transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
