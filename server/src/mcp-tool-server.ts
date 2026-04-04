/**
 * MCP Tool Server — Exposes Aygency World's 62 tools via Model Context Protocol
 *
 * Claude Code agents connect to this server and get access to role-scoped tools.
 * The server loads per-agent credentials and injects them into tool execution context.
 *
 * Run standalone: tsx server/src/mcp-tool-server.ts
 * Or import and start from the main server.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createToolRegistry } from "@aygent/tools";
import { createDb } from "@paperclipai/db/client";
import { sessionSearchService } from "./services/session-search.js";

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
    "track_deal", "update_deal_stage", "get_deal_pipeline",
    "generate_document_checklist", "calculate_transfer_costs",
    "create_task", "remember", "search_past_conversations",
  ],
  content: [
    "generate_social_content", "generate_content", "post_to_instagram",
    "generate_pitch_deck", "generate_pitch_presentation", "generate_landing_page",
    "generate_market_report", "launch_campaign", "create_drip_campaign",
    "enroll_lead_in_campaign", "get_campaign_stats",
    "send_whatsapp", "send_email", "send_instagram_dm",
    "search_projects", "get_project_details",
    "create_task", "remember", "web_search", "search_past_conversations",
  ],
  marketing: [
    "search_dld_transactions", "scrape_dxb_transactions", "get_building_analysis",
    "search_listings", "watch_listings", "analyze_investment",
    "web_search", "get_news",
    "search_projects", "get_project_details",
    "generate_market_report",
    "create_task", "remember", "search_past_conversations",
  ],
  finance: [
    "manage_landlord", "manage_property", "manage_tenancy",
    "calculate_rera_rent", "calculate_dld_fees",
    "create_portal", "get_portal_activity",
    "list_documents", "extract_document_data",
    "send_email", "send_whatsapp",
    "track_commission", "calculate_commission_split", "generate_invoice",
    "track_payment", "get_accounts_receivable", "calculate_vat",
    "track_expense", "get_agency_pnl",
    "track_deal", "get_deal_pipeline",
    "create_task", "remember", "search_past_conversations",
  ],
  viewing: [
    "get_calendar", "create_event", "check_availability",
    "schedule_viewing", "get_viewings",
    "send_whatsapp", "send_email",
    "search_leads", "update_lead",
    "create_task", "remember", "search_past_conversations",
  ],
  portfolio: [
    "manage_landlord", "manage_property", "manage_tenancy",
    "calculate_rera_rent", "calculate_dld_fees",
    "create_portal", "get_portal_activity",
    "list_documents", "send_email", "send_whatsapp",
    "create_task", "remember", "search_past_conversations",
  ],
  conveyancing: [
    "track_deal", "update_deal_stage", "get_deal_pipeline",
    "generate_document_checklist", "calculate_transfer_costs",
    "run_kyc_check", "screen_pep_sanctions", "generate_cdd_report",
    "search_leads", "update_lead", "get_lead_activity",
    "send_whatsapp", "send_email",
    "list_documents", "extract_document_data",
    "create_task", "remember", "search_past_conversations",
  ],
  compliance: [
    "run_kyc_check", "screen_pep_sanctions", "generate_cdd_report",
    "track_broker_card", "check_trakheesi_validity", "track_aml_training",
    "search_leads", "get_lead_activity",
    "create_task", "remember", "search_past_conversations",
  ],
  calling: [
    "make_call", "send_whatsapp", "send_email",
    "search_leads", "update_lead", "get_lead_activity",
    "search_whatsapp", "list_whatsapp_templates", "use_whatsapp_template",
    "create_task", "remember", "search_past_conversations",
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
  issueId?: string;
}) {
  const db = createDb(opts.databaseUrl);
  const registry = createToolRegistry();
  const sessionSearch = sessionSearchService(db);

  const allowedTools = getToolsForRole(opts.agentRole);
  const definitions = allowedTools
    ? registry.getDefinitions(allowedTools)
    : registry.definitions;

  // Build the full tool list (registry tools + platform tools)
  const searchPastConversationsDef = {
    name: "search_past_conversations",
    description: "Search across all past WhatsApp conversations, agent activity logs, and CEO Chat history. Use this to recall prior interactions with a lead, find what was discussed weeks ago, or look up past decisions.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search text — lead name, phone number, topic, project name, or any keyword" },
        lead_name_or_phone: { type: "string", description: "Optional: search specifically for a lead by name or phone." },
        days_back: { type: "number", description: "How many days back to search (default: 90, max: 365)" },
      },
      required: ["query"],
    },
  };

  const allToolDefs = [...definitions, searchPastConversationsDef];

  // Use the low-level Server API to register tools with raw JSON schemas
  // (McpServer.tool() requires Zod schemas which we don't have)
  const server = new Server(
    { name: "aygent-tools", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allToolDefs.map((def) => ({
      name: def.name,
      description: def.description,
      inputSchema: def.input_schema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args ?? {}) as Record<string, unknown>;

    // Handle platform tool
    if (name === "search_past_conversations") {
      try {
        const query = String(toolArgs.query ?? toolArgs.lead_name_or_phone ?? "");
        if (!query) {
          return { content: [{ type: "text" as const, text: "Error: query is required" }], isError: true };
        }
        if (toolArgs.lead_name_or_phone) {
          const result = await sessionSearch.searchLeadHistory(
            opts.companyId,
            String(toolArgs.lead_name_or_phone),
            { agentId: opts.agentId, daysBack: Number(toolArgs.days_back) || 90 },
          );
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        }
        const results = await sessionSearch.search(opts.companyId, query, {
          agentId: opts.agentId,
          daysBack: Number(toolArgs.days_back) || 90,
        });
        return { content: [{ type: "text" as const, text: JSON.stringify({ count: results.length, results }, null, 2) }] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
      }
    }

    // Handle registry tools
    try {
      const result = await registry.execute(name, toolArgs, {
        companyId: opts.companyId,
        agentId: opts.agentId,
        db,
        issueId: opts.issueId,
      });
      return {
        content: [{
          type: "text" as const,
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
        }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
    }
  });

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
  const issueId = process.env.PAPERCLIP_ISSUE_ID || undefined;

  const server = await createMcpToolServer({ databaseUrl, companyId, agentId, agentRole, issueId });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
