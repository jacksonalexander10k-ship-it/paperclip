import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { pushSubscriptions } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function pushSubscriptionRoutes(db: Db) {
  const router = Router();

  // Save/update push subscription
  router.post("/companies/:companyId/push-subscription", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);
    const actor = getActorInfo(req);

    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: "endpoint and keys (p256dh, auth) required" });
      return;
    }

    await db
      .insert(pushSubscriptions)
      .values({
        companyId,
        userId: actor.actorId,
        endpoint,
        keys,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptions.endpoint],
        set: { keys, companyId, userId: actor.actorId },
      });

    res.json({ subscribed: true });
  });

  // Remove push subscription
  router.delete("/companies/:companyId/push-subscription", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const { endpoint } = req.body;
    if (!endpoint) {
      res.status(400).json({ error: "endpoint required" });
      return;
    }

    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));

    res.json({ unsubscribed: true });
  });

  return router;
}
