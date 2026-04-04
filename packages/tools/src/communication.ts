import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import {
  aygentWhatsappMessages,
  aygentWhatsappTemplates,
} from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";

// ═══════════════════════════════════════════════════
// search_whatsapp
// ═══════════════════════════════════════════════════

export const searchWhatsappDefinition: ToolDefinition = {
  name: "search_whatsapp",
  description:
    "Search the agent's WhatsApp message history by keyword, contact name, or phone number. Use this when the agent asks about past conversations, messages from a specific person, or wants to find what was discussed about a topic.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query — matches against message content, sender name, or phone number",
      },
      contactName: {
        type: "string",
        description: "Filter by contact/sender name",
      },
      phone: {
        type: "string",
        description:
          "Filter by phone number (partial match, e.g. '0501234' or '971501234567')",
      },
      limit: {
        type: "number",
        description: "Number of results (default 10, max 30)",
      },
    },
  },
};

export const searchWhatsappExecutor: ToolExecutor = async (input, ctx) => {
  const { query, contactName, phone, limit } = input as {
    query?: string;
    contactName?: string;
    phone?: string;
    limit?: number;
  };

  const take = Math.min(limit ?? 10, 30);
  const t = aygentWhatsappMessages;
  const conditions = [eq(t.companyId, ctx.companyId)];

  if (query) {
    conditions.push(ilike(t.content, `%${query}%`));
  }
  if (contactName) {
    conditions.push(ilike(t.senderName, `%${contactName}%`));
  }
  if (phone) {
    conditions.push(ilike(t.senderPhone, `%${phone}%`));
  }

  const results = await ctx.db
    .select()
    .from(t)
    .where(and(...conditions))
    .orderBy(desc(t.timestamp))
    .limit(take);

  if (results.length === 0) {
    return { results: [], message: "No WhatsApp messages found matching your criteria." };
  }

  return {
    results: results.map((m) => ({
      id: m.id,
      chatJid: m.chatJid,
      fromMe: m.fromMe,
      senderName: m.senderName,
      senderPhone: m.senderPhone,
      content: m.content?.slice(0, 500) ?? null,
      mediaType: m.mediaType,
      status: m.status,
      timestamp: m.timestamp?.toISOString() ?? null,
    })),
    total: results.length,
  };
};

// ═══════════════════════════════════════════════════
// send_whatsapp
// ═══════════════════════════════════════════════════

export const sendWhatsappDefinition: ToolDefinition = {
  name: "send_whatsapp",
  description:
    "Draft a WhatsApp message to send to a contact. This NEVER sends directly — it returns a preview for the agent to approve, edit, or cancel. Use this when the agent asks to message someone on WhatsApp.",
  input_schema: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description:
          "Recipient phone number in international format (e.g. '971501234567') or contact name if known",
      },
      message: {
        type: "string",
        description: "The message text to send",
      },
    },
    required: ["to", "message"],
  },
};

export const sendWhatsappExecutor: ToolExecutor = async (input, _ctx) => {
  const { to, message } = input as { to: string; message: string };
  return {
    type: "approval_required",
    action: "send_whatsapp",
    to,
    message,
    status: "pending_approval",
    instructions: "This message will NOT be sent until approved. Review and approve, edit, or reject.",
  };
};

// ═══════════════════════════════════════════════════
// search_email
// ═══════════════════════════════════════════════════

export const searchEmailDefinition: ToolDefinition = {
  name: "search_email",
  description:
    "Search the agent's email inbox by keyword, sender, subject, or date. Uses Gmail search syntax. Use this when the agent asks to find emails, check what someone sent, or look up email conversations.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query — supports Gmail syntax like 'from:ahmed@example.com', 'subject:viewing', 'after:2025/01/01', or just keywords",
      },
      maxResults: {
        type: "number",
        description: "Number of results (default 10, max 20)",
      },
    },
    required: ["query"],
  },
};

export const searchEmailExecutor: ToolExecutor = async (input, _ctx) => {
  const { query, maxResults: _maxResults } = input as { query: string; maxResults?: number };
  return {
    results: [],
    query,
    message:
      "Gmail is not connected yet. No email data is available. " +
      "To search past communications, use search_whatsapp instead. " +
      "Ask the agency owner to connect Gmail in Settings to enable email search.",
  };
};

// ═══════════════════════════════════════════════════
// send_email
// ═══════════════════════════════════════════════════

