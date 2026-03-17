'use client';

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="flex items-end gap-2">
        <div className="w-8 h-8 rounded-full bg-boardy-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          B
        </div>
        <div className="chat-bubble-ai flex gap-1.5 py-4 px-5">
          <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
          <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
          <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
        </div>
      </div>
    </div>
  );
}
