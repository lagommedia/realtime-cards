import { NextRequest, NextResponse } from 'next/server';
import webPush from 'web-push';
import { TIER_CONFIGS, NotificationTier } from '@/lib/notification-tiers';

webPush.setVapidDetails(
  process.env.VAPID_CONTACT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { subscription, title, body, url, tag, tier = 2, silent = false } = (await req.json()) as {
      subscription: webPush.PushSubscription;
      title: string;
      body: string;
      url: string;
      tag?: string;
      tier?: NotificationTier;
      silent?: boolean;
    };

    const config = TIER_CONFIGS[tier as NotificationTier] ?? TIER_CONFIGS[2];

    await webPush.sendNotification(
      subscription,
      JSON.stringify({ title, body, url, tag, tier, silent }),
      {
        urgency: config.urgency,
        TTL: config.ttl,
      },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
