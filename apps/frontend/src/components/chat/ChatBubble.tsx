'use client';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

interface ChatBubbleProps {
  sender: 'AI' | 'USER' | 'SYSTEM';
  content: string;
  timestamp?: Date;
}

export function ChatBubble({ sender, content, timestamp }: ChatBubbleProps) {
  const isUser = sender === 'USER';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 fade-up w-full`}>
      <div className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`} style={{ maxWidth: 'min(85%, calc(100vw - 3rem))' }}>
        {!isUser && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
          >
            C
          </div>
        )}
        <div className="min-w-0">
          <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}>
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{content}</p>
            ) : (
              <div className="text-sm leading-relaxed break-words prose-chat">
                <ReactMarkdown
                  rehypePlugins={[rehypeSanitize]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#93C5FD' }}>
                        {children}
                      </a>
                    ),
                    code: ({ children }) => (
                      <code className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'rgba(255,255,255,0.1)' }}>
                        {children}
                      </code>
                    ),
                    h1: ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold mb-2">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-blue-400/40 pl-3 my-2 text-white/60 italic">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
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
