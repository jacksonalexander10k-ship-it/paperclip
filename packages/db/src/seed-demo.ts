import { createDb } from "./client.js";
import {
  companies,
  agents,
  goals,
  projects,
  issues,
  issueComments,
  approvals,
  activityLog,
  costEvents,
  heartbeatRuns,
  routines,
  routineTriggers,
  issueWorkProducts,
  aygentProperties,
} from "./schema/index.js";
import { eq } from "drizzle-orm";

const url =
  process.env.DATABASE_URL ??
  "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";

const db = createDb(url);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minutes ago → Date */
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);

/** Hours ago → Date */
const hoursAgo = (h: number) => ago(h * 60);

/** Days ago → Date */
const daysAgo = (d: number) => ago(d * 24 * 60);

// ---------------------------------------------------------------------------
// Idempotency: skip if demo company already exists
// ---------------------------------------------------------------------------

const existing = await db
  .select({ id: companies.id })
  .from(companies)
  .where(eq(companies.name, "Dubai Premium Properties"))
  .limit(1);

if (existing.length > 0) {
  console.log("Demo data already seeded (Dubai Premium Properties exists). Skipping.");
  process.exit(0);
}

console.log("Seeding demo data for Dubai Premium Properties...\n");

// ---------------------------------------------------------------------------
// 1. Company
// ---------------------------------------------------------------------------

const [company] = await db
  .insert(companies)
  .values({
    name: "Dubai Premium Properties",
    description:
      "Full-service Dubai real estate agency specialising in off-plan sales across JVC, Downtown, and Dubai Marina. AI-powered operations since 2026.",
    status: "active",
    issuePrefix: "DPP",
    budgetMonthlyCents: 25000, // $250/month budget
    spentMonthlyCents: 12400, // $124 spent so far
    requireBoardApprovalForNewAgents: false,
    brandColor: "#6366f1",
  })
  .returning();

const cid = company!.id;
console.log(`  ✓ Company: ${company!.name} (${cid})`);

// ---------------------------------------------------------------------------
// 2. Agents (5 — CEO, Sales, Content, Marketing, Finance)
// ---------------------------------------------------------------------------

const [ceo] = await db
  .insert(agents)
  .values({
    companyId: cid,
    name: "Khalid",
    role: "ceo",
    title: "Chief Executive Officer",
    icon: "👔",
    status: "idle",
    adapterType: "claude_local",
    adapterConfig: { model: "claude-sonnet-4-5-20250514" },
    runtimeConfig: { heartbeatIntervalSec: 14400 }, // every 4h
    budgetMonthlyCents: 8000,
    spentMonthlyCents: 4200,
    permissions: { canCreateAgents: true, canAssignTasks: true },
    lastHeartbeatAt: hoursAgo(2),
    metadata: {
      soulFile: "ceo/SOUL.md",
      gradient: "from-indigo-500 to-purple-600",
      areas: ["all"],
    },
  })
  .returning();

const [layla] = await db
  .insert(agents)
  .values({
    companyId: cid,
    name: "Layla",
    role: "sales",
    title: "Lead Sales Agent — JVC & Sports City",
    icon: "💬",
    status: "idle",
    reportsTo: ceo!.id,
    adapterType: "claude_local",
    adapterConfig: { model: "claude-sonnet-4-5-20250514" },
    runtimeConfig: { heartbeatIntervalSec: 0, wakeOnDemand: true },
    budgetMonthlyCents: 6000,
    spentMonthlyCents: 3800,
    capabilities:
      "Lead capture, scoring, enrichment, WhatsApp follow-ups, pipeline management, lead-to-broker handoff",
    permissions: { canAssignTasks: false },
    lastHeartbeatAt: ago(45),
    metadata: {
      gradient: "from-emerald-500 to-teal-600",
      areas: ["JVC", "Sports City", "Al Furjan"],
      languages: ["English", "Arabic"],
    },
  })
  .returning();

const [nour] = await db
  .insert(agents)
  .values({
    companyId: cid,
    name: "Nour",
    role: "content",
    title: "Content & Social Media Agent",
    icon: "🎨",
    status: "idle",
    reportsTo: ceo!.id,
    adapterType: "claude_local",
    adapterConfig: { model: "claude-sonnet-4-5-20250514" },
    runtimeConfig: { heartbeatIntervalSec: 0, wakeOnDemand: true },
    budgetMonthlyCents: 5000,
    spentMonthlyCents: 2400,
    capabilities:
      "Instagram content, pitch decks, landing pages, drip campaigns, social media scheduling",
    permissions: { canAssignTasks: false },
    lastHeartbeatAt: hoursAgo(6),
    metadata: {
      gradient: "from-pink-500 to-rose-600",
      areas: ["all"],
      languages: ["English", "Arabic"],
    },
  })
  .returning();

const [reem] = await db
  .insert(agents)
  .values({
    companyId: cid,
    name: "Reem",
    role: "marketing",
    title: "Market Intelligence Agent",
    icon: "📊",
    status: "idle",
    reportsTo: ceo!.id,
    adapterType: "claude_local",
    adapterConfig: { model: "claude-sonnet-4-5-20250514" },
    runtimeConfig: { heartbeatIntervalSec: 7200, wakeOnDemand: true }, // every 2h
    budgetMonthlyCents: 4000,
    spentMonthlyCents: 1400,
    capabilities:
      "DLD transaction monitoring, listing surveillance, news aggregation, investment analysis, competitor tracking",
    permissions: { canAssignTasks: false },
    lastHeartbeatAt: hoursAgo(1),
    metadata: {
      gradient: "from-amber-500 to-orange-600",
      areas: ["JVC", "Downtown", "Dubai Marina", "Business Bay"],
      languages: ["English"],
    },
  })
  .returning();

