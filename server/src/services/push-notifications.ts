import webpush from "web-push";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { pushSubscriptions } from "@paperclipai/db";

// Configure VAPID
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:hello@aygencyworld.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string; // URL to open when notification is clicked
  tag?: string; // Group similar notifications
}

export function pushNotificationService(db: Db) {
  return {
    /** Send push notification to all subscriptions for a company */
    sendToCompany: async (companyId: string, payload: PushPayload) => {
      if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
        console.warn("[push] VAPID keys not configured, skipping");
        return;
      }

      const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.companyId, companyId));

      const jsonPayload = JSON.stringify(payload);

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys as { p256dh: string; auth: string },
            },
            jsonPayload,
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired/invalid — remove it
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
            console.log(`[push] Removed expired subscription ${sub.id}`);
          } else {
            console.error(`[push] Failed to send to ${sub.id}:`, err.message);
          }
        }
      }
    },
  };
}
