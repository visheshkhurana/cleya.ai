'use client';

interface ChatBubbleProps {
  sender: 'AI' | 'USER' | 'SYSTEM';
  content: string;
  timestamp?: Date;
}

export function ChatBubble({ sender, content, timestamp }: ChatBubbleProps) {
  const isUser = sender === 'USER';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-boardy-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            B
          </div>
        )}
        <div>
          <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
          </div>
          {timestamp && (
            <p className={`text-[10px] text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
