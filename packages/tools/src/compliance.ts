import { eq, and, desc, lte } from "drizzle-orm";
import {
  aygentComplianceChecks,
  aygentBrokerCards,
  aygentDeals,
} from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import { storeDeliverable } from "./lib/deliverables.js";

// ═══════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════

const HIGH_RISK_NATIONALITIES = [
  "iran", "north korea", "syria", "yemen", "afghanistan",
  "libya", "somalia", "south sudan", "myanmar",
];

function determineRiskLevel(nationality?: string): string {
  if (!nationality) return "standard";
  const norm = nationality.toLowerCase().trim();
  return HIGH_RISK_NATIONALITIES.includes(norm) ? "high" : "standard";
}

function generateRequiredDocuments(
  clientType: string,
  riskLevel: string,
): Record<string, boolean> {
  // Base documents for all clients
  const docs: string[] = ["passport", "emirates_id", "visa"];

  // Additional per client type
  if (clientType === "company") {
    docs.push("trade_license", "memorandum_of_association", "power_of_attorney");
  } else if (clientType === "trust") {
    docs.push("trust_deed", "trustee_identification", "beneficiary_list");
  }

  // Additional for high risk
  if (riskLevel === "high") {
    docs.push("source_of_wealth", "bank_reference", "company_documents");
  }

  return docs.reduce<Record<string, boolean>>((acc, doc) => {
    acc[doc] = false;
    return acc;
  }, {});
}

// ═══════════════════════════════════════════════════
// run_kyc_check
// ═══════════════════════════════════════════════════

export const runKycCheckDefinition: ToolDefinition = {
  name: "run_kyc_check",
  description:
    "Manage KYC (Know Your Customer) checks for clients. Create new KYC check records, update documents collected or status, or list existing checks. Use when onboarding a new client, updating document collection progress, or reviewing KYC status for a deal.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "update", "get", "list"],
        description: "Action to perform",
      },
      checkId: { type: "string", description: "KYC check ID (for update/get)" },
      clientName: { type: "string", description: "Client full name (required for create)" },
      clientType: {
        type: "string",
        enum: ["individual", "company", "trust"],
        description: "Client type (required for create)",
      },
      nationality: { type: "string", description: "Client nationality — used to determine risk level" },
      emiratesId: { type: "string", description: "Emirates ID number" },
      passportNumber: { type: "string", description: "Passport number" },
      dealId: { type: "string", description: "Associated deal ID" },
      leadId: { type: "string", description: "Associated lead ID" },
      status: {
        type: "string",
        description: "Filter by status (for list) or new status (for update). Values: pending, in_progress, clear, flagged, expired",
      },
      documentsCollected: {
        type: "object",
        description: "Document collection updates — key: document name, value: true/false (for update)",
      },
      flagReason: { type: "string", description: "Reason for flagging (for update)" },
      resolution: { type: "string", description: "Resolution notes (for update)" },
    },
    required: ["action"],
  },
};

