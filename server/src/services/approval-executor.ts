import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { agentCredentialService } from "./agent-credentials.js";
import { facebookAdsService } from "./facebook-ads.js";
import { baileysSessionManager } from "./baileys-session-manager.js";
import { logger } from "../middleware/logger.js";
import type { Db } from "@paperclipai/db";
import {
  assets,
  aygentWhatsappMessages,
  aygentWhatsappWindows,
  aygentLeads,
  aygentCampaigns,
  aygentViewings,
  issueWorkProducts,
} from "@paperclipai/db";
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
    const phone = String(payload.phone ?? "").replace(/\+/g, "");
    const message = String(payload.message ?? "");
    if (!phone || !message) {
      return { executed: false, action: "send_whatsapp", error: "Missing phone or message" };
    }

    // Check if agent has a Baileys session (preferred — free, no API needed)
    const baileysCred = await credSvc.getByAgentAndService(agentId, "whatsapp_baileys");
    if (baileysCred && baileysSessionManager.isConnected(agentId)) {
      try {
        const result = await baileysSessionManager.sendMessage(agentId, phone, message);
        if (!result.success) {
          return { executed: false, action: "send_whatsapp", error: result.error ?? "Baileys send failed" };
        }

        // Store the sent message in conversation history
        try {
          await db.insert(aygentWhatsappMessages).values({
            companyId,
            agentId,
            chatJid: phone,
            messageId: result.messageId ?? `sent-${approvalId}-${Date.now()}`,
            fromMe: true,
            senderName: "Agent",
            content: message,
            status: "sent",
            timestamp: new Date(),
          });
        } catch (insertErr) {
          logger.warn({ insertErr, approvalId }, "approval-executor: failed to store outbound WhatsApp message");
        }

        return { executed: true, action: "send_whatsapp" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err, agentId }, "approval-executor: Baileys send failed, checking 360dialog fallback");
        // Fall through to 360dialog if Baileys fails
      }
    }

    // Fallback: 360dialog API
    const cred = await credSvc.getByAgentAndService(agentId, "whatsapp");
    if (!cred?.accessToken) {
      if (baileysCred) {
        return { executed: false, action: "send_whatsapp", blockedReason: "baileys_not_connected" };
      }
      return { executed: false, action: "send_whatsapp", blockedReason: "no_whatsapp_credentials" };
    }

    // Check 24-hour messaging window — free-form messages require an open window (360dialog only)
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
        logger.warn({ insertErr, approvalId }, "approval-executor: failed to store outbound WhatsApp message");
      }

      return { executed: true, action: "send_whatsapp" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { executed: false, action: "send_whatsapp", error: msg };
    }
  }

  /** Find the CEO Chat issue for a company (used to attach work products) */
  async function findCeoChatIssueId(companyId: string): Promise<string | null> {
    try {
      const { issueService: getIssueSvc } = await import("./issues.js");
      const issueSvc = getIssueSvc(db);
      const allIssues = await issueSvc.list(companyId);
      const ceoChatIssue = allIssues.find((i) => i.title.startsWith("CEO Chat"));
      return ceoChatIssue?.id ?? null;
    } catch {
      return null;
    }
  }

  /** Store a deliverable as an issue work product */
  async function storeWorkProduct(
    companyId: string,
    issueId: string | null,
    type: string,
    title: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const resolvedIssueId = issueId ?? (await findCeoChatIssueId(companyId));
    if (!resolvedIssueId) {
      logger.warn({ companyId, type }, "approval-executor: no issue found for work product storage");
      return;
    }
    try {
      await db.insert(issueWorkProducts).values({
        companyId,
        issueId: resolvedIssueId,
        type,
        provider: "aygent",
        title,
        url: payload.url ? String(payload.url) : null,
        status: "completed",
        summary: payload.description ? String(payload.description) : payload.summary ? String(payload.summary) : null,
        metadata: payload,
      });
    } catch (err) {
      logger.warn({ err, companyId, type }, "approval-executor: failed to store work product");
    }
  }

  /** Fetch asset file content from storage for email attachment */
  async function fetchAssetContent(
    companyId: string,
    assetId: string,
  ): Promise<{ data: Buffer; contentType: string; filename: string } | null> {
    try {
      const [asset] = await db
        .select()
        .from(assets)
        .where(and(eq(assets.id, assetId), eq(assets.companyId, companyId)));
      if (!asset) return null;

      // Assets stored locally use objectKey as file path
      const filePath = resolve(process.cwd(), "uploads", asset.objectKey);
      const data = await readFile(filePath);
      return {
        data,
        contentType: asset.contentType,
        filename: asset.originalFilename ?? asset.objectKey.split("/").pop() ?? "attachment",
      };
    } catch (err) {
      logger.warn({ err, assetId }, "approval-executor: failed to fetch asset for attachment");
      return null;
    }
  }

  /** Build a MIME multipart email with optional attachments */
  function buildMimeMessage(
    from: string,
    to: string,
    subject: string,
    htmlBody: string,
    attachmentList: Array<{ data: Buffer; contentType: string; filename: string }>,
  ): string {
    if (attachmentList.length === 0) {
      // Simple message — no MIME boundary needed
      return [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `Content-Type: text/html; charset=utf-8`,
        "",
        htmlBody,
      ].join("\r\n");
    }

    // Multipart/mixed with boundary
    const boundary = `----=_AygencyBoundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const parts: string[] = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      "",
      htmlBody,
    ];

    for (const att of attachmentList) {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${att.contentType}; name="${att.filename}"`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        "",
        att.data.toString("base64").replace(/(.{76})/g, "$1\r\n"),
      );
    }

    parts.push(`--${boundary}--`);
    return parts.join("\r\n");
  }

  async function executeEmail(
    agentId: string,
    companyId: string,
    payload: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    const to = String(payload.to ?? "");
    const subject = String(payload.subject ?? "");
    const body = String(payload.body ?? payload.message ?? "");

    if (!to) {
      return { executed: false, action: "send_email", error: "Missing recipient (to)" };
    }

    const cred = await credSvc.getByAgentAndService(agentId, "gmail");
    if (!cred?.accessToken) {
      // Store as work product even without credentials so the content is not lost
      await storeWorkProduct(companyId, null, "email", `Email to ${to}: ${subject}`, payload);
      return { executed: false, action: "send_email", blockedReason: "no_gmail_credentials" };
    }

    // Resolve file attachments from assets table
    const rawAttachments = (payload.attachments ?? []) as Array<{ assetId: string; filename?: string }>;
    const resolvedAttachments: Array<{ data: Buffer; contentType: string; filename: string }> = [];
    for (const att of rawAttachments) {
      const fetched = await fetchAssetContent(companyId, att.assetId);
      if (fetched) {
        resolvedAttachments.push({
          data: fetched.data,
          contentType: fetched.contentType,
          filename: att.filename ?? fetched.filename,
        });
      } else {
        logger.warn({ assetId: att.assetId }, "approval-executor: attachment asset not found, skipping");
      }
    }

    // Build RFC 2822 message (simple or multipart depending on attachments)
    const fromAddress = cred.gmailAddress ?? "me";
    const rawMessage = buildMimeMessage(fromAddress, to, subject, body, resolvedAttachments);

    // Gmail API expects URL-safe base64
    const encoded = Buffer.from(rawMessage).toString("base64url");

    try {
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cred.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encoded }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        logger.error({ status: res.status, errBody, to }, "approval-executor: Gmail send failed");
        // Store as work product so content is preserved
        await storeWorkProduct(companyId, null, "email", `Email to ${to}: ${subject}`, payload);
        return { executed: false, action: "send_email", error: `Gmail API error: ${res.status}` };
      }

      logger.info(
        { to, subject, attachmentCount: resolvedAttachments.length },
        "approval-executor: email sent via Gmail API",
      );
      return { executed: true, action: "send_email" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await storeWorkProduct(companyId, null, "email", `Email to ${to}: ${subject}`, payload);
      return { executed: false, action: "send_email", error: msg };
    }
  }

  async function executeInstagram(
    agentId: string,
    companyId: string,
    payload: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    const caption = String(payload.caption ?? "");
    const imageUrl = payload.imageUrl ?? payload.image_url ?? payload.url;

    const cred = await credSvc.getByAgentAndService(agentId, "instagram");
    if (!cred?.accessToken) {
      // Store the post content as a deliverable so it can be posted manually
      await storeWorkProduct(companyId, null, "instagram_post", caption.slice(0, 80) || "Instagram Post", payload);
      return { executed: false, action: "post_instagram", blockedReason: "no_instagram_credentials" };
    }

    // Attempt to post via Instagram Graph API (requires instagram_content_publish scope)
    const igUserId = cred.providerAccountId;

    if (!igUserId || !imageUrl) {
      // Can't post without user ID or image — store as deliverable
      await storeWorkProduct(companyId, null, "instagram_post", caption.slice(0, 80) || "Instagram Post", payload);
      logger.info({ caption: caption.slice(0, 100) }, "approval-executor: Instagram post stored as deliverable (missing igUserId or imageUrl)");
      return { executed: true, action: "post_instagram" };
    }

    try {
      // Step 1: Create media container
      const containerRes = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: String(imageUrl),
            caption,
            access_token: cred.accessToken,
          }),
        },
      );

      if (!containerRes.ok) {
        const errBody = await containerRes.text();
        logger.error({ status: containerRes.status, errBody }, "approval-executor: Instagram container creation failed");
        await storeWorkProduct(companyId, null, "instagram_post", caption.slice(0, 80) || "Instagram Post", payload);
        return { executed: false, action: "post_instagram", error: `Instagram API error: ${containerRes.status}` };
      }

      const containerData = await containerRes.json() as { id: string };

      // Step 2: Publish the container
      const publishRes = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: containerData.id,
            access_token: cred.accessToken,
          }),
        },
      );

      if (!publishRes.ok) {
        const errBody = await publishRes.text();
        logger.error({ status: publishRes.status, errBody }, "approval-executor: Instagram publish failed");
        await storeWorkProduct(companyId, null, "instagram_post", caption.slice(0, 80) || "Instagram Post", payload);
        return { executed: false, action: "post_instagram", error: `Instagram publish error: ${publishRes.status}` };
      }

      const publishData = await publishRes.json() as { id: string };
      logger.info({ mediaId: publishData.id, caption: caption.slice(0, 100) }, "approval-executor: Instagram post published");

      // Store the published post as a work product with the media ID
      await storeWorkProduct(companyId, null, "instagram_post", caption.slice(0, 80) || "Instagram Post", {
        ...payload,
        mediaId: publishData.id,
        published: true,
      });

      return { executed: true, action: "post_instagram" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await storeWorkProduct(companyId, null, "instagram_post", caption.slice(0, 80) || "Instagram Post", payload);
      return { executed: false, action: "post_instagram", error: msg };
    }
  }

  return {
    execute: async (
      approvalId: string,
      agentId: string,
      companyId: string,
      action: string,
      payload: Record<string, unknown>,
    ): Promise<ExecutionResult> => {
      // --- Multi-option gate: Save as Draft ---
      if (payload._saveAsDraft === true) {
        logger.info({ approvalId, action }, "approval-executor: saved as draft (not executed)");
        return { executed: true, action: `${action}_draft` };
      }

      // --- Multi-option gate: Delayed Execution ---
      const delayMinutes = typeof payload._delayMinutes === "number" ? payload._delayMinutes : 0;
      if (delayMinutes > 0) {
        const delayMs = delayMinutes * 60 * 1000;
        logger.info({ approvalId, action, delayMinutes }, "approval-executor: scheduling delayed execution");
        setTimeout(async () => {
          try {
            // Strip delay flag and execute normally
            const cleanPayload = { ...payload };
            delete cleanPayload._delayMinutes;
            const result = await executeAction(approvalId, agentId, companyId, action, cleanPayload);
            logger.info({ approvalId, action, result: result.executed }, "approval-executor: delayed execution completed");
          } catch (err) {
            logger.error({ err, approvalId, action }, "approval-executor: delayed execution failed");
          }
        }, delayMs);
        return { executed: true, action: `${action}_delayed_${delayMinutes}m` };
      }

      return executeAction(approvalId, agentId, companyId, action, payload);
    },
  };

  // Actual action execution logic — extracted to support delayed execution
  async function executeAction(
    approvalId: string,
    agentId: string,
    companyId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<ExecutionResult> {
      switch (action) {
        case "send_whatsapp":
          return executeWhatsApp(approvalId, agentId, companyId, payload);
        case "use_whatsapp_template":
          // WhatsApp template messages go through the same send path
          return executeWhatsApp(approvalId, agentId, companyId, payload);
        case "send_email":
          return executeEmail(agentId, companyId, payload);
        case "post_instagram":
        case "post_to_instagram":
          return executeInstagram(agentId, companyId, payload);
        case "update_lead_stage": {
          const leadId = String(payload.leadId ?? payload.lead_id ?? "");
          const newStage = String(payload.newStage ?? payload.new_stage ?? payload.stage ?? "");
          if (!leadId || !newStage) {
            return { executed: false, action, error: "Missing leadId or newStage" };
          }
          try {
            await db
              .update(aygentLeads)
              .set({ stage: newStage, updatedAt: new Date() })
              .where(and(eq(aygentLeads.id, leadId), eq(aygentLeads.companyId, companyId)));
            logger.info({ leadId, newStage, companyId }, "approval-executor: lead stage updated");
            return { executed: true, action };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error({ err, leadId, newStage }, "approval-executor: update_lead_stage failed");
            return { executed: false, action, error: msg };
          }
        }
        case "generate_pitch_deck":
        case "send_pitch_deck": {
          const title = String(payload.title ?? payload.name ?? "Pitch Deck");
          await storeWorkProduct(companyId, null, "pitch_deck", title, payload);
          logger.info({ title, companyId }, "approval-executor: pitch deck stored as deliverable");
          return { executed: true, action };
        }
        case "generate_landing_page": {
          const title = String(payload.title ?? payload.name ?? "Landing Page");
          await storeWorkProduct(companyId, null, "landing_page", title, payload);
          logger.info({ title, companyId }, "approval-executor: landing page stored as deliverable");
          return { executed: true, action };
        }
        case "launch_campaign": {
          const campaignName = String(payload.name ?? payload.campaignName ?? payload.campaign_name ?? "Campaign");
          const campaignType = String(payload.type ?? payload.campaignType ?? "drip");
          try {
            const rows = await db
              .insert(aygentCampaigns)
              .values({
                companyId,
                name: campaignName,
                type: campaignType,
                status: "active",
              })
              .returning();
            const campaign = rows[0];
            // Also store as a deliverable for visibility
            await storeWorkProduct(companyId, null, "campaign", campaignName, {
              ...payload,
              campaignId: campaign?.id,
            });
            logger.info({ campaignId: campaign?.id, campaignName, companyId }, "approval-executor: campaign created");
            return { executed: true, action };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error({ err, campaignName }, "approval-executor: launch_campaign failed");
            return { executed: false, action, error: msg };
          }
        }
        case "create_event": {
          const eventTitle = String(payload.title ?? payload.summary ?? "Event");
          const datetime = payload.datetime ?? payload.date ?? payload.start;
          const location = payload.location ?? payload.address ?? "";
          const leadId = payload.leadId ?? payload.lead_id;

          // Attempt Google Calendar API if credentials exist
          const calCred = await credSvc.getByAgentAndService(agentId, "google_calendar");
          let calendarEventId: string | null = null;

          if (calCred?.accessToken && datetime) {
            try {
              const startTime = new Date(String(datetime)).toISOString();
              const endTime = new Date(new Date(String(datetime)).getTime() + 60 * 60 * 1000).toISOString(); // +1 hour
              const calRes = await fetch(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${calCred.accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    summary: eventTitle,
                    location: location ? String(location) : undefined,
                    start: { dateTime: startTime },
                    end: { dateTime: endTime },
                    description: payload.description ? String(payload.description) : undefined,
                  }),
                },
              );
              if (calRes.ok) {
                const calData = await calRes.json() as { id: string };
                calendarEventId = calData.id;
                logger.info({ calendarEventId, eventTitle }, "approval-executor: Google Calendar event created");
              } else {
                const errBody = await calRes.text();
                logger.warn({ status: calRes.status, errBody }, "approval-executor: Google Calendar API failed, storing viewing record only");
              }
            } catch (err) {
              logger.warn({ err }, "approval-executor: Google Calendar call failed, storing viewing record only");
            }
          } else if (!calCred?.accessToken) {
            logger.info({ agentId }, "approval-executor: no Google Calendar credentials, storing viewing record only");
          }

          // Always create a viewing record
          try {
            await db.insert(aygentViewings).values({
              companyId,
              agentId,
              leadId: leadId ? String(leadId) : null,
              calendarEventId,
              datetime: datetime ? new Date(String(datetime)) : null,
              location: location ? String(location) : null,
              status: "scheduled",
              notes: payload.notes ? String(payload.notes) : null,
            });
          } catch (err) {
            logger.warn({ err }, "approval-executor: failed to insert viewing record");
          }

          // Also store as a deliverable
          await storeWorkProduct(companyId, null, "event", eventTitle, {
            ...payload,
            calendarEventId,
          });

          logger.info({ eventTitle, companyId, calendarEventId }, "approval-executor: create_event executed");
          return { executed: true, action };
        }
        case "hire_agent":
          return { executed: true, action: "hire_agent" };
        case "hire_team": {
          // Create agents from the approved team proposal
          const { agentService: getAgentSvc } = await import("./agents.js");
          const agentSvc = getAgentSvc(db);
          const agentList = (payload.agents ?? []) as Array<{
            name?: string; defaultName?: string; role: string; title: string; department: string;
          }>;
          const ceoAgent = (await agentSvc.list(companyId)).find((a) => a.role === "ceo");

          const hiredNames: string[] = [];
          for (const agent of agentList) {
            const agentName = agent.name || agent.defaultName || agent.title;
            try {
              await agentSvc.create(companyId, {
                name: agentName,
                role: agent.role,
                title: agent.title,
                adapterType: "claude_local",
                adapterConfig: { model: ceoAgent?.adapterConfig && typeof ceoAgent.adapterConfig === "object" && "model" in ceoAgent.adapterConfig ? String(ceoAgent.adapterConfig.model) : "claude-sonnet-4-6" },
                ...(ceoAgent ? { reportsTo: ceoAgent.id } : {}),
              });
              hiredNames.push(agentName);
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              const errStack = err instanceof Error ? err.stack : undefined;
              logger.error({ errMsg, errStack, agentName: agent.name, agentRole: agent.role, companyId }, "approval-executor: failed to create agent from hire_team");
            }
          }

          // Post a follow-up message in the CEO Chat issue
          if (hiredNames.length > 0 && ceoAgent) {
            try {
              const { issueService: getIssueSvc } = await import("./issues.js");
              const issueSvc = getIssueSvc(db);
              const allIssues = await issueSvc.list(companyId);
              const ceoChatIssue = allIssues.find((i) => i.title.startsWith("CEO Chat"));
              if (ceoChatIssue) {
                const nameList = hiredNames.join(", ");
                const followUp = `Your team is live. ${nameList} are ready. Want me to show you around, or should we get to work?`;
                await issueSvc.addComment(ceoChatIssue.id, followUp, { agentId: ceoAgent.id });
              }
            } catch (err) {
              logger.warn({ err, companyId }, "approval-executor: failed to post hire_team follow-up comment");
            }
          }

          logger.info({ companyId, agentCount: agentList.length }, "approval-executor: hire_team executed");
          return { executed: true, action: "hire_team" };
        }
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
        case "bulk_whatsapp": {
          // Bulk WhatsApp sends each message individually via the WhatsApp executor
          const recipients = (payload.recipients ?? payload.leads ?? []) as Array<{ phone: string; message: string; name?: string }>;
          let sent = 0;
          let failed = 0;
          for (const r of recipients) {
            try {
              const result = await executeWhatsApp(approvalId, agentId, companyId, { phone: r.phone, message: r.message });
              if (result.executed) sent++; else failed++;
            } catch { failed++; }
          }
          logger.info({ approvalId, sent, failed, total: recipients.length }, "approval-executor: bulk_whatsapp executed");
          return { executed: true, action };
        }
        case "confirm_viewing":
        case "approve_plan":
        case "ceo_proposal":
        case "approve_ceo_strategy":
          // These approval types are informational — approval itself is the action.
          // No side-effect needed beyond recording the decision.
          logger.info({ action, approvalId }, "approval-executor: informational approval executed");
          return { executed: true, action };
        default:
          logger.error({ action, approvalId }, "approval-executor: unrecognized action — no handler exists");
          return { executed: false, action, error: `No executor handler for action: ${action}` };
      }
  }
}
