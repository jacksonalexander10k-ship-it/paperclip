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

// Communication tools
import {
  searchWhatsappDefinition,
  searchWhatsappExecutor,
  sendWhatsappDefinition,
  sendWhatsappExecutor,
  searchEmailDefinition,
  searchEmailExecutor,
  sendEmailDefinition,
  sendEmailExecutor,
  searchInstagramDmsDefinition,
  searchInstagramDmsExecutor,
  sendInstagramDmDefinition,
  sendInstagramDmExecutor,
  postToInstagramDefinition,
  postToInstagramExecutor,
  listWhatsappTemplatesDefinition,
  listWhatsappTemplatesExecutor,
  useWhatsappTemplateDefinition,
  useWhatsappTemplateExecutor,
  makeCallDefinition,
  makeCallExecutor,
} from "./communication.js";

// Calendar tools
import {
  getCalendarDefinition,
  getCalendarExecutor,
  createEventDefinition,
  createEventExecutor,
  checkAvailabilityDefinition,
  checkAvailabilityExecutor,
  scheduleViewingDefinition,
  scheduleViewingExecutor,
  getViewingsDefinition,
  getViewingsExecutor,
} from "./calendar.js";

// Content tools
import {
  generatePitchDeckDefinition,
  generatePitchDeckExecutor,
  generatePitchPresentationDefinition,
  generatePitchPresentationExecutor,
  generateLandingPageDefinition,
  generateLandingPageExecutor,
  generateSocialContentDefinition,
  generateSocialContentExecutor,
  generateContentDefinition,
  generateContentExecutor,
  generateMarketReportDefinition,
  generateMarketReportExecutor,
  launchCampaignDefinition,
  launchCampaignExecutor,
  createDripCampaignDefinition,
  createDripCampaignExecutor,
  enrollLeadInCampaignDefinition,
  enrollLeadInCampaignExecutor,
} from "./content.js";

// Market tools
import {
  searchDldTransactionsDefinition,
  searchDldTransactionsExecutor,
  scrapeDxbTransactionsDefinition,
  scrapeDxbTransactionsExecutor,
  getBuildingAnalysisDefinition,
  getBuildingAnalysisExecutor,
  searchListingsDefinition,
  searchListingsExecutor,
  watchListingsDefinition,
  watchListingsExecutor,
  analyzeInvestmentDefinition,
  analyzeInvestmentExecutor,
  webSearchDefinition,
  webSearchExecutor,
} from "./market.js";

// Portfolio tools
import {
  manageLandlordDefinition,
  manageLandlordExecutor,
  managePropertyDefinition,
  managePropertyExecutor,
  manageTenancyDefinition,
  manageTenancyExecutor,
  calculateReraRentDefinition,
  calculateReraRentExecutor,
  calculateDldFeesDefinition,
  calculateDldFeesExecutor,
} from "./portfolio.js";

// Portal tools
import {
  createPortalDefinition,
  createPortalExecutor,
  getPortalActivityDefinition,
  getPortalActivityExecutor,
} from "./portals.js";

// Document tools
import {
  listDocumentsDefinition,
  listDocumentsExecutor,
  extractDocumentDataDefinition,
  extractDocumentDataExecutor,
  scrapeUrlDefinition,
  scrapeUrlExecutor,
} from "./documents.js";

// Admin tools
import {
  createTaskDefinition,
  createTaskExecutor,
  rememberDefinition,
  rememberExecutor,
  setGuardrailsDefinition,
  setGuardrailsExecutor,
  getNewsDefinition,
  getNewsExecutor,
  getCampaignStatsDefinition,
  getCampaignStatsExecutor,
} from "./admin.js";

// Deal tools
import {
  trackDealDefinition, trackDealExecutor,
  updateDealStageDefinition, updateDealStageExecutor,
  getDealPipelineDefinition, getDealPipelineExecutor,
  generateDocumentChecklistDefinition, generateDocumentChecklistExecutor,
  calculateTransferCostsDefinition, calculateTransferCostsExecutor,
} from "./deals.js";

// Finance tools
import {
  trackCommissionDefinition, trackCommissionExecutor,
  calculateCommissionSplitDefinition, calculateCommissionSplitExecutor,
  generateInvoiceDefinition, generateInvoiceExecutor,
  trackPaymentDefinition, trackPaymentExecutor,
  getAccountsReceivableDefinition, getAccountsReceivableExecutor,
  calculateVatDefinition, calculateVatExecutor,
  trackExpenseDefinition, trackExpenseExecutor,
  getAgencyPnlDefinition, getAgencyPnlExecutor,
} from "./finance.js";

// Compliance tools
import {
  runKycCheckDefinition,
  runKycCheckExecutor,
  screenPepSanctionsDefinition,
  screenPepSanctionsExecutor,
  trackBrokerCardDefinition,
  trackBrokerCardExecutor,
  generateCddReportDefinition,
  generateCddReportExecutor,
  checkTrakheesiValidityDefinition,
  checkTrakheesiValidityExecutor,
  trackAmlTrainingDefinition,
  trackAmlTrainingExecutor,
} from "./compliance.js";

export type { ToolDefinition, ToolExecutor, ToolContext };

