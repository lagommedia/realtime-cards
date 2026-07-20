'use client';

import Image from 'next/image';
import { useState } from 'react';

interface Props {
  playerId: number;
  playerName: string;
  size?: number;
}

export function getPlayerHeadshotUrl(playerId: number): string {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_180,q_auto:best/v1/people/${playerId}/headshot/67/current`;
}

export default function PlayerHeadshot({ playerId, playerName, size = 48 }: Props) {
  const [errored, setErrored] = useState(false);
  const initials = playerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  if (errored) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: '#ffffff18', fontSize: size * 0.3 }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0 rounded-full overflow-hidden" style={{ width: size, height: size, backgroundColor: '#ffffff10' }}>
      <Image
        src={getPlayerHeadshotUrl(playerId)}
        alt={playerName}
        fill
        unoptimized
        sizes={`${size}px`}
        className="object-contain object-center scale-110"
        onError={() => setErrored(true)}
      />
    </div>
  );
}
