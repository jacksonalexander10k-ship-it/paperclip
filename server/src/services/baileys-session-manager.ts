/**
 * Baileys Session Manager
 *
 * Manages multiple WhatsApp Web connections (one per agent).
 * Handles: connection lifecycle, QR code generation, message routing,
 * reconnection with exponential backoff, and session persistence via Postgres.
 */

import baileys from "@whiskeysockets/baileys";
import type { WASocket, BaileysEventMap } from "@whiskeysockets/baileys";

const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = baileys;
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  aygentWhatsappMessages,
  aygentWhatsappWindows,
  aygentBaileysAuth,
} from "@paperclipai/db";
import { usePostgresAuthState, clearAuthState } from "./baileys-auth-state.js";
import { agentCredentialService } from "./agent-credentials.js";
import { issueService, agentService } from "./index.js";
import { logActivity } from "./activity-log.js";
import { publishLiveEvent } from "./live-events.js";
import { logger } from "../middleware/logger.js";

export type BaileysConnectionStatus = "disconnected" | "qr_pending" | "connecting" | "connected";

interface BaileysSession {
  socket: WASocket;
  status: BaileysConnectionStatus;
  companyId: string;
  agentId: string;
  phoneNumber?: string;
  retryCount: number;
}

class BaileysSessionManager {
  private sessions = new Map<string, BaileysSession>();
  private db: Db | null = null;

  setDb(db: Db) {
    this.db = db;
  }

  private getDb(): Db {
    if (!this.db) throw new Error("BaileysSessionManager: DB not initialized");
    return this.db;
  }

