/**
 * Creates the demo user and links it to the demo company.
 * Run: pnpm --filter @paperclipai/db exec tsx src/seed-demo-user.ts
 */
import postgres from "postgres";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";

const sql = postgres("postgres://paperclip:paperclip@127.0.0.1:54329/paperclip", { max: 1 });

const DEMO_EMAIL = "demo@aygencyworld.com";
const DEMO_PASSWORD = "demo1234";

async function main() {
  const userId = randomUUID();
  const accountId = randomUUID();
  const now = new Date().toISOString();

  // Hash password (same format as better-auth: salt:hash, both hex, scrypt)
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(DEMO_PASSWORD, salt, 64).toString("hex");
  const passwordHash = `${salt}:${hash}`;

  // Clean up existing demo user
  console.log("Cleaning previous demo user...");
  await sql`DELETE FROM company_memberships WHERE principal_id IN (SELECT id FROM "user" WHERE email = ${DEMO_EMAIL})`;
  await sql`DELETE FROM instance_user_roles WHERE user_id IN (SELECT id FROM "user" WHERE email = ${DEMO_EMAIL})`;
  await sql`DELETE FROM account WHERE user_id IN (SELECT id FROM "user" WHERE email = ${DEMO_EMAIL})`;
  await sql`DELETE FROM session WHERE user_id IN (SELECT id FROM "user" WHERE email = ${DEMO_EMAIL})`;
  await sql`DELETE FROM "user" WHERE email = ${DEMO_EMAIL}`;

  // Create user
  await sql`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
            VALUES (${userId}, ${"Demo Owner"}, ${DEMO_EMAIL}, ${true}, ${now}, ${now})`;

  // Create account with password
  await sql`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
            VALUES (${accountId}, ${userId}, ${"credential"}, ${userId}, ${passwordHash}, ${now}, ${now})`;

  // Create instance_admin role
  await sql`INSERT INTO instance_user_roles (id, user_id, role)
            VALUES (${randomUUID()}, ${userId}, ${"instance_admin"})`;

  // Link to demo company
  const companies = await sql`SELECT id FROM companies WHERE issue_prefix = 'DPP'`;
  if (companies.length > 0) {
    const companyId = companies[0]!.id;
    await sql`INSERT INTO company_memberships (id, company_id, principal_type, principal_id, status, membership_role)
              VALUES (${randomUUID()}, ${companyId}, ${"user"}, ${userId}, ${"active"}, ${"owner"})`;
    console.log(`✓ Linked to company: ${companyId}`);
  } else {
    console.log("⚠ No demo company found. Run seed-demo.ts first.");
  }

  console.log(`\n✅ Demo user ready!`);
  console.log(`   Email: ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
  console.log(`   URL: http://localhost:5173\n`);

  await sql.end();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