const [omar] = await db
  .insert(agents)
  .values({
    companyId: cid,
    name: "Omar",
    role: "finance",
    title: "Finance & Portfolio Agent",
    icon: "💰",
    status: "idle",
    reportsTo: ceo!.id,
    adapterType: "claude_local",
    adapterConfig: { model: "claude-sonnet-4-5-20250514" },
    runtimeConfig: { heartbeatIntervalSec: 0, wakeOnDemand: true },
    budgetMonthlyCents: 2000,
    spentMonthlyCents: 600,
    capabilities:
      "Agency cost analysis, landlord management, tenancy renewals, rent tracking, RERA calculations, budget monitoring",
    permissions: { canAssignTasks: false },
    lastHeartbeatAt: daysAgo(1),
    metadata: {
      gradient: "from-cyan-500 to-blue-600",
      areas: ["all"],
      languages: ["English", "Arabic"],
    },
  })
  .returning();

const allAgents = [ceo!, layla!, nour!, reem!, omar!];
console.log(`  ✓ Agents: ${allAgents.map((a) => a.name).join(", ")}`);

// ---------------------------------------------------------------------------
// 3. Goal & Project
// ---------------------------------------------------------------------------

const [goal] = await db
  .insert(goals)
  .values({
    companyId: cid,
    title: "Scale to 50 qualified leads per month",
    description:
      "Increase qualified lead pipeline from current ~20/month to 50/month through improved response times, content marketing, and market intelligence.",
    level: "company",
    status: "active",
    ownerAgentId: ceo!.id,
  })
  .returning();

const [project] = await db
  .insert(projects)
  .values({
    companyId: cid,
    goalId: goal!.id,
    name: "Agency Operations",
    description: "Day-to-day agency operations — lead management, content, market intel, portfolio",
    status: "in_progress",
    leadAgentId: ceo!.id,
    color: "#6366f1",
  })
  .returning();

console.log(`  ✓ Goal: ${goal!.title}`);
console.log(`  ✓ Project: ${project!.name}`);

// ---------------------------------------------------------------------------
// 4. Heartbeat Runs (recent history — mix of success/fail)
// ---------------------------------------------------------------------------

const runs = await db
  .insert(heartbeatRuns)
  .values([
    {
      companyId: cid,
      agentId: ceo!.id,
      invocationSource: "scheduled",
      status: "succeeded",
      startedAt: hoursAgo(6),
      finishedAt: new Date(hoursAgo(6).getTime() + 45_000),
      usageJson: { inputTokens: 8200, outputTokens: 1840, cachedInputTokens: 3100, costCents: 18 },
      resultJson: { summary: "Morning brief generated. 3 approvals queued. Delegated follow-up batch to Layla." },
      contextSnapshot: { wakeReason: "scheduled", taskCount: 3 },
    },
    {
      companyId: cid,
      agentId: layla!.id,
      invocationSource: "assignment",
      status: "succeeded",
      startedAt: ago(45),
      finishedAt: new Date(ago(45).getTime() + 62_000),
      usageJson: { inputTokens: 6400, outputTokens: 2100, cachedInputTokens: 1800, costCents: 14 },
      resultJson: { summary: "Drafted WhatsApp follow-ups for 4 leads. Queued 2 approvals. Scored 1 new lead at 7/10." },
      contextSnapshot: { wakeReason: "assignment", issueIds: [] },
    },
    {
      companyId: cid,
      agentId: nour!.id,
      invocationSource: "scheduled",
      status: "succeeded",
      startedAt: hoursAgo(6),
      finishedAt: new Date(hoursAgo(6).getTime() + 38_000),
      usageJson: { inputTokens: 5100, outputTokens: 3200, cachedInputTokens: 900, costCents: 12 },
      resultJson: { summary: "Generated Instagram carousel for Damac Lagoons. Created pitch deck for Binghatti Aurora." },
      contextSnapshot: { wakeReason: "scheduled" },
    },
    {
      companyId: cid,
      agentId: reem!.id,
      invocationSource: "scheduled",
      status: "failed",
      startedAt: hoursAgo(3),
      finishedAt: new Date(hoursAgo(3).getTime() + 120_000),
      error: "Timeout: DLD transaction API took longer than 120s to respond",
      exitCode: 1,
      stderrExcerpt: "Error: Request to dld.gov.ae timed out after 120000ms",
      usageJson: { inputTokens: 2100, outputTokens: 400, cachedInputTokens: 800, costCents: 4 },
      contextSnapshot: { wakeReason: "scheduled" },
    },
    {
      companyId: cid,
      agentId: reem!.id,
      invocationSource: "scheduled",
      status: "succeeded",
      startedAt: hoursAgo(1),
      finishedAt: new Date(hoursAgo(1).getTime() + 52_000),
      usageJson: { inputTokens: 4800, outputTokens: 1600, cachedInputTokens: 2200, costCents: 10 },
      resultJson: { summary: "DLD report complete. 142 transactions in JVC this week (+12% WoW). Average price AED 1,180/sqft." },
      contextSnapshot: { wakeReason: "scheduled" },
    },
    {
      companyId: cid,
      agentId: omar!.id,
      invocationSource: "assignment",
      status: "succeeded",
      startedAt: daysAgo(1),
      finishedAt: new Date(daysAgo(1).getTime() + 28_000),
      usageJson: { inputTokens: 3200, outputTokens: 1100, cachedInputTokens: 600, costCents: 6 },
      resultJson: { summary: "Q1 cost analysis complete. Total agency AI spend: $124. Projected Q2: $380." },
      contextSnapshot: { wakeReason: "assignment" },
    },
  ])
  .returning();

