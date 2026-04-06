'use client';
import { useState, useEffect, ComponentType, Component, ReactNode } from 'react';

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

export default function ThreeBackground() {
  const [Canvas, setCanvas] = useState<ComponentType | null>(null);
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    if (!isWebGLAvailable()) {
      setWebglSupported(false);
      return;
    }
    import('./NetworkCanvas').then((mod) => {
      setCanvas(() => mod.default);
    }).catch(() => {
      setWebglSupported(false);
    });
  }, []);

  if (!webglSupported || !Canvas) {
    return <div className="fixed inset-0 z-0" style={{ background: '#080D1A' }} />;
  }

  return (
    <WebGLErrorBoundary fallback={<div className="fixed inset-0" style={{ background: '#080D1A' }} />}>
      <Canvas />
    </WebGLErrorBoundary>
  );
}
