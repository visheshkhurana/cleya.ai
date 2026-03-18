'use client';

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="flex items-end gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1"
          style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}
        >
          C
        </div>
        <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-4 flex gap-1.5 shadow-bubble">
          <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
          <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
          <div className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
        </div>
      </div>
    </div>
  );
}
