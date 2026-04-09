'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAgentData, CommandAction } from './types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChannel: (channelId: string) => void;
  onRunAgent: (agentId: string) => void;
  onAskAgent: (agentId: string, question: string) => void;
}

function fuzzyMatch(text: string, pattern: string): number {
  const lower = text.toLowerCase();
  const pat = pattern.toLowerCase();
  if (!pat) return 1;
  if (lower === pat) return 100;
  if (lower.startsWith(pat)) return 80;
  if (lower.includes(pat)) return 60;
  let pi = 0;
  let score = 0;
  let consecutive = 0;
  for (let i = 0; i < lower.length && pi < pat.length; i++) {
    if (lower[i] === pat[pi]) {
      score += 10 + consecutive * 5;
      consecutive++;
      pi++;
    } else {
      consecutive = 0;
    }
  }
  return pi === pat.length ? Math.max(score, 1) : 0;
}

export function CommandPalette({ isOpen, onClose, onSelectChannel, onRunAgent, onAskAgent }: CommandPaletteProps) {
  const { agentChannels, agentMap } = useAgentData();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [askMode, setAskMode] = useState<{ agentId: string; agentName: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setAskMode(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isOpen, onClose]);

  const items = useMemo(() => {
    const scored: { item: CommandAction; score: number }[] = [];
    const q = query.trim();

    agentChannels.forEach(ch => {
      const nameScore = fuzzyMatch(ch.name, q);
      const descScore = fuzzyMatch(ch.description, q);
      const score = Math.max(nameScore, descScore);
      if (score > 0) {
        scored.push({
          score,
          item: {
            id: `ch-${ch.id}`,
            label: `#${ch.name}`,
            description: ch.description,
            icon: ch.emoji,
            category: 'channel',
            action: () => { onSelectChannel(ch.id); onClose(); },
          },
        });
      }
    });

    Object.values(agentMap).forEach(agent => {
      const askLabel = `/ask ${agent.name}`;
      const askScore = Math.max(fuzzyMatch(askLabel, q), fuzzyMatch(agent.role, q));
      if (askScore > 0) {
        scored.push({
          score: askScore,
          item: {
            id: `ask-${agent.id}`,
            label: askLabel,
            description: `Ask ${agent.name} (${agent.role}) a question`,
            icon: agent.emoji,
            category: 'command',
            action: () => {
              setAskMode({ agentId: agent.id, agentName: agent.name });
              setQuery('');
              setTimeout(() => inputRef.current?.focus(), 50);
            },
          },
        });
      }

      const runLabel = `/run ${agent.name}`;
      const runScore = Math.max(fuzzyMatch(runLabel, q), fuzzyMatch(agent.name, q));
      if (runScore > 0) {
        scored.push({
          score: runScore,
          item: {
            id: `run-${agent.id}`,
            label: runLabel,
            description: `Trigger ${agent.name} to run now`,
            icon: agent.emoji,
            category: 'command',
            action: () => { onRunAgent(agent.id); onClose(); },
          },
        });
      }
    });

    const staticCmds: { label: string; desc: string; icon: string; id: string; action: () => void }[] = [
      { id: 'cmd-report', label: '/report', desc: 'Generate a performance report', icon: '\uD83D\uDCCA', action: () => { onSelectChannel('founder-room'); onClose(); } },
      { id: 'cmd-schedule', label: '/schedule', desc: 'View and manage agent schedules', icon: '\uD83D\uDCC5', action: () => { onSelectChannel('nexus'); onClose(); } },
      { id: 'cmd-approve', label: '/approve', desc: 'Review and approve pending content', icon: '\u2705', action: () => { onSelectChannel('maven'); onClose(); } },
    ];

    staticCmds.forEach(cmd => {
      const score = Math.max(fuzzyMatch(cmd.label, q), fuzzyMatch(cmd.desc, q));
      if (score > 0) {
        scored.push({
          score,
          item: { id: cmd.id, label: cmd.label, description: cmd.desc, icon: cmd.icon, category: 'command', action: cmd.action },
        });
      }
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.item);
  }, [query, onSelectChannel, onRunAgent, onClose, agentChannels, agentMap]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (askMode) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        onAskAgent(askMode.agentId, query.trim());
        onClose();
      } else if (e.key === 'Escape') {
        setAskMode(null);
        setQuery('');
      } else if (e.key === 'Backspace' && !query) {
        setAskMode(null);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault();
      items[selectedIndex].action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      if (selected) selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const grouped = {
    channel: items.filter(i => i.category === 'channel'),
    command: items.filter(i => i.category === 'command'),
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: 'rgba(15,20,35,0.98)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 flex-shrink-0">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          {askMode && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium flex-shrink-0">
              <span>{agentMap[askMode.agentId]?.emoji}</span>
              <span>Ask {askMode.agentName}</span>
              <button onClick={() => { setAskMode(null); setQuery(''); }} className="ml-1 text-indigo-300/50 hover:text-indigo-300">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </span>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={askMode ? `Type your question for ${askMode.agentName}...` : "Type a command or search... (e.g. /ask, /run, #channel)"}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/20 font-mono">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {askMode ? (
            <div className="text-center py-8">
              <p className="text-sm text-white/30">Type your question and press <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40 font-mono text-xs">Enter</kbd> to send</p>
              <p className="text-xs text-white/15 mt-2">Press <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-white/30 font-mono text-[10px]">Esc</kbd> to go back</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-sm text-white/20">No results found</div>
          ) : null}

          {!askMode && grouped.channel.length > 0 && (
            <>
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-semibold text-white/20 uppercase tracking-wider">Channels</span>
              </div>
              {grouped.channel.map((item, i) => {
                const globalIdx = items.indexOf(item);
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition ${
                      globalIdx === selectedIndex ? 'bg-indigo-500/10' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="text-sm flex-shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white">{item.label}</span>
                      <span className="text-xs text-white/20 ml-2">{item.description}</span>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {!askMode && grouped.command.length > 0 && (
            <>
              <div className="px-4 py-1.5 mt-1">
                <span className="text-[10px] font-semibold text-white/20 uppercase tracking-wider">Commands</span>
              </div>
              {grouped.command.map((item, i) => {
                const globalIdx = items.indexOf(item);
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition ${
                      globalIdx === selectedIndex ? 'bg-indigo-500/10' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="text-sm flex-shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white font-mono">{item.label}</span>
                      <span className="text-xs text-white/20 ml-2">{item.description}</span>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