console.log(`  ✓ Heartbeat runs: ${runs.length}`);

// ---------------------------------------------------------------------------
// 5. Issues / Tasks (10 across agents)
// ---------------------------------------------------------------------------

const taskValues = [
  {
    companyId: cid,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Follow up with Ahmed Al Hashimi — JVC 2BR enquiry",
    description:
      "Ahmed enquired about 2BR apartments in JVC via Property Finder 48h ago. First response sent. No reply yet. Draft a WhatsApp follow-up with Binghatti Hills pricing.",
    status: "in_progress",
    priority: "high" as const,
    assigneeAgentId: layla!.id,
    createdByAgentId: ceo!.id,
    issueNumber: 1,
    identifier: "DPP-1",
    originKind: "agent",
    createdAt: daysAgo(2),
  },
  {
    companyId: cid,
    projectId: project!.id,
    title: "Draft Instagram carousel — Damac Lagoons Q2 launch",
    description:
      "Create a 5-slide carousel for Instagram highlighting Damac Lagoons Maldives phase. Include: renders, starting price, payment plan, location map, CTA.",
    status: "todo",
    priority: "medium" as const,
    assigneeAgentId: nour!.id,
    createdByAgentId: ceo!.id,
    issueNumber: 2,
    identifier: "DPP-2",
    originKind: "agent",
    createdAt: daysAgo(1),
  },
  {
    companyId: cid,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Weekly DLD transaction report — JVC, Downtown, Marina",
    description:
      "Pull DLD transaction data for the past 7 days. Summarise volume, average price per sqft, notable deals. Flag any developer price changes.",
    status: "done",
    priority: "medium" as const,
    assigneeAgentId: reem!.id,
    createdByAgentId: ceo!.id,
    issueNumber: 3,
    identifier: "DPP-3",
    originKind: "agent",
    completedAt: hoursAgo(1),
    createdAt: daysAgo(2),
  },
  {
    companyId: cid,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Reactivate stale leads — 30+ days no contact",
    description:
      "Search for leads with last_contact_at > 30 days ago and score >= 5. Draft personalised reactivation WhatsApp templates. Queue for approval.",
    status: "todo",
    priority: "high" as const,
    assigneeAgentId: layla!.id,
    createdByAgentId: ceo!.id,
    issueNumber: 4,
    identifier: "DPP-4",
    originKind: "agent",
    createdAt: hoursAgo(4),
  },
  {
    companyId: cid,
    projectId: project!.id,
    title: "Generate pitch deck — Binghatti Aurora Downtown",
    description:
      "Create a branded PDF pitch deck for Binghatti Aurora. Include: project overview, floor plans, payment plan comparison, ROI projection, location highlights, developer track record.",
    status: "in_progress",
    priority: "medium" as const,
    assigneeAgentId: nour!.id,
    createdByAgentId: ceo!.id,
    issueNumber: 5,
    identifier: "DPP-5",
    originKind: "agent",
    startedAt: hoursAgo(6),
    createdAt: daysAgo(1),
  },
  {
    companyId: cid,
    projectId: project!.id,
    title: "Q1 agency cost analysis",
    description:
      "Compile total AI agent costs for Q1 2026. Break down by agent, by tool usage, by lead outcome. Compare against revenue generated. Project Q2 costs at current trajectory.",
    status: "in_review",
    priority: "low" as const,
    assigneeAgentId: omar!.id,
    createdByAgentId: ceo!.id,
    issueNumber: 6,
    identifier: "DPP-6",
    originKind: "agent",
    createdAt: daysAgo(3),
  },
  {
    companyId: cid,
    projectId: project!.id,
    title: "Connect Google Calendar for viewing scheduling",
    description: "Set up Google Calendar OAuth integration so the Viewing Agent can manage appointments.",
    status: "backlog",
    priority: "low" as const,
    assigneeAgentId: ceo!.id,
    issueNumber: 7,
    identifier: "DPP-7",
    originKind: "manual",
    createdAt: daysAgo(5),
  },
  {
    companyId: cid,
    projectId: project!.id,
    title: "Morning brief — March 31",
    description:
      "Daily briefing: overnight lead activity, pending approvals, agent costs, key metrics, today's priorities.",
    status: "done",
    priority: "medium" as const,
    assigneeAgentId: ceo!.id,
    createdByAgentId: ceo!.id,
    issueNumber: 8,
    identifier: "DPP-8",
    originKind: "agent",
    completedAt: hoursAgo(6),
    createdAt: hoursAgo(6),
  },
  {
    companyId: cid,
    projectId: project!.id,
    title: "Review Property Finder listing performance — March",
    description:
      "Analyse PF listing views, enquiry rates, and lead quality for our active listings. Recommend changes to listing descriptions or photos.",
    status: "todo",
    priority: "medium" as const,
    assigneeAgentId: reem!.id,
    createdByAgentId: ceo!.id,
    issueNumber: 9,
    identifier: "DPP-9",
    originKind: "agent",
    createdAt: hoursAgo(3),
  },
  {
    companyId: cid,
    projectId: project!.id,
    title: "Process tenancy renewal — Unit 1204, Binghatti Stars JVC",
    description:
      "Tenancy for Mr. Hassan expires April 15. RERA rent calculator shows 0% increase is fair. Draft renewal offer at same rate. Send via email for landlord approval.",
    status: "todo",
    priority: "high" as const,
    assigneeAgentId: omar!.id,
    createdByAgentId: ceo!.id,
    issueNumber: 10,
    identifier: "DPP-10",
    originKind: "agent",
    createdAt: hoursAgo(8),
  },
];

