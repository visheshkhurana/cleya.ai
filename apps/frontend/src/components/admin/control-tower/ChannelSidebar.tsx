'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Channel, PRESENCE_COLORS, CHANNEL_COLORS } from './types';
import { useTheme, t } from '@/components/admin/ThemeContext';

interface ChannelSidebarProps {
  channels: Channel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  onOpenCommandPalette: () => void;
}

export function ChannelSidebar({ channels, activeChannelId, onSelectChannel, onOpenCommandPalette }: ChannelSidebarProps) {
  const { isDark } = useTheme();
  const specialChannels = channels.filter(c => c.type === 'special');
  const agentChannels = channels.filter(c => c.type === 'agent');
  const [width, setWidth] = useState(240);
  const isResizing = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(180, Math.min(400, e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div ref={sidebarRef} className="h-full flex flex-col relative flex-shrink-0" style={{ background: t.bgSecondary(isDark), width: `${width}px`, minWidth: '180px', maxWidth: '400px', borderRight: `1px solid ${t.border(isDark)}` }}>
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500/50 z-10 transition-colors"
      />
      <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border(isDark)}` }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #6366F1, #4ECDC4)', boxShadow: '0 4px 14px rgba(99,102,241,0.25)' }}>
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className={`text-sm font-bold leading-tight truncate ${t.textPrimary(isDark)}`}>Control Tower</h1>
            <p className={`text-[10px] uppercase tracking-wider ${t.textDimmed(isDark)}`}>Cleya.ai</p>
          </div>
        </div>
      </div>

      <button
        onClick={onOpenCommandPalette}
        className={`mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition ${t.textMuted(isDark)}`}
        style={{ background: t.bgCard(isDark), border: `1px solid ${t.border(isDark)}` }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <span className="flex-1 text-left">Search...</span>
        <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${t.textDimmed(isDark)}`} style={{ background: t.bgCard(isDark) }}>&#x2318;K</kbd>
      </button>

      <div className="flex-1 overflow-y-auto py-2 space-y-4">
        <div>
          <div className="px-4 mb-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${t.textDimmed(isDark)}`}>Channels</span>
          </div>
          {specialChannels.map(channel => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isActive={activeChannelId === channel.id}
              onClick={() => onSelectChannel(channel.id)}
              isDark={isDark}
            />
          ))}
        </div>

        <div>
          <div className="px-4 mb-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${t.textDimmed(isDark)}`}>Agents</span>
          </div>
          {agentChannels.map(channel => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isActive={activeChannelId === channel.id}
              onClick={() => onSelectChannel(channel.id)}
              isDark={isDark}
            />
          ))}
        </div>
      </div>

      <div className="px-3 py-3" style={{ borderTop: `1px solid ${t.border(isDark)}` }}>
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${t.textMuted(isDark)}`}>
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span>Online</span>
        </div>
      </div>
    </div>
  );
}

function ChannelItem({ channel, isActive, onClick, isDark }: { channel: Channel; isActive: boolean; onClick: () => void; isDark: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-4 py-1.5 text-left transition-all group ${
        isActive
          ? 'bg-indigo-500/10 border-l-2 border-indigo-400'
          : `border-l-2 border-transparent`
      }`}
      style={!isActive ? { ['--tw-bg-opacity' as any]: 1 } : undefined}
      onMouseEnter={(e) => { if (!isActive) (e.currentTarget.style.background = t.bgHover(isDark)); }}
      onMouseLeave={(e) => { if (!isActive) (e.currentTarget.style.background = ''); }}
    >
      <div className="relative flex-shrink-0">
        <span className="text-sm">{channel.emoji}</span>
        {channel.type === 'agent' && (
          <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border ${isDark ? 'border-[#080D1A]' : 'border-white'} ${PRESENCE_COLORS[channel.presence]}`} />
        )}
        {channel.hasNewActivity && !isActive && (
          <div className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        )}
      </div>
      <span className={`text-sm truncate flex-1 ${
        isActive
          ? (isDark ? 'text-white font-medium' : 'text-gray-900 font-medium')
          : (isDark ? 'text-slate-400 group-hover:text-slate-200' : 'text-gray-500 group-hover:text-gray-800')
      }`}>
        #{channel.name}
      </span>
      {channel.unreadCount > 0 && (
        <span className="flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-indigo-500 text-white text-[10px] font-bold px-1">
          {channel.unreadCount}
        </span>
      )}
    </button>
  );
}
