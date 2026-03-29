import type { ToolDefinition, ToolExecutor, ToolContext } from "./types.js";

// Project tools
import {
  searchProjectsDefinition,
  searchProjectsExecutor,
  getProjectDetailsDefinition,
  getProjectDetailsExecutor,
} from "./projects.js";

// Lead tools
import {
  searchLeadsDefinition,
  searchLeadsExecutor,
  updateLeadDefinition,
  updateLeadExecutor,
  getLeadActivityDefinition,
  getLeadActivityExecutor,
  createTagDefinition,
  createTagExecutor,
  tagLeadDefinition,
  tagLeadExecutor,
  untagLeadDefinition,
  untagLeadExecutor,
  listTagsDefinition,
  listTagsExecutor,
  getFollowUpsDefinition,
  getFollowUpsExecutor,
  bulkFollowUpDefinition,
  bulkFollowUpExecutor,
  bulkLeadActionDefinition,
  bulkLeadActionExecutor,
  matchDealToLeadsDefinition,
  matchDealToLeadsExecutor,
  reactivateStaleLeadsDefinition,
  reactivateStaleLeadsExecutor,
  deduplicateLeadsDefinition,
  deduplicateLeadsExecutor,
  mergeLeadsDefinition,
  mergeLeadsExecutor,
} from "./leads.js";

export type { ToolDefinition, ToolExecutor, ToolContext };

const allDefinitions: ToolDefinition[] = [
  // Projects
  searchProjectsDefinition,
  getProjectDetailsDefinition,
  // Leads
  searchLeadsDefinition,
  updateLeadDefinition,
  getLeadActivityDefinition,
  createTagDefinition,
  tagLeadDefinition,
  untagLeadDefinition,
  listTagsDefinition,
  getFollowUpsDefinition,
  bulkFollowUpDefinition,
  bulkLeadActionDefinition,
  matchDealToLeadsDefinition,
  reactivateStaleLeadsDefinition,
  deduplicateLeadsDefinition,
  mergeLeadsDefinition,
];

const allExecutors: Record<string, ToolExecutor> = {
  // Projects
  search_projects: searchProjectsExecutor,
  get_project_details: getProjectDetailsExecutor,
  // Leads
  search_leads: searchLeadsExecutor,
  update_lead: updateLeadExecutor,
  get_lead_activity: getLeadActivityExecutor,
  create_tag: createTagExecutor,
  tag_lead: tagLeadExecutor,
  untag_lead: untagLeadExecutor,
  list_tags: listTagsExecutor,
  get_follow_ups: getFollowUpsExecutor,
  bulk_follow_up: bulkFollowUpExecutor,
  bulk_lead_action: bulkLeadActionExecutor,
  match_deal_to_leads: matchDealToLeadsExecutor,
  reactivate_stale_leads: reactivateStaleLeadsExecutor,
  deduplicate_leads: deduplicateLeadsExecutor,
  merge_leads: mergeLeadsExecutor,
};

export function createToolRegistry() {
  return {
    definitions: allDefinitions,
    executors: allExecutors,

    execute: async (
      name: string,
      input: Record<string, unknown>,
      ctx: ToolContext,
    ) => {
      const executor = allExecutors[name];
      if (!executor) throw new Error(`Unknown tool: ${name}`);
      return executor(input, ctx);
    },

    getDefinitions: (names?: string[]) => {
      if (!names) return allDefinitions;
      return allDefinitions.filter((d) => names.includes(d.name));
    },
  };
}