const issuesToInsert = taskValues.map(({ ...v }) => v);
const insertedIssues = await db.insert(issues).values(issuesToInsert).returning();
console.log(`  ✓ Tasks: ${insertedIssues.length}`);

// ---------------------------------------------------------------------------
// 6. CEO Chat thread (persistent issue + recent messages)
// ---------------------------------------------------------------------------

const [ceoChatIssue] = await db
  .insert(issues)
  .values({
    companyId: cid,
    projectId: project!.id,
    title: "CEO Chat",
    description: "Persistent chat thread between agency owner and CEO agent.",
    status: "in_progress",
    priority: "medium",
    assigneeAgentId: ceo!.id,
    issueNumber: 100,
    identifier: "DPP-100",
    originKind: "system",
    createdAt: daysAgo(7),
  })
  .returning();

// Seed some chat messages
await db.insert(issueComments).values([
  {
    companyId: cid,
    issueId: ceoChatIssue!.id,
    authorAgentId: ceo!.id,
    body: `Good morning! Here's your daily brief for March 31.\n\n**📊 Overnight Activity**\n- 3 new leads came in (2 from Property Finder, 1 from Instagram DM)\n- Layla responded to all 3 within 4 minutes\n- 1 lead scored 7/10 — Ahmed Al Hashimi, looking for 2BR in JVC, budget AED 1.2M\n\n**⏳ Pending Approvals (3)**\n- WhatsApp follow-up to Ahmed Al Hashimi (Layla)\n- Instagram carousel — Damac Lagoons (Nour)\n- Hire Viewing Agent request\n\n**💰 Costs Yesterday:** $18.40\n- Khalid: $4.20 | Layla: $6.80 | Nour: $4.40 | Reem: $2.10 | Omar: $0.90\n\n**🎯 Today's Priorities**\n1. Approve the Ahmed follow-up — he's a hot lead\n2. Review Nour's Damac Lagoons content before posting\n3. Decide on hiring a Viewing Agent — we're getting 3+ viewing requests/week`,
    createdAt: hoursAgo(6),
  },
  {
    companyId: cid,
    issueId: ceoChatIssue!.id,
    authorUserId: "board",
    body: "What's Ahmed's full profile? Is he worth prioritising?",
    createdAt: hoursAgo(5),
  },
  {
    companyId: cid,
    issueId: ceoChatIssue!.id,
    authorAgentId: ceo!.id,
    body: `Here's Ahmed Al Hashimi's profile:\n\n**Score:** 7/10\n**Source:** Property Finder — enquired about Binghatti Hills JVC\n**Budget:** AED 1.0–1.4M\n**Type:** 2BR apartment, off-plan preferred\n**Timeline:** "Within 3 months"\n**Language:** English + Arabic\n**Financing:** Cash buyer (mentioned "no mortgage")\n\n**Why he's worth prioritising:**\n- Cash buyer with a clear budget and timeline\n- JVC 2BR off-plan at AED 1.0–1.4M matches 6 active projects\n- Responded to Layla's first message within 20 minutes — high engagement\n- DLD check: no prior Dubai purchases — first-time buyer (motivated)\n\nI recommend approving Layla's follow-up immediately. She's drafted a personalised message with Binghatti Hills floor plans and payment plan.`,
    createdAt: hoursAgo(5),
  },
  {
    companyId: cid,
    issueId: ceoChatIssue!.id,
    authorUserId: "board",
    body: "Yes, approve it. And brief me on the Damac Lagoons post before it goes out.",
    createdAt: hoursAgo(4),
  },
  {
    companyId: cid,
    issueId: ceoChatIssue!.id,
    authorAgentId: ceo!.id,
    body: `Done — Layla's follow-up to Ahmed is approved and queued for sending.\n\nRegarding the Damac Lagoons carousel, Nour has prepared a 5-slide Instagram post:\n\n1. **Hero render** — Maldives-inspired waterfront villas\n2. **Starting price** — AED 1.8M, 60/40 payment plan\n3. **Location map** — 20 min to Downtown, Dubai Marina nearby\n4. **Amenities** — crystal lagoon, beach club, floating restaurants\n5. **CTA** — "DM us for exclusive pricing 📩"\n\nCaption: "Live the island life without leaving Dubai 🌴 Damac Lagoons Maldives — starting AED 1.8M..."\n\nShall I show you the full content for approval?`,
    createdAt: hoursAgo(4),
  },
]);

