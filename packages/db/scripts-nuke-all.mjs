/**
 * Wipe ALL non-auth data. Leaves user/auth tables intact so the dev account can log in.
 * No demo agency, no agents, no leads — completely empty. Use this to test onboarding from scratch.
 *
 * Run:  cd packages/db && node scripts-nuke-all.mjs
 */
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL ?? "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";
const sql = postgres(DB_URL, { max: 1 });

// Tables to PRESERVE — everything related to auth, the user's account, and Drizzle's own bookkeeping.
const KEEP = [
  "user",
  "account",
  "session",
  "verification",
  "instance_settings",
  "instance_user_roles",
  "cli_auth_challenges",
  "board_api_keys",
  "__drizzle_migrations",
];

async function main() {
  console.log("=== NUKING ALL DATA (keeping auth only) ===\n");

  const users = await sql`SELECT id, email FROM "user" ORDER BY created_at ASC LIMIT 5`;
  console.log(`Keeping ${users.length} user(s):`);
  for (const u of users) console.log(`  - ${u.email ?? "(no email)"} id=${u.id}`);
  console.log("");

  const allTablesRes = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ${sql(KEEP)}
    ORDER BY tablename
  `;
  const tables = allTablesRes.map((r) => r.tablename);
  console.log(`Truncating ${tables.length} tables (cascade)…`);

  // Single TRUNCATE with CASCADE drops all data and resets FKs in one go
  const quoted = tables.map((t) => `"${t}"`).join(", ");
  await sql.unsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);

  console.log("\n✓ All non-auth data wiped.");
  console.log("✓ User accounts preserved — log in as normal, onboarding will run fresh.");

  // Sanity check — confirm a few key tables are empty
  const checks = [
    "companies",
    "agents",
    "aygent_leads",
    "aygent_whatsapp_messages",
    "aygent_agent_credential_links",
    "aygent_company_credentials",
  ];
  console.log("\nRow counts after wipe:");
  for (const t of checks) {
    try {
      const [row] = await sql.unsafe(`SELECT COUNT(*)::int AS n FROM "${t}"`);
      console.log(`  ${t.padEnd(35)} ${row.n}`);
    } catch (err) {
      console.log(`  ${t.padEnd(35)} (table missing)`);
    }
  }

  await sql.end();
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
