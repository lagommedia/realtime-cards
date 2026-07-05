'use client';

import Image from 'next/image';
import { getTeamLogoUrl } from '@/lib/team-logos';

interface Props {
  teamId: number;
  abbreviation: string;
  size?: number;
  className?: string;
}

export default function TeamLogo({ teamId, abbreviation, size = 32, className = '' }: Props) {
  const src = getTeamLogoUrl(teamId);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg text-xs font-bold text-white ${className}`}
        style={{ width: size, height: size, backgroundColor: '#ffffff15', fontSize: size * 0.3 }}
      >
        {abbreviation}
      </div>
    );
  }

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <Image
        src={src}
        alt={abbreviation}
        fill
        sizes={`${size}px`}
        className="object-contain drop-shadow-sm"
        onError={(e) => {
          // Fallback to abbreviation text if image fails
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent) {
            parent.innerHTML = `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:#ffffff15;border-radius:8px;font-size:${size * 0.3}px;font-weight:700;color:#fff">${abbreviation}</div>`;
          }
        }}
      />
    </div>
  );
}