console.log(`  ✓ CEO Chat thread with 5 messages`);

// ---------------------------------------------------------------------------
// 7. Approvals (3 pending)
// ---------------------------------------------------------------------------

await db.insert(approvals).values([
  {
    companyId: cid,
    type: "send_whatsapp",
    requestedByAgentId: layla!.id,
    status: "pending",
    payload: {
      action: "send_whatsapp",
      to: "Ahmed Al Hashimi",
      phone: "+971501234567",
      leadScore: 7,
      message:
        "Hi Ahmed! 👋 Following up on your interest in JVC apartments. I've put together the Binghatti Hills floor plans and payment plan for the 2BR units within your budget.\n\nStarting from AED 1.05M with a 60/40 payment plan — 1% monthly during construction.\n\nWould you like to schedule a viewing this week? I have availability Thursday or Saturday.\n\n— Layla, Dubai Premium Properties",
      context:
        "Lead enquired 48h ago via Property Finder. First message sent — lead replied within 20 min. Cash buyer, first-time Dubai purchase. Score 7/10.",
    },
    createdAt: ago(45),
  },
  {
    companyId: cid,
    type: "post_instagram",
    requestedByAgentId: nour!.id,
    status: "pending",
    payload: {
      action: "post_instagram",
      contentType: "carousel",
      slides: 5,
      caption:
        "Live the island life without leaving Dubai 🌴\n\nDamac Lagoons Maldives phase — waterfront villas starting AED 1.8M with a 60/40 payment plan.\n\n✨ Crystal lagoon & beach club\n📍 20 min to Downtown Dubai\n🏠 2-5 BR villas\n\nDM us for exclusive pricing and floor plans 📩\n\n#DubaiRealEstate #DamacLagoons #OffPlanDubai #DubaiProperty #InvestInDubai #DubaiVillas",
      bestTimeToPost: "7:00 PM GST (peak Dubai Instagram engagement)",
      hashtags: 6,
    },
    createdAt: hoursAgo(5),
  },
  {
    companyId: cid,
    type: "hire_agent",
    requestedByAgentId: ceo!.id,
    status: "pending",
    payload: {
      action: "hire_agent",
      agentName: "Farah",
      role: "viewing",
      title: "Viewing & Calendar Agent",
      reason:
        "We're averaging 3+ viewing requests per week and currently handling them manually. A dedicated Viewing Agent can automate scheduling, send confirmations, manage calendar conflicts, and do post-viewing follow-ups.",
      estimatedMonthlyCost: "$15-25",
      capabilities: "Viewing scheduling, calendar management, confirmation messages, post-viewing follow-up",
    },
    createdAt: hoursAgo(4),
  },
]);

console.log(`  ✓ Approvals: 3 pending`);

// ---------------------------------------------------------------------------
// 8. Cost Events (realistic per-agent breakdown totalling ~$124)
// ---------------------------------------------------------------------------

// Spread cost events across the last 7 days
const costData = [
  // CEO runs
  { agentId: ceo!.id, provider: "anthropic", model: "claude-sonnet-4-5", inputTokens: 52000, outputTokens: 12400, cachedInputTokens: 18000, costCents: 4200, daysBack: 0 },
  // Layla runs
  { agentId: layla!.id, provider: "anthropic", model: "claude-sonnet-4-5", inputTokens: 41000, outputTokens: 14200, cachedInputTokens: 11000, costCents: 3800, daysBack: 0 },
  // Nour runs
  { agentId: nour!.id, provider: "anthropic", model: "claude-sonnet-4-5", inputTokens: 28000, outputTokens: 18600, cachedInputTokens: 5000, costCents: 2400, daysBack: 0 },
  // Reem runs
  { agentId: reem!.id, provider: "anthropic", model: "claude-sonnet-4-5", inputTokens: 22000, outputTokens: 6800, cachedInputTokens: 9000, costCents: 1400, daysBack: 0 },
  // Omar runs
  { agentId: omar!.id, provider: "anthropic", model: "claude-sonnet-4-5", inputTokens: 8000, outputTokens: 3200, cachedInputTokens: 2000, costCents: 600, daysBack: 1 },
];

await db.insert(costEvents).values(
  costData.map((c) => ({
    companyId: cid,
    agentId: c.agentId,
    provider: c.provider,
    biller: "anthropic",
    billingType: "token_usage",
    model: c.model,
    inputTokens: c.inputTokens,
    cachedInputTokens: c.cachedInputTokens,
    outputTokens: c.outputTokens,
    costCents: c.costCents,
    occurredAt: daysAgo(c.daysBack),
  })),
);

console.log(`  ✓ Cost events: $${(costData.reduce((s, c) => s + c.costCents, 0) / 100).toFixed(2)} total`);

// ---------------------------------------------------------------------------
// 9. Activity Log (25+ entries over past 48h)
// ---------------------------------------------------------------------------

