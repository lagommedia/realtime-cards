// Module-level snapshot queues — survive component unmount/remount so the
// broadcast delay doesn't need to re-calibrate when navigating back to a game.
const queues = new Map<string, Array<{ snap: unknown; ts: number }>>();

export function getSnapQueue(gameId: string): Array<{ snap: unknown; ts: number }> {
  if (!queues.has(gameId)) queues.set(gameId, []);
  return queues.get(gameId)!;
}

// Returns true if the queue already contains a snapshot that satisfies delaySec,
// meaning we can skip the calibration wait entirely.
export function queueIsSynced(gameId: string, delaySec: number): boolean {
  if (delaySec === 0) return true;
  const queue = queues.get(gameId);
  if (!queue || queue.length === 0) return false;
  const now = Date.now();
  return queue.some(s => now - s.ts >= delaySec * 1000);
}

// Prune entries older than maxAgeMs to prevent unbounded growth.
export function pruneQueue(gameId: string, maxAgeMs = 300_000): void {
  const queue = queues.get(gameId);
  if (!queue) return;
  const cutoff = Date.now() - maxAgeMs;
  const next = queue.filter(s => s.ts >= cutoff);
  queues.set(gameId, next);
}
