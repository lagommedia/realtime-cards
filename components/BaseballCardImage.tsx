'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getPlayerHeadshotUrl } from '@/components/PlayerHeadshot';
import { getTeamTheme } from '@/lib/team-themes';

interface Props {
  playerId: number;
  playerName: string;
  teamId: number;
  position: string;
  cardType: string;
  cardYear?: number;
  cardSet?: string;
  /** Live eBay image URL — used as fallback if targeted search fails */
  ebayImageUrl?: string;
  width?: number;
  height?: number;
}

export default function BaseballCardImage({
  playerId, playerName, teamId, position, cardType, cardYear, cardSet,
  ebayImageUrl, width = 90, height = 126,
}: Props) {
  const [ebayErrored, setEbayErrored] = useState(false);
  const [headshotErrored, setHeadshotErrored] = useState(false);
  const [searchedUrl, setSearchedUrl] = useState<string | null>(null);
  const [searchedErrored, setSearchedErrored] = useState(false);
  const theme = getTeamTheme(teamId);

  useEffect(() => {
    setSearchedUrl(null);
    setSearchedErrored(false);
    const params = new URLSearchParams({ player: playerName });
    if (cardYear) params.set('year', String(cardYear));
    if (cardSet) params.set('set', cardSet);
    fetch(`/api/card-image?${params}`)
      .then(r => r.json())
      .then((data: { imageUrl?: string | null }) => {
        if (data.imageUrl) setSearchedUrl(data.imageUrl);
      })
      .catch(() => {});
  }, [playerName, cardYear, cardSet]);

  // Targeted search image takes priority; eBay listing image is fallback
  const activeUrl = (!searchedErrored && searchedUrl) ? searchedUrl
    : (ebayImageUrl && !ebayErrored) ? ebayImageUrl
    : null;

  // ── Real card image ───────────────────────────────────────────────────────
  if (activeUrl) {
    return (
      <div
        className="relative flex-shrink-0 rounded-lg overflow-hidden shadow-lg"
        style={{ width, height, border: '1px solid #ffffff30' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeUrl}
          alt={`${playerName} card`}
          style={{ width, height, objectFit: 'cover' }}
          onError={() => {
            if (searchedUrl && !searchedErrored) setSearchedErrored(true);
            else if (ebayImageUrl && !ebayErrored) setEbayErrored(true);
          }}
        />
      </div>
    );
  }

  // ── Styled mock card (fallback) ───────────────────────────────────────────
  const initials = playerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      className="relative flex-shrink-0 rounded-lg overflow-hidden shadow-xl"
      style={{
        width,
        height,
        background: `linear-gradient(160deg, ${theme.primary}dd 0%, #0a0f1e 100%)`,
        border: `1.5px solid ${theme.primary}88`,
      }}
    >
      {/* Top team color band */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-1.5 py-1 z-10"
        style={{ backgroundColor: `${theme.primary}cc` }}
      >
        <span className="text-white text-[7px] font-black tracking-widest uppercase opacity-90">
          {cardYear ?? (cardType === 'Rookie Card' ? 'RC' : '2024')}
        </span>
        <span className="text-white text-[7px] font-bold opacity-80">{position}</span>
      </div>

      {/* Player headshot */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: 16, bottom: 22 }}>
        {!headshotErrored ? (
          <div className="relative w-full h-full">
            <Image
              src={getPlayerHeadshotUrl(playerId)}
              alt={playerName}
              fill
              sizes={`${width}px`}
              className="object-contain object-center"
              onError={() => setHeadshotErrored(true)}
            />
          </div>
        ) : (
          <div
            className="rounded-full flex items-center justify-center font-black text-white"
            style={{ width: width * 0.55, height: width * 0.55, backgroundColor: '#ffffff18', fontSize: width * 0.18 }}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Bottom name band */}
      <div
        className="absolute bottom-0 left-0 right-0 px-1.5 py-1 z-10"
        style={{ backgroundColor: '#000000cc' }}
      >
        <p className="text-white font-black text-[7px] uppercase tracking-wide leading-tight truncate">
          {playerName.split(' ').slice(-1)[0]}
        </p>
        {(cardType === 'Rookie Card' || cardSet) && (
          <p className="text-yellow-400 font-bold text-[6px] uppercase tracking-widest">
            {cardSet ?? 'Rookie Card'}
          </p>
        )}
      </div>

      {/* Holographic shimmer overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)',
        }}
      />
    </div>
  );
}
