import { eq, and, desc, sql } from "drizzle-orm";
import {
  aygentCampaigns,
  aygentCampaignSteps,
  aygentCampaignEnrollments,
} from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import { storeDeliverable } from "./lib/deliverables.js";

// ═══════════════════════════════════════════════════
// generate_pitch_deck
// ═══════════════════════════════════════════════════

export const generatePitchDeckDefinition: ToolDefinition = {
  name: "generate_pitch_deck",
  description:
    `Generate a professional investment pitch deck PDF for 1-3 Dubai off-plan projects. Use this whenever the agent asks to create a presentation, brochure, pitch deck, or investor deck for any project(s). Creates a data-driven pitch deck with per-project investment analysis, ROI projections, market comparisons, and tailored pitches.

IMPORTANT — This is a 3-step process. Do NOT skip any step.

STEP 1: Ask the agent these questions one by one (they can skip any, but warn the pitch will be more generic):
1. "What's the client's name?" (for personalisation)
2. "What bedroom type are they looking at?" (Studio, 1BR, 2BR, 3BR, etc. — this determines entry pricing and all financial calculations)
3. "What's the investment goal?" (Capital Appreciation / Rental Yield / End User / Golden Visa / Mixed)
4. "What's their budget range in AED?" (used for filtering and budget-mismatch notes)
5. "Your name, phone, and email for the pitch deck?"

STEP 2: Present a confirmation summary BEFORE calling the tool.
STEP 3: Only call this tool AFTER the agent confirms.`,
  input_schema: {
    type: "object",
    properties: {
      projectIds: {
        type: "array",
        items: { type: "number" },
        description: "Array of 1-3 Reelly project IDs (numeric, from search results 'reellyId' field)",
      },
      clientName: { type: "string", description: "Client's name" },
      investmentGoal: {
        type: "string",
        enum: ["capital_appreciation", "rental_yield", "lifestyle", "end_user", "golden_visa", "mixed"],
        description: "Client's primary investment goal.",
      },
      budgetMin: { type: "number", description: "Client's minimum budget in AED." },
      budgetMax: { type: "number", description: "Client's maximum budget in AED." },
      clientProfile: {
        type: "string",
        enum: ["first_time", "experienced", "local", "international"],
      },
      riskAppetite: {
        type: "string",
        enum: ["conservative", "moderate", "aggressive"],
      },
      preferredBedrooms: { type: "string", description: "Client's preferred bedroom type (e.g. '2BR', 'Studio')." },
      notes: { type: "string", description: "Any additional context." },
      agentName: { type: "string" },
      agentPhone: { type: "string" },
      agentEmail: { type: "string" },
      confirmed: {
        type: "boolean",
        description: "Must be true — confirms 3-step flow completed.",
      },
    },
    required: ["projectIds", "confirmed"],
  },
};

export const generatePitchDeckExecutor: ToolExecutor = async (input, _ctx) => {
  const { confirmed, projectIds } = input as { confirmed: boolean; projectIds: number[] };
  if (!confirmed) {
    return { error: "You must complete the 3-step confirmation flow before calling this tool. Set confirmed=true after the agent approves." };
  }
  return {
    type: "approval_required",
    action: "generate_pitch_deck",
    projectIds,
    ...input,
    status: "pending_generation",
    instructions: "Pitch deck generation queued. Results will appear in the Work tab when complete.",
  };
};

// ═══════════════════════════════════════════════════
// generate_pitch_presentation
// ═══════════════════════════════════════════════════

export const generatePitchPresentationDefinition: ToolDefinition = {
  name: "generate_pitch_presentation",
  description:
    `Generate an interactive HTML sales pitch presentation for 1-3 Dubai off-plan projects. Creates a shareable link (NOT a PDF) with scroll animations, a Google Maps location image, landmark distances, investment analysis, and a lead capture form. Use this when the agent asks for a "sales pitch", "interactive presentation", "shareable pitch", or "pitch link" for any project(s).

IMPORTANT — This is a 3-step process. Do NOT skip any step.

STEP 1: Ask the agent questions (client name, bedroom type, investment goal, budget, agent details).
STEP 2: Show confirmation, then ask "Shall I generate the pitch?"
STEP 3: Only call after agent confirms.`,
  input_schema: {
    type: "object",
    properties: {
      projectIds: {
        type: "array",
        items: { type: "number" },
        description: "Array of 1-3 Reelly project IDs",
      },
      clientName: { type: "string" },
      investmentGoal: {
        type: "string",
        enum: ["capital_appreciation", "rental_yield", "lifestyle", "end_user", "golden_visa", "mixed"],
      },
      budgetMin: { type: "number" },
      budgetMax: { type: "number" },
      clientProfile: {
        type: "string",
        enum: ["first_time", "experienced", "local", "international"],
      },
      riskAppetite: {
        type: "string",
        enum: ["conservative", "moderate", "aggressive"],
      },
      preferredBedrooms: { type: "string" },
      bedroomPerProject: {
        type: "array",
        items: { type: "string" },
        description: "Bedroom type per project in same order as projectIds.",
      },
      notes: { type: "string" },
      agentName: { type: "string" },
      agentPhone: { type: "string" },
      agentEmail: { type: "string" },
      confirmed: { type: "boolean", description: "Must be true." },
    },
    required: ["projectIds", "confirmed"],
  },
};

