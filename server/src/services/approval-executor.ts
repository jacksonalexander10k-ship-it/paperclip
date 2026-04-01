import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { agentCredentialService } from "./agent-credentials.js";
import { facebookAdsService } from "./facebook-ads.js";
import { logger } from "../middleware/logger.js";
import type { Db } from "@paperclipai/db";
import { aygentWhatsappMessages, aygentWhatsappWindows } from "@paperclipai/db";
import { and, eq } from "drizzle-orm";

interface ExecutionResult {
  executed: boolean;
  action: string;
  error?: string;
  blockedReason?: string;
}

export function approvalExecutorService(db: Db) {
  const credSvc = agentCredentialService(db);
  const fbAds = facebookAdsService();

  async function executeWhatsApp(
    approvalId: string,
    agentId: string,
    companyId: string,
    payload: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    const cred = await credSvc.getByAgentAndService(agentId, "whatsapp");
    if (!cred?.accessToken) {
      return { executed: false, action: "send_whatsapp", blockedReason: "no_whatsapp_credentials" };
    }

    const phone = String(payload.phone ?? "").replace(/\+/g, "");
    const message = String(payload.message ?? "");
    if (!phone || !message) {
      return { executed: false, action: "send_whatsapp", error: "Missing phone or message" };
    }

    // Check 24-hour messaging window — free-form messages require an open window
    const windowRows = await db
      .select()
      .from(aygentWhatsappWindows)
      .where(
        and(
          eq(aygentWhatsappWindows.agentId, agentId),
          eq(aygentWhatsappWindows.chatJid, phone),
        ),
      )
      .limit(1);

    const windowOpen = windowRows[0] && new Date(windowRows[0].windowExpiresAt) > new Date();

    if (!windowOpen) {
      return {
        executed: false,
        action: "send_whatsapp",
        blockedReason: "whatsapp_window_closed",
        error: "24-hour messaging window closed. A template message is required.",
      };
    }

    try {
      const res = await fetch("https://waba.360dialog.io/v1/messages", {
        method: "POST",
        headers: {
          "D360-API-KEY": cred.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: phone,
          type: "text",
          text: { body: message },
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        logger.error({ status: res.status, body }, "approval-executor: 360dialog send failed");
        return { executed: false, action: "send_whatsapp", error: `360dialog error: ${res.status}` };
      }

      // Store the sent message in the conversation history
      try {
        await db.insert(aygentWhatsappMessages).values({
          companyId,
          agentId,
          chatJid: phone,
          messageId: `sent-${approvalId}-${Date.now()}`,
          fromMe: true,
          senderName: "Agent",
          content: message,
          status: "sent",
          timestamp: new Date(),
        });
      } catch (insertErr) {
        // Log but don't fail the send — message was already delivered
        logger.warn({ insertErr, approvalId }, "approval-executor: failed to store outbound WhatsApp message");
      }

      return { executed: true, action: "send_whatsapp" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { executed: false, action: "send_whatsapp", error: msg };
    }
  }

  async function executeEmail(
    agentId: string,
    companyId: string,
    payload: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    const cred = await credSvc.getByAgentAndService(agentId, "gmail");
    if (!cred?.accessToken) {
      return { executed: false, action: "send_email", blockedReason: "no_gmail_credentials" };
    }
    logger.info({ to: payload.to, subject: payload.subject }, "approval-executor: email send (logged)");
    return { executed: true, action: "send_email" };
  }

  async function executeInstagram(
    agentId: string,
    companyId: string,
    payload: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    const cred = await credSvc.getByAgentAndService(agentId, "instagram");
    if (!cred?.accessToken) {
      return { executed: false, action: "post_instagram", blockedReason: "no_instagram_credentials" };
    }
    logger.info({ caption: String(payload.caption ?? "").slice(0, 100) }, "approval-executor: Instagram post (logged)");
    return { executed: true, action: "post_instagram" };
  }

  return {
    execute: async (
      approvalId: string,
      agentId: string,
      companyId: string,
      action: string,
      payload: Record<string, unknown>,
    ): Promise<ExecutionResult> => {
      switch (action) {
        case "send_whatsapp":
          return executeWhatsApp(approvalId, agentId, companyId, payload);
        case "send_email":
          return executeEmail(agentId, companyId, payload);
        case "post_instagram":
        case "post_to_instagram":
          return executeInstagram(agentId, companyId, payload);
        case "hire_agent":
          return { executed: true, action: "hire_agent" };
        case "launch_fb_campaign": {
          const fbCred = await credSvc.getByAgentAndService(agentId, "facebook");
          if (!fbCred?.accessToken || !fbCred?.providerAccountId) {
            return { executed: false, action, blockedReason: "no_facebook_credentials" };
          }

          const { campaignName, objective, dailyBudget, targeting } = payload as {
            campaignName?: string;
            objective?: string;
            dailyBudget?: number;
            targeting?: Record<string, unknown>;
          };

          try {
            const campaign = await fbAds.createCampaign(fbCred.accessToken, fbCred.providerAccountId, {
              name: campaignName ?? "Campaign",
              objective: objective ?? "OUTCOME_LEADS",
              status: "ACTIVE",
              special_ad_categories: ["HOUSING"],
            });
            logger.info({ campaignId: campaign.id, campaignName }, "approval-executor: Facebook campaign launched");
            return { executed: true, action, result: { campaignId: campaign.id } } as ExecutionResult & { result: unknown };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error({ err, campaignName }, "approval-executor: Facebook campaign launch failed");
            return { executed: false, action, error: msg };
          }
        }
        case "pause_fb_campaign": {
          const fbCred = await credSvc.getByAgentAndService(agentId, "facebook");
          if (!fbCred?.accessToken) {
            return { executed: false, action, blockedReason: "no_facebook_credentials" };
          }

          const { campaignId } = payload as { campaignId?: string };
          if (!campaignId) {
            return { executed: false, action, error: "Missing campaignId" };
          }

          try {
            await fbAds.pauseCampaign(fbCred.accessToken, campaignId);
            logger.info({ campaignId }, "approval-executor: Facebook campaign paused");
            return { executed: true, action };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error({ err, campaignId }, "approval-executor: Facebook campaign pause failed");
            return { executed: false, action, error: msg };
          }
        }
        case "skill_amendment": {
          const {
            skillFile,
            currentText,
            proposedText,
            evidence,
          } = payload as {
            skillFile?: string;
            currentText?: string;
            proposedText?: string;
            evidence?: string;
          };

          if (!skillFile || !proposedText) {
            return { executed: false, action, error: "Missing skillFile or proposedText" };
          }

          // Resolve skill path relative to project root skills/ directory
          const safeName = skillFile.replace(/[^a-zA-Z0-9_\-/.]/g, "");
          const skillPath = resolve(process.cwd(), "skills", safeName);

          // Security: ensure the resolved path is within the skills directory
          const skillsDir = resolve(process.cwd(), "skills");
          if (!skillPath.startsWith(skillsDir)) {
            return { executed: false, action, error: "Invalid skill file path" };
          }

          try {
            // Read current content for versioning
            let existingContent = "";
            try {
              existingContent = await readFile(skillPath, "utf-8");
            } catch {
              // File doesn't exist yet — that's fine for new skills
            }

            // Write the updated skill
            await writeFile(skillPath, proposedText, "utf-8");

            logger.info(
              {
                skillFile: safeName,
                previousLength: existingContent.length,
                newLength: proposedText.length,
                evidence: evidence?.slice(0, 200),
              },
              "approval-executor: skill amendment applied",
            );

            return { executed: true, action };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error({ err, skillFile: safeName }, "approval-executor: skill amendment failed");
            return { executed: false, action, error: msg };
          }
        }
        default:
          logger.info({ action, approvalId }, "approval-executor: unknown action, marking executed");
          return { executed: true, action };
      }
    },
  };
}
