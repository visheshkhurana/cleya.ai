import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TiltCard from '@/components/ui/TiltCard';

describe('TiltCard', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children', () => {
    render(
      <TiltCard>
        <span data-testid="child">Hello</span>
      </TiltCard>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <TiltCard className="custom">
        <span>child</span>
      </TiltCard>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('custom');
    expect(el.className).toContain('relative');
  });

  it('merges custom style', () => {
    const { container } = render(
      <TiltCard style={{ width: '200px' }}>
        <span>child</span>
      </TiltCard>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('200px');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = render(
      <TiltCard onClick={onClick}>
        <span>child</span>
      </TiltCard>,
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('updates transform on mouse move (desktop)', () => {
    const { container } = render(
      <TiltCard>
        <span>child</span>
      </TiltCard>,
    );
    const el = container.firstChild as HTMLElement;
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.mouseEnter(el);
    fireEvent.mouseMove(el, { clientX: 150, clientY: 150 });

    expect(el.style.transform).toContain('rotateX');
    expect(el.style.transform).toContain('scale3d(1.02,1.02,1.02)');
  });

  it('does not apply tilt transform on mobile viewports', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    const { container } = render(
      <TiltCard>
        <span>child</span>
      </TiltCard>,
    );
    const el = container.firstChild as HTMLElement;
    fireEvent.mouseEnter(el);
    fireEvent.mouseMove(el, { clientX: 100, clientY: 100 });
    expect(el.style.transform).not.toContain('scale3d(1.02,1.02,1.02)');
  });

  it('resets transform on mouse leave', () => {
    const { container } = render(
      <TiltCard>
        <span>child</span>
      </TiltCard>,
    );
    const el = container.firstChild as HTMLElement;
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.mouseEnter(el);
    fireEvent.mouseMove(el, { clientX: 150, clientY: 150 });
    fireEvent.mouseLeave(el);

    expect(el.style.transform).toContain('rotateX(0deg)');
    expect(el.style.transform).toContain('rotateY(0deg)');
  });
});