export const generatePitchPresentationExecutor: ToolExecutor = async (input, _ctx) => {
  const { confirmed, projectIds } = input as { confirmed: boolean; projectIds: number[] };
  if (!confirmed) {
    return { error: "You must complete the 3-step confirmation flow. Set confirmed=true after the agent approves." };
  }
  return {
    type: "approval_required",
    action: "generate_pitch_presentation",
    projectIds,
    ...input,
    status: "pending_generation",
    instructions: "Pitch presentation generation queued. A shareable link will be returned when complete.",
  };
};

// ═══════════════════════════════════════════════════
// generate_landing_page
// ═══════════════════════════════════════════════════

export const generateLandingPageDefinition: ToolDefinition = {
  name: "generate_landing_page",
  description:
    "Generate a shareable HTML landing page with lead capture form. Can use a project from the database OR freeform details. If no projectId, provide projectName and other details to create a custom page. Returns a public URL that can be shared with clients.",
  input_schema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "The project database ID. Optional if providing freeform details." },
      projectName: { type: "string", description: "Project/offering name (used when no projectId)" },
      developer: { type: "string", description: "Developer name" },
      location: { type: "string", description: "Location/area" },
      priceRange: { type: "string", description: "Price range text, e.g. 'From AED 1.2M'" },
      description: { type: "string", description: "Description/selling points" },
      customTitle: { type: "string", description: "Custom headline for the hero section" },
      agentName: { type: "string" },
      agentPhone: { type: "string" },
      agentEmail: { type: "string" },
    },
  },
};

export const generateLandingPageExecutor: ToolExecutor = async (input, _ctx) => {
  return {
    type: "approval_required",
    action: "generate_landing_page",
    ...input,
    status: "pending_generation",
    instructions: "Landing page generation queued. A public URL will be returned when complete.",
  };
};

// ═══════════════════════════════════════════════════
// generate_social_content
// ═══════════════════════════════════════════════════

export const generateSocialContentDefinition: ToolDefinition = {
  name: "generate_social_content",
  description:
    "Generate social media content (Instagram, LinkedIn, TikTok posts, or video scripts). Can use a project from the database OR freeform details provided by the user. If no projectId, use projectName and description instead.",
  input_schema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "The project database ID. Optional if providing freeform details." },
      projectName: { type: "string", description: "Project/offering name (used when no projectId)" },
      description: { type: "string", description: "Description of the project/offering" },
      platforms: {
        type: "array",
        items: { type: "string" },
        description: "Platforms to generate for: 'instagram', 'linkedin', 'tiktok', 'video_script'. Defaults to ['instagram'].",
      },
      tone: {
        type: "string",
        description: "Content tone: 'luxury', 'investment', 'family', or 'neutral' (default)",
      },
      highlights: {
        type: "array",
        items: { type: "string" },
        description: "Specific features to emphasize (e.g. 'sea view', 'payment plan', 'golden visa')",
      },
    },
  },
};

export const generateSocialContentExecutor: ToolExecutor = async (input, ctx) => {
  const { projectName, platforms, tone, highlights } = input as {
    projectName?: string; platforms?: string[]; tone?: string; highlights?: string[];
  };
  const platformList = platforms?.join(", ") ?? "instagram";
  const title = projectName
    ? `Social Content — ${projectName} (${platformList})`
    : `Social Content (${platformList})`;

  const summaryParts = [`Requested for ${platformList}`];
  if (tone) summaryParts.push(`${tone} tone`);
  if (projectName) summaryParts.push(`project: ${projectName}`);
  if (highlights?.length) summaryParts.push(`highlights: ${highlights.join(", ")}`);

  const deliverableId = await storeDeliverable(ctx, {
    type: "social_content",
    title,
    summary: summaryParts.join(", ") + ".",
    metadata: { toolInput: input },
  });

  return {
    status: "ai_generation",
    message: "Social content generation is AI-driven. Use the project details and platform requirements to generate content directly in conversation.",
    deliverableId,
    ...input,
  };
};