const allDefinitions: ToolDefinition[] = [
  // Projects (2)
  searchProjectsDefinition,
  getProjectDetailsDefinition,
  // Leads (14)
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
  // Communication (10)
  searchWhatsappDefinition,
  sendWhatsappDefinition,
  searchEmailDefinition,
  sendEmailDefinition,
  searchInstagramDmsDefinition,
  sendInstagramDmDefinition,
  postToInstagramDefinition,
  listWhatsappTemplatesDefinition,
  useWhatsappTemplateDefinition,
  makeCallDefinition,
  // Calendar (5)
  getCalendarDefinition,
  createEventDefinition,
  checkAvailabilityDefinition,
  scheduleViewingDefinition,
  getViewingsDefinition,
  // Content (9)
  generatePitchDeckDefinition,
  generatePitchPresentationDefinition,
  generateLandingPageDefinition,
  generateSocialContentDefinition,
  generateContentDefinition,
  generateMarketReportDefinition,
  launchCampaignDefinition,
  createDripCampaignDefinition,
  enrollLeadInCampaignDefinition,
  // Market (7)
  searchDldTransactionsDefinition,
  scrapeDxbTransactionsDefinition,
  getBuildingAnalysisDefinition,
  searchListingsDefinition,
  watchListingsDefinition,
  analyzeInvestmentDefinition,
  webSearchDefinition,
  // Portfolio (5)
  manageLandlordDefinition,
  managePropertyDefinition,
  manageTenancyDefinition,
  calculateReraRentDefinition,
  calculateDldFeesDefinition,
  // Portals (2)
  createPortalDefinition,
  getPortalActivityDefinition,
  // Documents (3)
  listDocumentsDefinition,
  extractDocumentDataDefinition,
  scrapeUrlDefinition,
  // Admin (5)
  createTaskDefinition,
  rememberDefinition,
  setGuardrailsDefinition,
  getNewsDefinition,
  getCampaignStatsDefinition,
  // Deals (5)
  trackDealDefinition,
  updateDealStageDefinition,
  getDealPipelineDefinition,
  generateDocumentChecklistDefinition,
  calculateTransferCostsDefinition,
  // Finance (8)
  trackCommissionDefinition,
  calculateCommissionSplitDefinition,
  generateInvoiceDefinition,
  trackPaymentDefinition,
  getAccountsReceivableDefinition,
  calculateVatDefinition,
  trackExpenseDefinition,
  getAgencyPnlDefinition,
  // Compliance (6)
  runKycCheckDefinition,
  screenPepSanctionsDefinition,
  trackBrokerCardDefinition,
  generateCddReportDefinition,
  checkTrakheesiValidityDefinition,
  trackAmlTrainingDefinition,
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
  // Communication
  search_whatsapp: searchWhatsappExecutor,
  send_whatsapp: sendWhatsappExecutor,
  search_email: searchEmailExecutor,
  send_email: sendEmailExecutor,
  search_instagram_dms: searchInstagramDmsExecutor,
  send_instagram_dm: sendInstagramDmExecutor,
  post_to_instagram: postToInstagramExecutor,
  list_whatsapp_templates: listWhatsappTemplatesExecutor,
  use_whatsapp_template: useWhatsappTemplateExecutor,
  make_call: makeCallExecutor,
  // Calendar
  get_calendar: getCalendarExecutor,
  create_event: createEventExecutor,
  check_availability: checkAvailabilityExecutor,
  schedule_viewing: scheduleViewingExecutor,
  get_viewings: getViewingsExecutor,
  // Content
  generate_pitch_deck: generatePitchDeckExecutor,
  generate_pitch_presentation: generatePitchPresentationExecutor,
  generate_landing_page: generateLandingPageExecutor,
  generate_social_content: generateSocialContentExecutor,
  generate_content: generateContentExecutor,
  generate_market_report: generateMarketReportExecutor,
  launch_campaign: launchCampaignExecutor,
  create_drip_campaign: createDripCampaignExecutor,
  enroll_lead_in_campaign: enrollLeadInCampaignExecutor,
  // Market
  search_dld_transactions: searchDldTransactionsExecutor,
  scrape_dxb_transactions: scrapeDxbTransactionsExecutor,
  get_building_analysis: getBuildingAnalysisExecutor,
  search_listings: searchListingsExecutor,
  watch_listings: watchListingsExecutor,
  analyze_investment: analyzeInvestmentExecutor,
  web_search: webSearchExecutor,
  // Portfolio
  manage_landlord: manageLandlordExecutor,
  manage_property: managePropertyExecutor,
  manage_tenancy: manageTenancyExecutor,
  calculate_rera_rent: calculateReraRentExecutor,
  calculate_dld_fees: calculateDldFeesExecutor,
  // Portals
  create_portal: createPortalExecutor,
  get_portal_activity: getPortalActivityExecutor,
  // Documents
  list_documents: listDocumentsExecutor,
  extract_document_data: extractDocumentDataExecutor,
  scrape_url: scrapeUrlExecutor,
  // Admin
  create_task: createTaskExecutor,
  remember: rememberExecutor,
  set_guardrails: setGuardrailsExecutor,
  get_news: getNewsExecutor,
  get_campaign_stats: getCampaignStatsExecutor,
  // Deals
  track_deal: trackDealExecutor,
  update_deal_stage: updateDealStageExecutor,
  get_deal_pipeline: getDealPipelineExecutor,
  generate_document_checklist: generateDocumentChecklistExecutor,
  calculate_transfer_costs: calculateTransferCostsExecutor,
  // Finance
  track_commission: trackCommissionExecutor,
  calculate_commission_split: calculateCommissionSplitExecutor,
  generate_invoice: generateInvoiceExecutor,
  track_payment: trackPaymentExecutor,
  get_accounts_receivable: getAccountsReceivableExecutor,
  calculate_vat: calculateVatExecutor,
  track_expense: trackExpenseExecutor,
  get_agency_pnl: getAgencyPnlExecutor,
  // Compliance
  run_kyc_check: runKycCheckExecutor,
  screen_pep_sanctions: screenPepSanctionsExecutor,
  track_broker_card: trackBrokerCardExecutor,
  generate_cdd_report: generateCddReportExecutor,
  check_trakheesi_validity: checkTrakheesiValidityExecutor,
  track_aml_training: trackAmlTrainingExecutor,
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
