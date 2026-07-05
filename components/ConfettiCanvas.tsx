'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  w: number; h: number;
  rotation: number;
  spin: number;
  opacity: number;
  shape: 'rect' | 'circle' | 'star';
}

interface Props {
  intensity: 'moderate' | 'heavy' | 'epic';
  active: boolean;
}

const PALETTES = {
  moderate: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#fff'],
  heavy:    ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#fff'],
  epic:     ['#f59e0b', '#fbbf24', '#fcd34d', '#ef4444', '#a855f7', '#22c55e', '#3b82f6', '#ec4899', '#fff'],
};

const COUNTS = { moderate: 90, heavy: 170, epic: 280 };

function buildParticles(canvas: HTMLCanvasElement, intensity: Props['intensity']): Particle[] {
  const colors = PALETTES[intensity];
  return Array.from({ length: COUNTS[intensity] }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 180,
    vx: (Math.random() - 0.5) * 7,
    vy: Math.random() * 4 + 1.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    w: Math.random() * 10 + 4,
    h: Math.random() * 5 + 3,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.25,
    opacity: 0.95,
    shape: (['rect', 'rect', 'circle', 'star'] as const)[Math.floor(Math.random() * 4)],
  }));
}

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  const pts = 5;
  const inner = r * 0.42;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const angle = (i * Math.PI) / pts - Math.PI / 2;
    const len = i % 2 === 0 ? r : inner;
    i === 0 ? ctx.moveTo(Math.cos(angle) * len, Math.sin(angle) * len)
             : ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
  }
  ctx.closePath();
  ctx.fill();
}

export default function ConfettiCanvas({ intensity, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = buildParticles(canvas, intensity);
    const ctx = canvas.getContext('2d')!;

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x   += p.vx;
        p.y   += p.vy;
        p.vy  += 0.09;
        p.vx  *= 0.993;
        p.rotation += p.spin;
        if (p.y > canvas.height * 0.55) p.opacity -= 0.014;

        if (p.opacity <= 0 || p.y > canvas.height + 40) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'star') {
          drawStar(ctx, p.w / 2);
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }

      if (particles.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, intensity]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9998 }}
    />
  );
}
