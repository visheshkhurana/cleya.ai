import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ParticleNetwork from '@/components/3d/ParticleNetwork';

function mockMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('ParticleNetwork', () => {
  const originalRAF = window.requestAnimationFrame;
  const originalCAF = window.cancelAnimationFrame;

  beforeEach(() => {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) => clearTimeout(id as unknown as NodeJS.Timeout)) as typeof window.cancelAnimationFrame;
    const ctx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as RenderingContext);
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCAF;
    vi.restoreAllMocks();
  });

  it('renders a canvas inside a positioned wrapper', () => {
    mockMatchMedia(false);
    const { container } = render(<ParticleNetwork />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('absolute');
    expect(wrapper.className).toContain('pointer-events-none');
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('does not attach resize/mousemove listeners when prefers-reduced-motion is set', () => {
    mockMatchMedia(true);
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(<ParticleNetwork />);
    const events = addSpy.mock.calls.map((c) => c[0]);
    expect(events).not.toContain('resize');
    expect(events).not.toContain('mousemove');
  });

  it('attaches resize and mousemove listeners when motion is allowed', () => {
    mockMatchMedia(false);
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(<ParticleNetwork />);
    const events = addSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain('resize');
    expect(events).toContain('mousemove');
  });

  it('removes listeners on unmount', () => {
    mockMatchMedia(false);
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const docRemoveSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<ParticleNetwork />);
    unmount();
    const windowEvents = removeSpy.mock.calls.map((c) => c[0]);
    const docEvents = docRemoveSpy.mock.calls.map((c) => c[0]);
    expect(windowEvents).toContain('resize');
    expect(windowEvents).toContain('mousemove');
    expect(docEvents).toContain('visibilitychange');
  });
});
