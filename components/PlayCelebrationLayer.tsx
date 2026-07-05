'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  WatchedPlayerEvent,
  getEventEmoji,
  getEventLabel,
  getEventColor,
  isPositiveEvent,
} from '@/lib/play-detector';
import {
  getEventNotificationTier,
  getTierAlertLabel,
  TIER_CONFIGS,
  NotificationTier,
} from '@/lib/notification-tiers';
import ConfettiCanvas from '@/components/ConfettiCanvas';
import BaseballEventAnimation from '@/components/BaseballEventAnimation';
import CardValueSurge from '@/components/CardValueSurge';
import EventProjectionChart from '@/components/EventProjectionChart';
import PlayerHeadshot from '@/components/PlayerHeadshot';
import { X, ChevronRight } from 'lucide-react';

interface Props {
  event: WatchedPlayerEvent | null;
  onDismiss: () => void;
  sendPush: (payload: { title: string; body: string; url: string; tag?: string; tier?: 1 | 2 | 3 | 4; silent?: boolean }) => Promise<void>;
}

function playerUrl(id: number) { return `/player/${id}`; }

// ── Tier 1: Full-Screen Takeover ─────────────────────────────────────────────
// Reserved for historic moments that fundamentally move the collector market.
function FullScreenTakeover({ event, onDismiss, onNavigate }: {
  event: WatchedPlayerEvent; onDismiss: () => void; onNavigate: () => void;
}) {
  const color  = getEventColor(event.eventType);
  const isPos  = isPositiveEvent(event.eventType);
  const label  = getTierAlertLabel(event.eventType);
  const emoji  = getEventEmoji(event.eventType);
  const evtLbl = getEventLabel(event.eventType);

  return (
    <>
      <style>{`
        @keyframes fs-pulse {
          0%,100% { opacity: 0.30; }
          50%      { opacity: 0.55; }
        }
        @keyframes fs-pop {
          0%   { transform: scale(0.4) translateY(30px); opacity: 0; }
          65%  { transform: scale(1.08) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes fs-label {
          0%   { letter-spacing: 0.4em; opacity: 0; transform: scale(0.85); }
          60%  { letter-spacing: 0.12em; opacity: 1; transform: scale(1.04); }
          100% { letter-spacing: 0.1em; opacity: 1; transform: scale(1); }
        }
        @keyframes fs-badge {
          0%  { opacity: 0; transform: translateY(-10px); }
          100%{ opacity: 1; transform: translateY(0); }
        }
        .fs-pulse  { animation: fs-pulse 2.2s ease-in-out infinite; }
        .fs-pop    { animation: fs-pop   0.6s 0.05s cubic-bezier(0.175,0.885,0.32,1.275) both; }
        .fs-label  { animation: fs-label 0.7s 0.25s cubic-bezier(0.175,0.885,0.32,1.275) both; }
        .fs-badge  { animation: fs-badge 0.4s 0.05s ease-out both; }
      `}</style>

      {isPos && <ConfettiCanvas intensity="epic" active />}

      <div
        className="fixed inset-0 flex flex-col z-[9999] overflow-hidden"
        style={{ backgroundColor: '#030712' }}
      >
        {/* Animated background glow */}
        <div
          className="fs-pulse absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 30%, ${color}55 0%, transparent 70%)` }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 100%, ${color}22 0%, transparent 60%)` }}
        />

        {/* Dismiss — top right */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 z-10 p-2 rounded-full text-white/40 hover:text-white/80 transition-colors"
          style={{ backgroundColor: '#ffffff12' }}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>

        {/* Alert badge — top center */}
        <div className="fs-badge flex justify-center pt-14">
          <div
            className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest"
            style={{
              backgroundColor: isPos ? `${color}25` : '#ef444425',
              color: isPos ? color : '#ef4444',
              border: `1px solid ${isPos ? color : '#ef4444'}55`,
            }}
          >
            {label}
          </div>
        </div>

        {/* Main content — centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-0">

          {/* Emoji + event label */}
          <div className="fs-pop text-6xl mb-3 leading-none select-none">{emoji}</div>
          <h1
            className="fs-label font-black text-center leading-none mb-5"
            style={{
              fontSize: 'clamp(1.6rem, 7vw, 2.8rem)',
              color: '#fff',
              textShadow: `0 0 60px ${color}cc, 0 2px 0 rgba(0,0,0,0.5)`,
            }}
          >
            {evtLbl}
          </h1>

          {/* Player */}
          <div className="flex items-center gap-3 mb-5">
            <PlayerHeadshot playerId={event.playerId} playerName={event.playerName} size={56} />
            <div>
              <p className="text-white font-black text-xl leading-tight">{event.playerName}</p>
              {event.rbi > 0 && (
                <p className="text-sm font-bold mt-0.5" style={{ color }}>{event.rbi} RBI</p>
              )}
              <p className="text-gray-500 text-xs mt-0.5 leading-snug max-w-[240px]">{event.description}</p>
            </div>
          </div>

          {/* Price impact */}
          <div className="w-full max-w-sm mb-6">
            <EventProjectionChart eventType={event.eventType} color={color} />
          </div>
        </div>

        {/* CTA — fixed at bottom */}
        <div className="px-6 pb-10 space-y-3">
          <button
            onClick={onNavigate}
            className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2"
            style={{ backgroundColor: color, color: '#fff' }}
          >
            View Card &amp; Buy <ChevronRight size={18} />
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-3 rounded-2xl font-semibold text-sm text-white/40"
          >
            Dismiss
          </button>
        </div>
      </div>
    </>
  );
}

// ── Tier 2: Card Overlay ──────────────────────────────────────────────────────
// Major events: HR, grand slam, IL placement. Confetti + animated card modal.
function CardOverlay({ event, onDismiss, onNavigate }: {
  event: WatchedPlayerEvent; onDismiss: () => void; onNavigate: () => void;
}) {
  const isPos = isPositiveEvent(event.eventType);
  const color = getEventColor(event.eventType);

  return (
    <>
      <style>{`
        @keyframes pop-in {
          0%   { transform: scale(0.55) translateY(40px); opacity: 0; }
          70%  { transform: scale(1.06) translateY(-4px); opacity: 1; }
          100% { transform: scale(1) translateY(0);       opacity: 1; }
        }
        @keyframes label-burst {
          0%   { transform: scale(0.4); opacity: 0; letter-spacing: 0.35em; }
          60%  { transform: scale(1.08); opacity: 1; letter-spacing: 0.15em; }
          100% { transform: scale(1);   opacity: 1; letter-spacing: 0.1em; }
        }
        .play-card  { animation: pop-in 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        .play-label { animation: label-burst 0.7s 0.2s cubic-bezier(0.175,0.885,0.32,1.275) both; }
      `}</style>

      {isPos && <ConfettiCanvas intensity="heavy" active />}

      <div
        className="fixed inset-0 flex items-center justify-center p-5 z-[9999]"
        style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
        onClick={onDismiss}
      >
        <div
          className="play-card w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: '#0d1527' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header band */}
          <div
            className="relative overflow-hidden"
            style={{ background: `linear-gradient(180deg, ${color}44 0%, ${color}18 100%)` }}
          >
            <div
              className="absolute inset-0 opacity-15"
              style={{ background: `radial-gradient(circle at 50% 0%, ${color}, transparent 65%)` }}
            />
            <button
              onClick={onDismiss}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-white/50 hover:text-white transition-colors"
              style={{ backgroundColor: '#00000030' }}
            >
              <X size={15} />
            </button>
            <BaseballEventAnimation eventType={event.eventType} color={color} />
            <div className="text-center pb-5 px-4 relative">
              <h2
                className="play-label font-black uppercase"
                style={{
                  fontSize: '1.7rem',
                  color,
                  textShadow: `0 0 40px ${color}dd, 0 2px 0 rgba(0,0,0,0.4)`,
                  letterSpacing: '0.08em',
                }}
              >
                {getEventLabel(event.eventType)}
              </h2>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pt-5 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <PlayerHeadshot playerId={event.playerId} playerName={event.playerName} size={54} />
              <div>
                <p className="text-white font-black text-lg leading-tight">{event.playerName}</p>
                {event.rbi > 0 && (
                  <p className="text-xs font-bold mt-0.5" style={{ color }}>{event.rbi} RBI</p>
                )}
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-5">{event.description}</p>
            <CardValueSurge eventType={event.eventType} color={color} />
            <button
              onClick={onNavigate}
              className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-sm mt-4"
              style={{ backgroundColor: color }}
            >
              View Card &amp; Buy <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Tier 3: Silent Toast ──────────────────────────────────────────────────────
// Notable plays: triple, stolen base, double play. Banner only, auto-dismisses.
function SilentToast({ event, onDismiss, onNavigate }: {
  event: WatchedPlayerEvent; onDismiss: () => void; onNavigate: () => void;
}) {
  const color  = getEventColor(event.eventType);
  const isPos  = isPositiveEvent(event.eventType);

  return (
    <div
      className="fixed left-0 right-0 z-[9999] flex justify-center px-4"
      style={{ top: 'max(env(safe-area-inset-top, 0px) + 12px, 12px)' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl cursor-pointer w-full"
        style={{
          backgroundColor: '#111827',
          borderColor: `${color}55`,
          maxWidth: 400,
        }}
        onClick={onNavigate}
      >
        {/* Left: colored indicator bar */}
        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

        <span className="text-2xl flex-shrink-0">{getEventEmoji(event.eventType)}</span>

        <div className="flex-1 min-w-0">
          <p className="font-black text-sm leading-tight" style={{ color }}>
            {getEventLabel(event.eventType)}
          </p>
          <p className="text-white font-semibold text-sm leading-tight truncate">{event.playerName}</p>
          <p className="text-gray-500 text-xs mt-0.5 truncate">{event.description}</p>
        </div>

        {/* Right: positive/negative indicator + dismiss */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onDismiss(); }}
            className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: isPos ? '#22c55e18' : '#ef444418',
              color: isPos ? '#22c55e' : '#ef4444',
            }}
          >
            {isPos ? 'Bullish' : 'Bearish'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function PlayCelebrationLayer({ event, onDismiss, sendPush }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState<WatchedPlayerEvent | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    setCurrent(null);
    onDismiss();
    if (autoRef.current) clearTimeout(autoRef.current);
  };

  const navigate = () => {
    dismiss();
    if (current) router.push(playerUrl(current.playerId));
  };

  useEffect(() => {
    if (!event) return;
    setCurrent(event);

    const tier   = getEventNotificationTier(event.eventType);
    const config = TIER_CONFIGS[tier];
    const url    = playerUrl(event.playerId);
    const emoji  = getEventEmoji(event.eventType);
    const title  = `${emoji} ${getEventLabel(event.eventType)}!`;
    const body   = `${event.playerName} · ${event.description}`;

    // Send OS push only for tiers 1–3
    if (config.sendPush) {
      sendPush({
        title,
        body,
        url,
        tag: `play-${event.playerId}`,
        tier,
        silent: config.silent,
      }).catch(() => {
        // Fallback: bare Notification API
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const n = new Notification(title, { body, icon: '/icon-192.png', silent: config.silent });
            n.onclick = () => { window.focus(); router.push(url); };
          } catch {}
        }
      });
    }

    // Auto-dismiss for tier 3
    if (autoRef.current) clearTimeout(autoRef.current);
    if (config.autoDismissMs) {
      autoRef.current = setTimeout(dismiss, config.autoDismissMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  if (!current) return null;

  const tier = getEventNotificationTier(current.eventType) as NotificationTier;

  // Tier 4: in-app log only — nothing rendered
  if (tier === 4) return null;

  if (tier === 1) return <FullScreenTakeover event={current} onDismiss={dismiss} onNavigate={navigate} />;
  if (tier === 2) return <CardOverlay        event={current} onDismiss={dismiss} onNavigate={navigate} />;
  return               <SilentToast         event={current} onDismiss={dismiss} onNavigate={navigate} />;
}
