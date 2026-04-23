/**
 * Shared stub factory for vi.mock("../services/index.js").
 *
 * Every service exported from services/index.ts is listed here so that
 * adding a new service never silently breaks unrelated test files.
 *
 * Usage in test files:
 *   import { baseServiceMocks } from "./helpers/mock-services.js";
 *
 *   vi.mock("../services/index.js", () => ({
 *     ...baseServiceMocks(),
 *     issueService: () => myDetailedMock,   // override what you need
 *   }));
 */

import { vi } from "vitest";

export function baseServiceMocks() {
  return {
    // ── Factory services (each takes db, returns service object) ──
    accessService: () => ({}),
    activityService: () => ({}),
    agentHealthService: () => ({}),
    agentInstructionsService: () => ({}),
    agentLearningService: () => ({}),
    agentMessageService: () => ({}),
    agentService: () => ({}),
    approvalService: () => ({}),
    assetService: () => ({}),
    billingService: () => ({
      isActive: vi.fn(async () => true),
      getSubscription: vi.fn(async () => ({ tierId: "enterprise", tierName: "Enterprise", status: "active" })),
      getTiers: vi.fn(() => []),
      reportUsage: vi.fn(async () => undefined),
    }),
    boardAuthService: () => ({}),
    budgetService: () => ({}),
    ceoCommandService: () => ({}),
    companyPortabilityService: () => ({}),
    companyService: () => ({}),
    companySkillService: () => ({}),
    costService: () => ({}),
    crossAgencyLearningService: () => ({}),
    dashboardService: () => ({}),
    documentService: () => ({}),
    executionWorkspaceService: () => ({}),
    facebookAdsService: () => ({}),
    financeService: () => ({}),
    goalService: () => ({}),
    heartbeatService: () => ({}),
    instanceSettingsService: () => ({}),
    issueApprovalService: () => ({}),
    issueService: () => ({}),
    kbAutoLearningService: () => ({}),
    knowledgeBaseService: () => ({}),
    leadService: () => ({}),
    predictiveActionsService: () => ({}),
    projectService: () => ({}),
    propertyService: () => ({}),
    pushNotificationService: () => ({}),
    routineService: () => ({}),
    secretService: () => ({}),
    selfOptimizingTeamsService: () => ({}),
    semanticMatchingService: () => ({}),
    sidebarBadgeService: () => ({}),
    workProductService: () => ({}),
    workspaceOperationService: () => ({}),

    // ── Plain value exports ──
    BILLING_TIERS: [],

    // ── Plain function exports ──
    classifyTask: vi.fn(),
    createStorageServiceFromConfig: vi.fn(),
    deduplicateAgentName: vi.fn(),
    extractCommands: vi.fn(),
    extractLegacyPlanBody: vi.fn(),
    getStorageService: vi.fn(),
    logActivity: vi.fn(),
    minutesToCron: vi.fn(),
    notifyHireApproved: vi.fn(),
    preprocessAgentContext: vi.fn(),
    publishLiveEvent: vi.fn(),
    reconcilePersistedRuntimeServicesOnStartup: vi.fn(),
    routedGenerate: vi.fn(),
    subscribeCompanyLiveEvents: vi.fn(),
    syncInstructionsBundleConfigFromFilePath: vi.fn(),
  };
}
