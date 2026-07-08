'use client';

import { use, useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CardPrediction, SetCardResult } from '@/types';
import { useTeam } from '@/context/TeamContext';
import { useWatchList } from '@/context/WatchListContext';
import { useGrading, GRADING_COMPANIES, GRADING_GRADES, GradingCompanyId, DEFAULT_GRADE } from '@/context/GradingContext';
import TrendingPlayerCard from '@/components/TrendingPlayerCard';
import PlayerHeadshot from '@/components/PlayerHeadshot';
import { ArrowLeft, Star, ExternalLink } from 'lucide-react';
import { getTeamTheme } from '@/lib/team-themes';

interface TrendingResponse {
  predictions: CardPrediction[];
  usedDummy: boolean;
}

interface SetCardsResponse {
  sets: SetCardResult[];
}

// ── Per-set card swiper ───────────────────────────────────────────────────────

function SetCardSwiper({
  sets,
  theme,
}: {
  sets: SetCardResult[];
  theme: ReturnType<typeof useTeam>['theme'];
}) {
  const [idx, setIdx] = useState(0);
  const touchStartRef = useRef<number | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const topCardInnerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = topCardInnerRef.current;
    if (!el) return;
    el.style.transition = '';
    el.style.transform = '';
    el.style.opacity = '';
  }, [idx]);

  if (sets.length === 0) return null;

  const current = sets[idx];
  const stackCount = Math.min(sets.length - idx, 3);

  function openListing() {
    if (current.itemUrl) window.open(current.itemUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div ref={innerRef}>
      {/* Price + set label */}
      <div className="rounded-xl px-3 py-2.5 mb-3" style={{ backgroundColor: '#ffffff08' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-black text-xl tabular-nums text-white">
              {current.soldPrice != null ? `$${current.soldPrice.toFixed(2)}` : '—'}
            </span>
            <span className="text-xs text-gray-500">last sold</span>
          </div>
          {current.soldDate && (
            <span className="text-[10px] text-gray-600">
              {new Date(current.soldDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <p className="text-gray-500 text-[10px] mt-0.5">
          {current.year} {current.set} RC
        </p>
      </div>

      {/* Card stack */}
      <div className="relative w-full" style={{ aspectRatio: '2.5/3.5' }}>
        {Array.from({ length: stackCount }, (_, depth) => {
          const cardIdx = idx + depth;
          const card = sets[cardIdx];
          const isTop = depth === 0;
          return (
            <div
              key={`${card.set}-${card.year}`}
              className="absolute inset-0 overflow-hidden"
              style={{
                borderRadius: 8,
                zIndex: stackCount - depth,
                transform: `translateY(${depth * 7}px) scale(${1 - depth * 0.04})`,
                transformOrigin: 'top center',
                transition: 'transform 0.25s ease',
                boxShadow: isTop ? '0 6px 28px rgba(0,0,0,0.65)' : '0 2px 10px rgba(0,0,0,0.35)',
              }}
            >
              <div
                ref={isTop ? topCardInnerRef : undefined}
                style={{ width: '100%', height: '100%' }}
                onTouchStart={!isTop ? undefined : e => {
                  touchStartRef.current = e.touches[0].clientX;
                }}
                onTouchMove={!isTop ? undefined : e => {
                  if (touchStartRef.current === null || !topCardInnerRef.current) return;
                  const dx = e.touches[0].clientX - touchStartRef.current;
                  topCardInnerRef.current.style.transition = 'none';
                  topCardInnerRef.current.style.transform = `translateX(${dx}px) rotate(${dx * 0.035}deg)`;
                }}
                onTouchEnd={!isTop ? undefined : e => {
                  if (touchStartRef.current === null) return;
                  const diff = touchStartRef.current - e.changedTouches[0].clientX;
                  touchStartRef.current = null;
                  const el = topCardInnerRef.current;
                  if (!el) return;
                  if (Math.abs(diff) < 8) {
                    // tap — open eBay listing
                    el.style.transition = '';
                    el.style.transform = '';
                    openListing();
                  } else if (diff > 50 && idx < sets.length - 1) {
                    el.style.transition = 'transform 0.28s ease-in, opacity 0.28s ease-in';
                    el.style.transform = 'translateX(-160%) rotate(-15deg)';
                    el.style.opacity = '0';
                    setTimeout(() => setIdx(i => i + 1), 250);
                  } else if (diff < -50 && idx > 0) {
                    el.style.transition = 'transform 0.28s ease-in, opacity 0.28s ease-in';
                    el.style.transform = 'translateX(160%) rotate(15deg)';
                    el.style.opacity = '0';
                    setTimeout(() => setIdx(i => i - 1), 250);
                  } else {
                    el.style.transition = 'transform 0.22s ease-out';
                    el.style.transform = '';
                  }
                }}
                onClick={isTop ? openListing : undefined}
              >
                {/* Card image or placeholder */}
                <div
                  className="w-full h-full flex flex-col items-center justify-center rounded-lg relative overflow-hidden cursor-pointer"
                  style={{ backgroundColor: '#0d1829', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.imageUrl}
                      alt={`${card.year} ${card.set} RC`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 p-4 text-center">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${theme.primary}22` }}
                      >
                        <span className="text-lg font-black" style={{ color: theme.primary }}>
                          {card.shortName}
                        </span>
                      </div>
                      <p className="text-white text-xs font-semibold">{card.year} {card.set}</p>
                      <p className="text-gray-500 text-[10px]">Tap to view on eBay</p>
                    </div>
                  )}
                  {/* eBay link overlay on tap */}
                  {isTop && card.itemUrl && (
                    <div className="absolute bottom-2 right-2">
                      <div
                        className="flex items-center gap-1 px-2 py-1 rounded-full"
                        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                      >
                        <ExternalLink size={9} color="#9ca3af" />
                        <span className="text-[9px] text-gray-400">eBay</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Set tabs + dots */}
      <div className="flex justify-center gap-2 pt-3 flex-wrap">
        {sets.map((s, i) => (
          <button
            key={s.set}
            onClick={() => setIdx(i)}
            className="px-3 py-1 rounded-full text-xs font-bold transition-all"
            style={{
              backgroundColor: i === idx ? `${theme.primary}33` : '#ffffff08',
              color: i === idx ? theme.primary : '#6b7280',
              border: `1px solid ${i === idx ? theme.primary : 'transparent'}`,
            }}
          >
            {s.shortName}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlayerProfilePage({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId: playerIdStr } = use(params);
  const playerId = parseInt(playerIdStr, 10);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTeam();
  const { isWatched, toggleWatch } = useWatchList();
  const { companyId: globalCompanyId, gradeValue: globalGradeValue, setCompanyId, setGradeValue } = useGrading();

  const initCompany: GradingCompanyId = (globalCompanyId as GradingCompanyId) ?? 'psa';
  const [localCompanyId, setLocalCompanyId] = useState<GradingCompanyId>(initCompany);
  const [localGradeValue, setLocalGradeValue] = useState<string>(
    globalGradeValue ?? DEFAULT_GRADE[initCompany]
  );

  function handleCompanyChange(id: GradingCompanyId) {
    setLocalCompanyId(id);
    setCompanyId(id);
    const grade = DEFAULT_GRADE[id];
    setLocalGradeValue(grade);
    setGradeValue(grade);
  }

  function handleGradeChange(grade: string) {
    setLocalGradeValue(grade);
    setGradeValue(grade);
  }

  const fallbackName    = searchParams.get('name')     ?? 'Player';
  const fallbackTeamId  = parseInt(searchParams.get('teamId') ?? '0', 10);
  const fallbackPosition = searchParams.get('position') ?? '';
  const fallbackTheme   = fallbackTeamId ? getTeamTheme(fallbackTeamId) : theme;

  const [prediction, setPrediction]   = useState<CardPrediction | null>(null);
  const [isLive, setIsLive]           = useState(false);
  const [loading, setLoading]         = useState(true);
  const [setCards, setSetCards]       = useState<SetCardResult[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  // ── Fetch prediction ──────────────────────────────────────────────────────
  useEffect(() => {
    const fallbackGameId = searchParams.get('gameId');
    const gradingParams = new URLSearchParams({ grading: localCompanyId, grade: localGradeValue });

    setLoading(true);

    const fromTrending = fetch(`/api/trending?${gradingParams}`)
      .then(r => r.json())
      .then((data: TrendingResponse) => {
        if (!data.usedDummy) setIsLive(true);
        return data.predictions.find(p => p.playerId === playerId) ?? null;
      })
      .catch(() => null);

    const fromGame = fallbackGameId
      ? fetch(`/api/game/${fallbackGameId}?${gradingParams}`)
          .then(r => r.json())
          .then((data: { predictions?: CardPrediction[]; isLive?: boolean }) => {
            if (data.isLive) setIsLive(true);
            return data.predictions?.find(p => p.playerId === playerId) ?? null;
          })
          .catch(() => null)
      : Promise.resolve(null);

    Promise.all([fromTrending, fromGame])
      .then(([trendingResult, gameResult]) => {
        setPrediction(trendingResult ?? gameResult);
      })
      .finally(() => setLoading(false));
  }, [playerId, searchParams, localCompanyId, localGradeValue]);

  // ── Fetch per-set eBay cards once we know the rookie year ─────────────────
  useEffect(() => {
    const rookieYear = prediction?.rookieCardOptions?.[0]?.year ?? 0;
    const name       = prediction?.playerName ?? fallbackName;
    if (!name || !rookieYear) return;

    setLoadingCards(true);
    const qs = new URLSearchParams({
      name,
      year: String(rookieYear),
      grading: localCompanyId,
      grade: localGradeValue,
    });
    fetch(`/api/player/${playerId}/cards?${qs}`)
      .then(r => r.json())
      .then((data: SetCardsResponse) => setSetCards(data.sets ?? []))
      .catch(() => setSetCards([]))
      .finally(() => setLoadingCards(false));
  }, [playerId, prediction?.playerName, prediction?.rookieCardOptions?.[0]?.year, localCompanyId, localGradeValue, fallbackName]);

  const watched = isWatched(playerId);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0f1e' }}>
      {/* Header */}
      <div
        className="px-4 pt-12 pb-4"
        style={{ background: `linear-gradient(180deg, ${theme.primary}44 0%, transparent 100%)` }}
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border border-white/10 text-gray-400"
            style={{ backgroundColor: theme.cardBackground }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-5 w-40 rounded-lg animate-pulse bg-white/10" />
            ) : (
              <h1 className="text-base font-black text-white leading-tight truncate">
                {prediction?.playerName ?? fallbackName}
              </h1>
            )}
            <p className="text-gray-500 text-xs mt-0.5">Card Profile</p>
          </div>
          {(prediction || !loading) && (
            <button
              onClick={() => toggleWatch({
                playerId,
                playerName: prediction?.playerName ?? fallbackName,
                teamId: prediction?.teamId ?? fallbackTeamId,
                position: prediction?.position ?? fallbackPosition,
              })}
              className="p-2 rounded-xl border transition-all"
              style={{
                backgroundColor: watched ? '#f59e0b18' : theme.cardBackground,
                borderColor: watched ? '#f59e0b44' : 'rgba(255,255,255,0.1)',
                color: watched ? '#f59e0b' : '#6b7280',
              }}
            >
              <Star size={18} fill={watched ? '#f59e0b' : 'none'} />
            </button>
          )}
        </div>

        {/* ── Grading picker ── */}
        <div className="mb-3">
          <div className="grid grid-cols-3 gap-2 mb-2">
            {GRADING_COMPANIES.map(c => (
              <button
                key={c.id}
                onClick={() => handleCompanyChange(c.id)}
                className="py-2 px-2 rounded-xl text-xs font-bold text-center transition-all border"
                style={{
                  backgroundColor: localCompanyId === c.id ? `${theme.primary}33` : theme.cardBackground,
                  borderColor: localCompanyId === c.id ? theme.primary : 'rgba(255,255,255,0.1)',
                  color: localCompanyId === c.id ? theme.primary : '#9ca3af',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {GRADING_GRADES[localCompanyId].map(g => (
              <button
                key={g.value}
                onClick={() => handleGradeChange(g.value)}
                className="flex-shrink-0 flex flex-col items-center py-2 px-3 rounded-xl border transition-all"
                style={{
                  backgroundColor: localGradeValue === g.value ? `${theme.primary}33` : theme.cardBackground,
                  borderColor: localGradeValue === g.value ? theme.primary : 'rgba(255,255,255,0.1)',
                }}
              >
                <span className="text-white text-xs font-bold whitespace-nowrap">{g.label}</span>
                <span className="text-gray-400 text-[10px] whitespace-nowrap">{g.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading shimmer */}
      {loading && (
        <div className="px-4 space-y-3">
          <div className="h-20 rounded-2xl animate-pulse bg-white/5" />
          <div className="h-64 rounded-2xl animate-pulse bg-white/5" />
        </div>
      )}

      {/* No prediction fallback */}
      {!loading && !prediction && (
        <div className="px-4 flex flex-col gap-4">
          <div
            className="rounded-2xl p-4 border border-white/10 flex items-center gap-4"
            style={{ backgroundColor: fallbackTheme.cardBackground }}
          >
            <PlayerHeadshot playerId={playerId} playerName={fallbackName} size={64} />
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-lg leading-tight truncate">{fallbackName}</p>
              {fallbackPosition && (
                <p className="text-gray-400 text-sm mt-0.5">{fallbackPosition}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">No card prediction available today</p>
            </div>
            <button
              onClick={() => toggleWatch({ playerId, playerName: fallbackName, teamId: fallbackTeamId, position: fallbackPosition })}
              className="p-2 rounded-xl border transition-all flex-shrink-0"
              style={{
                backgroundColor: isWatched(playerId) ? '#f59e0b18' : fallbackTheme.cardBackground,
                borderColor: isWatched(playerId) ? '#f59e0b44' : 'rgba(255,255,255,0.1)',
                color: isWatched(playerId) ? '#f59e0b' : '#6b7280',
              }}
            >
              <Star size={18} fill={isWatched(playerId) ? '#f59e0b' : 'none'} />
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      {!loading && prediction && (
        <div className="px-4 pb-8 space-y-4">

          {/* ── Rookie card listings (per-set eBay swiper) ── */}
          <div
            className="rounded-2xl p-4 border border-white/10"
            style={{ backgroundColor: theme.cardBackground }}
          >
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Rookie Card Listings
            </p>

            {loadingCards && (
              <div className="space-y-3">
                <div className="h-12 rounded-xl animate-pulse bg-white/5" />
                <div className="rounded-xl animate-pulse bg-white/5" style={{ aspectRatio: '2.5/3.5' }} />
              </div>
            )}

            {!loadingCards && setCards.length > 0 && (
              <SetCardSwiper sets={setCards} theme={theme} />
            )}

            {!loadingCards && setCards.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">
                No eBay listings found for this player
              </p>
            )}
          </div>

          {/* ── Prediction card (price chart + projection, no card stack) ── */}
          <TrendingPlayerCard
            prediction={prediction}
            rank={1}
            defaultChartView={isLive ? 'game' : 'season'}
            isLive={isLive}
            defaultExpanded
            hideCardImage
          />
        </div>
      )}
    </div>
  );
}
