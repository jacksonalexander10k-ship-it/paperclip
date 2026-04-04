import { eq, and, desc } from "drizzle-orm";
import { aygentDeals } from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import { storeDeliverable } from "./lib/deliverables.js";

// ═══════════════════════════════════════════════════
// Shared helper
// ═══════════════════════════════════════════════════

type DealType = "sale" | "offplan" | "rental";

function generateChecklist(dealType: DealType, isMortgage = false): Record<string, boolean> {
  const base: string[] = [];

  if (dealType === "sale") {
    base.push(
      "passport_buyer",
      "emirates_id_buyer",
      "passport_seller",
      "title_deed",
      "form_f",
      "noc",
      "managers_cheques",
    );
    if (isMortgage) {
      base.push(
        "mortgage_pre_approval",
        "valuation_report",
        "final_offer_letter",
        "mortgage_insurance",
      );
    }
  } else if (dealType === "offplan") {
    base.push(
      "passport_buyer",
      "emirates_id_buyer",
      "spa",
      "oqood_registration",
      "payment_receipts",
      "escrow_confirmation",
    );
  } else if (dealType === "rental") {
    base.push(
      "passport_buyer",
      "emirates_id_buyer",
      "visa_copy",
      "employment_letter",
      "tenancy_contract",
      "ejari_registration",
      "security_deposit",
    );
  }

  return base.reduce<Record<string, boolean>>((acc, doc) => {
    acc[doc] = false;
    return acc;
  }, {});
}

// ═══════════════════════════════════════════════════
// track_deal
// ═══════════════════════════════════════════════════

export const trackDealDefinition: ToolDefinition = {
  name: "track_deal",
  description:
    "Track a property deal through the pipeline. Create new deals, update deal details, list active deals, or get a specific deal. Use when agent mentions a sale, off-plan purchase, or rental transaction that needs to be tracked.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "get", "list"], description: "Action to perform" },
      dealId: { type: "string", description: "Deal ID (for update/get)" },
      dealType: { type: "string", enum: ["sale", "offplan", "rental"], description: "Type of deal (required for create)" },
      stage: { type: "string", description: "Filter by stage (for list)" },
      propertyAddress: { type: "string", description: "Full property address (required for create)" },
      propertyType: { type: "string", description: "apartment, villa, townhouse, office, shop" },
      area: { type: "string", description: "Area/community name" },
      developer: { type: "string", description: "Developer name (for off-plan)" },
      projectName: { type: "string", description: "Project/tower name (for off-plan)" },
      price: { type: "number", description: "Deal price in AED (required for create)" },
      isMortgage: { type: "boolean", description: "Is the buyer using a mortgage? Affects document checklist." },
      leadId: { type: "string", description: "Associated lead ID" },
      buyerName: { type: "string", description: "Buyer's full name" },
      buyerPhone: { type: "string", description: "Buyer's phone number" },
      buyerEmail: { type: "string", description: "Buyer's email" },
      sellerName: { type: "string", description: "Seller's full name (for secondary sale)" },
      sellerPhone: { type: "string", description: "Seller's phone number" },
      mortgageBank: { type: "string", description: "Mortgage bank name" },
      mortgageStatus: { type: "string", description: "Mortgage status (e.g. pre_approval, approved, rejected)" },
      expectedCloseDate: { type: "string", description: "Expected closing date (YYYY-MM-DD)" },
      notes: { type: "string", description: "Notes about the deal" },
      documentsChecklist: { type: "object", description: "Document checklist overrides — key: document name, value: true/false" },
    },
    required: ["action"],
  },
};