export const runKycCheckExecutor: ToolExecutor = async (input, ctx) => {
  const {
    action, checkId, clientName, clientType, nationality, emiratesId,
    passportNumber, dealId, leadId, status, documentsCollected,
    flagReason, resolution,
  } = input as {
    action: string;
    checkId?: string;
    clientName?: string;
    clientType?: string;
    nationality?: string;
    emiratesId?: string;
    passportNumber?: string;
    dealId?: string;
    leadId?: string;
    status?: string;
    documentsCollected?: Record<string, boolean>;
    flagReason?: string;
    resolution?: string;
  };

  const t = aygentComplianceChecks;

  if (action === "list") {
    const conditions = [
      eq(t.companyId, ctx.companyId),
      eq(t.checkType, "kyc"),
    ];
    if (status) conditions.push(eq(t.status, status));
    if (dealId) conditions.push(eq(t.dealId, dealId));

    const checks = await ctx.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(desc(t.createdAt))
      .limit(50);

    return { checks, total: checks.length };
  }

  if (action === "get") {
    if (!checkId) return { error: "checkId is required for get." };
    const results = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.id, checkId), eq(t.companyId, ctx.companyId)))
      .limit(1);
    if (results.length === 0) return { error: "KYC check not found." };
    return results[0];
  }

  if (action === "create") {
    if (!clientName) return { error: "clientName is required to create a KYC check." };
    if (!clientType) return { error: "clientType is required to create a KYC check." };

    const riskLevel = determineRiskLevel(nationality);
    const requiredDocuments = generateRequiredDocuments(clientType, riskLevel);

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const created = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        dealId: dealId ?? null,
        leadId: leadId ?? null,
        clientName,
        clientType,
        nationality: nationality ?? null,
        emiratesId: emiratesId ?? null,
        passportNumber: passportNumber ?? null,
        checkType: "kyc",
        status: "pending",
        documentsCollected: requiredDocuments,
        riskLevel,
        expiresAt,
      })
      .returning();

    const check = created[0]!;
    const docCount = Object.keys(requiredDocuments).length;

    return {
      check,
      message: `KYC check created for ${clientName} (${clientType}, risk: ${riskLevel}). ${docCount} documents required. Expires in 1 year.`,
      requiredDocuments: Object.keys(requiredDocuments),
    };
  }

  if (action === "update") {
    if (!checkId) return { error: "checkId is required for update." };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (documentsCollected !== undefined) {
      // Fetch existing docs and merge
      const existing = await ctx.db
        .select({ documentsCollected: t.documentsCollected })
        .from(t)
        .where(and(eq(t.id, checkId), eq(t.companyId, ctx.companyId)))
        .limit(1);
      if (existing.length === 0) return { error: "KYC check not found." };
      updates.documentsCollected = {
        ...(existing[0]!.documentsCollected ?? {}),
        ...documentsCollected,
      };
    }
    if (status) updates.status = status;
    if (flagReason) updates.flagReason = flagReason;
    if (resolution) updates.resolution = resolution;

    const updated = await ctx.db
      .update(t)
      .set(updates)
      .where(and(eq(t.id, checkId), eq(t.companyId, ctx.companyId)))
      .returning();

    if (updated.length === 0) return { error: "KYC check not found." };

    const check = updated[0]!;
    const docs = (check.documentsCollected ?? {}) as Record<string, boolean>;
    const collected = Object.values(docs).filter(Boolean).length;
    const total = Object.values(docs).length;

    return {
      check,
      message: `KYC check updated. Documents collected: ${collected}/${total}.`,
    };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// screen_pep_sanctions
// ═══════════════════════════════════════════════════

export const screenPepSanctionsDefinition: ToolDefinition = {
  name: "screen_pep_sanctions",
  description:
    "Record PEP (Politically Exposed Person) and sanctions screening for a client. Creates two compliance check records — one for PEP, one for sanctions — as a local audit trail. Use when onboarding any new client or when a deal requires AML compliance documentation.",
  input_schema: {
    type: "object",
    properties: {
      clientName: { type: "string", description: "Client full name (required)" },
      clientType: {
        type: "string",
        enum: ["individual", "company", "trust"],
        description: "Client type (required)",
      },
      nationality: { type: "string", description: "Client nationality" },
      passportNumber: { type: "string", description: "Passport number" },
      emiratesId: { type: "string", description: "Emirates ID number" },
      dealId: { type: "string", description: "Associated deal ID" },
      leadId: { type: "string", description: "Associated lead ID" },
    },
    required: ["clientName", "clientType"],
  },
};

export const screenPepSanctionsExecutor: ToolExecutor = async (input, ctx) => {
  const {
    clientName, clientType, nationality, passportNumber, emiratesId, dealId, leadId,
  } = input as {
    clientName: string;
    clientType: string;
    nationality?: string;
    passportNumber?: string;
    emiratesId?: string;
    dealId?: string;
    leadId?: string;
  };

  const t = aygentComplianceChecks;

  const commonFields = {
    companyId: ctx.companyId,
    dealId: dealId ?? null,
    leadId: leadId ?? null,
    clientName,
    clientType,
    nationality: nationality ?? null,
    passportNumber: passportNumber ?? null,
    emiratesId: emiratesId ?? null,
    status: "clear",
    checkedBy: ctx.agentId,
    checkedAt: new Date(),
  };

  const [pepCheck, sanctionsCheck] = await Promise.all([
    ctx.db.insert(t).values({ ...commonFields, checkType: "pep" }).returning(),
    ctx.db.insert(t).values({ ...commonFields, checkType: "sanctions" }).returning(),
  ]);

  return {
    pepCheck: pepCheck[0],
    sanctionsCheck: sanctionsCheck[0],
    message: `PEP and sanctions screening recorded for ${clientName} (${clientType}). Both checks status: clear. Note: this is a local audit trail record — not connected to an external screening API.`,
  };
};

// ═══════════════════════════════════════════════════
// track_broker_card
// ═══════════════════════════════════════════════════

export const trackBrokerCardDefinition: ToolDefinition = {
  name: "track_broker_card",
  description:
    "Manage broker RERA card records and training certifications. Create new broker card records, update card details, list all brokers, or check for cards expiring soon. Use to monitor broker licence compliance and ensure cards and AML training are current.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "update", "list", "check_expiring"],
        description: "Action to perform",
      },
      cardId: { type: "string", description: "Broker card ID (for update)" },
      brokerName: { type: "string", description: "Broker full name (required for create)" },
      reraCardNumber: { type: "string", description: "RERA card number" },
      reraBrn: { type: "string", description: "RERA broker registration number (BRN)" },
      issueDate: { type: "string", description: "Card issue date (YYYY-MM-DD)" },
      expiryDate: { type: "string", description: "Card expiry date (YYYY-MM-DD)" },
      status: { type: "string", description: "Card status: active, expired, suspended (default: active)" },
      dreiTrainingDate: { type: "string", description: "DREI training completion date (YYYY-MM-DD)" },
      dreiCertificateId: { type: "string", description: "DREI certificate ID" },
      amlTrainingDate: { type: "string", description: "AML training completion date (YYYY-MM-DD). Auto-calculates amlTrainingExpiry as +365 days." },
      phone: { type: "string", description: "Broker phone number" },
      email: { type: "string", description: "Broker email address" },
      areasFocus: {
        type: "array",
        items: { type: "string" },
        description: "Areas the broker focuses on (e.g. ['JVC', 'Downtown'])",
      },
      notes: { type: "string", description: "Notes about this broker" },
      daysAhead: {
        type: "number",
        description: "For check_expiring: return cards expiring within this many days (default 90)",
      },
    },
    required: ["action"],
  },
};

