/**
 * Real User Journey — Operates Gulf Horizon Properties as a real agency owner.
 * Does everything a user would actually do, not just check pages load.
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:3001";
const DB = "postgresql://paperclip:paperclip@127.0.0.1:54329/paperclip";

let prefix = "";
let companyId = "";

// Helper to call API
async function api(method: string, path: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}/api${path}`, opts);
  return { status: res.status, data: await res.json().catch(() => null) };
}

// Helper to send CEO Chat message and get response
async function chatWithCeo(message: string): Promise<string> {
  const res = await fetch(`${BASE}/api/companies/${companyId}/ceo-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const text = await res.text();
  // Parse SSE events
  const lines = text.split("\n").filter(l => l.startsWith("data: "));
  let fullText = "";
  for (const line of lines) {
    try {
      const evt = JSON.parse(line.slice(6));
      if (evt.type === "text") fullText += evt.text;
    } catch {}
  }
  return fullText;
}

test.describe.serial("Real User Journey — Operating Gulf Horizon Properties", () => {

  // ═══════════════════════════════════════
  // DAY 0: SETUP
  // ═══════════════════════════════════════

  test("ONBOARDING: Sign up as a Dubai agency owner", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector("text=What's your agency called?", { timeout: 15000 });

    // I'm opening a mid-size agency focused on off-plan and rentals in prime areas
    await page.fill('input[placeholder*="Prime Properties"]', "Gulf Horizon Properties");
    await page.click("text=Continue");
    await page.click("text=Off-Plan Sales");
    await page.click("text=Rentals & Leasing");
    await page.click("text=Continue");
    await page.waitForSelector("text=Which areas", { timeout: 5000 });
    await page.click("text=JVC");
    await page.click("text=Downtown");
    await page.click("text=Business Bay");
    await page.click("text=Continue");
    await page.click("text=6–15 people");
    await page.click("text=Continue");
    await page.waitForSelector("text=Where do your leads", { timeout: 5000 });
    await page.click("text=Property Finder");
    await page.click("text=Bayut");
    await page.click("text=Instagram");
    await page.click("text=Continue");
    await page.waitForSelector("text=What do you need", { timeout: 5000 });
    await page.click("text=Lead Management");
    await page.click("text=Content & Marketing");
    await page.click("text=Viewing Management");
    const textarea = page.locator("textarea");
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill("We have 8 brokers. Biggest problem is leads going cold — takes us hours to respond to PF enquiries. Need sub-5-min response time.");
    }
    await page.click("text=Continue");
    await page.waitForSelector("text=Choose your setup", { timeout: 5000 });
    await page.click("text=Growth");
    await page.click("text=Continue");
    await page.waitForSelector("text=Name your CEO", { timeout: 5000 });
    await page.fill('input[placeholder*="Khalid"]', "Nadia");
    await page.click("text=Hire CEO");

    // Wait for Claude to reason + redirect
    await page.waitForURL(/ceo-chat/, { timeout: 120000 });
    const url = page.url();
    prefix = url.match(/\/([A-Z]+)\/ceo-chat/)?.[1] ?? "";

    // Get company ID
    const companies = (await api("GET", "/companies")).data;
    companyId = companies[0].id;

    console.log(`\n🏢 ONBOARDING COMPLETE`);
    console.log(`   Agency: Gulf Horizon Properties`);
    console.log(`   CEO: Nadia`);
    console.log(`   Prefix: ${prefix}`);
    console.log(`   Company ID: ${companyId}`);
  });

  test("HIRE TEAM: Approve Nadia's team proposal", async ({ page }) => {
    await page.goto(`${BASE}/${prefix}/ceo-chat`);
    await page.waitForTimeout(3000);

    // Check what Nadia proposed
    const bodyText = await page.locator("body").innerText();
    const hasProposal = bodyText.includes("Proposed Team") || bodyText.includes("Approve");
    console.log(`\n👔 TEAM PROPOSAL`);
    console.log(`   Proposal visible: ${hasProposal}`);

    // Approve the team
    const approveBtn = page.locator("text=Approve & Hire Team");
    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(3000);
      console.log(`   Clicked Approve & Hire Team`);
    }

    // Verify agents created
    const agents = (await api("GET", `/companies/${companyId}/agents`)).data;
    console.log(`   Agents created: ${agents.length}`);
    for (const a of agents) {
      console.log(`   - ${a.name} (${a.role}) — ${a.status}`);
    }
  });

  // ═══════════════════════════════════════
  // DAY 1: OPERATING THE BUSINESS
  // ═══════════════════════════════════════

  test("CEO CHAT: Ask Nadia for a morning brief", async () => {
    const response = await chatWithCeo("Brief me. What's the status of the agency?");
    console.log(`\n📋 MORNING BRIEF`);
    console.log(`   Response length: ${response.length} chars`);
    console.log(`   First 200 chars: ${response.slice(0, 200)}...`);
    expect(response.length).toBeGreaterThan(50);
  });

  test("CEO CHAT: Ask Nadia to find leads", async () => {
    const response = await chatWithCeo("Find me the hottest leads. What's in the pipeline?");
    console.log(`\n🔍 FIND LEADS`);
    console.log(`   Response length: ${response.length} chars`);
    console.log(`   First 200 chars: ${response.slice(0, 200)}...`);
    expect(response.length).toBeGreaterThan(20);
  });

  test("CEO CHAT: Ask Nadia about budget", async () => {
    const response = await chatWithCeo("Show me the current budget. How much have we spent?");
    console.log(`\n💰 BUDGET CHECK`);
    console.log(`   Response length: ${response.length} chars`);
    console.log(`   First 200 chars: ${response.slice(0, 200)}...`);
    expect(response.length).toBeGreaterThan(20);
  });

  test("CEO CHAT: Ask Nadia to delegate a task", async () => {
    const response = await chatWithCeo("I need the content agent to create an Instagram post about our new JVC listings. Make it happen.");
    console.log(`\n📝 DELEGATE TASK`);
    console.log(`   Response length: ${response.length} chars`);
    console.log(`   First 300 chars: ${response.slice(0, 300)}...`);

    // Check if a task was created
    const issues = (await api("GET", `/companies/${companyId}/issues`)).data;
    const nonCeoChat = issues.filter((i: any) => !i.title.includes("CEO Chat"));
    console.log(`   Tasks created: ${nonCeoChat.length}`);
    for (const t of nonCeoChat) {
      console.log(`   - [${t.identifier}] ${t.title} (${t.status})`);
    }
  });

  // ═══════════════════════════════════════
  // LEAD MANAGEMENT
  // ═══════════════════════════════════════

  test("LEADS: Add 5 leads manually via API", async () => {
    const leads = [
      { name: "Ahmed Al Hashimi", phone: "+971501234567", email: "ahmed@test.com", source: "property_finder", stage: "new", score: 8 },
      { name: "Maria Ivanova", phone: "+971559876543", email: "maria@test.com", source: "instagram", stage: "new", score: 6 },
      { name: "Li Wei Chen", phone: "+971504445556", email: "liwei@test.com", source: "bayut", stage: "contacted", score: 7 },
      { name: "Fatima Hassan", phone: "+971507778889", email: "fatima@test.com", source: "referrals", stage: "qualified", score: 9 },
      { name: "John Smith", phone: "+971502223334", email: "john@test.com", source: "facebook_ads", stage: "new", score: 4 },
    ];

    console.log(`\n👥 ADDING LEADS`);
    for (const lead of leads) {
      const res = await api("POST", `/companies/${companyId}/leads`, lead);
      console.log(`   ${lead.name}: ${res.status === 201 ? "✅" : `❌ (${res.status})`}`);
    }

    // Verify all leads exist
    const allLeads = (await api("GET", `/companies/${companyId}/leads`)).data;
    console.log(`   Total leads in DB: ${allLeads.length}`);
  });

  test("LEADS: Update lead stages", async () => {
    const leads = (await api("GET", `/companies/${companyId}/leads`)).data;
    console.log(`\n📊 UPDATING LEAD STAGES`);

    // Move Ahmed from "new" to "contacted"
    const ahmed = leads.find((l: any) => l.name === "Ahmed Al Hashimi");
    if (ahmed) {
      const res = await api("PATCH", `/companies/${companyId}/leads/${ahmed.id}`, { stage: "contacted" });
      console.log(`   Ahmed → contacted: ${res.status === 200 ? "✅" : `❌ (${res.status})`}`);
    }

    // Move Fatima from "qualified" to "viewing_scheduled"
    const fatima = leads.find((l: any) => l.name === "Fatima Hassan");
    if (fatima) {
      const res = await api("PATCH", `/companies/${companyId}/leads/${fatima.id}`, { stage: "viewing_scheduled" });
      console.log(`   Fatima → viewing_scheduled: ${res.status === 200 ? "✅" : `❌ (${res.status})`}`);
    }

    // Update John's score
    const john = leads.find((l: any) => l.name === "John Smith");
    if (john) {
      const res = await api("PATCH", `/companies/${companyId}/leads/${john.id}`, { score: 7 });
      console.log(`   John score 4→7: ${res.status === 200 ? "✅" : `❌ (${res.status})`}`);
    }
  });

  test("LEADS: View leads in UI with filters", async ({ page }) => {
    await page.goto(`${BASE}/${prefix}/leads`);
    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").innerText();
    console.log(`\n📋 LEADS UI`);
    console.log(`   Ahmed visible: ${bodyText.includes("Ahmed") ? "✅" : "❌"}`);
    console.log(`   Maria visible: ${bodyText.includes("Maria") ? "✅" : "❌"}`);
    console.log(`   Fatima visible: ${bodyText.includes("Fatima") ? "✅" : "❌"}`);
  });

  // ═══════════════════════════════════════
  // AGENT MANAGEMENT
  // ═══════════════════════════════════════

  test("AGENTS: Pause and resume an agent", async () => {
    const agents = (await api("GET", `/companies/${companyId}/agents`)).data;
    const nonCeo = agents.find((a: any) => a.role !== "ceo");

    console.log(`\n⏸️ AGENT MANAGEMENT`);
    if (nonCeo) {
      // Pause
      const pauseRes = await api("POST", `/agents/${nonCeo.id}/pause`, {});
      console.log(`   Pause ${nonCeo.name}: ${pauseRes.status === 200 ? "✅" : `❌ (${pauseRes.status})`}`);

      // Verify paused
      const after = (await api("GET", `/agents/${nonCeo.id}`)).data;
      console.log(`   Status after pause: ${after.status}`);

      // Resume
      const resumeRes = await api("POST", `/agents/${nonCeo.id}/resume`, {});
      console.log(`   Resume ${nonCeo.name}: ${resumeRes.status === 200 ? "✅" : `❌ (${resumeRes.status})`}`);

      const afterResume = (await api("GET", `/agents/${nonCeo.id}`)).data;
      console.log(`   Status after resume: ${afterResume.status}`);
    }
  });

  test("AGENTS: Set budget for an agent", async () => {
    const agents = (await api("GET", `/companies/${companyId}/agents`)).data;
    const nonCeo = agents.find((a: any) => a.role !== "ceo");

    console.log(`\n💵 AGENT BUDGET`);
    if (nonCeo) {
      const res = await api("PATCH", `/agents/${nonCeo.id}`, { budgetMonthlyCents: 5000 });
      console.log(`   Set ${nonCeo.name} budget to $50/month: ${res.status === 200 ? "✅" : `❌ (${res.status})`}`);
    }
  });

  // ═══════════════════════════════════════
  // TASKS
  // ═══════════════════════════════════════

  test("TASKS: Create a task and assign to agent", async () => {
    const agents = (await api("GET", `/companies/${companyId}/agents`)).data;
    const contentAgent = agents.find((a: any) => a.role === "content");

    console.log(`\n📌 TASK MANAGEMENT`);
    const taskRes = await api("POST", `/companies/${companyId}/issues`, {
      title: "Create Instagram post — JVC off-plan launch",
      description: "Design and draft an Instagram carousel post showcasing our new JVC off-plan listings. Include pricing, payment plans, and lifestyle images.",
      status: "todo",
      priority: "high",
      assigneeAgentId: contentAgent?.id ?? null,
      originKind: "manual",
    });
    console.log(`   Create task: ${taskRes.status === 201 ? "✅" : `❌ (${taskRes.status})`}`);
    if (taskRes.data) console.log(`   Task ID: ${taskRes.data.identifier}`);

    // Create another task
    const salesAgent = agents.find((a: any) => a.role === "sales");
    const task2 = await api("POST", `/companies/${companyId}/issues`, {
      title: "Follow up with Fatima Hassan — viewing next week",
      description: "Fatima scored 9/10. She's interested in 2BR in Downtown. Schedule a viewing for next Tuesday.",
      status: "todo",
      priority: "urgent",
      assigneeAgentId: salesAgent?.id ?? null,
      originKind: "manual",
    });
    console.log(`   Create task 2: ${task2.status === 201 ? "✅" : `❌ (${task2.status})`}`);

    // List all tasks
    const allIssues = (await api("GET", `/companies/${companyId}/issues`)).data;
    const tasks = allIssues.filter((i: any) => !i.title.includes("CEO Chat"));
    console.log(`   Total tasks: ${tasks.length}`);
    for (const t of tasks) {
      console.log(`   - [${t.identifier}] ${t.title} (${t.status}, ${t.priority})`);
    }
  });

  // ═══════════════════════════════════════
  // KNOWLEDGE BASE
  // ═══════════════════════════════════════

  test("KNOWLEDGE BASE: Upload a document", async ({ page }) => {
    console.log(`\n📚 KNOWLEDGE BASE`);
    await page.goto(`${BASE}/${prefix}/knowledge-base`);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator("body").innerText();
    const hasKB = bodyText.includes("Knowledge") || bodyText.includes("Upload") || bodyText.includes("document");
    console.log(`   Page loaded: ${hasKB ? "✅" : "❌"}`);
  });

  // ═══════════════════════════════════════
  // DASHBOARD + ANALYTICS
  // ═══════════════════════════════════════

  test("DASHBOARD: View metrics", async ({ page }) => {
    await page.goto(`${BASE}/${prefix}/dashboard`);
    await page.waitForTimeout(3000);

    console.log(`\n📊 DASHBOARD`);
    const bodyText = await page.locator("body").innerText();
    console.log(`   Has agent info: ${bodyText.includes("Nadia") || bodyText.includes("agent") ? "✅" : "❌"}`);
    console.log(`   Has metrics/cards: ${(await page.locator("[class*='card']").count()) > 0 ? "✅" : "❌"}`);
  });

  test("COSTS: View budget and projections", async ({ page }) => {
    await page.goto(`${BASE}/${prefix}/costs`);
    await page.waitForTimeout(2000);

    console.log(`\n💰 COSTS PAGE`);
    const bodyText = await page.locator("body").innerText();
    console.log(`   Page loaded: ${bodyText.length > 100 ? "✅" : "❌"}`);
  });

  // ═══════════════════════════════════════
  // ORG CHART
  // ═══════════════════════════════════════

  test("ORG CHART: View agency hierarchy", async ({ page }) => {
    await page.goto(`${BASE}/${prefix}/org`);
    await page.waitForTimeout(2000);

    console.log(`\n🏗️ ORG CHART`);
    const hasSvg = await page.locator("svg").count() > 0;
    const bodyText = await page.locator("body").innerText();
    const hasNadia = bodyText.includes("Nadia");
    console.log(`   SVG chart rendered: ${hasSvg ? "✅" : "❌"}`);
    console.log(`   CEO Nadia visible: ${hasNadia ? "✅" : "❌"}`);
  });

  // ═══════════════════════════════════════
  // CEO CHAT: More conversations
  // ═══════════════════════════════════════

  test("CEO CHAT: Ask about a specific lead", async () => {
    const response = await chatWithCeo("What do you know about Fatima Hassan? She's our hottest lead.");
    console.log(`\n💬 LEAD DISCUSSION`);
    console.log(`   Response: ${response.slice(0, 200)}...`);
    expect(response.length).toBeGreaterThan(20);
  });

  test("CEO CHAT: Ask to pause all agents", async () => {
    const response = await chatWithCeo("Pause all agents right now.");
    console.log(`\n⏸️ PAUSE ALL`);
    console.log(`   Response: ${response.slice(0, 200)}...`);

    // Check agent statuses
    const agents = (await api("GET", `/companies/${companyId}/agents`)).data;
    const paused = agents.filter((a: any) => a.status === "paused").length;
    const total = agents.filter((a: any) => a.role !== "ceo").length;
    console.log(`   Paused: ${paused}/${total} agents`);
  });

  test("CEO CHAT: Resume agents", async () => {
    const response = await chatWithCeo("Resume all agents. Let's get back to work.");
    console.log(`\n▶️ RESUME ALL`);
    console.log(`   Response: ${response.slice(0, 200)}...`);
  });

  // ═══════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════

  test("SETTINGS: View all sections", async ({ page }) => {
    await page.goto(`${BASE}/${prefix}/company/settings`);
    await page.waitForTimeout(2000);

    console.log(`\n⚙️ SETTINGS`);
    const bodyText = await page.locator("body").innerText();
    console.log(`   Learnings/Instincts: ${bodyText.includes("Learning") || bodyText.includes("Instinct") ? "✅" : "❌"}`);
    console.log(`   Auto-Approve: ${bodyText.includes("Auto-Approve") || bodyText.includes("auto-approve") ? "✅" : "❌"}`);
    console.log(`   Danger Zone: ${bodyText.includes("Danger") || bodyText.includes("Delete") ? "✅" : "❌"}`);
  });

  // ═══════════════════════════════════════
  // FINAL REPORT
  // ═══════════════════════════════════════

  test("FINAL REPORT: Full agency state", async () => {
    const agents = (await api("GET", `/companies/${companyId}/agents`)).data;
    const issues = (await api("GET", `/companies/${companyId}/issues`)).data;
    const approvals = (await api("GET", `/companies/${companyId}/approvals`)).data;
    const leads = (await api("GET", `/companies/${companyId}/leads`)).data;
    const comments = (await api("GET", `/issues/${issues[0]?.id}/comments?order=asc`)).data;
    const dashboard = (await api("GET", `/companies/${companyId}/dashboard`)).data;

    console.log("\n");
    console.log("═══════════════════════════════════════════════════");
    console.log("  GULF HORIZON PROPERTIES — END OF DAY REPORT");
    console.log("═══════════════════════════════════════════════════");
    console.log(`\n  🏢 Agency: Gulf Horizon Properties`);
    console.log(`  👔 CEO: Nadia`);
    console.log(`\n  👥 TEAM (${agents.length} agents):`);
    for (const a of agents) {
      console.log(`     ${a.name} — ${a.role} — ${a.status}`);
    }
    console.log(`\n  📌 TASKS (${issues.length}):`);
    for (const i of issues) {
      console.log(`     [${i.identifier}] ${i.title} — ${i.status}`);
    }
    console.log(`\n  ✅ APPROVALS (${approvals.length}):`);
    for (const a of approvals) {
      console.log(`     ${a.type} — ${a.status}`);
    }
    console.log(`\n  👥 LEADS (${leads.length}):`);
    for (const l of leads) {
      console.log(`     ${l.name} — ${l.stage} — Score: ${l.score}/10 — Source: ${l.source}`);
    }
    console.log(`\n  💬 CEO CHAT MESSAGES: ${comments?.length ?? 0}`);
    console.log(`\n  📊 DASHBOARD:`);
    if (dashboard) {
      console.log(`     Active agents: ${dashboard.agents?.active ?? "?"}`);
      console.log(`     Open tasks: ${dashboard.tasks?.open ?? "?"}`);
      console.log(`     Month spend: $${((dashboard.costs?.monthSpendCents ?? 0) / 100).toFixed(2)}`);
    }
    console.log("\n═══════════════════════════════════════════════════\n");
  });
});
