'use client';

import Image from 'next/image';

function LogoImg({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={32}
      height={32}
      className="rounded-lg"
      style={{ objectFit: 'contain' }}
    />
  );
}

export function PlatformIcon({ id }: { id: string }) {
  switch (id) {
    case 'ballpark':
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M16 3 L29 16 L16 29 L3 16 Z" fill="rgba(34,100,60,0.45)" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/>
          <path d="M16 1 L18.5 3.5 L16 6 L13.5 3.5 Z" fill="#f59e0b"/>
          <path d="M27 14.5 L29.5 17 L27 19.5 L24.5 17 Z" fill="#f59e0b"/>
          <path d="M5 14.5 L7.5 17 L5 19.5 L2.5 17 Z" fill="#f59e0b"/>
          <path d="M14 27 L18 27 L19.5 29.5 L16 31.5 L12.5 29.5 Z" fill="white"/>
          <circle cx="16" cy="16" r="1.5" fill="rgba(255,255,255,0.35)"/>
        </svg>
      );

    case 'cable':
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M6 28 C4 17 11 8 22 5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          <path d="M8 27 C7 18 13 11 22 9" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          <path d="M10 26 C10 19 15 14 22 13" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          <line x1="14" y1="21" x2="22" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="22" cy="13" r="2.5" fill="white"/>
          <line x1="13" y1="24" x2="13" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          <line x1="9" y1="30" x2="18" y2="30" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );

    case 'youtube':
      return <LogoImg src="/logos/youtube.png" alt="YouTube TV" />;

    case 'hulu':
      return <LogoImg src="/logos/hulu.png" alt="Hulu" />;

    case 'fubotv':
      return <LogoImg src="/logos/fubotv.png" alt="fuboTV" />;

    case 'apple':
      return <LogoImg src="/logos/appletv.png" alt="Apple TV+" />;

    case 'peacock':
      return <LogoImg src="/logos/peacock.jpg" alt="Peacock" />;

    case 'mlbtv':
      return <LogoImg src="/logos/mlbtv.png" alt="MLB.tv" />;

    default:
      return null;
  }
}
