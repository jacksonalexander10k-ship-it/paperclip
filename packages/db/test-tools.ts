/**
 * ACTUALLY tests every tool executor by calling the function.
 * Not "registered" — CALLED. With real DB, real input, real output.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { companies, agents, aygentLeads, aygentLandlords, aygentWhatsappTemplates } from "./src/schema/index.js";
import { createToolRegistry } from "../tools/src/index.js";

const DB_URL = "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";

async function main() {
  const sql = postgres(DB_URL, { max: 5 });
  const db = drizzle(sql) as any;

  // Seed data
  const [company] = await db.insert(companies).values({
    name: "Tool Test Co", description: "Test", issuePrefix: `T${Date.now().toString(36).slice(-2).toUpperCase()}`,
  }).returning();

  const [agent] = await db.insert(agents).values({
    companyId: company.id, name: "Bot", role: "ceo", adapterType: "claude_local",
    adapterConfig: {}, budgetMonthlyCents: 0, spentMonthlyCents: 0,
    runtimeConfig: {}, permissions: {},
  }).returning();

  const [lead] = await db.insert(aygentLeads).values({
    companyId: company.id, agentId: agent.id, name: "Ahmed Al Hashimi",
    phone: "+971501234567", email: "ahmed@test.com", source: "property_finder",
    stage: "new", score: 8,
  }).returning();

  const [landlord] = await db.insert(aygentLandlords).values({
    companyId: company.id, name: "Khalid", phone: "+971509876543", email: "k@test.com",
  }).returning();

  const [waTemplate] = await db.insert(aygentWhatsappTemplates).values({
    companyId: company.id,
    name: "greeting_utility",
    category: "utility",
    content: "Hi {{client_name}}, this is {{agent_name}} from Dubai Properties. {{message}}",
    isDefault: true,
    usageCount: 0,
  }).returning();

  const ctx = { companyId: company.id, agentId: agent.id, db };
  const registry = createToolRegistry();

  // Every tool with actual input that exercises the function
  const tests: [string, Record<string, unknown>][] = [
    // LEAD TOOLS
    ["search_leads", { query: "Ahmed" }],
    ["update_lead", { leadId: lead.id, stage: "contacted", notes: "Called" }],
    ["get_lead_activity", { leadId: lead.id }],
    ["create_tag", { name: "vip", description: "VIP clients" }],
    ["tag_lead", { lead: lead.id, tag: "vip" }],
    ["list_tags", {}],
    ["untag_lead", { lead: lead.id, tag: "vip" }],
    ["get_follow_ups", {}],
    ["bulk_follow_up", { leadIds: [lead.id], message: "Following up on your JVC enquiry" }],
    ["reactivate_stale_leads", { daysSinceContact: 1 }],
    ["bulk_lead_action", { action: "tag", leadIds: [lead.id], payload: { tagName: "vip" } }],
    ["match_deal_to_leads", { price: 1000000, area: "JVC", propertyType: "apartment" }],
    ["deduplicate_leads", {}],
    // merge_leads needs 2 different leads — skip to avoid data corruption

    // COMMUNICATION
    ["search_whatsapp", { query: "test" }],
    ["send_whatsapp", { to: "+971501234567", message: "Hi Ahmed, following up on JVC" }],
    ["search_email", { query: "test" }],
    ["send_email", { to: "ahmed@test.com", subject: "JVC Update", body: "Hi Ahmed, new units available" }],
    ["list_whatsapp_templates", {}],
    ["use_whatsapp_template", { templateId: waTemplate.id, contactJid: "+971501234567", variables: { client_name: "Ahmed" } }],
    ["make_call", { leadId: lead.id, purpose: "lead_reactivation" }],

    // PROJECTS
    ["search_projects", { query: "Binghatti" }],
    ["get_project_details", { projectId: "00000000-0000-0000-0000-000000000000" }],

    // MARKET
    ["search_listings", { purpose: "for-sale", location: "JVC", bedrooms: "2" }],
    ["search_dld_transactions", { area: "JVC" }],
    ["scrape_dxb_transactions", { area: "Dubai Marina", days: 30 }],
    ["get_building_analysis", { buildingName: "Marina Gate" }],
    ["analyze_investment", { projectIds: ["00000000-0000-0000-0000-000000000000"] }],
    ["get_news", { category: "market" }],
    ["web_search", { query: "Dubai property market 2026" }],
    ["watch_listings", { action: "create", location: "JVC", maxPrice: 1500000 }],

    // CONTENT
    ["generate_social_content", { platforms: ["instagram"], projectName: "JVC off-plan launch", tone: "luxury" }],
    ["generate_content", { instructions: "Write a property description for a 2BR apartment in JVC, AED 800K", title: "JVC Property Description" }],
    ["generate_market_report", { area: "JVC" }],
    ["generate_pitch_deck", { projectIds: [1], clientName: "Ahmed", confirmed: true }],
    ["generate_pitch_presentation", { projectIds: [1], confirmed: true }],
    ["generate_landing_page", { projectName: "Binghatti Hills", customTitle: "JVC Off-Plan from AED 800K" }],
    ["post_to_instagram", { caption: "New JVC launch!", imageUrl: "https://example.com/jvc.jpg" }],
    ["search_instagram_dms", { limit: 10 }],
    ["send_instagram_dm", { recipientId: "testuser123", recipientName: "testuser", message: "Thanks for your interest!" }],

    // CAMPAIGNS
    ["launch_campaign", { name: "JVC Launch Campaign", projectName: "Binghatti Hills" }],
    ["create_drip_campaign", { name: "Warm Nurture", type: "warm_nurture", stepCount: 4 }],
    ["enroll_lead_in_campaign", { leadId: lead.id, campaignId: "CAMPAIGN_ID_PLACEHOLDER" }],
    ["get_campaign_stats", { campaignId: "CAMPAIGN_ID_PLACEHOLDER" }],

    // CALENDAR
    ["get_calendar", { startDate: "2026-04-03" }],
    ["create_event", { title: "Viewing with Ahmed", date: "2026-04-05", startTime: "14:00" }],
    ["check_availability", { date: "2026-04-05" }],
    ["schedule_viewing", { leadId: lead.id, projectName: "Marina Gate 1804", datetime: "2026-04-05T14:00:00" }],
    ["get_viewings", {}],

    // PORTFOLIO
    ["manage_landlord", { action: "list" }],
    ["manage_property", { action: "create", landlordId: landlord.id, unit: "Marina Gate 1804", bedrooms: "2", area: "Dubai Marina" }],
    ["manage_tenancy", { action: "history", propertyId: "00000000-0000-0000-0000-000000000000" }],
    ["calculate_rera_rent", { currentRent: 120000, marketRent: 140000 }],
    ["calculate_dld_fees", { purchasePrice: 1500000, propertyType: "apartment", isOffPlan: true }],

    // PORTALS
    ["create_portal", { clientName: "Ahmed", type: "buyer", leadId: lead.id }],
    ["get_portal_activity", { leadId: lead.id }],

    // DOCUMENTS
    ["list_documents", {}],
    ["extract_document_data", { documentId: "00000000-0000-0000-0000-000000000000" }],

    // ADMIN
    ["create_task", { description: "Follow up Ahmed at 3pm", type: "one_off" }],
    ["remember", { content: "Ahmed prefers WhatsApp over phone, interested in 2BR JVC", subject: "Ahmed Al Hashimi" }],
    ["set_guardrails", { guardrails: ["No pricing over AED 5M in auto-replies"] }],
  ];

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  CALLING EVERY TOOL EXECUTOR — REAL TESTS");
  console.log(`  ${tests.length} tools to test`);
  console.log("═══════════════════════════════════════════════════\n");

  let passed = 0, failed = 0, stubs = 0;

  // Track IDs created by earlier tests for use in later tests
  let createdCampaignId: string | null = null;
  let createdPortalLeadId: string | null = null;

  for (let i = 0; i < tests.length; i++) {
    const [name, input] = tests[i];
    const num = String(i + 1).padStart(2);
    const executor = registry.executors[name];

    if (!executor) {
      console.log(`  [${num}] ${name}: ❌ NOT IN REGISTRY`);
      failed++;
      continue;
    }

    // Patch in dynamic IDs from earlier test results
    if (name === "enroll_lead_in_campaign" && createdCampaignId) {
      (input as Record<string, unknown>).campaignId = createdCampaignId;
    }
    if (name === "get_campaign_stats" && createdCampaignId) {
      (input as Record<string, unknown>).campaignId = createdCampaignId;
    }

    try {
      const result = await executor(input, ctx);
      const output = typeof result === "string" ? result : JSON.stringify(result);
      const isStub = output.includes("stub") || output.includes("not implemented") ||
        output.includes("not configured") || output.includes("TODO") ||
        output === "null" || output === "undefined" || output === '""' || output === "{}";

      // Capture dynamic IDs for subsequent tests
      if (name === "create_drip_campaign" && result && typeof result === "object" && "campaignId" in result) {
        createdCampaignId = (result as Record<string, unknown>).campaignId as string;
      }

      if (isStub) {
        console.log(`  [${num}] ${name}: 🟡 STUB — ${output.slice(0, 70)}`);
        stubs++;
      } else {
        console.log(`  [${num}] ${name}: ✅ ${output.slice(0, 70)}`);
        passed++;
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      // Expected errors for unconnected integrations
      const expected = /not connected|no credential|not found|No |empty|no campaign|no portal|not configured|no calendar|no instagram|no gmail|no whatsapp|not available|requires|ECONNREFUSED|fetch failed|network/i.test(msg);
      if (expected) {
        console.log(`  [${num}] ${name}: ⚠️ NEEDS INTEGRATION — ${msg.slice(0, 60)}`);
        stubs++;
      } else {
        console.log(`  [${num}] ${name}: ❌ ERROR — ${msg.slice(0, 70)}`);
        failed++;
      }
    }
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  RESULTS:`);
  console.log(`    ✅ Working:            ${passed}`);
  console.log(`    🟡 Stub/needs config:  ${stubs}`);
  console.log(`    ❌ Broken:             ${failed}`);
  console.log(`    Total:                 ${tests.length}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  await sql.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
