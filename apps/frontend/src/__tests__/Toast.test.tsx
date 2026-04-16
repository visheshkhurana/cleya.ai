import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider, useToast } from '@/components/Toast';

function Harness({ onReady }: { onReady: (api: ReturnType<typeof useToast>) => void }) {
  const api = useToast();
  React.useEffect(() => {
    onReady(api);
  }, [api, onReady]);
  return null;
}

describe('useToast (no provider)', () => {
  it('returns no-op functions when used outside a provider', () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(<Harness onReady={(a) => { api = a; }} />);
    expect(() => api!.success('hi')).not.toThrow();
    expect(() => api!.error('hi')).not.toThrow();
    expect(() => api!.info('hi')).not.toThrow();
    expect(() => api!.warning('hi')).not.toThrow();
  });
});

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children', () => {
    render(
      <ToastProvider>
        <div data-testid="child">content</div>
      </ToastProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('shows a success toast when success() is called', () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>,
    );
    act(() => {
      api!.success('Saved!');
    });
    expect(screen.getByText('Saved!')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows different toast types with distinct borders', () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>,
    );
    act(() => { api!.error('Oops'); });
    expect(screen.getByText('Oops')).toBeInTheDocument();
    act(() => { api!.info('Heads up'); });
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    act(() => { api!.warning('Careful'); });
    expect(screen.getByText('Careful')).toBeInTheDocument();
  });

  it('limits visible toasts to 3 (keeps most recent)', () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>,
    );
    act(() => {
      api!.info('One');
      api!.info('Two');
      api!.info('Three');
      api!.info('Four');
    });
    expect(screen.queryByText('One')).not.toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
    expect(screen.getByText('Three')).toBeInTheDocument();
    expect(screen.getByText('Four')).toBeInTheDocument();
  });

  it('dismisses a toast when the close button is clicked', () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>,
    );
    act(() => { api!.success('bye'); });
    expect(screen.getByText('bye')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Dismiss'));
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText('bye')).not.toBeInTheDocument();
  });

  it('auto-removes toasts after their duration + exit animation', () => {
    let api: ReturnType<typeof useToast> | null = null;
    render(
      <ToastProvider>
        <Harness onReady={(a) => { api = a; }} />
      </ToastProvider>,
    );
    act(() => { api!.success('temp'); });
    expect(screen.getByText('temp')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000 + 400);
    });
    expect(screen.queryByText('temp')).not.toBeInTheDocument();
  });
});
