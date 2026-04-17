'use client';

import { Component, type ReactNode } from 'react';

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

/**
 * Catches the Next.js dynamic chunk-load failures that have been observed on
 * the /pricing route. Offers an explicit retry that does a full reload (which
 * clears the stale chunk reference) so users aren't left on a blank page.
 */
export default class PricingErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    const msg = (error?.message || '').toLowerCase();
    const isChunk =
      error?.name === 'ChunkLoadError' ||
      msg.includes('chunkloaderror') ||
      msg.includes('loading chunk') ||
      msg.includes('failed to fetch dynamically imported module');
    return { hasError: true, isChunkError: isChunk };
  }

  componentDidCatch(error: Error) {
    console.error('[PricingErrorBoundary]', error);
  }

  private handleRetry = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#080D1A' }}>
        <div className="max-w-md text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(108,99,255,0.15)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9B95FF" strokeWidth="2">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">We couldn&apos;t load the pricing page</h1>
          <p className="text-sm mb-6" style={{ color: '#94A3B8' }}>
            {this.state.isChunkError
              ? 'A new version of the site is available. Reload to get the latest copy.'
              : 'Something went wrong while loading this page. Please try again.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={this.handleRetry} className="px-5 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#6C63FF' }}>
              Reload page
            </button>
            <a href="/" className="px-5 py-2.5 rounded-lg text-sm font-medium text-white/70 border border-white/10">
              Back to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
