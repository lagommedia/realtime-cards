'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useWatchList } from '@/context/WatchListContext';
import {
  classifyPlay,
  WatchedPlayerEvent,
  LiveGamePlays,
} from '@/lib/play-detector';

const POLL_MS = 30_000;

export function useWatchedPlayerEvents() {
  const { watchedPlayers } = useWatchList();
  const [pendingEvent, setPendingEvent] = useState<WatchedPlayerEvent | null>(null);

  // gameId -> last seen atBatIndex
  const lastSeen = useRef<Record<number, number>>({});
  // `${playerId}-${gameId}` -> Set<hitType> for cycle tracking
  const hitTypes = useRef<Record<string, Set<string>>>({});
  // gameIds we've initialized (skip events on first poll)
  const initialized = useRef<Set<number>>(new Set());

  const processGames = useCallback((games: LiveGamePlays[]) => {
    const watchedIds = new Set(watchedPlayers.map(p => p.playerId));
    if (watchedIds.size === 0) return;

    for (const game of games) {
      if (!game.isLive || game.plays.length === 0) continue;

      // First time seeing this game: record watermark, fire no events
      if (!initialized.current.has(game.gameId)) {
        const max = Math.max(...game.plays.map(p => p.atBatIndex));
        lastSeen.current[game.gameId] = max;
        initialized.current.add(game.gameId);
        continue;
      }

      const watermark = lastSeen.current[game.gameId] ?? -1;
      const newPlays = game.plays.filter(p => p.atBatIndex > watermark);
      if (newPlays.length === 0) continue;

      lastSeen.current[game.gameId] = Math.max(...newPlays.map(p => p.atBatIndex));

      for (const play of newPlays) {
        if (!watchedIds.has(play.batterId)) continue;

        const player = watchedPlayers.find(p => p.playerId === play.batterId);
        if (!player) continue;

        const key = `${play.batterId}-${game.gameId}`;
        if (!hitTypes.current[key]) hitTypes.current[key] = new Set();

        const eventType = classifyPlay(play.event, play.rbi, hitTypes.current[key]);
        if (!eventType) continue;

        const event: WatchedPlayerEvent = {
          id: `${play.batterId}-${play.atBatIndex}`,
          playerId: play.batterId,
          playerName: game.playerNames[play.batterId] ?? player.playerName,
          eventType,
          description: play.description,
          rbi: play.rbi,
          gameId: game.gameId,
          atBatIndex: play.atBatIndex,
          timestamp: Date.now(),
        };

        setPendingEvent(event);
      }
    }
  }, [watchedPlayers]);

  useEffect(() => {
    if (watchedPlayers.length === 0) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/live-plays');
        const data = (await res.json()) as { games: LiveGamePlays[] };
        processGames(data.games);
      } catch {}
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [watchedPlayers, processGames]);

  const clearEvent = useCallback(() => setPendingEvent(null), []);

  return { pendingEvent, clearEvent };
}