export const trackDealExecutor: ToolExecutor = async (input, ctx) => {
  const {
    action, dealId, dealType, stage, propertyAddress, propertyType,
    area, developer, projectName, price, isMortgage, leadId,
    buyerName, buyerPhone, buyerEmail, sellerName, sellerPhone,
    mortgageBank, mortgageStatus, expectedCloseDate, notes, documentsChecklist,
  } = input as {
    action: string;
    dealId?: string;
    dealType?: DealType;
    stage?: string;
    propertyAddress?: string;
    propertyType?: string;
    area?: string;
    developer?: string;
    projectName?: string;
    price?: number;
    isMortgage?: boolean;
    leadId?: string;
    buyerName?: string;
    buyerPhone?: string;
    buyerEmail?: string;
    sellerName?: string;
    sellerPhone?: string;
    mortgageBank?: string;
    mortgageStatus?: string;
    expectedCloseDate?: string;
    notes?: string;
    documentsChecklist?: Record<string, boolean>;
  };

  const t = aygentDeals;

  if (action === "list") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (stage) conditions.push(eq(t.stage, stage));
    if (dealType) conditions.push(eq(t.dealType, dealType));

    const deals = await ctx.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(desc(t.updatedAt))
      .limit(50);

    return {
      deals: deals.map((d) => ({
        id: d.id,
        dealType: d.dealType,
        stage: d.stage,
        propertyAddress: d.propertyAddress,
        area: d.area,
        price: d.price,
        buyerName: d.buyerName,
        sellerName: d.sellerName,
        expectedCloseDate: d.expectedCloseDate?.toISOString().split("T")[0] ?? null,
        updatedAt: d.updatedAt.toISOString(),
      })),
      total: deals.length,
    };
  }

  if (action === "get") {
    if (!dealId) return { error: "dealId is required for get." };
    const results = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.id, dealId), eq(t.companyId, ctx.companyId)))
      .limit(1);
    if (results.length === 0) return { error: "Deal not found." };
    return results[0];
  }

  if (action === "create") {
    if (!dealType) return { error: "dealType is required to create a deal." };
    if (!propertyAddress) return { error: "propertyAddress is required to create a deal." };
    if (price === undefined || price === null) return { error: "price is required to create a deal." };

    const checklist = documentsChecklist ?? generateChecklist(dealType, isMortgage ?? false);

    const created = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        agentId: ctx.agentId,
        leadId: leadId ?? null,
        dealType,
        stage: "offer",
        propertyAddress,
        propertyType: propertyType ?? null,
        area: area ?? null,
        developer: developer ?? null,
        projectName: projectName ?? null,
        price,
        buyerName: buyerName ?? null,
        buyerPhone: buyerPhone ?? null,
        buyerEmail: buyerEmail ?? null,
        sellerName: sellerName ?? null,
        sellerPhone: sellerPhone ?? null,
        mortgageBank: mortgageBank ?? null,
        mortgageStatus: mortgageStatus ?? null,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        notes: notes ?? null,
        documentsChecklist: checklist,
      })
      .returning();

    return {
      deal: created[0],
      message: `Deal created for ${propertyAddress} (${dealType}, AED ${price.toLocaleString()}). Stage: offer. ${Object.keys(checklist).length} documents in checklist.`,
    };
  }

  if (action === "update") {
    if (!dealId) return { error: "dealId is required for update." };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (propertyAddress) updates.propertyAddress = propertyAddress;
    if (propertyType) updates.propertyType = propertyType;
    if (area) updates.area = area;
    if (developer) updates.developer = developer;
    if (projectName) updates.projectName = projectName;
    if (price !== undefined) updates.price = price;
    if (buyerName) updates.buyerName = buyerName;
    if (buyerPhone) updates.buyerPhone = buyerPhone;
    if (buyerEmail) updates.buyerEmail = buyerEmail;
    if (sellerName) updates.sellerName = sellerName;
    if (sellerPhone) updates.sellerPhone = sellerPhone;
    if (mortgageBank) updates.mortgageBank = mortgageBank;
    if (mortgageStatus) updates.mortgageStatus = mortgageStatus;
    if (expectedCloseDate) updates.expectedCloseDate = new Date(expectedCloseDate);
    if (notes) updates.notes = notes;
    if (documentsChecklist) updates.documentsChecklist = documentsChecklist;

    const updated = await ctx.db
      .update(t)
      .set(updates)
      .where(and(eq(t.id, dealId), eq(t.companyId, ctx.companyId)))
      .returning();

    if (updated.length === 0) return { error: "Deal not found." };
    return { deal: updated[0], message: "Deal updated." };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// update_deal_stage
// ═══════════════════════════════════════════════════

const VALID_TRANSITIONS: Record<string, string[]> = {
  offer: ["form_f", "fell_through"],
  form_f: ["noc_applied", "fell_through"],
  noc_applied: ["noc_received", "fell_through"],
  noc_received: ["mortgage_processing", "transfer_booked", "fell_through"],
  mortgage_processing: ["mortgage_approved", "fell_through"],
  mortgage_approved: ["transfer_booked", "fell_through"],
  transfer_booked: ["transfer_complete", "fell_through"],
  transfer_complete: ["completed"],
};

export const updateDealStageDefinition: ToolDefinition = {
  name: "update_deal_stage",
  description:
    "Transition a deal to a new pipeline stage. Validates that the transition is allowed based on the current stage. Use when the status of a deal progresses (e.g. form F signed, NOC applied, transfer booked).",
  input_schema: {
    type: "object",
    properties: {
      dealId: { type: "string", description: "Deal ID to update" },
      newStage: {
        type: "string",
        enum: ["form_f", "noc_applied", "noc_received", "mortgage_processing", "mortgage_approved", "transfer_booked", "transfer_complete", "completed", "fell_through"],
        description: "The new stage to transition to",
      },
      formFDate: { type: "string", description: "Date Form F was signed (YYYY-MM-DD)" },
      nocAppliedDate: { type: "string", description: "Date NOC was applied for (YYYY-MM-DD)" },
      nocReceivedDate: { type: "string", description: "Date NOC was received (YYYY-MM-DD)" },
      nocExpiryDate: { type: "string", description: "NOC expiry date (YYYY-MM-DD)" },
      transferDate: { type: "string", description: "Transfer date at DLD (YYYY-MM-DD)" },
      fellThroughReason: { type: "string", description: "Reason the deal fell through (required if newStage is fell_through)" },
      notes: { type: "string", description: "Notes about this stage transition" },
    },
    required: ["dealId", "newStage"],
  },
};

export const updateDealStageExecutor: ToolExecutor = async (input, ctx) => {
  const {
    dealId, newStage, formFDate, nocAppliedDate, nocReceivedDate,
    nocExpiryDate, transferDate, fellThroughReason, notes,
  } = input as {
    dealId: string;
    newStage: string;
    formFDate?: string;
    nocAppliedDate?: string;
    nocReceivedDate?: string;
    nocExpiryDate?: string;
    transferDate?: string;
    fellThroughReason?: string;
    notes?: string;
  };

  const t = aygentDeals;

  // Fetch current deal
  const results = await ctx.db
    .select()
    .from(t)
    .where(and(eq(t.id, dealId), eq(t.companyId, ctx.companyId)))
    .limit(1);

  if (results.length === 0) return { error: "Deal not found." };
  const deal = results[0]!;

  // Validate transition
  const allowed = VALID_TRANSITIONS[deal.stage] ?? [];
  if (!allowed.includes(newStage)) {
    return {
      error: `Invalid stage transition: ${deal.stage} → ${newStage}. Allowed next stages: ${allowed.join(", ") || "none"}.`,
    };
  }

  // Validate fell_through requires reason
  if (newStage === "fell_through" && !fellThroughReason) {
    return { error: "fellThroughReason is required when transitioning to fell_through." };
  }

  // Build updates
  const updates: Record<string, unknown> = {
    stage: newStage,
    updatedAt: new Date(),
  };

  if (newStage === "fell_through" && fellThroughReason) {
    updates.fellThroughReason = fellThroughReason;
  }

  if (newStage === "completed") {
    updates.completionDate = new Date();
  }

  if (formFDate) updates.formFDate = new Date(formFDate);
  if (nocAppliedDate) updates.nocAppliedDate = new Date(nocAppliedDate);
  if (nocReceivedDate) updates.nocReceivedDate = new Date(nocReceivedDate);
  if (nocExpiryDate) updates.nocExpiryDate = new Date(nocExpiryDate);
  if (transferDate) updates.transferDate = new Date(transferDate);

  // Append notes with stage prefix
  if (notes) {
    const prefix = `[${newStage}] `;
    updates.notes = deal.notes ? `${deal.notes}\n${prefix}${notes}` : `${prefix}${notes}`;
  }

  const updated = await ctx.db
    .update(t)
    .set(updates)
    .where(and(eq(t.id, dealId), eq(t.companyId, ctx.companyId)))
    .returning();

  return {
    deal: updated[0],
    message: `Deal stage updated: ${deal.stage} → ${newStage}.${newStage === "completed" ? " Completion date recorded." : ""}`,
    previousStage: deal.stage,
    newStage,
  };
};

// ═══════════════════════════════════════════════════
// get_deal_pipeline
// ═══════════════════════════════════════════════════

export const getDealPipelineDefinition: ToolDefinition = {
  name: "get_deal_pipeline",
  description:
    "Get a grouped view of all active deals by pipeline stage. Shows deal counts, total value, and identifies the bottleneck stage. Use when agent needs an overview of the current deal pipeline or wants to report on deal activity.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const getDealPipelineExecutor: ToolExecutor = async (_input, ctx) => {
  const t = aygentDeals;

  const allDeals = await ctx.db
    .select()
    .from(t)
    .where(eq(t.companyId, ctx.companyId))
    .orderBy(desc(t.updatedAt));

  const activeStages = ["offer", "form_f", "noc_applied", "noc_received", "mortgage_processing", "mortgage_approved", "transfer_booked", "transfer_complete"];

  // Group by stage
  const pipeline: Record<string, Array<{
    id: string;
    propertyAddress: string;
    area: string | null;
    price: number;
    buyerName: string | null;
    dealType: string;
    updatedAt: string;
  }>> = {};

  for (const stage of activeStages) {
    pipeline[stage] = [];
  }

  let completedCount = 0;
  let fellThroughCount = 0;

  for (const deal of allDeals) {
    if (deal.stage === "completed") {
      completedCount++;
    } else if (deal.stage === "fell_through") {
      fellThroughCount++;
    } else if (activeStages.includes(deal.stage)) {
      pipeline[deal.stage]!.push({
        id: deal.id,
        propertyAddress: deal.propertyAddress,
        area: deal.area,
        price: deal.price,
        buyerName: deal.buyerName,
        dealType: deal.dealType,
        updatedAt: deal.updatedAt.toISOString(),
      });
    }
  }

  // Calculate summary
  const activeDeals = allDeals.filter((d) => activeStages.includes(d.stage));
  const totalActive = activeDeals.length;
  const totalValueAed = activeDeals.reduce((sum, d) => sum + d.price, 0);

  // Bottleneck = stage with the most deals
  let bottleneckStage = "offer";
  let bottleneckCount = 0;
  for (const stage of activeStages) {
    const count = pipeline[stage]!.length;
    if (count > bottleneckCount) {
      bottleneckCount = count;
      bottleneckStage = stage;
    }
  }

  return {
    pipeline,
    summary: {
      total_active: totalActive,
      total_value_aed: totalValueAed,
      bottleneck_stage: bottleneckCount > 0 ? bottleneckStage : null,
      completed: completedCount,
      fell_through: fellThroughCount,
    },
  };
};

// ═══════════════════════════════════════════════════
// generate_document_checklist
// ═══════════════════════════════════════════════════

export const generateDocumentChecklistDefinition: ToolDefinition = {
  name: "generate_document_checklist",
  description:
    "Generate the required document checklist for a deal type. Optionally saves it to an existing deal record. Use when an agent needs to know which documents are required for a sale, off-plan purchase, or rental deal.",
  input_schema: {
    type: "object",
    properties: {
      dealType: { type: "string", enum: ["sale", "offplan", "rental"], description: "Type of deal" },
      isMortgage: { type: "boolean", description: "Is the buyer using a mortgage? Adds mortgage-specific documents." },
      dealId: { type: "string", description: "If provided, saves the generated checklist to this deal record." },
    },
    required: ["dealType"],
  },
};

export const generateDocumentChecklistExecutor: ToolExecutor = async (input, ctx) => {
  const { dealType, isMortgage, dealId } = input as {
    dealType: DealType;
    isMortgage?: boolean;
    dealId?: string;
  };

  const checklist = generateChecklist(dealType, isMortgage ?? false);
  const documents = Object.keys(checklist);

  // Save to deal record if dealId provided
  if (dealId) {
    const t = aygentDeals;
    await ctx.db
      .update(t)
      .set({ documentsChecklist: checklist, updatedAt: new Date() })
      .where(and(eq(t.id, dealId), eq(t.companyId, ctx.companyId)));
  }

  return {
    dealType,
    isMortgage: isMortgage ?? false,
    checklist,
    documents,
    total: documents.length,
    savedToDeal: dealId ?? null,
    message: `${documents.length} documents required for a ${dealType} deal${isMortgage ? " with mortgage" : ""}.`,
  };
};

// ═══════════════════════════════════════════════════
// calculate_transfer_costs
// ═══════════════════════════════════════════════════

export const calculateTransferCostsDefinition: ToolDefinition = {
  name: "calculate_transfer_costs",
  description:
    "Calculate the full cost breakdown for a property transaction in Dubai: DLD fees, title deed, NOC, trustee, agent commission + VAT, and mortgage registration. Use when agent or owner wants to know the total cost of a deal or needs a buyer cost summary.",
  input_schema: {
    type: "object",
    properties: {
      price: { type: "number", description: "Property price in AED" },
      dealType: { type: "string", enum: ["sale", "offplan", "rental"], description: "Type of deal" },
      isMortgage: { type: "boolean", description: "Is the buyer using a mortgage?" },
      mortgageAmount: { type: "number", description: "Mortgage loan amount in AED (if using mortgage)" },
      commissionRate: { type: "number", description: "Agent commission rate as a percentage. Defaults: sale=2%, rental=5%, offplan=0%" },
      nocFee: { type: "number", description: "NOC fee from developer in AED. Defaults to 1000 for sale, 0 for offplan/rental." },
    },
    required: ["price"],
  },
};

export const calculateTransferCostsExecutor: ToolExecutor = async (input, ctx) => {
  const {
    price,
    dealType = "sale",
    isMortgage = false,
    mortgageAmount,
    commissionRate,
    nocFee: nocFeeInput,
  } = input as {
    price: number;
    dealType?: DealType;
    isMortgage?: boolean;
    mortgageAmount?: number;
    commissionRate?: number;
    nocFee?: number;
  };

  // Default commission by deal type
  const defaultCommissionRate = dealType === "sale" ? 2 : dealType === "rental" ? 5 : 0;
  const effectiveCommissionRate = commissionRate ?? defaultCommissionRate;

  // Default NOC fee
  const defaultNocFee = dealType === "sale" ? 1000 : 0;
  const effectiveNocFee = nocFeeInput ?? defaultNocFee;

  // DLD transfer fee: 4% of price
  const dldTransferFee = price * 0.04;

  // Fixed DLD admin fee
  const dldAdminFee = 580;

  // Title deed issuance
  const titleDeedFee = 4200;

  // NOC fee (from developer, secondary sales)
  const nocFee = effectiveNocFee;

  // Trustee fee (Dubai Land Department trustee office)
  const trusteeFee = 4000;

  // Agent commission + 5% VAT
  const commissionBase = price * (effectiveCommissionRate / 100);
  const commissionVat = commissionBase * 0.05;
  const commissionTotal = commissionBase + commissionVat;

  // Mortgage registration: 0.25% of loan amount
  const effectiveMortgageAmount = mortgageAmount ?? 0;
  const mortgageRegistrationFee = isMortgage && effectiveMortgageAmount > 0
    ? effectiveMortgageAmount * 0.0025
    : 0;

  const totalFees =
    dldTransferFee +
    dldAdminFee +
    titleDeedFee +
    nocFee +
    trusteeFee +
    commissionTotal +
    mortgageRegistrationFee;

  const totalCost = price + totalFees;

  const result = {
    price,
    dealType,
    breakdown: {
      dld_transfer_fee: {
        amount: Math.round(dldTransferFee),
        rate: "4%",
        description: "DLD Transfer Fee (4% of purchase price)",
      },
      dld_admin_fee: {
        amount: dldAdminFee,
        description: "DLD Admin Fee",
      },
      title_deed: {
        amount: titleDeedFee,
        description: "Title Deed Issuance",
      },
      noc_fee: {
        amount: nocFee,
        description: dealType === "offplan" ? "NOC — N/A for off-plan" : "NOC from Developer",
      },
      trustee_fee: {
        amount: trusteeFee,
        description: "DLD Trustee Office Fee",
      },
      agent_commission: {
        amount: Math.round(commissionTotal),
        base: Math.round(commissionBase),
        vat: Math.round(commissionVat),
        rate: `${effectiveCommissionRate}% + 5% VAT`,
        description: "Agent Commission",
      },
      mortgage_registration: {
        amount: Math.round(mortgageRegistrationFee),
        rate: isMortgage ? "0.25% of loan amount" : "N/A — cash purchase",
        description: "Mortgage Registration Fee",
      },
    },
    totalFees: Math.round(totalFees),
    totalAcquisitionCost: Math.round(totalCost),
    financing: isMortgage
      ? {
          mortgageAmount: effectiveMortgageAmount,
          downPayment: price - effectiveMortgageAmount,
          totalCashNeeded: Math.round((price - effectiveMortgageAmount) + totalFees),
        }
      : {
          totalCashNeeded: Math.round(totalCost),
        },
  };

  const deliverableId = ctx.issueId
    ? await storeDeliverable(ctx, {
        type: "transfer_cost_calculation",
        title: `Transfer Cost Breakdown — AED ${price.toLocaleString()} (${dealType})`,
        summary: `Total acquisition cost: AED ${result.totalAcquisitionCost.toLocaleString()}. Fees: AED ${result.totalFees.toLocaleString()}.`,
        metadata: { toolInput: input, result },
      })
    : null;

  return { ...result, deliverableId };
};
