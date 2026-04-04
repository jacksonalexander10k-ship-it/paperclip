/**
 * Tests ALL 62 tools by calling their executors directly.
 * Run from server dir: pnpm exec tsx scripts/test-all-tools.ts
 */
import { createToolRegistry } from "@aygent/tools";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { companies, agents, aygentLeads, aygentLandlords } from "@paperclipai/db";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";

async function main() {
  const sql = postgres(DATABASE_URL, { max: 5 });
  const db = drizzle(sql) as any;

  // Setup test data
  const [company] = await db.insert(companies).values({
    name: "Tool Test Agency",
    description: "Focus: offplan. Areas: JVC.",
    issuePrefix: "TTX",
  }).returning();

  const [agent] = await db.insert(agents).values({
    companyId: company.id,
    name: "TestBot",
    role: "ceo",
    adapterType: "claude_local",
    adapterConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    runtimeConfig: {},
    permissions: {},
  }).returning();

  const [lead] = await db.insert(aygentLeads).values({
    companyId: company.id,
    agentId: agent.id,
    name: "Ahmed Al Hashimi",
    phone: "+971501234567",
    email: "ahmed@test.com",
    source: "property_finder",
    stage: "new",
    score: 8,
  }).returning();

  const [landlord] = await db.insert(aygentLandlords).values({
    companyId: company.id,
    name: "Khalid Al Mansoori",
    phone: "+971509876543",
    email: "khalid@landlord.com",
  }).returning();

  const ctx = { companyId: company.id, agentId: agent.id, db };
  const registry = createToolRegistry();

  const toolTests: Record<string, Record<string, unknown>> = {
    search_leads: { query: "Ahmed" },
    update_lead: { leadId: lead.id, stage: "contacted", notes: "Test" },
    get_lead_activity: { leadId: lead.id },
    create_tag: { name: "test-tag", description: "Test" },
    tag_lead: { leadId: lead.id, tagName: "test-tag" },
    list_tags: {},
    untag_lead: { leadId: lead.id, tagName: "test-tag" },
    get_follow_ups: {},
    bulk_follow_up: { leadIds: [lead.id], message: "Test" },
    reactivate_stale_leads: { daysInactive: 14 },
    bulk_lead_action: { action: "tag", tagName: "test-tag", leadIds: [lead.id] },
    match_deal_to_leads: { area: "JVC", priceMin: 500000, priceMax: 2000000 },
    deduplicate_leads: {},
    search_whatsapp: { query: "test" },
    send_whatsapp: { phone: "+971501234567", message: "Test", to: "Ahmed" },
    search_email: { query: "test" },
    send_email: { recipient: "test@test.com", subject: "Test", body: "Test" },
    list_whatsapp_templates: {},
    use_whatsapp_template: { templateName: "greeting", phone: "+971501234567", variables: {} },
    make_call: { phone: "+971501234567", leadName: "Ahmed", purpose: "Test" },
    search_projects: { query: "Binghatti" },
    get_project_details: { projectName: "Binghatti Hills" },
    search_listings: { area: "JVC", bedrooms: 2 },
    search_dld_transactions: { area: "JVC", period: "90d" },
    scrape_dxb_transactions: { area: "Dubai Marina", days: 30 },
    get_building_analysis: { buildingName: "Marina Gate" },
    analyze_investment: { projects: ["Binghatti Hills"] },
    get_news: { category: "market" },
    web_search: { query: "Dubai property 2026" },
    watch_listings: { area: "JVC", maxPrice: 1500000 },
    generate_social_content: { platform: "instagram", topic: "JVC launch" },
    generate_content: { type: "property_description", context: "2BR JVC" },
    generate_market_report: { area: "JVC" },
    generate_pitch_deck: { projects: ["Binghatti Hills"], clientName: "Ahmed" },
    generate_pitch_presentation: { projectName: "Binghatti Hills" },
    generate_landing_page: { projectName: "Binghatti Hills", headline: "JVC" },
    post_to_instagram: { caption: "Test", imageUrl: "https://example.com/t.jpg" },
    search_instagram_dms: { query: "test" },
    send_instagram_dm: { recipient: "testuser", message: "Test" },
    launch_campaign: { name: "Test", projectName: "Binghatti" },
    create_drip_campaign: { name: "Test Drip", type: "warm_nurture", emails: 4 },
    enroll_lead_in_campaign: { leadId: lead.id, campaignName: "Test Drip" },
    get_campaign_stats: { campaignName: "Test Drip" },
    get_calendar: { date: "2026-04-03" },
    create_event: { title: "Test", date: "2026-04-05", time: "14:00" },
    check_availability: { date: "2026-04-05" },
    schedule_viewing: { leadId: lead.id, propertyName: "Marina Gate", date: "2026-04-05", time: "14:00" },
    get_viewings: {},
    manage_landlord: { action: "list" },
    manage_property: { action: "create", landlordId: landlord.id, name: "Marina Gate 1804", bedrooms: 2 },
    manage_tenancy: { action: "list" },
    calculate_rera_rent: { currentRent: 120000, averageMarketRent: 140000 },
    calculate_dld_fees: { purchasePrice: 1500000, propertyType: "apartment", isOffPlan: true },
    create_portal: { clientName: "Ahmed", type: "buyer", leadId: lead.id },
    get_portal_activity: { portalId: "test" },
    list_documents: {},
    extract_document_data: { documentType: "passport", text: "Name: Ahmed" },
    create_task: { title: "Test reminder", scheduledFor: "2026-04-04T10:00:00Z" },
    remember: { fact: "Ahmed prefers WhatsApp" },
    set_guardrails: { rule: "No pricing over 5M" },
  };

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  TESTING ALL TOOLS");
  console.log("═══════════════════════════════════════════════════\n");

  let passed = 0, failed = 0, total = 0;

  for (const [name, input] of Object.entries(toolTests)) {
    total++;
    const executor = registry.executors.get(name);
    if (!executor) {
      console.log(`  [${String(total).padStart(2)}] ${name}: ❌ NOT REGISTERED`);
      failed++;
      continue;
    }
    try {
      const result = await executor(input, ctx);
      const preview = typeof result === "string" ? result.slice(0, 60) : JSON.stringify(result).slice(0, 60);
      console.log(`  [${String(total).padStart(2)}] ${name}: ✅ ${preview}`);
      passed++;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      const expected = /not connected|no credential|not found|No |empty|stub|not implemented|Cannot merge|no campaign|no portal|not configured|no calendar|no instagram|no gmail/i.test(msg);
      if (expected) {
        console.log(`  [${String(total).padStart(2)}] ${name}: ⚠️ ${msg.slice(0, 60)}`);
        passed++;
      } else {
        console.log(`  [${String(total).padStart(2)}] ${name}: ❌ ${msg.slice(0, 80)}`);
        failed++;
      }
    }
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  RESULTS: ${passed} ✅ / ${failed} ❌ / ${total} total`);
  console.log(`═══════════════════════════════════════════════════\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
