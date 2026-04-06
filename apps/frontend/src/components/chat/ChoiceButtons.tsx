'use client';

import { useState } from 'react';

interface Choice {
  label: string;
  value: string;
}

interface ChoiceButtonsProps {
  choices: Choice[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function ChoiceButtons({ choices, onSelect, disabled }: ChoiceButtonsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (value: string) => {
    if (disabled || selected) return;
    setSelected(value);
    onSelect(value);
  };

  return (
    <div className="flex flex-col gap-2 mb-3 fade-up" style={{ maxWidth: 'min(85%, calc(100vw - 3rem))' }}>
      {choices.map((choice, i) => (
        <button
          key={choice.value}
          onClick={() => handleSelect(choice.value)}
          disabled={disabled || !!selected}
          className={`choice-button flex items-center gap-3 ${
            selected === choice.value
              ? 'choice-button-selected'
              : selected
              ? 'opacity-30 cursor-not-allowed'
              : ''
          }`}
        >
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
              selected === choice.value
                ? 'bg-brand-violet text-white'
                : 'bg-white/10 text-white/60'
            }`}
          >
            {LETTERS[i] || i + 1}
          </span>
          <span>{choice.label}</span>
        </button>
      ))}
    </div>
  );
}
