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

export function ChoiceButtons({ choices, onSelect, disabled }: ChoiceButtonsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (value: string) => {
    if (disabled || selected) return;
    setSelected(value);
    onSelect(value);
  };

  return (
    <div className="flex flex-col gap-2 mb-3 max-w-[85%]">
      {choices.map((choice) => (
        <button
          key={choice.value}
          onClick={() => handleSelect(choice.value)}
          disabled={disabled || !!selected}
          className={`choice-button ${
            selected === choice.value
              ? 'choice-button-selected'
              : selected
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