  /**
   * Start a new Baileys connection for an agent. Returns QR code data URI on first connect.
   */
  async connect(
    agentId: string,
    companyId: string,
  ): Promise<{ status: BaileysConnectionStatus; qrDataUrl?: string }> {
    const db = this.getDb();

    // If already connected, return status
    const existing = this.sessions.get(agentId);
    if (existing?.status === "connected") {
      return { status: "connected" };
    }

    // Clean up any existing socket
    if (existing?.socket) {
      existing.socket.end(undefined);
      this.sessions.delete(agentId);
    }

    // Ensure auth row exists in DB
    const authRows = await db
      .select()
      .from(aygentBaileysAuth)
      .where(eq(aygentBaileysAuth.agentId, agentId))
      .limit(1);

    if (!authRows[0]) {
      await db.insert(aygentBaileysAuth).values({
        companyId,
        agentId,
      });
    }

    // Load auth state from Postgres
    const { state, saveCreds } = await usePostgresAuthState(db, agentId);
    const { version } = await fetchLatestBaileysVersion();

    return new Promise((resolve) => {
      let qrResolved = false;

      const socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger as any),
        },
        printQRInTerminal: false,
        logger: logger as any,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
      });

      const session: BaileysSession = {
        socket,
        status: "connecting",
        companyId,
        agentId,
        retryCount: 0,
      };
      this.sessions.set(agentId, session);

      // Handle connection updates (QR code, connected, disconnected)
      socket.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          session.status = "qr_pending";
          try {
            const qrDataUrl = await QRCode.toDataURL(qr);

            // Push QR to frontend via live events
            publishLiveEvent({
              companyId,
              type: "baileys.qr",
              payload: { agentId, qrDataUrl },
            });

            // Resolve the initial connect() call with the first QR
            if (!qrResolved) {
              qrResolved = true;
              resolve({ status: "qr_pending", qrDataUrl });
            }
          } catch (err) {
            logger.error({ err }, "baileys: QR code generation failed");
          }
        }

        if (connection === "open") {
          session.status = "connected";
          session.retryCount = 0;

          // Extract phone number from credentials
          const phoneNumber = state.creds.me?.id?.split(":")[0] ?? undefined;
          session.phoneNumber = phoneNumber;

          // Update phone number in auth table
          if (phoneNumber) {
            await db
              .update(aygentBaileysAuth)
              .set({ phoneNumber, updatedAt: new Date() })
              .where(eq(aygentBaileysAuth.agentId, agentId));
          }

          // Store a credential record so the rest of the system knows this agent has WhatsApp
          const credSvc = agentCredentialService(db);
          await credSvc.connect(companyId, agentId, "whatsapp_baileys", {
            accessToken: "baileys-session",
            whatsappPhoneNumberId: phoneNumber,
          });

          publishLiveEvent({
            companyId,
            type: "baileys.connected",
            payload: { agentId, phoneNumber },
          });

          logger.info({ agentId, phoneNumber }, "baileys: connected");

          if (!qrResolved) {
            qrResolved = true;
            resolve({ status: "connected" });
          }
        }

        if (connection === "close") {
          session.status = "disconnected";
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          logger.info({ agentId, statusCode, loggedOut }, "baileys: disconnected");

          if (loggedOut) {
            // User logged out — clear all auth state
            await clearAuthState(db, agentId);
            this.sessions.delete(agentId);

            // Remove the credential record
            const credSvc = agentCredentialService(db);
            const cred = await credSvc.getByAgentAndService(agentId, "whatsapp_baileys");
            if (cred) await credSvc.disconnect(cred.id);

            publishLiveEvent({
              companyId,
              type: "baileys.disconnected",
              payload: { agentId, reason: "logged_out" },
            });
          } else {
            // Transient error — reconnect with backoff
            session.retryCount++;
            const delay = Math.min(1000 * 2 ** session.retryCount, 60_000);
            logger.info({ agentId, retryCount: session.retryCount, delay }, "baileys: reconnecting");
            setTimeout(() => {
              this.reconnect(agentId, companyId).catch((err) => {
                logger.error({ err, agentId }, "baileys: reconnect failed");
              });
            }, delay);
          }

          if (!qrResolved) {
            qrResolved = true;
            resolve({ status: "disconnected" });
          }
        }
      });

      // Persist credentials whenever they change
      socket.ev.on("creds.update", saveCreds);

      // Handle inbound messages
      socket.ev.on("messages.upsert", async ({ messages, type }: { messages: any[]; type: string }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
          // Skip status broadcast messages
          if (msg.key.remoteJid === "status@broadcast") continue;
          // Skip messages sent by us
          if (msg.key.fromMe) continue;

          const from = msg.key.remoteJid ?? "";
          const senderPhone = from.replace("@s.whatsapp.net", "");
          const body =
            msg.message?.conversation ??
            msg.message?.extendedTextMessage?.text ??
            msg.message?.imageMessage?.caption ??
            `[${Object.keys(msg.message ?? {})[0] ?? "unknown"}]`;
          const messageType = Object.keys(msg.message ?? {})[0] ?? "unknown";
          const timestamp = new Date((msg.messageTimestamp as number) * 1000);
          const contactName = msg.pushName ?? senderPhone;

          logger.info(
            { agentId, from: senderPhone, body: (body ?? "").slice(0, 100), messageType },
            "baileys: inbound message",
          );

          try {
            // Store message
            await db.insert(aygentWhatsappMessages).values({
              companyId,
              agentId,
              chatJid: senderPhone,
              messageId: msg.key.id ?? `baileys-${Date.now()}`,
              fromMe: false,
              senderName: contactName,
              senderPhone,
              content: body ?? "",
              mediaType: messageType !== "conversation" && messageType !== "extendedTextMessage" ? messageType : null,
              status: "received",
              timestamp,
            });

            // Upsert 24-hour messaging window
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            await db
              .insert(aygentWhatsappWindows)
              .values({
                companyId,
                agentId,
                chatJid: senderPhone,
                windowOpenedAt: now,
                windowExpiresAt: expiresAt,
              })
              .onConflictDoUpdate({
                target: [aygentWhatsappWindows.agentId, aygentWhatsappWindows.chatJid],
                set: { windowOpenedAt: now, windowExpiresAt: expiresAt },
              });

            // Create Paperclip issue for the agent to process
            const issueSvc = issueService(db);
            const issue = await issueSvc.create(companyId, {
              title: `WhatsApp from ${contactName}`,
              description: `Inbound WhatsApp message from +${senderPhone}:\n\n> ${body}\n\nMessage type: ${messageType}\nTimestamp: ${timestamp.toISOString()}`,
              status: "todo",
              priority: "high",
              assigneeAgentId: agentId,
              originKind: "webhook",
              originId: msg.key.id ?? `baileys-${Date.now()}`,
            });

            await logActivity(db, {
              companyId,
              actorType: "system",
              actorId: "baileys-whatsapp",
              action: "lead.inbound_whatsapp",
              entityType: "issue",
              entityId: issue.id,
              agentId,
              details: {
                from: senderPhone,
                contactName,
                messageType,
                bodyPreview: (body ?? "").slice(0, 100),
                provider: "baileys",
              },
            });

            logger.info(
              { issueId: issue.id, agentId, from: senderPhone },
              "baileys: issue created for inbound message",
            );
          } catch (err) {
            logger.error({ err, agentId, from: senderPhone }, "baileys: failed to process inbound message");
          }
        }
      });
    });
  }

  /**
   * Reconnect an existing session (used for transient disconnects).
   */
  private async reconnect(agentId: string, companyId: string) {
    const existing = this.sessions.get(agentId);
    if (existing?.socket) {
      try { existing.socket.end(undefined); } catch { /* ignore */ }
    }
    this.sessions.delete(agentId);
    await this.connect(agentId, companyId);
  }

  /**
   * Disconnect and optionally clear auth state (full logout).
   */
  async disconnect(agentId: string, logout = false) {
    const db = this.getDb();
    const session = this.sessions.get(agentId);

    if (session?.socket) {
      if (logout) {
        await session.socket.logout();
      } else {
        session.socket.end(undefined);
      }
    }

    this.sessions.delete(agentId);

    if (logout) {
      await clearAuthState(db, agentId);
      const credSvc = agentCredentialService(db);
      const cred = await credSvc.getByAgentAndService(agentId, "whatsapp_baileys");
      if (cred) await credSvc.disconnect(cred.id);
    }

    const companyId = session?.companyId;
    if (companyId) {
      publishLiveEvent({
        companyId,
        type: "baileys.disconnected",
        payload: { agentId, reason: logout ? "logged_out" : "manual" },
      });
    }
  }

  /**
   * Get connection status for an agent.
   */
  getStatus(agentId: string): { status: BaileysConnectionStatus; phoneNumber?: string } {
    const session = this.sessions.get(agentId);
    if (!session) return { status: "disconnected" };
    return { status: session.status, phoneNumber: session.phoneNumber };
  }

  /**
   * Send a message through Baileys.
   */
  async sendMessage(
    agentId: string,
    phone: string,
    text: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== "connected") {
      return { success: false, error: "Baileys session not connected" };
    }

    // Normalize phone to JID format
    const jid = phone.includes("@") ? phone : `${phone.replace(/\+/g, "")}@s.whatsapp.net`;

    try {
      const result = await session.socket.sendMessage(jid, { text });
      return {
        success: true,
        messageId: result?.key?.id ?? undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, agentId, phone }, "baileys: send failed");
      return { success: false, error: msg };
    }
  }

  /**
   * Restore all persisted sessions on server startup.
   */
  async restoreAllSessions(db: Db) {
    this.setDb(db);

    const sessions = await db
      .select()
      .from(aygentBaileysAuth)
      .where(eq(aygentBaileysAuth.credsJson, aygentBaileysAuth.credsJson)); // WHERE creds_json IS NOT NULL

    // Filter to only rows with actual creds
    const validSessions = sessions.filter((s) => s.credsJson);

    if (validSessions.length === 0) {
      logger.info("baileys: no sessions to restore");
      return;
    }

    logger.info({ count: validSessions.length }, "baileys: restoring sessions");

    for (const session of validSessions) {
      try {
        await this.connect(session.agentId, session.companyId);
        logger.info({ agentId: session.agentId }, "baileys: session restored");
      } catch (err) {
        logger.error({ err, agentId: session.agentId }, "baileys: failed to restore session");
      }
    }
  }

  /**
   * Check if an agent has an active Baileys session.
   */
  isConnected(agentId: string): boolean {
    return this.sessions.get(agentId)?.status === "connected";
  }

  /**
   * Get all active session agent IDs.
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.entries())
      .filter(([, s]) => s.status === "connected")
      .map(([id]) => id);
  }
}

// Singleton instance
export const baileysSessionManager = new BaileysSessionManager();
