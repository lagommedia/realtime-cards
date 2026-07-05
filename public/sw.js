// CardTracker MLB — Service Worker
// Handles push notifications and notification clicks.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Vibration patterns per notification tier
const VIBRATE = {
  1: [300, 100, 300, 100, 600],  // Tier 1: dramatic triple burst
  2: [200, 100, 200],            // Tier 2: standard double buzz
  3: [],                         // Tier 3: silent — no vibration
  4: [],                         // Tier 4: no push sent, but safe fallback
};

// ── Push received from server ────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  const tier   = data.tier   ?? 2;
  const silent = data.silent ?? false;
  const title  = data.title  ?? 'CardTracker MLB';

  const options = {
    body:     data.body  ?? '',
    icon:     '/icon-192.png',
    badge:    '/icon-72.png',
    tag:      data.tag   ?? 'cardtracker',
    renotify: true,
    silent,
    data:     { url: data.url ?? '/watchlist', tier },
    vibrate:  VIBRATE[tier] ?? VIBRATE[2],
    actions: tier <= 2
      ? [
          { action: 'view',    title: 'View Card' },
          { action: 'dismiss', title: 'Dismiss' },
        ]
      : [{ action: 'view', title: 'View' }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url ?? '/watchlist';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(targetUrl);
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
