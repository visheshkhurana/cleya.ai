import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TypingIndicator } from '@/components/chat/TypingIndicator';

describe('TypingIndicator', () => {
  it('renders three animated dots', () => {
    const { container } = render(<TypingIndicator />);
    const dots = container.querySelectorAll('.typing-dot');
    expect(dots).toHaveLength(3);
  });

  it('renders the assistant avatar initial', () => {
    const { container } = render(<TypingIndicator />);
    expect(container.textContent).toContain('C');
  });

  it('aligns the indicator to the start (assistant side)', () => {
    const { container } = render(<TypingIndicator />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('justify-start');
  });
});
