'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, Channel, AGENT_MAP, Thread } from './types';

interface ChatPanelProps {
  channel: Channel;
  messages: ChatMessage[];
  onSendMessage: (content: string, mentions?: string[]) => void;
  isLoading: boolean;
  thread: Thread | null;
  onOpenThread: (message: ChatMessage) => void;
  onCloseThread: () => void;
  onSendThreadReply: (content: string, threadId: string) => void;
}

export function ChatPanel({
  channel,
  messages,
  onSendMessage,
  isLoading,
  thread,
  onOpenThread,
  onCloseThread,
  onSendThreadReply,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [threadInput, setThreadInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (thread) threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.replies]);

  const parseMentions = useCallback((text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      if (AGENT_MAP[match[1].toLowerCase()]) {
        mentions.push(match[1].toLowerCase());
      }
    }
    return mentions;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowMentions(true);
      setMentionFilter(mentionMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
      setMentionFilter('');
    }
  };

  const insertMention = (agentId: string) => {
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const textBefore = input.slice(0, cursorPos);
    const textAfter = input.slice(cursorPos);
    const beforeMention = textBefore.replace(/@\w*$/, '');
    setInput(`${beforeMention}@${agentId} ${textAfter}`);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const mentions = parseMentions(input);
    onSendMessage(input.trim(), mentions.length > 0 ? mentions : undefined);
    setInput('');
    setShowMentions(false);
  };

  const handleThreadSend = () => {
    if (!threadInput.trim() || !thread || isLoading) return;
    onSendThreadReply(threadInput.trim(), thread.parentMessage.id);
    setThreadInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, isThread = false) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      isThread ? handleThreadSend() : handleSend();
    }
  };

  const filteredAgents = Object.values(AGENT_MAP).filter(a =>
    a.id.includes(mentionFilter) || a.name.toLowerCase().includes(mentionFilter)
  );

  return (
    <div className="flex-1 flex min-w-0">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-3" style={{ background: 'rgba(8,13,26,0.9)' }}>
          <span className="text-lg">{channel.emoji}</span>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white">#{channel.name}</h2>
            <p className="text-[11px] text-white/30 truncate">{channel.description}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1" style={{ background: 'rgba(8,13,26,0.6)' }}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <span className="text-4xl mb-3">{channel.emoji}</span>
              <h3 className="text-lg font-semibold text-white mb-1">#{channel.name}</h3>
              <p className="text-sm text-white/30 max-w-md">{channel.description}</p>
              <p className="text-xs text-white/20 mt-4">Type a message to get started. Use @agent to mention specific agents.</p>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onOpenThread={onOpenThread} />
          ))}
          {isLoading && (
            <div className="flex items-start gap-3 py-2 px-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
              <div className="text-xs text-white/30 mt-2">Agent is thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="px-4 py-3 border-t border-white/[0.06] relative" style={{ background: 'rgba(8,13,26,0.9)' }}>
          {showMentions && filteredAgents.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 mb-1 rounded-xl border border-white/10 overflow-hidden shadow-2xl" style={{ background: 'rgba(15,20,35,0.98)' }}>
              {filteredAgents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => insertMention(agent.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-500/10 transition text-left"
                >
                  <span className="text-sm">{agent.emoji}</span>
                  <div>
                    <span className="text-sm text-white font-medium">{agent.name}</span>
                    <span className="text-xs text-white/30 ml-2">{agent.role}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => handleKeyDown(e)}
              placeholder={`Message #${channel.name}... (use @agent to mention)`}
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder-white/20 resize-none outline-none min-h-[24px] max-h-[120px]"
              style={{ lineHeight: '24px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:bg-white/10 disabled:text-white/20 text-white flex items-center justify-center transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {thread && (
        <div className="w-[340px] min-w-[340px] flex flex-col border-l border-white/[0.06]" style={{ background: 'rgba(8,13,26,0.95)' }}>
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Thread</h3>
            <button onClick={onCloseThread} className="text-white/30 hover:text-white transition p-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            <MessageBubble message={thread.parentMessage} onOpenThread={() => {}} isThreadParent />
            <div className="border-t border-white/[0.06] my-3" />
            <div className="text-[10px] text-white/20 px-2 mb-2">{thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}</div>
            {thread.replies.map((reply) => (
              <MessageBubble key={reply.id} message={reply} onOpenThread={() => {}} />
            ))}
            <div ref={threadEndRef} />
          </div>

          <div className="px-3 py-3 border-t border-white/[0.06]">
            <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <textarea
                value={threadInput}
                onChange={(e) => setThreadInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, true)}
                placeholder="Reply..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/20 resize-none outline-none min-h-[24px] max-h-[80px]"
                style={{ lineHeight: '24px' }}
              />
              <button
                onClick={handleThreadSend}
                disabled={!threadInput.trim() || isLoading}
                className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:bg-white/10 text-white flex items-center justify-center transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, onOpenThread, isThreadParent }: { message: ChatMessage; onOpenThread: (msg: ChatMessage) => void; isThreadParent?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (message.type === 'system-event') {
    return (
      <div className="flex items-center gap-3 py-1.5 px-3">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-[11px] text-white/20 flex-shrink-0">{message.content}</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>
    );
  }

  const isUser = message.sender === 'user';
  const isError = message.type === 'error';
  const isLong = message.content.length > 500;
  const displayContent = isLong && !expanded ? message.content.slice(0, 500) + '...' : message.content;

  const renderContentWithMentions = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /@(\w+)/g;
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const name = match[1];
      if (AGENT_MAP[name.toLowerCase()]) {
        parts.push(
          <span key={key++} className="text-indigo-400 font-medium bg-indigo-500/10 px-1 rounded">@{name}</span>
        );
      } else {
        parts.push(match[0]);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts;
  };

  return (
    <div className={`group flex items-start gap-3 py-1.5 px-3 rounded-lg hover:bg-white/[0.02] transition ${isError ? 'bg-red-500/5' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-indigo-500/20' : isError ? 'bg-red-500/20' : 'bg-white/[0.06]'
      }`}>
        {isUser ? (
          <span className="text-xs font-bold text-indigo-400">You</span>
        ) : (
          <span className="text-sm">{message.agentEmoji || '\uD83E\uDD16'}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={`text-sm font-semibold ${isUser ? 'text-indigo-300' : isError ? 'text-red-300' : 'text-white'}`}>
            {isUser ? 'You' : message.agentName || 'System'}
          </span>
          <span className="text-[10px] text-white/20">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.type === 'run-output' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/60 font-medium">run output</span>
          )}
        </div>
        <div className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${isUser ? 'text-white/80' : isError ? 'text-red-300/80' : 'text-white/70'}`}>
          {renderContentWithMentions(displayContent)}
        </div>
        {isLong && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-indigo-400 mt-1 hover:underline">
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition">
          {!isThreadParent && (
            <button onClick={() => onOpenThread(message)} className="flex items-center gap-1 text-[11px] text-white/20 hover:text-white/40 transition">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {message.threadCount ? `${message.threadCount} replies` : 'Reply in thread'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
