import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChoiceButtons } from '@/components/chat/ChoiceButtons';

const choices = [
  { label: 'First', value: 'one' },
  { label: 'Second', value: 'two' },
  { label: 'Third', value: 'three' },
];

describe('ChoiceButtons', () => {
  it('renders all choices with labels', () => {
    render(<ChoiceButtons choices={choices} onSelect={() => {}} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('prefixes each choice with a letter (A, B, C, ...)', () => {
    render(<ChoiceButtons choices={choices} onSelect={() => {}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('falls back to numeric prefix beyond 8 options', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      label: `Opt ${i}`,
      value: `v${i}`,
    }));
    render(<ChoiceButtons choices={many} onSelect={() => {}} />);
    expect(screen.getByText('H')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('calls onSelect with the value when clicked', () => {
    const onSelect = vi.fn();
    render(<ChoiceButtons choices={choices} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Second'));
    expect(onSelect).toHaveBeenCalledWith('two');
  });

  it('only fires onSelect for the first click', () => {
    const onSelect = vi.fn();
    render(<ChoiceButtons choices={choices} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('First'));
    fireEvent.click(screen.getByText('Second'));
    fireEvent.click(screen.getByText('Third'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('one');
  });

  it('disables remaining buttons after a selection', () => {
    render(<ChoiceButtons choices={choices} onSelect={() => {}} />);
    fireEvent.click(screen.getByText('First'));
    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it('marks the selected choice with the selected class', () => {
    render(<ChoiceButtons choices={choices} onSelect={() => {}} />);
    const button = screen.getByText('First').closest('button')!;
    fireEvent.click(button);
    expect(button.className).toContain('choice-button-selected');
  });

  it('does not call onSelect when disabled', () => {
    const onSelect = vi.fn();
    render(<ChoiceButtons choices={choices} onSelect={onSelect} disabled />);
    fireEvent.click(screen.getByText('First'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders buttons as disabled when disabled prop is true', () => {
    render(<ChoiceButtons choices={choices} onSelect={() => {}} disabled />);
    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });
});
