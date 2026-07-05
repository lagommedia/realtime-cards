'use client';

import { useEffect, useState, useCallback } from 'react';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return new Uint8Array(Array.from(raw, c => c.charCodeAt(0)));
}

export type PushStatus = 'unsupported' | 'loading' | 'denied' | 'subscribed' | 'unsubscribed';

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  // Register service worker + read existing subscription on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => {
        if (sub) {
          setSubscription(sub);
          setStatus('subscribed');
        } else {
          setStatus(
            Notification.permission === 'denied' ? 'denied' : 'unsubscribed',
          );
        }
      })
      .catch(() => setStatus('unsupported'));
  }, []);

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus('denied');
        return null;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ) as BufferSource,
      });

      setSubscription(sub);
      setStatus('subscribed');
      return sub;
    } catch {
      setStatus('unsubscribed');
      return null;
    }
  }, []);

  const sendPush = useCallback(
    async (payload: {
      title: string;
      body: string;
      url: string;
      tag?: string;
      tier?: 1 | 2 | 3 | 4;
      silent?: boolean;
    }) => {
      let sub = subscription;

      // If not yet subscribed, try to subscribe silently
      if (!sub && status === 'unsubscribed') {
        sub = await subscribe();
      }
      if (!sub) return;

      try {
        await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON(), ...payload }),
        });
      } catch {}
    },
    [subscription, status, subscribe],
  );

  return { status, subscription, subscribe, sendPush };
}