export const trackBrokerCardExecutor: ToolExecutor = async (input, ctx) => {
  const {
    action, cardId, brokerName, reraCardNumber, reraBrn, issueDate, expiryDate,
    status, dreiTrainingDate, dreiCertificateId, amlTrainingDate, phone, email,
    areasFocus, notes, daysAhead,
  } = input as {
    action: string;
    cardId?: string;
    brokerName?: string;
    reraCardNumber?: string;
    reraBrn?: string;
    issueDate?: string;
    expiryDate?: string;
    status?: string;
    dreiTrainingDate?: string;
    dreiCertificateId?: string;
    amlTrainingDate?: string;
    phone?: string;
    email?: string;
    areasFocus?: string[];
    notes?: string;
    daysAhead?: number;
  };

  const t = aygentBrokerCards;

  if (action === "list") {
    const cards = await ctx.db
      .select()
      .from(t)
      .where(eq(t.companyId, ctx.companyId))
      .orderBy(t.expiryDate)
      .limit(100);

    return { cards, total: cards.length };
  }

  if (action === "check_expiring") {
    const days = daysAhead ?? 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const cards = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.companyId, ctx.companyId), lte(t.expiryDate, cutoff)))
      .orderBy(t.expiryDate)
      .limit(100);

    const now = new Date();
    const withDaysUntilExpiry = cards.map((card) => ({
      ...card,
      days_until_expiry: card.expiryDate
        ? Math.ceil((card.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return {
      cards: withDaysUntilExpiry,
      total: withDaysUntilExpiry.length,
      message: `${withDaysUntilExpiry.length} broker card(s) expiring within ${days} days.`,
    };
  }

  if (action === "create") {
    if (!brokerName) return { error: "brokerName is required to create a broker card." };

    let amlTrainingExpiry: Date | null = null;
    if (amlTrainingDate) {
      amlTrainingExpiry = new Date(amlTrainingDate);
      amlTrainingExpiry.setDate(amlTrainingExpiry.getDate() + 365);
    }

    const created = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        brokerName,
        reraCardNumber: reraCardNumber ?? null,
        reraBrn: reraBrn ?? null,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        status: status ?? "active",
        dreiTrainingDate: dreiTrainingDate ? new Date(dreiTrainingDate) : null,
        dreiCertificateId: dreiCertificateId ?? null,
        amlTrainingDate: amlTrainingDate ? new Date(amlTrainingDate) : null,
        amlTrainingExpiry,
        phone: phone ?? null,
        email: email ?? null,
        areasFocus: areasFocus ?? [],
        notes: notes ?? null,
      })
      .returning();

    return {
      card: created[0],
      message: `Broker card created for ${brokerName}.${expiryDate ? ` Card expires ${expiryDate}.` : ""}${amlTrainingExpiry ? ` AML training expires ${amlTrainingExpiry.toISOString().split("T")[0]}.` : ""}`,
    };
  }

  if (action === "update") {
    if (!cardId) return { error: "cardId is required for update." };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (reraCardNumber) updates.reraCardNumber = reraCardNumber;
    if (reraBrn) updates.reraBrn = reraBrn;
    if (issueDate) updates.issueDate = new Date(issueDate);
    if (expiryDate) updates.expiryDate = new Date(expiryDate);
    if (status) updates.status = status;
    if (dreiTrainingDate) updates.dreiTrainingDate = new Date(dreiTrainingDate);
    if (dreiCertificateId) updates.dreiCertificateId = dreiCertificateId;
    if (amlTrainingDate) {
      updates.amlTrainingDate = new Date(amlTrainingDate);
      const expiry = new Date(amlTrainingDate);
      expiry.setDate(expiry.getDate() + 365);
      updates.amlTrainingExpiry = expiry;
    }
    if (phone) updates.phone = phone;
    if (email) updates.email = email;
    if (areasFocus) updates.areasFocus = areasFocus;
    if (notes) updates.notes = notes;

    const updated = await ctx.db
      .update(t)
      .set(updates)
      .where(and(eq(t.id, cardId), eq(t.companyId, ctx.companyId)))
      .returning();

    if (updated.length === 0) return { error: "Broker card not found." };
    return { card: updated[0], message: "Broker card updated." };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// generate_cdd_report
// ═══════════════════════════════════════════════════

export const generateCddReportDefinition: ToolDefinition = {
  name: "generate_cdd_report",
  description:
    "Generate a Customer Due Diligence (CDD) report for a deal. Pulls all compliance checks linked to the deal, groups by client, and produces an overall compliance status. Use before deal completion to confirm all parties have KYC, PEP, and sanctions checks in place.",
  input_schema: {
    type: "object",
    properties: {
      dealId: { type: "string", description: "Deal ID to generate CDD report for (required)" },
    },
    required: ["dealId"],
  },
};

export const generateCddReportExecutor: ToolExecutor = async (input, ctx) => {
  const { dealId } = input as { dealId: string };

  // Fetch deal
  const dealResults = await ctx.db
    .select()
    .from(aygentDeals)
    .where(and(eq(aygentDeals.id, dealId), eq(aygentDeals.companyId, ctx.companyId)))
    .limit(1);

  if (dealResults.length === 0) return { error: "Deal not found." };
  const deal = dealResults[0]!;

  // Fetch all compliance checks for this deal
  const checks = await ctx.db
    .select()
    .from(aygentComplianceChecks)
    .where(
      and(
        eq(aygentComplianceChecks.dealId, dealId),
        eq(aygentComplianceChecks.companyId, ctx.companyId),
      ),
    )
    .orderBy(aygentComplianceChecks.clientName, aygentComplianceChecks.checkType);

  // Group checks by clientName
  const byClient: Record<string, {
    kyc: typeof checks[number] | null;
    pep: typeof checks[number] | null;
    sanctions: typeof checks[number] | null;
  }> = {};

  for (const check of checks) {
    if (!byClient[check.clientName]) {
      byClient[check.clientName] = { kyc: null, pep: null, sanctions: null };
    }
    const entry = byClient[check.clientName]!;
    if (check.checkType === "kyc") entry.kyc = check;
    else if (check.checkType === "pep") entry.pep = check;
    else if (check.checkType === "sanctions") entry.sanctions = check;
  }

  // Build per-client summary
  const clientSummaries = Object.entries(byClient).map(([name, clientChecks]) => {
    const kycDocs = (clientChecks.kyc?.documentsCollected ?? {}) as Record<string, boolean>;
    const missingDocuments = Object.entries(kycDocs)
      .filter(([, collected]) => !collected)
      .map(([doc]) => doc);

    const allClear =
      clientChecks.kyc?.status === "clear" &&
      clientChecks.pep?.status === "clear" &&
      clientChecks.sanctions?.status === "clear" &&
      missingDocuments.length === 0;

    return {
      clientName: name,
      kycStatus: clientChecks.kyc?.status ?? "missing",
      pepStatus: clientChecks.pep?.status ?? "missing",
      sanctionsStatus: clientChecks.sanctions?.status ?? "missing",
      missingDocuments,
      allClear,
    };
  });

  // Determine missing party checks
  const checkedClients = Object.keys(byClient);
  const missingPartyChecks: string[] = [];
  if (deal.buyerName && !checkedClients.includes(deal.buyerName)) {
    missingPartyChecks.push(`Buyer: ${deal.buyerName}`);
  }
  if (deal.sellerName && !checkedClients.includes(deal.sellerName)) {
    missingPartyChecks.push(`Seller: ${deal.sellerName}`);
  }

  // Overall status
  const allClientsCompliant = clientSummaries.every((c) => c.allClear);
  const overallStatus = allClientsCompliant && missingPartyChecks.length === 0
    ? "COMPLIANT"
    : "INCOMPLETE";

  const report = {
    dealId,
    dealType: deal.dealType,
    propertyAddress: deal.propertyAddress,
    stage: deal.stage,
    overallStatus,
    clients: clientSummaries,
    missingPartyChecks,
    generatedAt: new Date().toISOString(),
  };

  const deliverableId = await storeDeliverable(ctx, {
    type: "cdd_report",
    title: `CDD Report — ${deal.propertyAddress}`,
    summary: `Overall: ${overallStatus}. ${clientSummaries.length} client(s) screened.${missingPartyChecks.length > 0 ? ` Missing checks for: ${missingPartyChecks.join(", ")}.` : ""}`,
    metadata: { dealId, report },
  });

  return { ...report, deliverableId };
};

// ═══════════════════════════════════════════════════
// check_trakheesi_validity
// ═══════════════════════════════════════════════════

export const checkTrakheesiValidityDefinition: ToolDefinition = {
  name: "check_trakheesi_validity",
  description:
    "Record a Trakheesi permit number verification for a listing. Creates an audit trail compliance record. Use when verifying that a property listing has a valid DLD Trakheesi permit before advertising. Note: currently a stub for future DLD API integration — records the audit trail and returns status valid.",
  input_schema: {
    type: "object",
    properties: {
      permitNumber: { type: "string", description: "Trakheesi permit number (required)" },
      listingUrl: { type: "string", description: "Listing URL this permit is for (optional)" },
      notes: { type: "string", description: "Notes about this permit check (optional)" },
    },
    required: ["permitNumber"],
  },
};

export const checkTrakheesiValidityExecutor: ToolExecutor = async (input, ctx) => {
  const { permitNumber, listingUrl, notes } = input as {
    permitNumber: string;
    listingUrl?: string;
    notes?: string;
  };

  // Build resolution note from optional fields
  const resolutionParts = [
    listingUrl ? `Listing URL: ${listingUrl}` : null,
    notes ?? null,
  ].filter(Boolean);

  // Create compliance check as audit trail
  const created = await ctx.db
    .insert(aygentComplianceChecks)
    .values({
      companyId: ctx.companyId,
      dealId: null,
      leadId: null,
      clientName: `Trakheesi: ${permitNumber}`,
      clientType: "listing",
      checkType: "trakheesi",
      status: "clear",
      checkedBy: ctx.agentId,
      checkedAt: new Date(),
      resolution: resolutionParts.length > 0 ? resolutionParts.join(" | ") : null,
    })
    .returning();

  return {
    permitNumber,
    status: "valid",
    auditTrailId: created[0]?.id ?? null,
    listingUrl: listingUrl ?? null,
    message: `Trakheesi permit ${permitNumber} recorded as valid. Audit trail created. Note: this is a stub — future DLD API integration will provide live validation.`,
    stub: true,
  };
};

// ═══════════════════════════════════════════════════
// track_aml_training
// ═══════════════════════════════════════════════════

export const trackAmlTrainingDefinition: ToolDefinition = {
  name: "track_aml_training",
  description:
    "Track AML (Anti-Money Laundering) and DREI training records for brokers. Record new training completions, list all brokers with their training status, or check which brokers have AML training expiring soon. Use for compliance monitoring of broker certifications.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["record", "list", "check_expiring"],
        description: "Action to perform",
      },
      brokerName: { type: "string", description: "Broker name (required for record)" },
      trainingType: {
        type: "string",
        enum: ["aml", "drei"],
        description: "Type of training completed (required for record)",
      },
      completionDate: {
        type: "string",
        description: "Training completion date (YYYY-MM-DD, required for record). Defaults to today if not provided.",
      },
      certificateId: { type: "string", description: "Certificate ID for the completed training" },
      daysAhead: {
        type: "number",
        description: "For check_expiring: return brokers with AML training expiring within this many days (default 90)",
      },
    },
    required: ["action"],
  },
};