const activities = [
  // Day 2 ago
  { actorType: "agent", actorId: ceo!.id, action: "agent.created", entityType: "agent", entityId: omar!.id, agentId: ceo!.id, details: { agentName: "Omar", role: "finance" }, createdAt: daysAgo(2) },
  { actorType: "agent", actorId: ceo!.id, action: "issue.created", entityType: "issue", entityId: insertedIssues[0]!.id, agentId: ceo!.id, details: { title: "Follow up with Ahmed Al Hashimi" }, createdAt: daysAgo(2) },
  { actorType: "agent", actorId: ceo!.id, action: "issue.assigned", entityType: "issue", entityId: insertedIssues[0]!.id, agentId: layla!.id, details: { assignee: "Layla" }, createdAt: daysAgo(2) },

  // Day 1 ago
  { actorType: "agent", actorId: ceo!.id, action: "issue.created", entityType: "issue", entityId: insertedIssues[1]!.id, agentId: ceo!.id, details: { title: "Draft Instagram carousel — Damac Lagoons" }, createdAt: daysAgo(1) },
  { actorType: "agent", actorId: ceo!.id, action: "issue.assigned", entityType: "issue", entityId: insertedIssues[1]!.id, agentId: nour!.id, details: { assignee: "Nour" }, createdAt: daysAgo(1) },
  { actorType: "agent", actorId: nour!.id, action: "run.started", entityType: "heartbeat_run", entityId: runs[2]!.id, agentId: nour!.id, details: { source: "scheduled" }, createdAt: daysAgo(1) },
  { actorType: "agent", actorId: nour!.id, action: "run.completed", entityType: "heartbeat_run", entityId: runs[2]!.id, agentId: nour!.id, details: { summary: "Generated Instagram carousel and pitch deck" }, createdAt: daysAgo(1) },
  { actorType: "agent", actorId: omar!.id, action: "run.started", entityType: "heartbeat_run", entityId: runs[5]!.id, agentId: omar!.id, details: { source: "assignment" }, createdAt: daysAgo(1) },
  { actorType: "agent", actorId: omar!.id, action: "run.completed", entityType: "heartbeat_run", entityId: runs[5]!.id, agentId: omar!.id, details: { summary: "Q1 cost analysis complete" }, createdAt: daysAgo(1) },
  { actorType: "agent", actorId: omar!.id, action: "issue.status_changed", entityType: "issue", entityId: insertedIssues[5]!.id, agentId: omar!.id, details: { from: "in_progress", to: "in_review" }, createdAt: daysAgo(1) },

  // Today — morning
  { actorType: "agent", actorId: ceo!.id, action: "run.started", entityType: "heartbeat_run", entityId: runs[0]!.id, agentId: ceo!.id, details: { source: "scheduled" }, createdAt: hoursAgo(6) },
  { actorType: "agent", actorId: ceo!.id, action: "comment.created", entityType: "issue", entityId: ceoChatIssue!.id, agentId: ceo!.id, details: { summary: "Morning brief posted" }, createdAt: hoursAgo(6) },
  { actorType: "agent", actorId: ceo!.id, action: "run.completed", entityType: "heartbeat_run", entityId: runs[0]!.id, agentId: ceo!.id, details: { summary: "Morning brief generated, 3 approvals queued" }, createdAt: hoursAgo(6) },
  { actorType: "agent", actorId: ceo!.id, action: "issue.created", entityType: "issue", entityId: insertedIssues[3]!.id, agentId: ceo!.id, details: { title: "Reactivate stale leads" }, createdAt: hoursAgo(4) },
  { actorType: "agent", actorId: ceo!.id, action: "approval.requested", entityType: "approval", entityId: "pending", agentId: ceo!.id, details: { type: "hire_agent", agentName: "Farah" }, createdAt: hoursAgo(4) },

  // Today — Reem's failed then successful run
  { actorType: "agent", actorId: reem!.id, action: "run.started", entityType: "heartbeat_run", entityId: runs[3]!.id, agentId: reem!.id, details: { source: "scheduled" }, createdAt: hoursAgo(3) },
  { actorType: "agent", actorId: reem!.id, action: "run.failed", entityType: "heartbeat_run", entityId: runs[3]!.id, agentId: reem!.id, details: { error: "DLD API timeout" }, createdAt: hoursAgo(3) },
  { actorType: "agent", actorId: reem!.id, action: "run.started", entityType: "heartbeat_run", entityId: runs[4]!.id, agentId: reem!.id, details: { source: "scheduled" }, createdAt: hoursAgo(1) },
  { actorType: "agent", actorId: reem!.id, action: "run.completed", entityType: "heartbeat_run", entityId: runs[4]!.id, agentId: reem!.id, details: { summary: "DLD report complete — 142 JVC transactions" }, createdAt: hoursAgo(1) },
  { actorType: "agent", actorId: reem!.id, action: "issue.status_changed", entityType: "issue", entityId: insertedIssues[2]!.id, agentId: reem!.id, details: { from: "in_progress", to: "done" }, createdAt: hoursAgo(1) },

  // Today — Layla's run
  { actorType: "agent", actorId: layla!.id, action: "run.started", entityType: "heartbeat_run", entityId: runs[1]!.id, agentId: layla!.id, details: { source: "assignment" }, createdAt: ago(45) },
  { actorType: "agent", actorId: layla!.id, action: "approval.requested", entityType: "approval", entityId: "pending", agentId: layla!.id, details: { type: "send_whatsapp", to: "Ahmed Al Hashimi" }, createdAt: ago(45) },
  { actorType: "agent", actorId: layla!.id, action: "run.completed", entityType: "heartbeat_run", entityId: runs[1]!.id, agentId: layla!.id, details: { summary: "Drafted 4 follow-ups, queued 2 approvals" }, createdAt: ago(44) },
  { actorType: "agent", actorId: nour!.id, action: "approval.requested", entityType: "approval", entityId: "pending", agentId: nour!.id, details: { type: "post_instagram", content: "Damac Lagoons carousel" }, createdAt: hoursAgo(5) },

  // Budget warning
  { actorType: "system", actorId: "system", action: "budget.warning", entityType: "agent", entityId: layla!.id, details: { agentName: "Layla", spentPercent: 63, message: "Layla has used 63% of her monthly budget ($38 of $60)" }, createdAt: hoursAgo(2) },
];

