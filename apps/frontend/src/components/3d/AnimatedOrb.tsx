'use client';
import { useEffect, useRef } from 'react';

export default function AnimatedOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let paused = false;
    const size = 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let time = 0;

    const handleVisibility = () => { paused = document.hidden; };
    document.addEventListener('visibilitychange', handleVisibility);

    const draw = () => {
      if (paused) { animId = requestAnimationFrame(draw); return; }

      time += 0.008;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const baseR = canvas.width * 0.35;

      for (let layer = 3; layer >= 0; layer--) {
        const r = baseR + layer * 8;
        const alpha = 0.08 + layer * 0.05;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gradient.addColorStop(0, `rgba(108,99,255,${alpha + 0.1})`);
        gradient.addColorStop(0.6, `rgba(78,205,196,${alpha})`);
        gradient.addColorStop(1, 'rgba(108,99,255,0)');

        ctx.beginPath();
        const points = 100;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const noise = Math.sin(angle * 3 + time * 2 + layer) * 12 +
                        Math.sin(angle * 5 - time * 1.5) * 8 +
                        Math.cos(angle * 2 + time * 3) * 6;
          const pr = r + noise;
          const px = cx + Math.cos(angle) * pr;
          const py = cy + Math.sin(angle) * pr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 0 }}>
      <div className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] opacity-40">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
}
