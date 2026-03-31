/**
 * Agent Credentials Service
 *
 * Manages per-agent OAuth credentials for WhatsApp, Gmail, Instagram, etc.
 * Each agent can have its own communication identity (phone number, email).
 */

import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { aygentAgentCredentials } from "@paperclipai/db";

export type CredentialService = "whatsapp" | "gmail" | "instagram" | "google_calendar";

export interface AgentCredential {
  id: string;
  companyId: string;
  agentId: string;
  service: string;
  accessToken: string | null;
  refreshToken: string | null;
  providerAccountId: string | null;
  whatsappPhoneNumberId: string | null;
  gmailAddress: string | null;
  scopes: string | null;
  expiresAt: Date | null;
  connectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function agentCredentialService(db: Db) {
  return {
    /** List all credentials for a company */
    listByCompany: async (companyId: string): Promise<AgentCredential[]> => {
      return db
        .select()
        .from(aygentAgentCredentials)
        .where(eq(aygentAgentCredentials.companyId, companyId)) as Promise<AgentCredential[]>;
    },

    /** List credentials for a specific agent */
    listByAgent: async (agentId: string): Promise<AgentCredential[]> => {
      return db
        .select()
        .from(aygentAgentCredentials)
        .where(eq(aygentAgentCredentials.agentId, agentId)) as Promise<AgentCredential[]>;
    },

    /** Get a specific credential by agent + service */
    getByAgentAndService: async (
      agentId: string,
      service: string,
    ): Promise<AgentCredential | null> => {
      const rows = await db
        .select()
        .from(aygentAgentCredentials)
        .where(
          and(
            eq(aygentAgentCredentials.agentId, agentId),
            eq(aygentAgentCredentials.service, service),
          ),
        );
      return (rows[0] as AgentCredential | undefined) ?? null;
    },

    /** Find agent by WhatsApp phone number ID (for webhook routing) */
    findByWhatsappPhoneNumberId: async (
      phoneNumberId: string,
    ): Promise<AgentCredential | null> => {
      const rows = await db
        .select()
        .from(aygentAgentCredentials)
        .where(eq(aygentAgentCredentials.whatsappPhoneNumberId, phoneNumberId));
      return (rows[0] as AgentCredential | undefined) ?? null;
    },

    /** Find agent by Gmail address (for webhook routing) */
    findByGmailAddress: async (
      email: string,
    ): Promise<AgentCredential | null> => {
      const rows = await db
        .select()
        .from(aygentAgentCredentials)
        .where(eq(aygentAgentCredentials.gmailAddress, email));
      return (rows[0] as AgentCredential | undefined) ?? null;
    },

    /** Connect a service (create or update credential) */
    connect: async (
      companyId: string,
      agentId: string,
      service: string,
      data: {
        accessToken?: string;
        refreshToken?: string;
        providerAccountId?: string;
        whatsappPhoneNumberId?: string;
        gmailAddress?: string;
        scopes?: string;
        expiresAt?: Date;
      },
    ): Promise<AgentCredential> => {
      // Check if credential already exists
      const existing = await db
        .select()
        .from(aygentAgentCredentials)
        .where(
          and(
            eq(aygentAgentCredentials.agentId, agentId),
            eq(aygentAgentCredentials.service, service),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (existing) {
        // Update existing
        const [updated] = await db
          .update(aygentAgentCredentials)
          .set({
            ...data,
            connectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(aygentAgentCredentials.id, existing.id))
          .returning();
        return updated as AgentCredential;
      }

      // Create new
      const [created] = await db
        .insert(aygentAgentCredentials)
        .values({
          companyId,
          agentId,
          service,
          ...data,
          connectedAt: new Date(),
        })
        .returning();
      return created as AgentCredential;
    },

    /** Disconnect a service */
    disconnect: async (credentialId: string): Promise<void> => {
      await db
        .delete(aygentAgentCredentials)
        .where(eq(aygentAgentCredentials.id, credentialId));
    },

    /** Refresh token for a credential */
    updateToken: async (
      credentialId: string,
      accessToken: string,
      expiresAt?: Date,
    ): Promise<void> => {
      await db
        .update(aygentAgentCredentials)
        .set({
          accessToken,
          expiresAt: expiresAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(aygentAgentCredentials.id, credentialId));
    },

    /** List credentials expiring within the given minutes */
    listExpiring: async (withinMinutes: number): Promise<AgentCredential[]> => {
      const cutoff = new Date(Date.now() + withinMinutes * 60_000);
      // Use raw SQL for the comparison since drizzle's lte needs same types
      const all = await db
        .select()
        .from(aygentAgentCredentials);
      return (all as AgentCredential[]).filter(
        (c) => c.expiresAt && c.expiresAt <= cutoff,
      );
    },
  };
}