await db.insert(activityLog).values(
  activities.map((a) => ({
    companyId: cid,
    actorType: a.actorType,
    actorId: String(a.actorId),
    action: a.action,
    entityType: a.entityType,
    entityId: String(a.entityId),
    agentId: a.agentId && a.actorType === "agent" ? (a.agentId as string) : undefined,
    details: a.details,
    createdAt: a.createdAt,
  })),
);

console.log(`  ✓ Activity log: ${activities.length} entries`);

// ---------------------------------------------------------------------------
// 10. Deliverables / Work Products (3)
// ---------------------------------------------------------------------------

await db.insert(issueWorkProducts).values([
  {
    companyId: cid,
    projectId: project!.id,
    issueId: insertedIssues[4]!.id, // Pitch deck task
    type: "document",
    provider: "internal",
    title: "Binghatti Aurora — Investor Pitch Deck",
    status: "draft",
    isPrimary: true,
    summary: "12-page branded pitch deck with project overview, floor plans, payment plan comparison, ROI projection.",
    metadata: { format: "pdf", pages: 12, generatedBy: "Nour" },
    createdAt: hoursAgo(5),
  },
  {
    companyId: cid,
    projectId: project!.id,
    issueId: insertedIssues[2]!.id, // DLD report task
    type: "document",
    provider: "internal",
    title: "JVC Market Report — Week of March 24",
    url: "#",
    status: "active",
    isPrimary: true,
    summary: "142 transactions in JVC. Average AED 1,180/sqft (+3.2% MoM). Top developer: Binghatti (38 units).",
    metadata: { format: "pdf", pages: 6, generatedBy: "Reem" },
    createdAt: hoursAgo(1),
  },
  {
    companyId: cid,
    projectId: project!.id,
    issueId: insertedIssues[1]!.id, // Instagram carousel task
    type: "file",
    provider: "internal",
    title: "Damac Lagoons Carousel — 5 slides",
    status: "ready_for_review",
    isPrimary: true,
    summary: "5-slide Instagram carousel: hero render, pricing, location map, amenities, CTA. Awaiting approval.",
    metadata: { format: "png", slides: 5, generatedBy: "Nour" },
    createdAt: hoursAgo(5),
  },
]);

console.log(`  ✓ Deliverables: 3`);

// ---------------------------------------------------------------------------
// 11. Automations / Routines (5)
// ---------------------------------------------------------------------------

const routineValues = [
  {
    title: "Daily Morning Brief",
    description:
      "CEO generates a morning briefing every day at 8am: overnight activity, pending approvals, costs, priorities.",
    assigneeAgentId: ceo!.id,
    priority: "high" as const,
    status: "active",
    lastTriggeredAt: hoursAgo(6),
    cronExpression: "0 8 * * *",
    timezone: "Asia/Dubai",
  },
  {
    title: "Lead Follow-Up Loop",
    description:
      "Layla checks for leads requiring follow-up every 4 hours. Drafts WhatsApp messages and queues for approval.",
    assigneeAgentId: layla!.id,
    priority: "high" as const,
    status: "active",
    lastTriggeredAt: ago(45),
    cronExpression: "0 */4 * * *",
    timezone: "Asia/Dubai",
  },
  {
    title: "Instagram Content Scheduler",
    description:
      "Nour generates the day's content queue at 9am. Creates carousels, reels concepts, and stories for approval.",
    assigneeAgentId: nour!.id,
    priority: "medium" as const,
    status: "active",
    lastTriggeredAt: hoursAgo(6),
    cronExpression: "0 9 * * *",
    timezone: "Asia/Dubai",
  },
  {
    title: "Tenancy Renewal Check",
    description:
      "Omar scans for tenancies expiring within 60 days every Monday. Drafts renewal offers and flags urgent ones.",
    assigneeAgentId: omar!.id,
    priority: "medium" as const,
    status: "active",
    lastTriggeredAt: daysAgo(3),
    cronExpression: "0 8 * * 1",
    timezone: "Asia/Dubai",
  },
  {
    title: "Market Intelligence Sweep",
    description:
      "Reem monitors DLD transactions, new listings, and news every 2 hours. Flags notable market movements.",
    assigneeAgentId: reem!.id,
    priority: "medium" as const,
    status: "active",
    lastTriggeredAt: hoursAgo(1),
    cronExpression: "0 */2 * * *",
    timezone: "Asia/Dubai",
  },
];

