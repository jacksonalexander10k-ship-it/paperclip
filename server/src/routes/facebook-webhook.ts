import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { aygentAgentCredentials } from "@paperclipai/db";
import { facebookAdsService } from "../services/facebook-ads.js";
import { leadIngestionService } from "../services/lead-ingestion.js";
import { logger } from "../middleware/logger.js";

/**
 * Facebook Lead Ads webhook receiver.
 * Mounted BEFORE auth middleware — Facebook needs unauthenticated POST access.
 *
 * Handles:
 * 1. Webhook verification (GET) — Meta sends hub.challenge to confirm subscription
 * 2. Lead form submissions (POST) — Meta sends leadgen change events
 */
export function facebookWebhookRoutes(db: Db) {
  const router = Router();
  const fbAds = facebookAdsService();
  const ingestion = leadIngestionService(db);

  // Webhook verification (GET)
  router.get("/webhook/facebook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      logger.info("facebook-webhook: verified");
      res.status(200).send(challenge);
      return;
    }

    res.sendStatus(403);
  });

  // Lead webhook handler (POST)
  router.post("/webhook/facebook", async (req, res) => {
    // Ack immediately — Facebook retries if it doesn't get a 200 quickly
    res.sendStatus(200);

    try {
      const entries: Array<{ changes?: Array<{ field: string; value: Record<string, unknown> }> }> =
        req.body?.entry ?? [];

      for (const entry of entries) {
        const changes = entry.changes ?? [];
        for (const change of changes) {
          if (change.field !== "leadgen") continue;

          const leadgenId = change.value?.leadgen_id as string | undefined;
          const formId = change.value?.form_id as string | undefined;

          if (!leadgenId) continue;

          logger.info({ leadgenId, formId }, "facebook-webhook: leadgen event received");

          // Find all facebook credentials across all companies and try each
          // until one successfully fetches the lead data.
          // (Meta sends all lead events to the single registered webhook URL.)
          const allFacebookCreds = await db
            .select()
            .from(aygentAgentCredentials)
            .where(eq(aygentAgentCredentials.service, "facebook"));

          let processed = false;
          for (const cred of allFacebookCreds) {
            if (!cred.accessToken) continue;

            try {
              const leadData = await fbAds.getLeadData(cred.accessToken, leadgenId);
              if (!leadData?.field_data) continue;

              // Parse field_data array into a flat key→value object
              const fields: Record<string, string> = {};
              for (const f of leadData.field_data as Array<{ name: string; values?: string[] }>) {
                fields[f.name] = f.values?.[0] ?? "";
              }

              const name =
                fields.full_name ||
                [fields.first_name, fields.last_name].filter(Boolean).join(" ") ||
                null;

              await ingestion.ingestFromPortal(
                cred.companyId,
                cred.agentId,
                {
                  // Cast to the narrow union — the DB column accepts any string
                  source: "facebook_ad" as "property_finder",
                  name,
                  phone: fields.phone_number || fields.phone || null,
                  email: fields.email || null,
                  message: `Facebook Lead Ad submission (form: ${formId ?? "unknown"})`,
                  propertyRef: null,
                },
              );

              logger.info(
                { leadgenId, companyId: cred.companyId },
                "facebook-webhook: lead ingested",
              );
              processed = true;
              break; // Successfully processed — no need to try other credentials
            } catch (err) {
              // This credential didn't work (wrong page, expired token, etc.) — try next
              logger.debug({ err, credId: cred.id }, "facebook-webhook: credential did not match leadgen");
              continue;
            }
          }

          if (!processed) {
            logger.warn({ leadgenId }, "facebook-webhook: no matching credential found for leadgen event");
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "facebook-webhook: unhandled error processing payload");
    }
  });

  return router;
}
