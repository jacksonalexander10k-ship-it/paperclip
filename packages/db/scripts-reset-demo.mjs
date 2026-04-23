/**
 * Nuke all companies + rebuild one clean Demo company with canonical 7-agent roster.
 * Run:  cd packages/db && node scripts-reset-demo.mjs
 */
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL ?? "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";
const sql = postgres(DB_URL, { max: 1 });

const AGENTS = [
  { name: "Omar",   role: "ceo",          title: "Executive Director",   heartbeat: 14400, auto: null  },
  { name: "Sarah",  role: "sales",        title: "Sales Agent",          heartbeat: 900,   auto: false },
  { name: "Aisha",  role: "content",      title: "Social Media Manager", heartbeat: 86400, auto: null  },
  { name: "Khaled", role: "marketing",    title: "Marketing Manager",    heartbeat: 3600,  auto: null  },
  { name: "Tariq",  role: "intelligence", title: "Data Analyst",         heartbeat: 3600,  auto: null  },
  { name: "Layla",  role: "operations",   title: "Operations Agent",     heartbeat: 1800,  auto: null  },
  { name: "Mariam", role: "finance",      title: "Finance Officer",      heartbeat: 86400, auto: null  },
];

const TEMPLATES = [
  { name: "Off-plan first touch", category: "first_touch", isDefault: true,  content: "Hi {{lead_name}}! This is {{agent_name}} from {{company_name}}. I noticed you were interested in off-plan properties in Dubai. We have some exciting new launches with great payment plans 🏠 What area are you focused on?" },
  { name: "Secondary market — quick intro", category: "first_touch", isDefault: false, content: "Hi {{lead_name}}, this is {{agent_name}} from {{company_name}}. Are you currently looking to buy a ready property in Dubai? I can shortlist 3 options that match your budget today." },
  { name: "Casual first message", category: "first_touch", isDefault: false, content: "Hey {{lead_name}}! 👋 {{agent_name}} from {{company_name}} — saw you were checking out Dubai property. Anything specific I can help with?" },
  { name: "Cold lead re-engagement", category: "reactivation", isDefault: false, content: "Hi {{lead_name}}, {{agent_name}} here from {{company_name}}. The Dubai market has shifted in the last few months — would you like a quick update on what your budget gets you today?" },
];

