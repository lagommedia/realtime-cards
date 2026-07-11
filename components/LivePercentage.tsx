'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  value: number;
  direction?: 'up' | 'down' | 'neutral';
  isLive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function LivePercentage({ value, direction = 'neutral', isLive = false, className, style }: Props) {
  const [livePct, setLivePct] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLivePct(value); }, [value]);

  useEffect(() => {
    const intervalMs = isLive ? 2400 : 5500;
    const amplitude = isLive ? 0.22 : 0.08;
    const bias = direction === 'up' ? 0.03 : direction === 'down' ? -0.03 : 0;
    const cap = isLive ? 3.5 : 1.5;

    const id = setInterval(() => {
      setLivePct(prev => {
        const noise = (Math.random() - 0.47) * amplitude;
        const next = parseFloat(
          Math.max(value - cap, Math.min(value + cap, prev + bias + noise)).toFixed(1)
        );
        setFlash(next >= prev ? 'up' : 'down');
        if (flashRef.current) clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => setFlash(null), 500);
        return next;
      });
    }, intervalMs);

    return () => {
      clearInterval(id);
      if (flashRef.current) clearTimeout(flashRef.current);
    };
  }, [isLive, value, direction]);

  const baseColor = livePct > 0 ? '#22c55e' : livePct < 0 ? '#ef4444' : '#9ca3af';
  const color = flash === 'up' ? '#22c55e' : flash === 'down' ? '#ef4444' : baseColor;

  return (
    <span className={className} style={{ color, transition: 'color 0.4s ease-out', ...style }}>
      {livePct >= 0 ? '+' : ''}{livePct.toFixed(1)}%
    </span>
  );
}