export const sendEmailDefinition: ToolDefinition = {
  name: "send_email",
  description:
    "Draft an email to send on behalf of the agent. This NEVER sends directly — it returns a preview for the agent to approve, edit, or cancel. Use this when the agent asks to email someone. Supports file attachments from knowledge base or work products.",
  input_schema: {
    type: "object",
    properties: {
      to: {
        type: "string",
        description: "Recipient email address",
      },
      subject: {
        type: "string",
        description: "Email subject line",
      },
      body: {
        type: "string",
        description: "Email body text",
      },
      attachments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            assetId: {
              type: "string",
              description: "Asset ID from knowledge base or work products",
            },
            filename: {
              type: "string",
              description: "Display filename for the attachment",
            },
          },
          required: ["assetId"],
        },
        description: "Files to attach — use asset IDs from search_knowledge_base or work products",
      },
    },
    required: ["to", "subject", "body"],
  },
};

export const sendEmailExecutor: ToolExecutor = async (input, _ctx) => {
  const { to, subject, body, attachments } = input as {
    to: string;
    subject: string;
    body: string;
    attachments?: Array<{ assetId: string; filename?: string }>;
  };
  return {
    type: "approval_required",
    action: "send_email",
    to,
    subject,
    body,
    attachments: attachments ?? [],
    status: "pending_approval",
    instructions: "This email will NOT be sent until approved. Review and approve, edit, or reject.",
  };
};

// ═══════════════════════════════════════════════════
// search_instagram_dms
// ═══════════════════════════════════════════════════

export const searchInstagramDmsDefinition: ToolDefinition = {
  name: "search_instagram_dms",
  description:
    "Search recent Instagram DMs. Requires instagram_manage_messages permission.",
  input_schema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Number of conversations to fetch (default 10)",
      },
    },
  },
};

export const searchInstagramDmsExecutor: ToolExecutor = async (input, _ctx) => {
  const { limit: _limit } = input as { limit?: number };
  return {
    results: [],
    message:
      "Instagram is not connected yet. No DM data is available. " +
      "To search past communications, use search_whatsapp instead. " +
      "Ask the agency owner to connect Instagram in Settings to enable DM search.",
  };
};

// ═══════════════════════════════════════════════════
// send_instagram_dm
// ═══════════════════════════════════════════════════

export const sendInstagramDmDefinition: ToolDefinition = {
  name: "send_instagram_dm",
  description:
    "Draft an Instagram direct message to send to a user. This NEVER sends directly — it returns a preview for the agent to approve, edit, or cancel. Use this when the agent asks to DM someone on Instagram.",
  input_schema: {
    type: "object",
    properties: {
      recipientId: {
        type: "string",
        description: "The Instagram user ID of the recipient (from search_instagram_dms results)",
      },
      recipientName: {
        type: "string",
        description: "Display name or username of the recipient (for the approval card)",
      },
      message: {
        type: "string",
        description: "The message text to send",
      },
    },
    required: ["recipientId", "recipientName", "message"],
  },
};

export const sendInstagramDmExecutor: ToolExecutor = async (input, _ctx) => {
  const { recipientId, recipientName, message } = input as {
    recipientId: string;
    recipientName: string;
    message: string;
  };
  return {
    type: "approval_required",
    action: "send_instagram_dm",
    recipientId,
    recipientName,
    message,
    status: "pending_approval",
    instructions: "This DM will NOT be sent until approved. Review and approve, edit, or reject.",
  };
};

// ═══════════════════════════════════════════════════
// post_to_instagram
// ═══════════════════════════════════════════════════

export const postToInstagramDefinition: ToolDefinition = {
  name: "post_to_instagram",
  description:
    "Publish a photo, carousel, story, or reel to the agent's connected Instagram account. Returns an approval card — the post is NOT published until the agent approves. Requires the agent to have connected Instagram in Settings. Use mediaType 'story' for ephemeral stories (image only, no caption) and 'reel' for short-form video content.",
  input_schema: {
    type: "object",
    properties: {
      imageUrl: {
        type: "string",
        description: "URL of the image to post (must be publicly accessible). Used for feed posts and stories.",
      },
      imageUrls: {
        type: "array",
        items: { type: "string" },
        description: "Array of image URLs for a carousel post (2-10 images)",
      },
      videoUrl: {
        type: "string",
        description: "URL of the video for a reel (must be publicly accessible, MP4 format)",
      },
      caption: {
        type: "string",
        description: "Post caption including hashtags (not used for stories)",
      },
      mediaType: {
        type: "string",
        enum: ["feed", "story", "reel"],
        description: "Type of Instagram post: 'feed' (default photo/carousel), 'story' (ephemeral image story), or 'reel' (short-form video)",
      },
    },
    required: ["caption"],
  },
};