export const trackAmlTrainingExecutor: ToolExecutor = async (input, ctx) => {
  const { action, brokerName, trainingType, completionDate, certificateId, daysAhead } = input as {
    action: string;
    brokerName?: string;
    trainingType?: "aml" | "drei";
    completionDate?: string;
    certificateId?: string;
    daysAhead?: number;
  };

  const t = aygentBrokerCards;

  if (action === "list") {
    const cards = await ctx.db
      .select()
      .from(t)
      .where(eq(t.companyId, ctx.companyId))
      .orderBy(t.brokerName)
      .limit(100);

    const now = new Date();
    const brokers = cards.map((card) => ({
      id: card.id,
      brokerName: card.brokerName,
      reraCardNumber: card.reraCardNumber,
      expiryDate: card.expiryDate?.toISOString().split("T")[0] ?? null,
      dreiTrainingDate: card.dreiTrainingDate?.toISOString().split("T")[0] ?? null,
      amlTrainingDate: card.amlTrainingDate?.toISOString().split("T")[0] ?? null,
      amlTrainingExpiry: card.amlTrainingExpiry?.toISOString().split("T")[0] ?? null,
      amlTrainingDaysRemaining: card.amlTrainingExpiry
        ? Math.ceil((card.amlTrainingExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      amlStatus: card.amlTrainingExpiry
        ? card.amlTrainingExpiry > now ? "current" : "expired"
        : "not_recorded",
    }));

    return { brokers, total: brokers.length };
  }

  if (action === "check_expiring") {
    const days = daysAhead ?? 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const cards = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.companyId, ctx.companyId), lte(t.amlTrainingExpiry, cutoff)))
      .orderBy(t.amlTrainingExpiry)
      .limit(100);

    const now = new Date();
    const brokers = cards.map((card) => ({
      id: card.id,
      brokerName: card.brokerName,
      amlTrainingExpiry: card.amlTrainingExpiry?.toISOString().split("T")[0] ?? null,
      days_until_expiry: card.amlTrainingExpiry
        ? Math.ceil((card.amlTrainingExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return {
      brokers,
      total: brokers.length,
      message: `${brokers.length} broker(s) with AML training expiring within ${days} days.`,
    };
  }

  if (action === "record") {
    if (!brokerName) return { error: "brokerName is required to record training." };
    if (!trainingType) return { error: "trainingType is required to record training." };

    // Find broker card by name
    const cards = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.companyId, ctx.companyId), eq(t.brokerName, brokerName)))
      .limit(1);

    if (cards.length === 0) {
      return {
        error: `Broker card not found for "${brokerName}". Create the broker card first using track_broker_card with action: create.`,
      };
    }

    const card = cards[0]!;
    const trainingDateParsed = completionDate ? new Date(completionDate) : new Date();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (trainingType === "aml") {
      updates.amlTrainingDate = trainingDateParsed;
      const expiry = new Date(trainingDateParsed);
      expiry.setDate(expiry.getDate() + 365);
      updates.amlTrainingExpiry = expiry;
      if (certificateId) updates.dreiCertificateId = certificateId; // reuse available field
    } else if (trainingType === "drei") {
      updates.dreiTrainingDate = trainingDateParsed;
      if (certificateId) updates.dreiCertificateId = certificateId;
    }

    const updated = await ctx.db
      .update(t)
      .set(updates)
      .where(and(eq(t.id, card.id), eq(t.companyId, ctx.companyId)))
      .returning();

    const updatedCard = updated[0]!;
    const expiryMsg = trainingType === "aml" && updatedCard.amlTrainingExpiry
      ? ` AML training expires ${updatedCard.amlTrainingExpiry.toISOString().split("T")[0]}.`
      : "";

    return {
      card: updatedCard,
      message: `${trainingType.toUpperCase()} training recorded for ${brokerName} on ${trainingDateParsed.toISOString().split("T")[0]}.${expiryMsg}`,
    };
  }

  return { error: `Unknown action: ${action}` };
};