for (const r of routineValues) {
  const { cronExpression, timezone, lastTriggeredAt, ...routineData } = r;

  const [routine] = await db
    .insert(routines)
    .values({
      companyId: cid,
      projectId: project!.id,
      ...routineData,
      lastTriggeredAt,
    })
    .returning();

  await db.insert(routineTriggers).values({
    companyId: cid,
    routineId: routine!.id,
    kind: "cron",
    label: r.title,
    enabled: true,
    cronExpression,
    timezone,
    lastFiredAt: lastTriggeredAt,
  });
}

console.log(`  ✓ Automations: ${routineValues.length}`);

// ---------------------------------------------------------------------------
// 12. Properties (5 sales, 5 rentals)
// ---------------------------------------------------------------------------

console.log("  Seeding properties...");

const propertyData = [
  {
    companyId: cid,
    listingType: "sale",
    buildingName: "Binghatti Hills",
    area: "JVC",
    unit: "1204",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1245,
    floor: "12",
    viewType: "Pool",
    parkingSpaces: 1,
    saleValue: 1_850_000,
    pipelineStatus: "available",
    photos: [],
    createdAt: daysAgo(12),
  },
  {
    companyId: cid,
    listingType: "sale",
    buildingName: "The Address Residences",
    area: "Downtown Dubai",
    unit: "3502",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 3,
    sqft: 2100,
    floor: "35",
    viewType: "Burj Khalifa",
    parkingSpaces: 2,
    saleValue: 3_200_000,
    pipelineStatus: "viewing_scheduled",
    photos: [],
    createdAt: daysAgo(5),
  },
  {
    companyId: cid,
    listingType: "sale",
    buildingName: "Vincitore Palacio",
    area: "Arjan",
    unit: "507",
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    sqft: 780,
    floor: "5",
    viewType: "Garden",
    parkingSpaces: 1,
    saleValue: 950_000,
    pipelineStatus: "offer_received",
    photos: [],
    createdAt: daysAgo(28),
  },
  {
    companyId: cid,
    listingType: "sale",
    buildingName: "Marina Gate",
    area: "Dubai Marina",
    unit: "2201",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1580,
    floor: "22",
    viewType: "Marina",
    parkingSpaces: 1,
    saleValue: 2_400_000,
    pipelineStatus: "sold",
    photos: [],
    createdAt: daysAgo(45),
  },
  {
    companyId: cid,
    listingType: "sale",
    buildingName: "Sobha Hartland Greens",
    area: "MBR City",
    unit: "Villa 14",
    propertyType: "villa",
    bedrooms: 4,
    bathrooms: 5,
    sqft: 3200,
    floor: "G+1",
    viewType: "Lagoon",
    parkingSpaces: 2,
    saleValue: 4_500_000,
    pipelineStatus: "available",
    photos: [],
    createdAt: daysAgo(2),
  },
  {
    companyId: cid,
    listingType: "rental",
    buildingName: "Bloom Towers",
    area: "JVC",
    unit: "804",
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    sqft: 650,
    floor: "8",
    viewType: "Community",
    parkingSpaces: 1,
    rentalPrice: 55_000,
    pipelineStatus: "available",
    photos: [],
    createdAt: daysAgo(7),
  },
  {
    companyId: cid,
    listingType: "rental",
    buildingName: "DAMAC Hills 2",
    area: "DAMAC Hills",
    unit: "TH-22",
    propertyType: "townhouse",
    bedrooms: 3,
    bathrooms: 3,
    sqft: 1800,
    floor: "G+1",
    viewType: "Park",
    parkingSpaces: 2,
    rentalPrice: 95_000,
    pipelineStatus: "viewing_scheduled",
    photos: [],
    createdAt: daysAgo(10),
  },
  {
    companyId: cid,
    listingType: "rental",
    buildingName: "Park Heights",
    area: "Dubai Hills",
    unit: "1605",
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1100,
    floor: "16",
    viewType: "Park",
    parkingSpaces: 1,
    rentalPrice: 120_000,
    pipelineStatus: "application_received",
    photos: [],
    createdAt: daysAgo(20),
  },
  {
    companyId: cid,
    listingType: "rental",
    buildingName: "Al Habtoor City",
    area: "Business Bay",
    unit: "4101",
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 4,
    sqft: 2400,
    floor: "41",
    viewType: "Canal",
    parkingSpaces: 2,
    rentalPrice: 180_000,
    pipelineStatus: "under_contract",
    photos: [],
    createdAt: daysAgo(35),
  },
  {
    companyId: cid,
    listingType: "rental",
    buildingName: "Samana Golf Avenue",
    area: "Dubai Sports City",
    unit: "302",
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 2,
    sqft: 890,
    floor: "3",
    viewType: "Golf Course",
    parkingSpaces: 1,
    rentalPrice: 65_000,
    pipelineStatus: "rented",
    photos: [],
    createdAt: daysAgo(60),
  },
];

const insertedProperties = await db
  .insert(aygentProperties)
  .values(propertyData)
  .returning({ id: aygentProperties.id });

console.log(`  ✓ ${insertedProperties.length} properties seeded`);

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log("\n✅ Demo seed complete — Dubai Premium Properties is ready.\n");
process.exit(0);
