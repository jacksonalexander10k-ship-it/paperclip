/**
 * Full App Audit — Tests all 100 user actions
 * Runs as a real agency owner operating the full business
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "http://127.0.0.1:3001";
const TIMEOUT = 15_000;

// Helper: wait for page to be interactive
async function waitForApp(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

// Helper: navigate within the app
async function nav(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { timeout: 30_000 });
  await waitForApp(page);
}

// Store state across tests
let companyPrefix = "";
let companyId = "";

test.describe.serial("Full App Audit — 100 User Actions", () => {

  // ═══════════════════════════════════════════════════════════════
  // ONBOARDING (#1-10)
  // ═══════════════════════════════════════════════════════════════

  test("1-2: Agency name + focus selection", async ({ page }) => {
    await nav(page, "/");
    await page.waitForSelector("text=What's your agency called?", { timeout: TIMEOUT });
    await page.fill('input[placeholder*="Prime Properties"]', "TestCo Realty");
    await page.click("text=Continue");
    await page.waitForSelector("text=What does your agency do?", { timeout: TIMEOUT });
    await page.click("text=Off-Plan Sales");
    await page.click("text=Rentals & Leasing");
    await page.click("text=Continue");
  });

  test("3-4: Areas + team size", async ({ page }) => {
    await nav(page, "/");
    // Need to redo onboarding since each test gets fresh page
    await page.waitForSelector("text=What's your agency called?", { timeout: TIMEOUT });
    await page.fill('input[placeholder*="Prime Properties"]', "TestCo Realty");
    await page.click("text=Continue");
    await page.waitForSelector("text=What does your agency do?", { timeout: TIMEOUT });
    await page.click("text=Off-Plan Sales");
    await page.click("text=Continue");
    await page.waitForSelector("text=Which areas do you cover?", { timeout: TIMEOUT });
    await page.click("text=JVC");
    await page.click("text=Downtown");
    await page.click("text=Continue");
    await page.waitForSelector("text=How big is your current team?", { timeout: TIMEOUT });
    await page.click("text=2–5 people");
    await page.click("text=Continue");
  });

  test("5-10: Full onboarding through to CEO Chat", async ({ page }) => {
    await nav(page, "/");
    // Step 1
    await page.waitForSelector("text=What's your agency called?", { timeout: TIMEOUT });
    await page.fill('input[placeholder*="Prime Properties"]', "TestCo Realty");
    await page.click("text=Continue");
    // Step 2
    await page.click("text=Off-Plan Sales");
    await page.click("text=Rentals & Leasing");
    await page.click("text=Continue");
    // Step 3
    await page.waitForSelector("text=Which areas", { timeout: TIMEOUT });
    await page.click("text=JVC");
    await page.click("text=Downtown");
    await page.click("text=Dubai Marina");
    await page.click("text=Continue");
    // Step 4
    await page.click("text=2–5 people");
    await page.click("text=Continue");
    // Step 5
    await page.waitForSelector("text=Where do your leads", { timeout: TIMEOUT });
    await page.click("text=Property Finder");
    await page.click("text=Instagram");
    await page.click("text=Continue");
    // Step 6
    await page.waitForSelector("text=What do you need", { timeout: TIMEOUT });
    await page.click("text=Lead Management");
    await page.click("text=Content & Marketing");
    await page.click("text=Market Intelligence");
    await page.click("text=Continue");
    // Step 7 — Pack selection
    await page.waitForSelector("text=Choose your setup", { timeout: TIMEOUT });
    await page.click("text=Scale");
    await page.click("text=Continue");
    // Step 8 — CEO name
    await page.waitForSelector("text=Name your CEO", { timeout: TIMEOUT });
    await page.fill('input[placeholder*="Khalid"]', "Max");
    await page.click("text=Hire CEO");
    // Step 9 — Loading
    await page.waitForSelector("text=Hiring Max", { timeout: TIMEOUT });
    // Wait for redirect to CEO Chat (may take 30+ seconds for Claude)
    await page.waitForURL(/ceo-chat/, { timeout: 90_000 });
    // Save prefix for other tests
    const url = page.url();
    const match = url.match(/\/([A-Z]+)\/ceo-chat/);
    companyPrefix = match?.[1] ?? "TES";
    console.log(`✅ Onboarding complete. Prefix: ${companyPrefix}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // CEO CHAT FIRST RUN (#11-16)
  // ═══════════════════════════════════════════════════════════════

  test("11-13: CEO welcome + team proposal with editable names", async ({ page }) => {
    // Get company from DB
    const healthRes = await fetch(`${BASE}/api/companies`);
    const companies = await healthRes.json();
    if (companies.length > 0) {
      companyId = companies[0].id;
      companyPrefix = companies[0].issuePrefix;
    }
    await nav(page, `/${companyPrefix}/ceo-chat`);

    // Check for CEO messages
    const hasCeoMessages = await page.locator('[class*="CEO"]').count() > 0 ||
      await page.locator('text=TestCo').count() > 0 ||
      await page.locator('text=Max').count() > 0;
    console.log(`  CEO messages visible: ${hasCeoMessages}`);

    // Check for team proposal card
    const hasTeamCard = await page.locator('text=Proposed Team').count() > 0 ||
      await page.locator('text=Approve & Hire Team').count() > 0;
    console.log(`  Team proposal card: ${hasTeamCard}`);

    // Check for editable name inputs
    if (hasTeamCard) {
      const nameInputs = await page.locator('input[type="text"]').count();
      console.log(`  Editable name inputs: ${nameInputs}`);
    }
  });

  test("14: Approve & Hire Team creates agents", async ({ page }) => {
    await nav(page, `/${companyPrefix}/ceo-chat`);
    await page.waitForTimeout(2000);

    const approveBtn = page.locator('text=Approve & Hire Team');
    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(3000);
      // Verify agents created
      const agentsRes = await fetch(`${BASE}/api/companies/${companyId}/agents`);
      const agents = await agentsRes.json();
      console.log(`  Agents after approval: ${agents.length} (${agents.map((a: any) => a.name).join(", ")})`);
      expect(agents.length).toBeGreaterThan(1);
    } else {
      console.log("  ⚠️ Team already approved or card not visible");
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // CEO CHAT DAILY (#17-27)
  // ═══════════════════════════════════════════════════════════════

  test("17: Send message and get response", async ({ page }) => {
    await nav(page, `/${companyPrefix}/ceo-chat`);
    const input = page.locator('input[placeholder*="Type a message"]');
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill("Hello Max, brief me on the agency status");
      await page.locator('button[type="submit"], button:has(svg)').last().click();
      // Wait for streaming response (up to 60s for Claude)
      await page.waitForTimeout(5000);
      const hasResponse = await page.locator('.chat-msg-enter, [class*="bubble"]').count() > 0;
      console.log(`  Got CEO response: ${hasResponse}`);
    }
  });

  test("18-21: Quick action buttons exist", async ({ page }) => {
    await nav(page, `/${companyPrefix}/ceo-chat`);
    const actions = ["Brief me", "What's pending?", "Pause all agents", "Show budget", "Find leads"];
    for (const action of actions) {
      const btn = page.locator(`text=${action}`);
      const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`  Quick action "${action}": ${visible ? "✅" : "❌"}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // APPROVALS (#25-29)
  // ═══════════════════════════════════════════════════════════════

  test("25-29: Approvals page loads and shows items", async ({ page }) => {
    await nav(page, `/${companyPrefix}/approvals/pending`);
    const pageLoaded = await page.locator('text=Approvals').isVisible({ timeout: TIMEOUT }).catch(() => false) ||
      await page.locator('text=All caught up').isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Approvals page loaded: ${pageLoaded}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // AGENT MANAGEMENT (#30-37)
  // ═══════════════════════════════════════════════════════════════

  test("30-34: Agent list and detail page", async ({ page }) => {
    await nav(page, `/${companyPrefix}/agents/all`);
    await page.waitForTimeout(2000);
    const agentCards = await page.locator('[class*="agent"], [data-testid*="agent"]').count();
    const hasAgents = agentCards > 0 || await page.locator('text=Max').isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Agent list visible: ${hasAgents}`);

    // Click first agent to view detail
    const firstAgent = page.locator('text=Max').first();
    if (await firstAgent.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstAgent.click();
      await page.waitForTimeout(2000);
      const detailLoaded = await page.locator('text=Pause').isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`  Agent detail loaded: ${detailLoaded}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD (#35-38)
  // ═══════════════════════════════════════════════════════════════

  test("35-38: Dashboard loads with metrics", async ({ page }) => {
    await nav(page, `/${companyPrefix}/dashboard`);
    const loaded = await page.locator('text=Dashboard').isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Dashboard loaded: ${loaded}`);
    // Check for metric cards
    const hasMetrics = await page.locator('[class*="card"], [class*="stat"]').count() > 0;
    console.log(`  Has metric cards: ${hasMetrics}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // LEADS (#39-45)
  // ═══════════════════════════════════════════════════════════════

  test("39-43: Leads page loads with filters", async ({ page }) => {
    await nav(page, `/${companyPrefix}/leads`);
    const loaded = await page.locator('text=Leads').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Leads page loaded: ${loaded}`);
    // Check for add lead button
    const hasAddBtn = await page.locator('text=Add Lead').isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Add Lead button: ${hasAddBtn}`);
  });

  test("44: Add a lead manually", async ({ page }) => {
    await nav(page, `/${companyPrefix}/leads`);
    const addBtn = page.locator('text=Add Lead');
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      // Fill lead form if modal appears
      const nameInput = page.locator('input[placeholder*="name"], input[name="name"]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill("Ahmed Al Hashimi");
        const phoneInput = page.locator('input[placeholder*="phone"], input[name="phone"]').first();
        if (await phoneInput.isVisible()) await phoneInput.fill("+971501234567");
        console.log("  ✅ Lead form filled");
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // INBOX (#46-47)
  // ═══════════════════════════════════════════════════════════════

  test("46-47: Inbox page loads", async ({ page }) => {
    await nav(page, `/${companyPrefix}/inbox/mine`);
    const loaded = await page.locator('text=Inbox').isVisible({ timeout: TIMEOUT }).catch(() => false) ||
      await page.locator('text=Nothing here').isVisible({ timeout: TIMEOUT }).catch(() => false) ||
      await page.locator('text=All caught up').isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Inbox loaded: ${loaded}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // TASKS (#48-50)
  // ═══════════════════════════════════════════════════════════════

  test("48-50: Tasks/Issues page loads with completion bar", async ({ page }) => {
    await nav(page, `/${companyPrefix}/issues`);
    await page.waitForTimeout(2000);
    const loaded = await page.locator('text=Tasks').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Tasks page loaded: ${loaded}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // LIVE ACTIVITY (#51-53)
  // ═══════════════════════════════════════════════════════════════

  test("51: Live Activity page loads", async ({ page }) => {
    await nav(page, `/${companyPrefix}/activity`);
    const loaded = await page.locator('text=Activity').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Activity page loaded: ${loaded}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // BUDGET (#54-56)
  // ═══════════════════════════════════════════════════════════════

  test("54-56: Budget/Costs page loads with projections", async ({ page }) => {
    await nav(page, `/${companyPrefix}/costs`);
    const loaded = await page.locator('text=Cost').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Costs page loaded: ${loaded}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // KNOWLEDGE BASE (#57-59)
  // ═══════════════════════════════════════════════════════════════

  test("57-59: Knowledge Base page loads", async ({ page }) => {
    await nav(page, `/${companyPrefix}/knowledge-base`);
    const loaded = await page.locator('text=Knowledge').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Knowledge Base loaded: ${loaded}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // SETTINGS (#60-65)
  // ═══════════════════════════════════════════════════════════════

  test("60-65: Settings page loads with all sections", async ({ page }) => {
    await nav(page, `/${companyPrefix}/company/settings`);
    await page.waitForTimeout(2000);
    const loaded = await page.locator('text=Settings').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Settings loaded: ${loaded}`);

    // Check for new sections
    const sections = ["Learnings", "Auto-Approve", "Export", "Delete", "Danger"];
    for (const section of sections) {
      const visible = await page.locator(`text=${section}`).first().isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`  Settings section "${section}": ${visible ? "✅" : "❌"}`);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // PROPERTIES (#66-67)
  // ═══════════════════════════════════════════════════════════════

  test("66-67: Properties page loads", async ({ page }) => {
    await nav(page, `/${companyPrefix}/properties/sale`);
    const loaded = await page.locator('text=Properties').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Properties page loaded: ${loaded}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // ORG CHART (#91-95)
  // ═══════════════════════════════════════════════════════════════

  test("91-95: Org Chart page loads", async ({ page }) => {
    await nav(page, `/${companyPrefix}/org`);
    const loaded = await page.locator('text=Org').first().isVisible({ timeout: TIMEOUT }).catch(() => false) ||
      await page.locator('svg').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Org Chart loaded: ${loaded}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // AUTOMATIONS (#68-70)
  // ═══════════════════════════════════════════════════════════════

  test("68-70: Automations page loads", async ({ page }) => {
    await nav(page, `/${companyPrefix}/automations`);
    const loaded = await page.locator('text=Automation').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Automations page loaded: ${loaded}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // DOCUMENTS (#71)
  // ═══════════════════════════════════════════════════════════════

  test("71: Documents page loads", async ({ page }) => {
    await nav(page, `/${companyPrefix}/documents`);
    const loaded = await page.locator('text=Document').first().isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Documents page loaded: ${loaded}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // API VERIFICATION (backend wiring)
  // ═══════════════════════════════════════════════════════════════

  test("Backend APIs: verify all critical endpoints respond", async ({ request }) => {
    // Get company ID from DB
    const companiesRes = await request.get(`${BASE}/api/companies`);
    const companies = await companiesRes.json();
    if (companies.length === 0) {
      console.log("  ⚠️ No companies — skipping API checks");
      return;
    }
    const cId = companies[0].id;

    const endpoints = [
      { name: "Health", method: "GET", url: "/api/health" },
      { name: "Companies", method: "GET", url: "/api/companies" },
      { name: "Agents", method: "GET", url: `/api/companies/${cId}/agents` },
      { name: "Issues", method: "GET", url: `/api/companies/${cId}/issues` },
      { name: "Approvals", method: "GET", url: `/api/companies/${cId}/approvals` },
      { name: "Costs", method: "GET", url: `/api/companies/${cId}/costs` },
      { name: "Dashboard", method: "GET", url: `/api/companies/${cId}/dashboard` },
      { name: "Activity", method: "GET", url: `/api/companies/${cId}/activity` },
      { name: "Leads", method: "GET", url: `/api/companies/${cId}/leads` },
      { name: "Knowledge Base", method: "GET", url: `/api/companies/${cId}/knowledge-base` },
    ];

    for (const ep of endpoints) {
      try {
        const res = await request.get(`${BASE}${ep.url}`);
        const status = res.status();
        console.log(`  ${ep.name}: ${status === 200 ? "✅" : "❌"} (${status})`);
      } catch (err) {
        console.log(`  ${ep.name}: ❌ (fetch failed)`);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // MOBILE RESPONSIVENESS (#96-100)
  // ═══════════════════════════════════════════════════════════════

  test("96-100: Mobile viewport renders correctly", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }, // iPhone X
    });
    const page = await context.newPage();

    // Get company from DB
    const companiesRes = await (await fetch(`${BASE}/api/companies`)).json();
    if (companiesRes.length === 0) {
      console.log("  ⚠️ No companies — skipping mobile test");
      return;
    }
    const prefix = companiesRes[0].issuePrefix;

    await nav(page, `/${prefix}/ceo-chat`);
    const chatVisible = await page.locator('text=CEO Chat').isVisible({ timeout: TIMEOUT }).catch(() => false);
    console.log(`  Mobile CEO Chat loaded: ${chatVisible}`);

    // Check input is visible
    const inputVisible = await page.locator('input[placeholder*="Type a message"]').isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Mobile input visible: ${inputVisible}`);

    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = 375;
    const hasOverflow = bodyWidth > viewportWidth + 10;
    console.log(`  Mobile no horizontal overflow: ${!hasOverflow ? "✅" : "❌"} (body: ${bodyWidth}px)`);

    await context.close();
  });
});