// ═══════════════════════════════════════════════════
// generate_content
// ════��══════════════════════════════════════════════

export const generateContentDefinition: ToolDefinition = {
  name: "generate_content",
  description:
    "Generate ANY type of content with no limitations. Use this for anything that doesn't fit other specific tools: sales pages, ad copy, investor memos, pitch scripts, comparison sheets, email templates, property descriptions, brochures, video scripts, presentation outlines, social media strategies, market reports — literally anything. For HTML content (pages, documents), it saves a file and returns a shareable URL. For text content, it returns the content directly.",
  input_schema: {
    type: "object",
    properties: {
      instructions: {
        type: "string",
        description: "Detailed instructions for what to create.",
      },
      title: {
        type: "string",
        description: "Title for the generated content",
      },
      format: {
        type: "string",
        description: "'html' to generate a shareable webpage, or 'text' to return content directly. Default: 'text'",
      },
      projectId: {
        type: "string",
        description: "Optional project ID to pull data from the database",
      },
    },
    required: ["instructions"],
  },
};

export const generateContentExecutor: ToolExecutor = async (input, ctx) => {
  const { title: inputTitle, instructions, format } = input as {
    title?: string; instructions?: string; format?: string;
  };
  const title = inputTitle ?? "Generated Content";
  const safeInstructions = instructions ?? "";

  const summaryText = safeInstructions.length > 0
    ? `Requested: ${safeInstructions.slice(0, 300)}${safeInstructions.length > 300 ? "..." : ""}. Format: ${format ?? "text"}.`
    : `Content generation request. Format: ${format ?? "text"}.`;

  const deliverableId = await storeDeliverable(ctx, {
    type: "generated_content",
    title,
    summary: summaryText,
    metadata: { toolInput: input, format: format ?? "text" },
  });

  return {
    status: "ai_generation",
    message: "Content generation is AI-driven. Use the instructions and any referenced project data to generate the content directly.",
    deliverableId,
    ...input,
  };
};

// ═══════════════════════════════════════════════════
// generate_market_report
// ═══════════════════════════════════════════════════

export const generateMarketReportDefinition: ToolDefinition = {
  name: "generate_market_report",
  description:
    "Generate a market briefing or report for a specific area or for a specific client. Pulls from DLD transaction data, news, and lead context. Use when agent asks for market update, area analysis, client briefing, or market report.",
  input_schema: {
    type: "object",
    properties: {
      area: { type: "string", description: "Area to analyze (e.g. Dubai Marina, JVC, Palm Jumeirah)" },
      propertyType: { type: "string", description: "Focus on: apartment, villa, all" },
      clientName: { type: "string", description: "If generating for a specific client, their name" },
      format: { type: "string", description: "'summary' for chat response, 'detailed' for full report, 'whatsapp' for client-ready message" },
    },
    required: ["area"],
  },
};

export const generateMarketReportExecutor: ToolExecutor = async (input, ctx) => {
  const { area, propertyType, clientName, format } = input as {
    area: string; propertyType?: string; clientName?: string; format?: string;
  };
  const title = clientName
    ? `Market Report — ${area} (for ${clientName})`
    : `Market Report — ${area}`;

  const summaryParts = [`Market briefing requested for ${area}`];
  if (propertyType) summaryParts.push(`property type: ${propertyType}`);
  if (clientName) summaryParts.push(`prepared for ${clientName}`);
  summaryParts.push(`format: ${format ?? "summary"}`);

  const deliverableId = await storeDeliverable(ctx, {
    type: "market_report",
    title,
    summary: summaryParts.join(", ") + ".",
    metadata: { toolInput: input },
  });

  return {
    status: "ai_generation",
    message: "Market report generation is AI-driven. Use DLD transaction data, news, and project info to generate the report.",
    deliverableId,
    ...input,
  };
};

// ═══════════════════════════════════════════════════
// launch_campaign
// ═══════════════════════════════════════════════════

export const launchCampaignDefinition: ToolDefinition = {
  name: "launch_campaign",
  description:
    "Launch a marketing campaign. Can use a project from the database OR freeform details. Generates deliverables in parallel. Optionally specify which items to create. This is a fire-and-forget operation — results will appear in the Work tab as they complete.",
  input_schema: {
    type: "object",
    properties: {
      projectId: { type: "string", description: "The project database ID. Optional if providing freeform details." },
      projectName: { type: "string", description: "Project/offering name" },
      items: {
        type: "array",
        items: { type: "string" },
        description: "Deliverables: 'landing_page', 'social_instagram', 'social_linkedin', 'social_tiktok', 'video_script'. Defaults to all.",
      },
    },
  },
};

