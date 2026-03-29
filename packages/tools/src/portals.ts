import { eq, and, desc } from "drizzle-orm";
import { aygentPortals, aygentPortalActivity } from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";

// ═══════════════════════════════════════════════════
// create_portal
// ═══════════════════════════════════════════════════

export const createPortalDefinition: ToolDefinition = {
  name: "create_portal",
  description:
    "Create a personalized client portal for a lead. Returns a shareable link the agent can send via WhatsApp. The portal shows shortlisted projects and documents. Use when the agent wants to share properties with a client.",
  input_schema: {
    type: "object",
    properties: {
      leadId: { type: "string", description: "The lead's database ID" },
      projectIds: {
        type: "array",
        items: { type: "string" },
        description: "Project IDs to include",
      },
      documentIds: {
        type: "array",
        items: { type: "string" },
        description: "Document IDs to include",
      },
      message: {
        type: "string",
        description: "Custom welcome message for the client",
      },
    },
    required: ["leadId"],
  },
};

export const createPortalExecutor: ToolExecutor = async (input, ctx) => {
  const { leadId, projectIds, documentIds, message } = input as {
    leadId: string;
    projectIds?: string[];
    documentIds?: string[];
    message?: string;
  };

  // Generate a slug
  const slug = `portal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const portal = await ctx.db
    .insert(aygentPortals)
    .values({
      companyId: ctx.companyId,
      leadId,
      slug,
      isActive: true,
      sharedProjects: projectIds ?? [],
      sharedDocuments: documentIds ?? [],
      customMessage: message ?? null,
    })
    .returning();

  return {
    portalId: portal[0]?.id,
    slug,
    url: `/portal/${slug}`,
    leadId,
    message: `Client portal created. Share this link with the client: /portal/${slug}`,
  };
};

// ═══════════════════════════════════════════════════
// get_portal_activity
// ═══════════════════════════════════════════════════

export const getPortalActivityDefinition: ToolDefinition = {
  name: "get_portal_activity",
  description:
    "Check how a lead has been engaging with their client portal — page views, which projects they looked at, when they last visited. Use when the agent wants to know if a lead has been looking at the portal.",
  input_schema: {
    type: "object",
    properties: {
      leadId: { type: "string", description: "The lead's database ID" },
    },
    required: ["leadId"],
  },
};

export const getPortalActivityExecutor: ToolExecutor = async (input, ctx) => {
  const { leadId } = input as { leadId: string };

  // Find portal for this lead
  const portals = await ctx.db
    .select()
    .from(aygentPortals)
    .where(and(eq(aygentPortals.leadId, leadId), eq(aygentPortals.companyId, ctx.companyId)))
    .limit(1);

  if (portals.length === 0) {
    return { error: "No portal found for this lead. Create one first with create_portal." };
  }

  const portal = portals[0]!;
  const activity = await ctx.db
    .select()
    .from(aygentPortalActivity)
    .where(eq(aygentPortalActivity.portalId, portal.id))
    .orderBy(desc(aygentPortalActivity.createdAt))
    .limit(50);

  return {
    portalId: portal.id,
    slug: portal.slug,
    isActive: portal.isActive,
    totalViews: activity.length,
    lastVisit: activity[0]?.createdAt?.toISOString() ?? null,
    activity: activity.map((a) => ({
      type: a.type,
      projectId: a.projectId,
      documentId: a.documentId,
      metadata: a.metadata,
      timestamp: a.createdAt?.toISOString() ?? null,
    })),
  };
};
