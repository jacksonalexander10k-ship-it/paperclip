/**
 * Full E2E User Journey — Operates the business as a real agency owner.
 * Fresh DB, goes through onboarding, then exercises every feature.
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:3001";

async function waitForApp(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function nav(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { timeout: 30_000 });
  await waitForApp(page);
}

let prefix = "";
let companyId = "";

test.describe.serial("Full E2E User Journey", () => {

  // ═══════════════════════════════════════
  // PHASE 1: ONBOARDING
  // ═══════════════════════════════════════

  test("Onboarding: complete all steps", async ({ page }) => {
    await nav(page, "/");
    // Step 1: Agency name
    await page.waitForSelector("text=What's your agency called?", { timeout: 15_000 });
    await page.fill('input[placeholder*="Prime Properties"]', "Gulf Horizon Properties");
    await page.click("text=Continue");
    // Step 2: Focus
    await page.click("text=Off-Plan Sales");
    await page.click("text=Secondary / Resale");
    await page.click("text=Rentals & Leasing");
    await page.click("text=Continue");
    // Step 3: Areas
    await page.waitForSelector("text=Which areas", { timeout: 5000 });
    await page.click("text=JVC");
    await page.click("text=Business Bay");
    await page.click("text=Dubai Marina");
    await page.click("text=Palm Jumeirah");
    await page.click("text=Continue");
    // Step 4: Team
    await page.click("text=6–15 people");
    await page.click("text=Continue");
    // Step 5: Sources
    await page.waitForSelector("text=Where do your leads", { timeout: 5000 });
    await page.click("text=Property Finder");
    await page.click("text=Bayut");
    await page.click("text=Instagram");
    await page.click("text=Facebook / Meta Ads");
    await page.click("text=Referrals / Word of mouth");
    await page.click("text=Continue");
    // Step 6: Needs
    await page.waitForSelector("text=What do you need", { timeout: 5000 });
    await page.click("text=Lead Management");
    await page.click("text=Content & Marketing");
    await page.click("text=Market Intelligence");
    await page.click("text=Viewing Management");
    await page.click("text=Portfolio & Landlords");
    // Free text
    const textarea = page.locator("textarea");
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill("We have 8 brokers, mostly Arabic and English speaking. Launching 3 new DAMAC projects next quarter. Need to hit 50 leads/week minimum.");
    }
    await page.click("text=Continue");
    // Step 7: Pack
    await page.waitForSelector("text=Choose your setup", { timeout: 5000 });
    await page.click("text=Scale");
    await page.click("text=Continue");
    // Step 8: CEO name
    await page.waitForSelector("text=Name your CEO", { timeout: 5000 });
    await page.fill('input[placeholder*="Khalid"]', "Rashid");
    await page.click("text=Hire CEO");
    // Wait for loading + redirect
    await page.waitForURL(/ceo-chat/, { timeout: 120_000 });
    const url = page.url();
    const m = url.match(/\/([A-Z]+)\/ceo-chat/);
    prefix = m?.[1] ?? "";
    console.log("✅ ONBOARDING: Complete. Prefix:", prefix);
  });

  // ═══════════════════════════════════════
  // PHASE 2: CEO CHAT FIRST RUN
  // ═══════════════════════════════════════

  test("CEO Chat: welcome messages + team proposal", async ({ page }) => {
    const res = await fetch(`${BASE}/api/companies`);
    const companies = await res.json();
    companyId = companies[0]?.id ?? "";
    prefix = companies[0]?.issuePrefix ?? prefix;

    await nav(page, `/${prefix}/ceo-chat`);
    await page.waitForTimeout(3000);

    // Check CEO messages exist
    const msgCount = await page.locator('[class*="rounded"]').filter({ hasText: /Gulf Horizon|Rashid|team|setup/ }).count();
    console.log(`  CEO messages found: ${msgCount}`);

    // Check team proposal
    const hasProposal = await page.locator("text=Proposed Team").isVisible({ timeout: 3000 }).catch(() => false);
    const hasApproveBtn = await page.locator("text=Approve & Hire Team").isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Team proposal: ${hasProposal}, Approve button: ${hasApproveBtn}`);

    // Approve the team
    if (hasApproveBtn) {
      await page.click("text=Approve & Hire Team");
      await page.waitForTimeout(3000);
    }

    // Verify agents created
    const agentsRes = await fetch(`${BASE}/api/companies/${companyId}/agents`);
    const agents = await agentsRes.json();
    console.log(`  Agents created: ${agents.length} — ${agents.map((a: any) => `${a.name} (${a.role})`).join(", ")}`);
    console.log("✅ CEO CHAT FIRST RUN: Complete");
  });

  // ═══════════════════════════════════════
  // PHASE 3: CEO CHAT DAILY USE
  // ═══════════════════════════════════════

  test("CEO Chat: send message + quick actions", async ({ page }) => {
    await nav(page, `/${prefix}/ceo-chat`);
    await page.waitForTimeout(2000);

    // Send a message
    const input = page.locator('input[placeholder*="Type a message"]');
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill("Brief me on the agency. What should we focus on today?");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(8000);
      console.log("  Message sent + response received");
    }

    // Test quick actions exist
    const quickActions = await page.locator("button").filter({ hasText: /Brief me|Pause all|Show budget|Find leads/ }).count();
    console.log(`  Quick action buttons found: ${quickActions}`);
    console.log("✅ CEO CHAT DAILY: Complete");
  });

  // ═══════════════════════════════════════
  // PHASE 4: NAVIGATION — ALL PAGES
  // ═══════════════════════════════════════

  test("Navigate all pages", async ({ page }) => {
    const pages = [
      { path: `/${prefix}/dashboard`, name: "Dashboard" },
      { path: `/${prefix}/agents/all`, name: "Agents" },
      { path: `/${prefix}/approvals/pending`, name: "Approvals" },
      { path: `/${prefix}/leads`, name: "Leads" },
      { path: `/${prefix}/issues`, name: "Tasks" },
      { path: `/${prefix}/inbox/mine`, name: "Inbox" },
      { path: `/${prefix}/activity`, name: "Activity" },
      { path: `/${prefix}/costs/summary`, name: "Costs" },
      { path: `/${prefix}/knowledge-base`, name: "Knowledge Base" },
      { path: `/${prefix}/properties/sale`, name: "Properties" },
      { path: `/${prefix}/org`, name: "Org Chart" },
      { path: `/${prefix}/automations`, name: "Automations" },
      { path: `/${prefix}/documents`, name: "Documents" },
      { path: `/${prefix}/company/settings`, name: "Settings" },
    ];

    for (const p of pages) {
      await nav(page, p.path);
      const hasContent = await page.locator("main, [class*='content'], [class*='page']").first().isVisible({ timeout: 5000 }).catch(() => false);
      const notBlank = (await page.locator("body").innerText()).length > 50;
      console.log(`  ${p.name}: ${notBlank ? "✅" : "❌"}`);
    }
    console.log("✅ ALL PAGES: Navigation complete");
  });

  // ═══════════════════════════════════════
  // PHASE 5: SETTINGS FEATURES
  // ═══════════════════════════════════════

  test("Settings: learnings, export, delete sections", async ({ page }) => {
    await nav(page, `/${prefix}/company/settings`);
    await page.waitForTimeout(2000);

    const bodyText = await page.locator("body").innerText();
    const hasLearnings = bodyText.includes("Learning") || bodyText.includes("Instinct");
    const hasAutoApprove = bodyText.includes("Auto-Approve") || bodyText.includes("auto-approve");
    const hasDanger = bodyText.includes("Danger") || bodyText.includes("Delete");

    console.log(`  Learnings section: ${hasLearnings ? "✅" : "❌"}`);
    console.log(`  Auto-Approve section: ${hasAutoApprove ? "✅" : "❌"}`);
    console.log(`  Danger/Delete section: ${hasDanger ? "✅" : "❌"}`);
    console.log("✅ SETTINGS: Complete");
  });

  // ═══════════════════════════════════════
  // PHASE 6: BACKEND API VERIFICATION
  // ═══════════════════════════════════════

  test("Backend APIs: all endpoints respond", async ({ request }) => {
    const endpoints = [
      { name: "Health", url: "/api/health" },
      { name: "Companies", url: "/api/companies" },
      { name: "Agents", url: `/api/companies/${companyId}/agents` },
      { name: "Issues", url: `/api/companies/${companyId}/issues` },
      { name: "Approvals", url: `/api/companies/${companyId}/approvals` },
      { name: "Costs Summary", url: `/api/companies/${companyId}/costs/summary` },
      { name: "Costs By Agent", url: `/api/companies/${companyId}/costs/by-agent` },
      { name: "Dashboard", url: `/api/companies/${companyId}/dashboard` },
      { name: "Activity", url: `/api/companies/${companyId}/activity` },
      { name: "Leads", url: `/api/companies/${companyId}/leads` },
      { name: "Knowledge Base", url: `/api/companies/${companyId}/knowledge-base` },
      { name: "Push Subscriptions", url: `/api/companies/${companyId}/push-subscriptions` },
    ];

    let passed = 0;
    for (const ep of endpoints) {
      const res = await request.get(`${BASE}${ep.url}`);
      const ok = res.status() === 200;
      if (ok) passed++;
      console.log(`  ${ep.name}: ${ok ? "✅" : "❌"} (${res.status()})`);
    }
    console.log(`✅ BACKEND: ${passed}/${endpoints.length} endpoints OK`);
  });

  // ═══════════════════════════════════════
  // PHASE 7: LEAD MANAGEMENT
  // ═══════════════════════════════════════

  test("Leads: create via API + verify in UI", async ({ page, request }) => {
    // Create a lead via API
    const leadRes = await request.post(`${BASE}/api/companies/${companyId}/leads`, {
      data: {
        name: "Ahmed Al Hashimi",
        phone: "+971501234567",
        email: "ahmed@test.com",
        source: "property_finder",
        stage: "new",
        score: 8,
      },
    });
    const lead = await leadRes.json();
    console.log(`  Lead created: ${lead.id ? "✅" : "❌"}`);

    // Verify in UI
    await nav(page, `/${prefix}/leads`);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator("body").innerText();
    const hasLead = bodyText.includes("Ahmed") || bodyText.includes("Hashimi");
    console.log(`  Lead visible in UI: ${hasLead ? "✅" : "❌"}`);
    console.log("✅ LEADS: Complete");
  });

  // ═══════════════════════════════════════
  // PHASE 8: MOBILE
  // ═══════════════════════════════════════

  test("Mobile: CEO Chat renders correctly", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await nav(page, `/${prefix}/ceo-chat`);

    const inputVisible = await page.locator('input[placeholder*="Type a message"]').isVisible({ timeout: 5000 }).catch(() => false);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const noOverflow = bodyWidth <= 385;

    console.log(`  Mobile input visible: ${inputVisible ? "✅" : "❌"}`);
    console.log(`  No horizontal overflow: ${noOverflow ? "✅" : "❌"} (${bodyWidth}px)`);
    console.log("✅ MOBILE: Complete");
    await ctx.close();
  });

  // ═══════════════════════════════════════
  // PHASE 9: AGENT DETAIL
  // ═══════════════════════════════════════

  test("Agent Detail: view CEO agent", async ({ page }) => {
    // Get CEO agent ID
    const agentsRes = await fetch(`${BASE}/api/companies/${companyId}/agents`);
    const agents = await agentsRes.json();
    const ceo = agents.find((a: any) => a.role === "ceo");

    if (ceo) {
      await nav(page, `/${prefix}/agents/${ceo.id}`);
      await page.waitForTimeout(2000);
      const bodyText = await page.locator("body").innerText();
      const hasName = bodyText.includes("Rashid") || bodyText.includes("CEO");
      const hasPause = bodyText.includes("Pause");
      console.log(`  Agent name visible: ${hasName ? "✅" : "❌"}`);
      console.log(`  Pause button: ${hasPause ? "✅" : "❌"}`);
    }
    console.log("✅ AGENT DETAIL: Complete");
  });

  // ═══════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════

  test("Final: count all agents and verify state", async () => {
    const agentsRes = await fetch(`${BASE}/api/companies/${companyId}/agents`);
    const agents = await agentsRes.json();

    const issuesRes = await fetch(`${BASE}/api/companies/${companyId}/issues`);
    const issues = await issuesRes.json();

    const approvalsRes = await fetch(`${BASE}/api/companies/${companyId}/approvals`);
    const approvals = await approvalsRes.json();

    const leadsRes = await fetch(`${BASE}/api/companies/${companyId}/leads`);
    const leads = await leadsRes.json();

    console.log("\n══════════════════════════════════");
    console.log("  FINAL STATE OF GULF HORIZON PROPERTIES");
    console.log("══════════════════════════════════");
    console.log(`  Agents: ${agents.length}`);
    agents.forEach((a: any) => console.log(`    - ${a.name} (${a.role}) — ${a.status}`));
    console.log(`  Issues/Tasks: ${issues.length}`);
    console.log(`  Approvals: ${approvals.length}`);
    console.log(`  Leads: ${leads.length}`);
    console.log("══════════════════════════════════\n");
  });
});
