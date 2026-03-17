'use client';

interface ChatBubbleProps {
  sender: 'AI' | 'USER' | 'SYSTEM';
  content: string;
  timestamp?: Date;
}

export function ChatBubble({ sender, content, timestamp }: ChatBubbleProps) {
  const isUser = sender === 'USER';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 fade-up`}>
      <div className={`flex items-end gap-2.5 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1"
            style={{ background: 'linear-gradient(135deg, #6C47FF, #4E2FD8)' }}
          >
            B
          </div>
        )}
        <div>
          <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
          </div>
          {timestamp && (
            <p className={`text-[10px] text-white/20 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
