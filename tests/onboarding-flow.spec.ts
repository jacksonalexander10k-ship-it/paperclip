import { test, expect } from "@playwright/test";

const BASE = "http://127.0.0.1:3001";

test.describe("Onboarding → CEO Welcome → Team Proposal", () => {
  test("full flow: onboarding wizard through to team proposal card", async ({ page }) => {
    // ── Step 1: Agency name ──
    await page.goto(BASE);
    await page.waitForSelector("text=What's your agency called?", { timeout: 10000 });
    await page.fill('input[placeholder*="Prime Properties"]', "10k Properties");
    await page.click("text=Continue");

    // ── Step 2: Focus ──
    await page.waitForSelector("text=What does your agency do?", { timeout: 5000 });
    await page.click("text=Off-Plan Sales");
    await page.click("text=Secondary / Resale");
    await page.click("text=Continue");

    // ── Step 3: Areas ──
    await page.waitForSelector("text=Which areas do you cover?", { timeout: 5000 });
    await page.click("text=Downtown");
    await page.click("text=Dubai Marina");
    await page.click("text=Business Bay");
    await page.click("text=Continue");

    // ── Step 4: Team size ──
    await page.waitForSelector("text=How big is your current team?", { timeout: 5000 });
    await page.click("text=2–5 people");
    await page.click("text=Continue");

    // ── Step 5: Lead sources ──
    await page.waitForSelector("text=Where do your leads come from?", { timeout: 5000 });
    await page.click("text=Property Finder");
    await page.click("text=Instagram");
    await page.click("text=Continue");

    // ── Step 6: Needs ──
    await page.waitForSelector("text=What do you need help with?", { timeout: 5000 });
    await page.click("text=Lead Management");
    await page.click("text=Content & Marketing");
    await page.click("text=Continue");

    // ── Step 7: Name CEO ──
    await page.waitForSelector("text=Name your CEO", { timeout: 5000 });
    await page.fill('input[placeholder*="Khalid"]', "Clive");
    await page.click("text=Hire CEO");

    // ── Step 8: Creating ──
    await page.waitForSelector("text=Clive is ready", { timeout: 15000 });

    // ── CEO Chat — Vite dev can be slow, wait then navigate directly ──
    await page.waitForTimeout(3000);
    // Navigate directly to CEO Chat (Vite redirect can leave blank page)
    await page.goto(`${BASE}/KPR/ceo-chat`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=CEO Chat", { timeout: 30000 });

    // ── First-run welcome messages should appear ──
    // Wait for the first-run trigger + comment refetch
    await page.waitForTimeout(5000);
    // Reload to ensure comments are fetched fresh
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    // Wait for the CEO's welcome greeting
    await page.waitForSelector("text=Welcome to 10k Properties", { timeout: 20000 });

    // Wait for context acknowledgment
    await expect(page.locator("text=off-plan")).toBeVisible({ timeout: 5000 });

    // Wait for team proposal card
    await page.waitForSelector("text=Proposed Team", { timeout: 10000 });

    // ── Verify team proposal has editable name fields ──
    const nameInputs = page.locator('input[type="text"]');
    const inputCount = await nameInputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(2);

    // ── Edit an agent name ──
    const firstNameInput = nameInputs.first();
    await firstNameInput.clear();
    await firstNameInput.fill("Sarah");

    // ── Verify "Approve & Hire Team" button exists ──
    await expect(page.locator("text=Approve & Hire Team")).toBeVisible();

    // ── Click approve ──
    await page.click("text=Approve & Hire Team");

    // ── Verify approval went through ──
    await page.waitForSelector("text=Team approved", { timeout: 10000 });

    console.log("✅ Full onboarding flow passed!");
  });
});
