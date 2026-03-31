/**
 * MCP Tool Server — Exposes Aygency World's 62 tools via Model Context Protocol
 *
 * Claude Code agents connect to this server and get access to role-scoped tools.
 * The server loads per-agent credentials and injects them into tool execution context.
 *
 * Run standalone: tsx server/src/mcp-tool-server.ts
 * Or import and start from the main server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createToolRegistry } from "@aygent/tools";
import { createDb } from "@paperclipai/db/client";

// ---------------------------------------------------------------------------
// Role → Tool Scoping
// ---------------------------------------------------------------------------

const ROLE_TOOLS: Record<string, string[]> = {
  ceo: [], // CEO gets ALL tools (empty = no filter)
  sales: [
    "search_leads", "update_lead", "get_lead_activity", "tag_lead", "untag_lead",
    "create_tag", "list_tags", "get_follow_ups", "bulk_follow_up", "reactivate_stale_leads",
    "match_deal_to_leads", "deduplicate_leads", "merge_leads",
    "search_whatsapp", "send_whatsapp", "search_email", "send_email",
    "list_whatsapp_templates", "use_whatsapp_template",
    "search_projects", "get_project_details", "search_listings",
    "search_dld_transactions", "web_search",
    "create_task", "remember",
  ],
  content: [
    "generate_social_content", "generate_content", "post_to_instagram",
    "generate_pitch_deck", "generate_pitch_presentation", "generate_landing_page",
    "generate_market_report", "launch_campaign", "create_drip_campaign",
    "enroll_lead_in_campaign", "get_campaign_stats",
    "send_whatsapp", "send_email", "send_instagram_dm",
    "search_projects", "get_project_details",
    "create_task", "remember", "web_search",
  ],
  marketing: [
    "search_dld_transactions", "scrape_dxb_transactions", "get_building_analysis",
    "search_listings", "watch_listings", "analyze_investment",
    "web_search", "get_news",
    "search_projects", "get_project_details",
    "generate_market_report",
    "create_task", "remember",
  ],
  finance: [
    "manage_landlord", "manage_property", "manage_tenancy",
    "calculate_rera_rent", "calculate_dld_fees",
    "create_portal", "get_portal_activity",
    "list_documents", "extract_document_data",
    "send_email", "send_whatsapp",
    "create_task", "remember",
  ],
  viewing: [
    "get_calendar", "create_event", "check_availability",
    "schedule_viewing", "get_viewings",
    "send_whatsapp", "send_email",
    "search_leads", "update_lead",
    "create_task", "remember",
  ],
  portfolio: [
    "manage_landlord", "manage_property", "manage_tenancy",
    "calculate_rera_rent", "calculate_dld_fees",
    "create_portal", "get_portal_activity",
    "list_documents", "send_email", "send_whatsapp",
    "create_task", "remember",
  ],
};

function getToolsForRole(role: string): string[] | null {
  const normalised = role.toLowerCase().replace(/-agent$/, "").replace(/^lead/, "sales");
  const tools = ROLE_TOOLS[normalised];
  if (!tools) return null; // unknown role → return all tools
  if (tools.length === 0) return null; // CEO → no filter
  return tools;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export async function createMcpToolServer(opts: {
  databaseUrl: string;
  companyId: string;
  agentId: string;
  agentRole: string;
}) {
  const db = createDb(opts.databaseUrl);
  const registry = createToolRegistry();

  const allowedTools = getToolsForRole(opts.agentRole);
  const definitions = allowedTools
    ? registry.getDefinitions(allowedTools)
    : registry.definitions;

  const server = new McpServer({
    name: "aygency-tools",
    version: "1.0.0",
  });

  // Register each tool
  for (const def of definitions) {
    server.tool(
      def.name,
      def.description,
      def.input_schema.properties as Record<string, unknown>,
      async (args: Record<string, unknown>) => {
        try {
          const result = await registry.execute(def.name, args, {
            companyId: opts.companyId,
            agentId: opts.agentId,
            db,
          });
          return {
            content: [
              {
                type: "text" as const,
                text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}

// ---------------------------------------------------------------------------
// Standalone entry point (for testing or spawning as a subprocess)
// ---------------------------------------------------------------------------

if (process.argv[1]?.endsWith("mcp-tool-server.ts") || process.argv[1]?.endsWith("mcp-tool-server.js")) {
  const databaseUrl = process.env.DATABASE_URL ?? "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";
  const companyId = process.env.PAPERCLIP_COMPANY_ID ?? "";
  const agentId = process.env.PAPERCLIP_AGENT_ID ?? "";
  const agentRole = process.env.PAPERCLIP_AGENT_ROLE ?? "general";

  const server = await createMcpToolServer({ databaseUrl, companyId, agentId, agentRole });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