async function main() {
  console.log("=== RESETTING DEMO ===\n");

  const users = await sql`SELECT id, email FROM "user" ORDER BY created_at ASC LIMIT 5`;
  if (users.length === 0) {
    console.error("✗ No user found. Sign up first.");
    await sql.end();
    process.exit(1);
  }
  const user = users[0];
  console.log(`Primary user: ${user.email ?? "(no email)"} id=${user.id}\n`);

  const existing = await sql`SELECT id, name FROM companies`;
  console.log(`Deleting ${existing.length} existing companies:`);
  for (const c of existing) console.log(`  - ${c.name}`);

  // Delete in FK order (most tables don't have ON DELETE CASCADE back to companies)
  const depTables = [
    "activity_log",
    "agent_api_keys",
    "agent_config_revisions",
    "agent_runtime_state",
    "agent_task_sessions",
    "agent_wakeup_requests",
    "approval_comments",
    "approvals",
    "assets",
    "aygent_activities",
    "aygent_agent_credential_links",
    "aygent_agent_credentials",
    "aygent_agent_learnings",
    "aygent_agent_memory",
    "aygent_agent_messages",
    "aygent_auto_reply_queue",
    "aygent_auto_reply_rules",
    "aygent_baileys_sessions",
    "aygent_broker_cards",
    "aygent_call_config",
    "aygent_call_logs",
    "aygent_campaigns",
    "aygent_commissions",
    "aygent_company_credentials",
    "aygent_compliance_checks",
    "aygent_deals",
    "aygent_dld_transactions",
    "aygent_documents",
    "aygent_expenses",
    "aygent_guardrails",
    "aygent_invoices",
    "aygent_landlords",
    "aygent_leads",
    "aygent_listing_watches",
    "aygent_maintenance_requests",
    "aygent_news",
    "aygent_portals",
    "aygent_projects",
    "aygent_properties",
    "aygent_property_leads",
    "aygent_rent_cheques",
    "aygent_tags",
    "aygent_tenancies",
    "aygent_viewings",
    "aygent_whatsapp_messages",
    "aygent_whatsapp_templates",
    "aygent_whatsapp_windows",
    "budget_incidents",
    "budget_policies",
    "company_logos",
    "company_memberships",
    "company_secret_versions",
    "company_secrets",
    "company_skills",
    "cost_events",
    "document_revisions",
    "documents",
    "execution_workspaces",
    "finance_events",
    "goals",
    "heartbeat_run_events",
    "heartbeat_runs",
    "invites",
    "issue_approvals",
    "issue_attachments",
    "issue_comments",
    "issue_documents",
    "issue_inbox_archives",
    "issue_labels",
    "issue_read_states",
    "issue_work_products",
    "issues",
    "join_requests",
    "knowledge_base_files",
    "labels",
    "plugin_company_settings",
    "plugin_entities",
    "plugin_jobs",
    "plugin_logs",
    "plugin_state",
    "principal_permission_grants",
    "project_goals",
    "project_workspaces",
    "projects",
    "routines",
    "workspace_operations",
    "workspace_runtime_services",
    "agents",
  ];
  // TRUNCATE everything dependent on companies + companies itself in one shot (CASCADE handles deep deps)
  const allTablesRes = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('user', 'account', 'session', 'verification', 'instance_settings', 'instance_user_roles', 'cli_auth_challenges', 'board_api_keys', '__drizzle_migrations')
  `;
  const tables = allTablesRes.map((r) => r.tablename);
  const quoted = tables.map((t) => `"${t}"`).join(", ");
  if (tables.length > 0) {
    await sql.unsafe(`TRUNCATE ${quoted} RESTART IDENTITY CASCADE`);
  }
  console.log(`✓ Truncated ${tables.length} tables (kept user/auth tables intact)\n`);

  const [demo] = await sql`
    INSERT INTO companies (name, description, status, issue_prefix, issue_counter, require_board_approval_for_new_agents)
    VALUES ('Demo Agency', 'Universal demo — Dubai off-plan real estate agency', 'active', 'DEMO', 0, true)
    RETURNING id, name, issue_prefix
  `;
  console.log(`✓ Created: ${demo.name} (prefix ${demo.issue_prefix}, id ${demo.id})\n`);

  await sql`
    INSERT INTO company_memberships (company_id, principal_type, principal_id, membership_role, status)
    VALUES (${demo.id}, 'user', ${user.id}, 'owner', 'active')
  `;
  console.log(`✓ Granted membership to ${user.email ?? user.id}\n`);

  console.log("Creating 7 canonical agents:");
  for (const a of AGENTS) {
    const metadata = a.auto !== null ? { autoApprove: a.auto } : {};
    await sql`
      INSERT INTO agents (company_id, name, role, title, status, adapter_type, adapter_config, runtime_config, budget_monthly_cents, spent_monthly_cents, permissions, metadata)
      VALUES (
        ${demo.id},
        ${a.name},
        ${a.role},
        ${a.title},
        'idle',
        'claude_local',
        ${sql.json({ model: "claude-sonnet-4-20250514" })},
        ${sql.json({ heartbeatIntervalSeconds: a.heartbeat })},
        0, 0,
        ${sql.json({})},
        ${sql.json(metadata)}
      )
    `;
    console.log(`  ✓ ${a.name.padEnd(8)} ${a.title}`);
  }

  console.log("\nSeeding 4 WhatsApp templates:");
  for (const t of TEMPLATES) {
    await sql`
      INSERT INTO aygent_whatsapp_templates (company_id, name, category, content, is_default)
      VALUES (${demo.id}, ${t.name}, ${t.category}, ${t.content}, ${t.isDefault})
    `;
    console.log(`  ✓ ${t.name}${t.isDefault ? " (default)" : ""}`);
  }

  const [counts] = await sql`
    SELECT
      (SELECT count(*) FROM agents WHERE company_id = ${demo.id})::int AS agents,
      (SELECT count(*) FROM aygent_whatsapp_templates WHERE company_id = ${demo.id})::int AS templates,
      (SELECT count(*) FROM aygent_leads)::int AS leads,
      (SELECT count(*) FROM issues)::int AS issues,
      (SELECT count(*) FROM approvals)::int AS approvals
  `;

  console.log("\n=== FINAL STATE ===");
  console.log(`  Demo Agency  prefix=DEMO  agents=${counts.agents}  templates=${counts.templates}  leads=${counts.leads}  issues=${counts.issues}  approvals=${counts.approvals}`);

  const [salesAgent] = await sql`SELECT id FROM agents WHERE company_id = ${demo.id} AND role = 'sales' LIMIT 1`;
  console.log(`\n=== NEXT STEPS ===`);
  console.log(`1. Log in: http://localhost:3001  (user: ${user.email ?? "existing account"})`);
  console.log(`2. Connect WhatsApp on Sarah (Sales):`);
  console.log(`   http://localhost:3001/DEMO/agents/${salesAgent.id}\n`);

  await sql.end();
}

main().catch(async (err) => {
  console.error("FAILED:", err);
  await sql.end();
  process.exit(1);
});