export const launchCampaignExecutor: ToolExecutor = async (input, _ctx) => {
  return {
    type: "approval_required",
    action: "launch_campaign",
    ...input,
    status: "pending_approval",
    instructions: "Campaign launch requires approval. Deliverables will be generated in parallel after approval.",
  };
};

// ═══════════════════════════════════════════════════
// create_drip_campaign
// ═══════════════════════════════════════════════════

export const createDripCampaignDefinition: ToolDefinition = {
  name: "create_drip_campaign",
  description:
    "Create an email drip campaign with AI-generated content. The campaign consists of a sequence of timed emails sent to enrolled leads via Gmail. Types: warm_nurture, cold_outreach, post_viewing, custom.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Campaign name (e.g. 'Creek Harbour Warm Leads')" },
      type: { type: "string", description: "Campaign type: 'warm_nurture', 'cold_outreach', 'post_viewing', or 'custom'" },
      projectId: { type: "string", description: "Optional project ID to tailor emails" },
      stepCount: { type: "number", description: "Number of emails in the sequence (default 4-5)" },
      customInstructions: { type: "string", description: "Additional instructions for email content generation" },
    },
    required: ["name", "type"],
  },
};

export const createDripCampaignExecutor: ToolExecutor = async (input, ctx) => {
  const { name, type, projectId, stepCount, customInstructions } = input as {
    name: string;
    type: string;
    projectId?: string;
    stepCount?: number;
    customInstructions?: string;
  };

  const campaign = await ctx.db
    .insert(aygentCampaigns)
    .values({
      companyId: ctx.companyId,
      name,
      type,
      projectId: projectId ?? null,
      status: "draft",
    })
    .returning();

  const campaignId = campaign[0]?.id;
  if (!campaignId) {
    return { error: "Failed to create campaign." };
  }

  // Create placeholder steps
  const steps = stepCount ?? 4;
  for (let i = 1; i <= steps; i++) {
    await ctx.db.insert(aygentCampaignSteps).values({
      campaignId,
      stepNumber: i,
      subject: `[Draft] Email ${i} — ${name}`,
      body: `[AI to generate based on: type=${type}, step=${i}/${steps}${customInstructions ? `, instructions: ${customInstructions}` : ""}]`,
      delayDays: i === 1 ? 0 : (i <= 2 ? 2 : 7),
    });
  }

  return {
    campaignId,
    name,
    type,
    stepCount: steps,
    status: "draft",
    message: `Campaign "${name}" created with ${steps} email steps. Steps have placeholder content — use AI to generate real email copy, then activate the campaign.`,
  };
};

// ═══════════════════════════════════════════════════
// enroll_lead_in_campaign
// ═══════════════════════════════════════════════════

export const enrollLeadInCampaignDefinition: ToolDefinition = {
  name: "enroll_lead_in_campaign",
  description:
    "Enroll a lead in an existing email drip campaign. The lead must have an email address. Emails will be sent automatically according to the campaign schedule.",
  input_schema: {
    type: "object",
    properties: {
      campaignId: { type: "string", description: "The drip campaign ID" },
      leadId: { type: "string", description: "The lead ID to enroll" },
    },
    required: ["campaignId", "leadId"],
  },
};

export const enrollLeadInCampaignExecutor: ToolExecutor = async (input, ctx) => {
  const { campaignId, leadId } = input as { campaignId: string; leadId: string };

  // Verify campaign exists and belongs to this company
  const campaigns = await ctx.db
    .select()
    .from(aygentCampaigns)
    .where(and(eq(aygentCampaigns.id, campaignId), eq(aygentCampaigns.companyId, ctx.companyId)))
    .limit(1);

  if (campaigns.length === 0) {
    return { error: "Campaign not found." };
  }

  const enrollment = await ctx.db
    .insert(aygentCampaignEnrollments)
    .values({
      campaignId,
      leadId,
      currentStep: 0,
      status: "active",
      nextSendAt: new Date(),
    })
    .returning();

  return {
    enrollmentId: enrollment[0]?.id,
    campaignId,
    leadId,
    status: "active",
    message: `Lead enrolled in campaign "${campaigns[0]?.name}". First email will be sent according to the campaign schedule.`,
  };
};