export const postToInstagramExecutor: ToolExecutor = async (input, _ctx) => {
  const { imageUrl, imageUrls, videoUrl, caption, mediaType } = input as {
    imageUrl?: string;
    imageUrls?: string[];
    videoUrl?: string;
    caption: string;
    mediaType?: string;
  };
  return {
    type: "approval_required",
    action: "post_to_instagram",
    imageUrl,
    imageUrls,
    videoUrl,
    caption,
    mediaType: mediaType ?? "feed",
    status: "pending_approval",
    instructions: "This post will NOT be published until approved. Review and approve, edit, or reject.",
  };
};

// ═══════════════════════════════════════════════════
// list_whatsapp_templates
// ═══════════════════════════════════════════════════

export const listWhatsappTemplatesDefinition: ToolDefinition = {
  name: "list_whatsapp_templates",
  description:
    "List the agent's WhatsApp message templates, optionally filtered by category. Use when the agent wants to see their templates or pick one to send.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description:
          "Filter by: intro | viewing_confirmation | followup | market_update | payment_reminder | price_drop",
      },
    },
  },
};

export const listWhatsappTemplatesExecutor: ToolExecutor = async (input, ctx) => {
  const { category } = input as { category?: string };
  const t = aygentWhatsappTemplates;
  const conditions = [eq(t.companyId, ctx.companyId)];

  if (category) {
    conditions.push(eq(t.category, category));
  }

  const templates = await ctx.db
    .select()
    .from(t)
    .where(and(...conditions))
    .orderBy(desc(t.usageCount));

  return {
    templates: templates.map((tpl) => ({
      id: tpl.id,
      name: tpl.name,
      category: tpl.category,
      content: tpl.content,
      isDefault: tpl.isDefault,
      usageCount: tpl.usageCount,
    })),
    total: templates.length,
  };
};

// ═══════════════════════════════════════════════════
// use_whatsapp_template
// ═══════════════════════════════════════════════════

export const useWhatsappTemplateDefinition: ToolDefinition = {
  name: "use_whatsapp_template",
  description:
    "Send a WhatsApp message using a template. Merges the template with lead data and returns an approval card. Use when the agent asks to use a template or send a templated message.",
  input_schema: {
    type: "object",
    properties: {
      templateId: { type: "string", description: "Template database ID" },
      contactJid: {
        type: "string",
        description: "WhatsApp contact JID or phone number",
      },
      variables: {
        type: "object",
        description:
          "Variable values: client_name, project_name, date, time, etc.",
      },
    },
    required: ["templateId", "contactJid"],
  },
};

export const useWhatsappTemplateExecutor: ToolExecutor = async (input, ctx) => {
  const { templateId, contactJid, variables } = input as {
    templateId: string;
    contactJid: string;
    variables?: Record<string, string>;
  };

  const results = await ctx.db
    .select()
    .from(aygentWhatsappTemplates)
    .where(
      and(
        eq(aygentWhatsappTemplates.id, templateId),
        eq(aygentWhatsappTemplates.companyId, ctx.companyId),
      ),
    )
    .limit(1);

  const template = results[0];
  if (!template) {
    return { error: "Template not found." };
  }

  // Merge variables into template content
  let mergedContent = template.content ?? "";
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      mergedContent = mergedContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
  }

  return {
    type: "approval_required",
    action: "send_whatsapp",
    to: contactJid,
    message: mergedContent,
    templateName: template.name,
    status: "pending_approval",
    instructions: "This templated message will NOT be sent until approved. Review and approve, edit, or reject.",
  };
};

// ═══════════════════════════════════════════════════
// make_call
// ═══��═══════════════════════════════════════════════

export const makeCallDefinition: ToolDefinition = {
  name: "make_call",
  description:
    `Initiate an AI-powered outbound phone call to a lead, tenant, or landlord on behalf of the agent.
The AI will conduct a natural voice conversation using the lead's full CRM context.
Always requires explicit agent approval before dialling.
Use when the agent asks to call, phone, ring, or follow up by phone with a contact.`,
  input_schema: {
    type: "object",
    properties: {
      leadId: {
        type: "string",
        description: "Database ID of the lead to call",
      },
      purpose: {
        type: "string",
        enum: ["viewing_confirmation", "lead_reactivation", "renewal_reminder", "dld_prospect", "custom"],
        description: "The purpose of the call",
      },
      notes: {
        type: "string",
        description: "Additional context for the AI during the call (optional)",
      },
    },
    required: ["leadId", "purpose"],
  },
};

export const makeCallExecutor: ToolExecutor = async (input, _ctx) => {
  const { leadId, purpose, notes } = input as {
    leadId: string;
    purpose: string;
    notes?: string;
  };
  return {
    type: "approval_required",
    action: "make_call",
    leadId,
    purpose,
    notes,
    status: "pending_approval",
    instructions: "This call will NOT be made until approved. Review the purpose and approve or reject.",
  };
};
