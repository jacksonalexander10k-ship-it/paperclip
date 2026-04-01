/**
 * Demo Seed Script — creates a fully populated demo agency
 * that showcases every Phase 4-8 feature.
 *
 * Run from server package: pnpm --filter @paperclipai/db exec tsx ../../server/scripts/seed-demo.ts
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import {
  companies,
  agents,
  issues,
  approvals,
  costEvents,
  aygentLeads,
  aygentProperties,
  aygentWhatsappMessages,
  aygentAgentLearnings,
  aygentAgentMessages,
} from "./schema/index.js";

// Embedded Postgres used by Paperclip (default port 54329)
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql);

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------
const COMPANY_ID = randomUUID();
const CEO_ID = randomUUID();
const SALES_ID = randomUUID();
const CONTENT_ID = randomUUID();
const MARKET_ID = randomUUID();
const VIEWING_ID = randomUUID();

const LEADS = Array.from({ length: 15 }, () => randomUUID());
const PROPERTIES = Array.from({ length: 8 }, () => randomUUID());
const CEO_CHAT_ISSUE_ID = randomUUID();

function ago(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function seed() {
  console.log("🌱 Seeding demo agency...\n");

  // Clean up any previous demo data using deferred FK checks
  console.log("  Cleaning previous demo data...");
  const oldCompanies = await sql`SELECT id FROM companies WHERE issue_prefix = 'DPP'`;
  for (const row of oldCompanies) {
    const cid = row.id;
    // Disable FK checks temporarily for clean deletion
    await sql`SET session_replication_role = replica`;
    // Get all tables that have company_id and delete from them
    const tables = await sql`
      SELECT DISTINCT table_name FROM information_schema.columns
      WHERE column_name = 'company_id' AND table_schema = 'public'
    `;
    for (const t of tables) {
      try {
        await sql.unsafe(`DELETE FROM "${t.table_name}" WHERE company_id = '${cid}'`);
      } catch { /* table might not have data */ }
    }
    await sql`DELETE FROM companies WHERE id = ${cid}`;
    await sql`SET session_replication_role = DEFAULT`;
  }
  console.log("  ✓ Clean\n");

  // ── Company ────────────────────────────────────────────────
  await db.insert(companies).values({
    id: COMPANY_ID,
    name: "Dubai Prestige Properties",
    description: "Premium off-plan and secondary real estate in Dubai",
    status: "active",
    issuePrefix: "DPP",
    budgetMonthlyCents: 50000,
    spentMonthlyCents: 3240,
    brandColor: "#0f766e",
  });
  console.log("✓ Company: Dubai Prestige Properties");

  // ── Agents ─────────────────────────────────────────────────
  const agentData = [
    { id: CEO_ID, name: "Khalid", role: "ceo", title: "CEO Agent", status: "idle", budget: 10000, spent: 840, reportsTo: null },
    { id: SALES_ID, name: "Layla", role: "sales", title: "Sales Agent — JVC & Downtown", status: "idle", budget: 15000, spent: 1200, reportsTo: CEO_ID },
    { id: CONTENT_ID, name: "Nour", role: "content", title: "Content Agent", status: "idle", budget: 8000, spent: 560, reportsTo: CEO_ID },
    { id: MARKET_ID, name: "Omar", role: "marketing", title: "Market Intelligence Agent", status: "idle", budget: 8000, spent: 420, reportsTo: CEO_ID },
    { id: VIEWING_ID, name: "Sara", role: "operations", title: "Viewing Coordinator", status: "idle", budget: 5000, spent: 220, reportsTo: SALES_ID },
  ];

  for (const a of agentData) {
    await db.insert(agents).values({
      id: a.id,
      companyId: COMPANY_ID,
      name: a.name,
      role: a.role,
      title: a.title,
      status: a.status,
      budgetMonthlyCents: a.budget,
      spentMonthlyCents: a.spent,
      reportsTo: a.reportsTo,
      lastHeartbeatAt: ago(Math.random() * 4),
    });
  }
  console.log("✓ 5 agents: Khalid (CEO), Layla (Sales), Nour (Content), Omar (Market), Sara (Viewing)");

  // ── CEO Chat Issue ─────────────────────────────────────────
  await db.insert(issues).values({
    id: CEO_CHAT_ISSUE_ID,
    companyId: COMPANY_ID,
    title: "CEO Chat",
    status: "in_progress",
    priority: "high",
    assigneeAgentId: CEO_ID,
  });
  console.log("✓ CEO Chat issue");

  // ── Leads ──────────────────────────────────────────────────
  const leadData = [
    { name: "Ahmed Al Hashimi", phone: "+971501234567", nationality: "UAE", budget: { min: 800000, max: 1200000, area: "JVC" }, propertyType: "1BR Apartment", score: 8, stage: "qualified", source: "property_finder", language: "Arabic", lastContact: ago(2) },
    { name: "Maria Petrova", phone: "+971552345678", nationality: "Russian", budget: { min: 1500000, max: 2500000, area: "Downtown" }, propertyType: "2BR Apartment", score: 9, stage: "viewing", source: "instagram", language: "Russian", lastContact: ago(6) },
    { name: "James Chen", phone: "+971553456789", nationality: "Chinese", budget: { min: 2000000, max: 5000000, area: "Palm Jumeirah" }, propertyType: "Villa", score: 7, stage: "qualified", source: "referral", language: "English", lastContact: daysAgo(3) },
    { name: "Fatima Al Mansouri", phone: "+971504567890", nationality: "UAE", budget: { min: 600000, max: 900000, area: "JVC" }, propertyType: "Studio", score: 6, stage: "lead", source: "bayut", language: "Arabic", lastContact: daysAgo(1) },
    { name: "Dmitri Volkov", phone: "+971555678901", nationality: "Russian", budget: { min: 3000000, max: 4000000, area: "Marina" }, propertyType: "3BR Apartment", score: 9, stage: "negotiation", source: "direct", language: "Russian", lastContact: ago(12) },
    { name: "Sarah Williams", phone: "+971556789012", nationality: "British", budget: { min: 1000000, max: 1500000, area: "Business Bay" }, propertyType: "1BR Apartment", score: 5, stage: "lead", source: "property_finder", language: "English", lastContact: daysAgo(6) },
    { name: "Ali Hassan", phone: "+971507890123", nationality: "Egyptian", budget: { min: 500000, max: 800000, area: "JVC" }, propertyType: "Studio", score: 4, stage: "lead", source: "facebook_ad", language: "Arabic", lastContact: daysAgo(8) },
    { name: "Anna Ivanova", phone: "+971558901234", nationality: "Russian", budget: { min: 900000, max: 1300000, area: "JVC" }, propertyType: "1BR Apartment", score: 7, stage: "contacted", source: "bayut", language: "Russian", lastContact: daysAgo(2) },
    { name: "Michael Brown", phone: "+971509012345", nationality: "American", budget: { min: 2000000, max: 3000000, area: "Creek Harbour" }, propertyType: "2BR Apartment", score: 6, stage: "contacted", source: "landing_page", language: "English", lastContact: daysAgo(4) },
    { name: "Priya Sharma", phone: "+971550123456", nationality: "Indian", budget: { min: 700000, max: 1000000, area: "Sports City" }, propertyType: "1BR Apartment", score: 5, stage: "lead", source: "dubizzle", language: "English", lastContact: daysAgo(10) },
    { name: "Hassan Al Qassimi", phone: "+971501112233", nationality: "UAE", budget: { min: 5000000, max: 10000000, area: "Downtown" }, propertyType: "Penthouse", score: 10, stage: "viewing", source: "referral", language: "Arabic", lastContact: ago(3) },
    { name: "Elena Kuznetsova", phone: "+971552223344", nationality: "Russian", budget: { min: 1200000, max: 1800000, area: "JVC" }, propertyType: "2BR Apartment", score: 7, stage: "qualified", source: "instagram", language: "Russian", lastContact: daysAgo(1) },
    { name: "Tom Wilson", phone: "+971553334455", nationality: "British", budget: { min: 400000, max: 600000, area: "JVC" }, propertyType: "Studio", score: 3, stage: "lead", source: "property_finder", language: "English", lastContact: daysAgo(15) },
    { name: "Yuki Tanaka", phone: "+971554445566", nationality: "Japanese", budget: { min: 1500000, max: 2000000, area: "Marina" }, propertyType: "1BR Apartment", score: 6, stage: "contacted", source: "landing_page", language: "English", lastContact: daysAgo(5) },
    { name: "Amir Khaled", phone: "+971505556677", nationality: "UAE", budget: { min: 800000, max: 1100000, area: "Business Bay" }, propertyType: "1BR Apartment", score: 7, stage: "qualified", source: "whatsapp", language: "Arabic", lastContact: daysAgo(2) },
  ];

  for (let i = 0; i < leadData.length; i++) {
    const l = leadData[i]!;
    await db.insert(aygentLeads).values({
      id: LEADS[i]!,
      companyId: COMPANY_ID,
      agentId: SALES_ID,
      name: l.name,
      phone: l.phone,
      nationality: l.nationality,
      budget: l.budget,
      propertyType: l.propertyType,
      score: l.score,
      stage: l.stage,
      source: l.source,
      language: l.language,
      lastContactAt: l.lastContact,
    });
  }
  console.log("✓ 15 leads across all stages and nationalities");

  // ── Properties ─────────────────────────────────────────────
  const propData = [
    { name: "Binghatti Hills", area: "JVC", type: "1BR Apartment", beds: 1, sqft: 750, sale: 850000, listing: "sale" },
    { name: "Sobha Hartland II", area: "MBR City", type: "2BR Apartment", beds: 2, sqft: 1200, sale: 1800000, listing: "sale" },
    { name: "Creek Rise", area: "Creek Harbour", type: "2BR Apartment", beds: 2, sqft: 1100, sale: 2200000, listing: "sale" },
    { name: "DAMAC Lagoons", area: "DAMAC Hills 2", type: "Villa", beds: 4, sqft: 2800, sale: 3500000, listing: "sale" },
    { name: "Marina Gate", area: "Dubai Marina", type: "3BR Apartment", beds: 3, sqft: 2100, sale: 4200000, listing: "sale" },
    { name: "JVC Tower 5", area: "JVC", type: "Studio", beds: 0, sqft: 450, rental: 45000, listing: "rental" },
    { name: "Bay Avenue", area: "Business Bay", type: "1BR Apartment", beds: 1, sqft: 800, rental: 85000, listing: "rental" },
    { name: "Palm View West", area: "Palm Jumeirah", type: "2BR Apartment", beds: 2, sqft: 1500, rental: 180000, listing: "rental" },
  ];

  for (let i = 0; i < propData.length; i++) {
    const p = propData[i]!;
    await db.insert(aygentProperties).values({
      id: PROPERTIES[i]!,
      companyId: COMPANY_ID,
      buildingName: p.name,
      area: p.area,
      propertyType: p.type,
      bedrooms: p.beds,
      sqft: p.sqft,
      saleValue: (p as any).sale ?? null,
      rentalPrice: (p as any).rental ?? null,
      listingType: p.listing,
      pipelineStatus: "active",
      status: "active",
    });
  }
  console.log("✓ 8 properties (5 sale, 3 rental)");

  // ── WhatsApp Messages (conversation history) ───────────────
  const waMessages = [
    { agent: SALES_ID, jid: "971501234567", fromMe: true, name: "Layla", content: "Hi Ahmed! Thanks for your interest in Binghatti Hills JVC. Would you like to see pricing and floor plans?", time: ago(48) },
    { agent: SALES_ID, jid: "971501234567", fromMe: false, name: "Ahmed", content: "Yes please, what's the starting price for 1BR?", time: ago(47) },
    { agent: SALES_ID, jid: "971501234567", fromMe: true, name: "Layla", content: "1BR starts from AED 850,000 with a 60/40 payment plan. Handover Q3 2026. Shall I send the brochure?", time: ago(46) },
    { agent: SALES_ID, jid: "971501234567", fromMe: false, name: "Ahmed", content: "That's within my budget. Can I visit this week?", time: ago(2) },
    { agent: SALES_ID, jid: "971552345678", fromMe: true, name: "Layla", content: "Здравствуйте, Мария! Спасибо за интерес к Downtown Dubai. Какой тип недвижимости вас интересует?", time: ago(72) },
    { agent: SALES_ID, jid: "971552345678", fromMe: false, name: "Maria", content: "2BR в Downtown, бюджет до 2.5M AED. Какие есть варианты?", time: ago(71) },
    { agent: SALES_ID, jid: "971552345678", fromMe: true, name: "Layla", content: "У нас есть отличные варианты в Creek Rise и Sobha Hartland. Могу организовать просмотр в четверг?", time: ago(6) },
    { agent: SALES_ID, jid: "971555678901", fromMe: true, name: "Layla", content: "Дмитрий, добрый день! Хотел обсудить условия по Marina Gate. Готов ли застройщик к скидке?", time: ago(12) },
    { agent: SALES_ID, jid: "971555678901", fromMe: false, name: "Dmitri", content: "Да, давайте обсудим. Я готов закрыть сделку на этой неделе если будет хорошее предложение.", time: ago(11) },
  ];

  for (const m of waMessages) {
    await db.insert(aygentWhatsappMessages).values({
      companyId: COMPANY_ID,
      agentId: m.agent,
      chatJid: m.jid,
      messageId: `demo-${randomUUID().slice(0, 8)}`,
      fromMe: m.fromMe,
      senderName: m.name,
      content: m.content,
      status: m.fromMe ? "sent" : "received",
      timestamp: m.time,
    });
  }
  console.log("✓ 9 WhatsApp messages (Arabic + Russian conversations)");

  // ── Agent Learnings (Phase 5) ──────────────────────────────
  const learningData = [
    { agent: SALES_ID, type: "correction", action: "send_whatsapp", original: "Hi Ahmed! 😊 Would you like to learn about our amazing properties?", corrected: "Dear Mr. Al Hashimi, thank you for your enquiry about JVC properties. I'd be happy to share pricing details.", reason: "Use formal Arabic greetings. No emojis with UAE nationals.", time: daysAgo(12) },
    { agent: SALES_ID, type: "correction", action: "send_whatsapp", original: "We have 1BR apartments starting from AED 850K.", corrected: "We have 1BR apartments starting from AED 850,000 with a 60/40 payment plan. Handover Q3 2026.", reason: "Always include payment plan and handover date in first price mention.", time: daysAgo(10) },
    { agent: SALES_ID, type: "correction", action: "send_whatsapp", original: "Following up on our conversation about Binghatti Hills.", corrected: "Mr. Al Hashimi, just checking in — we have new units available at Binghatti Hills with updated pricing. Would you like the details?", reason: "Follow-ups must add new value, not just 'checking in'.", time: daysAgo(8) },
    { agent: SALES_ID, type: "rejection", action: "send_whatsapp", original: "Hey! Just wanted to touch base about your property search. Any updates? 🏠", reason: "Too casual for this agency. Never use 'touch base' or house emoji.", time: daysAgo(7) },
    { agent: SALES_ID, type: "correction", action: "send_whatsapp", original: "Здравствуйте! Как ваши дела?", corrected: "Мария, добрый день. У нас появились новые варианты 2BR в Downtown от AED 1.8M — ROI 7.2% годовых. Интересно?", reason: "Russian clients want metrics immediately. Lead with price and ROI, not pleasantries.", time: daysAgo(6) },
    { agent: CONTENT_ID, type: "correction", action: "post_instagram", original: "🏠 Amazing new launch in JVC! Starting from just AED 850K! Don't miss out! 🔥 #DubaiRealEstate #Investment", corrected: "Binghatti Hills, JVC — 1BR from AED 850K | 60/40 payment plan | Q3 2026 handover. DM for floor plans. #JVC #DubaiOffPlan #BinghattiHills", reason: "Less hype, more specifics. Include payment plan and project name in post.", time: daysAgo(5) },
    { agent: CONTENT_ID, type: "correction", action: "post_instagram", original: "Beautiful sunset view from our latest listing! 🌅", corrected: "Creek Rise, Creek Harbour — 2BR with full creek view, 1,100 sqft. Starting AED 2.2M. This view, every evening.", reason: "Every post must include: project name, type, size, price. Pretty photos alone don't sell.", time: daysAgo(4) },
    { agent: SALES_ID, type: "correction", action: "send_whatsapp", original: "Hi James, are you still looking for a villa in Palm Jumeirah?", corrected: "James, a 4BR villa just listed in Palm West Beach at AED 4.8M — below recent comparables. Your budget fits. Want to see it Saturday?", reason: "Re-engagement messages must reference a specific new opportunity, not ask a yes/no question.", time: daysAgo(3) },
    { agent: SALES_ID, type: "compacted", action: "general", original: null, corrected: "Always use formal greetings for Arabic-speaking leads (Mr./Mrs. + family name). No emojis in first messages.", reason: null, time: daysAgo(2) },
    { agent: SALES_ID, type: "compacted", action: "general", original: null, corrected: "Every first price mention must include: AED amount, payment plan split, and handover date.", reason: null, time: daysAgo(2) },
    { agent: SALES_ID, type: "compacted", action: "general", original: null, corrected: "Russian-speaking leads: lead with price per sqft, ROI %, and rental yield. They decide on numbers, not emotion.", reason: null, time: daysAgo(2) },
    { agent: CONTENT_ID, type: "compacted", action: "general", original: null, corrected: "Every Instagram post must include: project name, property type, size, price, and one differentiating detail.", reason: null, time: daysAgo(2) },
  ];

  for (const l of learningData) {
    await db.insert(aygentAgentLearnings).values({
      companyId: COMPANY_ID,
      agentId: l.agent,
      type: l.type,
      actionType: l.action,
      original: l.original,
      corrected: l.corrected ?? null,
      reason: l.reason ?? null,
      active: true,
      appliedCount: Math.floor(Math.random() * 20) + 1,
      createdAt: l.time,
      updatedAt: l.time,
    });
  }
  console.log("✓ 12 agent learnings (corrections, rejections, compacted insights)");

  // ── Inter-Agent Messages (Phase 6) ─────────────────────────
  const messageData = [
    { from: MARKET_ID, to: SALES_ID, priority: "action", type: "price_alert", summary: "JVC 1BR prices dropped 12% this week based on DLD transaction data. You have 6 leads interested in JVC.", data: { area: "JVC", propertyType: "1BR", changePercent: -12, period: "7d", source: "DLD" }, time: ago(6) },
    { from: SALES_ID, to: CONTENT_ID, priority: "action", type: "demand_signal", summary: "4 leads in pipeline asking about JVC 1BR. Need Instagram content and a pitch deck for Binghatti Hills.", data: { area: "JVC", leadCount: 4, projectName: "Binghatti Hills" }, time: ago(5) },
    { from: CONTENT_ID, to: SALES_ID, priority: "info", type: "content_published", summary: "Published Instagram post about Binghatti Hills JVC — 1BR from AED 850K. You can reference this in follow-ups.", data: { postType: "instagram", project: "Binghatti Hills", engagement: 340 }, time: ago(4) },
    { from: SALES_ID, to: VIEWING_ID, priority: "action", type: "viewing_request", summary: "Ahmed Al Hashimi wants to view Binghatti Hills JVC this week. Score 8, cash buyer, prefers weekday mornings.", data: { leadId: LEADS[0], leadName: "Ahmed Al Hashimi", property: "Binghatti Hills", score: 8 }, time: ago(3) },
    { from: VIEWING_ID, to: SALES_ID, priority: "action", type: "viewing_outcome", summary: "Ahmed Al Hashimi viewed Binghatti Hills — very positive. Wants to see 2 more units. Interested in higher floor.", data: { leadId: LEADS[0], outcome: "positive", notes: "Wants higher floor, corner unit preferred" }, time: ago(1) },
    { from: MARKET_ID, to: SALES_ID, priority: "action", type: "new_launch", summary: "Emaar announcing new phase at Creek Harbour next week. Expected starting AED 2.1M for 2BR. You have 3 leads who match.", data: { developer: "Emaar", project: "Creek Harbour Phase 3", expectedPrice: 2100000, matchingLeads: 3 }, time: ago(8) },
    { from: MARKET_ID, to: CONTENT_ID, priority: "action", type: "market_event", summary: "Emaar Creek Harbour new phase launching next week. Prepare announcement content and early-bird registration post.", data: { developer: "Emaar", project: "Creek Harbour Phase 3", launchDate: "next Tuesday" }, time: ago(8) },
    { from: SALES_ID, to: CEO_ID, priority: "urgent", type: "hot_lead", summary: "Hassan Al Qassimi — score 10, AED 5-10M budget, wants Downtown penthouse. Viewed 2 properties today. Ready to sign this week.", data: { leadId: LEADS[10], score: 10, budget: "5-10M AED", timeline: "this week" }, time: ago(3) },
    { from: VIEWING_ID, to: SALES_ID, priority: "action", type: "viewing_noshow", summary: "Tom Wilson no-showed for the 3rd time. Recommend downgrading score and pausing follow-ups.", data: { leadId: LEADS[12], noShowCount: 3, currentScore: 3 }, time: ago(10) },
    { from: CONTENT_ID, to: SALES_ID, priority: "info", type: "engagement_spike", summary: "Yesterday's JVC price drop post got 520 likes — 3x our average. JVC content is resonating. Will double down this week.", data: { postType: "instagram", likes: 520, averageLikes: 170, topic: "JVC" }, time: ago(2) },
    { from: SALES_ID, to: CONTENT_ID, priority: "info", type: "deck_request", summary: "Need a pitch deck for Maria Petrova — Creek Rise 2BR. Include ROI breakdown and payment plan comparison.", data: { leadName: "Maria Petrova", project: "Creek Rise", language: "Russian" }, time: ago(14) },
    { from: MARKET_ID, to: CEO_ID, priority: "info", type: "competitor_alert", summary: "Allsopp & Allsopp dropped their JVC listing prices by 8%. They may be undercutting on service charges too.", data: { competitor: "Allsopp & Allsopp", area: "JVC", priceChange: -8 }, time: daysAgo(2) },
  ];

  for (const m of messageData) {
    const expiresAt = new Date(m.time.getTime() + 48 * 60 * 60 * 1000);
    await db.insert(aygentAgentMessages).values({
      companyId: COMPANY_ID,
      fromAgentId: m.from,
      toAgentId: m.to,
      priority: m.priority,
      messageType: m.type,
      summary: m.summary,
      data: m.data,
      readByAgents: [m.to],
      actedOn: Math.random() > 0.3,
      expiresAt,
      createdAt: m.time,
    });
  }
  console.log("✓ 12 inter-agent messages (price alerts, demand signals, viewing outcomes, hot lead escalation)");

  // ── Pending Approvals ──────────────────────────────────────
  const approvalData = [
    { type: "send_whatsapp", agent: SALES_ID, payload: { type: "approval_required", action: "send_whatsapp", to: "Ahmed Al Hashimi", phone: "+971501234567", message: "Dear Mr. Al Hashimi, following your viewing at Binghatti Hills — we have a corner unit on the 18th floor just listed at AED 920,000. 60/40 payment plan. Shall I reserve it for 48 hours?", lead_score: 8, context: "Post-viewing follow-up. Lead expressed interest in higher floor corner unit." } },
    { type: "send_whatsapp", agent: SALES_ID, payload: { type: "approval_required", action: "send_whatsapp", to: "Elena Kuznetsova", phone: "+971552223344", message: "Елена, добрый день. Цены на 1BR в JVC снизились на 12% за неделю — сейчас от AED 740K. ROI 8.1% годовых. Актуально?", lead_score: 7, context: "Re-engagement triggered by Market Agent's JVC price drop alert." } },
    { type: "post_instagram", agent: CONTENT_ID, payload: { type: "approval_required", action: "post_instagram", caption: "Creek Harbour Phase 3 by Emaar — early access registration now open.\n\n2BR from AED 2.1M | 70/30 payment plan | Q4 2027 handover\nCreek view guaranteed on floors 15+\n\nDM 'CREEK' for priority access.\n\n#CreekHarbour #Emaar #DubaiOffPlan #NewLaunch", context: "New Emaar launch announcement. Market Agent flagged this as high-opportunity." } },
    { type: "send_whatsapp", agent: SALES_ID, payload: { type: "approval_required", action: "send_whatsapp", to: "Dmitri Volkov", phone: "+971555678901", message: "Дмитрий, застройщик подтвердил скидку 5% при полной оплате на Marina Gate — финальная цена AED 3,990,000. Это AED 200K ниже рынка. Готовы оформить на этой неделе?", lead_score: 9, context: "Negotiation phase. Developer confirmed 5% cash discount. Dmitri ready to close." } },
  ];

  for (const a of approvalData) {
    await db.insert(approvals).values({
      companyId: COMPANY_ID,
      type: a.type,
      requestedByAgentId: a.agent,
      status: "pending",
      payload: a.payload,
    });
  }
  console.log("✓ 4 pending approvals (WhatsApp messages + Instagram post)");

  // ── Cost Events (for analytics) ────────────────────────────
  for (let d = 0; d < 14; d++) {
    for (const agentId of [CEO_ID, SALES_ID, CONTENT_ID, MARKET_ID, VIEWING_ID]) {
      const base = agentId === SALES_ID ? 120 : agentId === CEO_ID ? 80 : 50;
      const costCents = base + Math.floor(Math.random() * 60);
      await db.insert(costEvents).values({
        companyId: COMPANY_ID,
        agentId,
        provider: "anthropic",
        biller: "anthropic",
        billingType: "metered_api",
        model: "claude-sonnet-4-5",
        inputTokens: 2000 + Math.floor(Math.random() * 3000),
        outputTokens: 500 + Math.floor(Math.random() * 1500),
        costCents,
        occurredAt: daysAgo(d),
      });
    }
  }
  console.log("✓ 70 cost events (14 days × 5 agents)");

  // ── CEO Chat Comments (morning brief + conversation) ───────
  const comments = [
    { agent: CEO_ID, body: `Good morning. Here's your agency update.

**Headline:** Ahmed Al Hashimi viewed Binghatti Hills yesterday and wants to see more units. He's a cash buyer scoring 8 — this could close this week.

**What your team did overnight:**
Omar detected a 12% price drop in JVC from DLD transaction data. Layla cross-referenced your pipeline and found 6 leads who stalled on JVC pricing — she's drafted re-engagement messages with the new numbers. Nour is already working on an Instagram post about the price drop.

Separately, Omar flagged an upcoming Emaar launch at Creek Harbour. Nour is preparing early-access content, and Layla identified 3 leads who match the project profile.

**Agent coordination:** 8 messages exchanged between agents overnight. Market → Sales → Content pipeline is working well — price intel turns into outreach within hours.

**Learnings applied:** Layla used formal Arabic greetings with Ahmed (from your correction last week) and led with payment plan details for Russian leads — both patterns you taught her.

**Pending your approval:**
- 3 WhatsApp messages (Ahmed follow-up, Elena re-engagement, Dmitri negotiation offer)
- 1 Instagram post (Creek Harbour launch announcement)

**Cost yesterday:** $14.20 across all agents. Layla: $6.40, Nour: $3.80, Omar: $2.60, Khalid: $1.40.`, time: ago(2) },
    { user: true, body: "Approve all the WhatsApp messages. Hold the Instagram post — I want to add the starting price for studios too.", time: ago(1.5) },
    { agent: CEO_ID, body: `Done — 3 WhatsApp messages approved and queued for delivery. I've held the Instagram post and asked Nour to add studio pricing before resubmitting.

Also flagging: Hassan Al Qassimi (score 10, AED 5-10M budget) viewed 2 Downtown penthouses today and told Sara he's ready to sign this week. This is your biggest potential deal. I'd recommend you handle this one directly.`, time: ago(1) },
  ];

  for (const c of comments) {
    const authorAgentId = (c as any).agent ?? null;
    const authorUserId = (c as any).user ? "demo-owner" : null;
    const ts = c.time.toISOString();
    await sql`INSERT INTO issue_comments (id, company_id, issue_id, body, author_agent_id, author_user_id, created_at, updated_at)
              VALUES (${randomUUID()}, ${COMPANY_ID}, ${CEO_CHAT_ISSUE_ID}, ${c.body}, ${authorAgentId}, ${authorUserId}, ${ts}, ${ts})`;
  }
  console.log("✓ CEO Chat conversation (morning brief + owner interaction)");

  console.log("\n✅ Demo seed complete!");
  console.log(`\n   Company: Dubai Prestige Properties`);
  console.log(`   Company ID: ${COMPANY_ID}`);
  console.log(`   Agents: Khalid (CEO), Layla (Sales), Nour (Content), Omar (Market), Sara (Viewing)`);
  console.log(`   Leads: 15 | Properties: 8 | Approvals: 4 pending`);
  console.log(`   Learnings: 12 | Agent Messages: 12 | WhatsApp: 9`);
  console.log(`\n   Ready for demo! 🚀\n`);

  await sql.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
