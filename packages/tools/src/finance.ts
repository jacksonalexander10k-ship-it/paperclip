import { eq, and, desc, gte, lte, ne, sum, sql } from "drizzle-orm";
import {
  aygentCommissions,
  aygentInvoices,
  aygentExpenses,
  aygentDeals,
  costEvents,
} from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import { storeDeliverable } from "./lib/deliverables.js";

// ═══════════════════════════════════════════════════
// track_commission
// ═══════════════════════════════════════════════════

export const trackCommissionDefinition: ToolDefinition = {
  name: "track_commission",
  description:
    "Track commissions earned from deals. Create commission records (auto-calculates splits and VAT), update status, or list commissions with aggregated totals. Use when a deal is completed or when updating commission payment status.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "list", "get"], description: "Action to perform" },
      commissionId: { type: "string", description: "Commission ID (for update/get)" },
      dealId: { type: "string", description: "Deal ID to commission is linked to (required for create)" },
      grossAmount: { type: "number", description: "Gross commission amount in AED (required for create)" },
      agentSplitPct: { type: "number", description: "Agent split percentage (default 60). Overrides tier-based default." },
      commissionRate: { type: "number", description: "Commission rate as a percentage (e.g. 2 for 2%). Stored for reference." },
      source: { type: "string", description: "Source of the commission (e.g. 'Property Finder', 'referral', 'direct')" },
      status: { type: "string", description: "Filter by status (for list) or new status (for update). Values: earned, invoiced, collected, written_off" },
      notes: { type: "string", description: "Notes about this commission (for update)" },
      paidDate: { type: "string", description: "Date payment was received (YYYY-MM-DD, for update when marking collected)" },
      paidAmount: { type: "number", description: "Amount actually paid in AED (for update)" },
    },
    required: ["action"],
  },
};

export const trackCommissionExecutor: ToolExecutor = async (input, ctx) => {
  const {
    action, commissionId, dealId, grossAmount, agentSplitPct,
    commissionRate, source, status, notes, paidDate, paidAmount,
  } = input as {
    action: string;
    commissionId?: string;
    dealId?: string;
    grossAmount?: number;
    agentSplitPct?: number;
    commissionRate?: number;
    source?: string;
    status?: string;
    notes?: string;
    paidDate?: string;
    paidAmount?: number;
  };

  const t = aygentCommissions;

  if (action === "list") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (status) conditions.push(eq(t.status, status));

    const commissions = await ctx.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(desc(t.createdAt))
      .limit(50);

    const totalEarned = commissions.reduce((sum, c) => sum + c.grossAmount, 0);
    const totalCollected = commissions
      .filter((c) => c.status === "collected")
      .reduce((sum, c) => sum + (c.paidAmount ?? c.totalWithVat ?? c.grossAmount), 0);

    return {
      commissions: commissions.map((c) => ({
        id: c.id,
        dealId: c.dealId,
        dealType: c.dealType,
        grossAmount: c.grossAmount,
        agentAmount: c.agentAmount,
        agencyAmount: c.agencyAmount,
        vatAmount: c.vatAmount,
        totalWithVat: c.totalWithVat,
        status: c.status,
        source: c.source,
        paidDate: c.paidDate?.toISOString().split("T")[0] ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      total: commissions.length,
      aggregates: {
        totalEarned,
        totalCollected,
        totalOutstanding: totalEarned - totalCollected,
      },
    };
  }

  if (action === "get") {
    if (!commissionId) return { error: "commissionId is required for get." };
    const results = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.id, commissionId), eq(t.companyId, ctx.companyId)))
      .limit(1);
    if (results.length === 0) return { error: "Commission not found." };
    return results[0];
  }

  if (action === "create") {
    if (!dealId) return { error: "dealId is required to create a commission." };
    if (grossAmount === undefined || grossAmount === null) return { error: "grossAmount is required to create a commission." };

    // Look up the deal to get dealType
    const dealResults = await ctx.db
      .select({ dealType: aygentDeals.dealType })
      .from(aygentDeals)
      .where(and(eq(aygentDeals.id, dealId), eq(aygentDeals.companyId, ctx.companyId)))
      .limit(1);

    if (dealResults.length === 0) return { error: "Deal not found." };
    const dealType = dealResults[0]!.dealType;

    // Calculate splits
    const effectiveSplitPct = agentSplitPct ?? 60;
    const agentAmountCalc = Math.round(grossAmount * (effectiveSplitPct / 100));
    const agencyAmountCalc = grossAmount - agentAmountCalc;
    const vatAmountCalc = Math.round(grossAmount * 0.05);
    const totalWithVatCalc = grossAmount + vatAmountCalc;

    const created = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        agentId: ctx.agentId,
        dealId,
        dealType,
        grossAmount,
        commissionRate: commissionRate != null ? String(commissionRate) : null,
        agentSplitPct: String(effectiveSplitPct),
        agentAmount: agentAmountCalc,
        agencyAmount: agencyAmountCalc,
        vatAmount: vatAmountCalc,
        totalWithVat: totalWithVatCalc,
        status: "earned",
        source: source ?? null,
        notes: notes ?? null,
      })
      .returning();

    return {
      commission: created[0],
      message: `Commission recorded: AED ${grossAmount.toLocaleString()} gross. Agent: AED ${agentAmountCalc.toLocaleString()} (${effectiveSplitPct}%), Agency: AED ${agencyAmountCalc.toLocaleString()}. Total incl. VAT: AED ${totalWithVatCalc.toLocaleString()}.`,
    };
  }

  if (action === "update") {
    if (!commissionId) return { error: "commissionId is required for update." };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (notes) updates.notes = notes;
    if (paidDate) updates.paidDate = new Date(paidDate);
    if (paidAmount !== undefined) updates.paidAmount = paidAmount;

    const updated = await ctx.db
      .update(t)
      .set(updates)
      .where(and(eq(t.id, commissionId), eq(t.companyId, ctx.companyId)))
      .returning();

    if (updated.length === 0) return { error: "Commission not found." };
    return { commission: updated[0], message: "Commission updated." };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// calculate_commission_split
// ═══════════════════════════════════════════════════

export const calculateCommissionSplitDefinition: ToolDefinition = {
  name: "calculate_commission_split",
  description:
    "Calculate commission split breakdown for a deal — no DB writes. Returns gross commission, agent share, agency share, VAT, and total. Use when previewing commission before creating a deal, or when quoting a buyer/seller on agent fees.",
  input_schema: {
    type: "object",
    properties: {
      price: { type: "number", description: "Property price in AED" },
      dealType: { type: "string", enum: ["sale", "offplan", "rental"], description: "Type of deal. Determines default commission rate: sale=2%, rental=5%, offplan=5%" },
      commissionRate: { type: "number", description: "Commission rate as a percentage. Overrides the deal-type default." },
      agentTier: {
        type: "string",
        enum: ["junior", "senior", "top", "custom"],
        description: "Agent tier determines split: junior=50%, senior=60%, top=70%. Use 'custom' with agentSplitPct to set manually.",
      },
      agentSplitPct: { type: "number", description: "Custom agent split percentage (used when agentTier is 'custom')" },
    },
    required: ["price"],
  },
};

export const calculateCommissionSplitExecutor: ToolExecutor = async (input, _ctx) => {
  const {
    price,
    dealType = "sale",
    commissionRate,
    agentTier = "senior",
    agentSplitPct,
  } = input as {
    price: number;
    dealType?: string;
    commissionRate?: number;
    agentTier?: string;
    agentSplitPct?: number;
  };

  // Default commission rates by deal type
  const defaultRates: Record<string, number> = { sale: 2, rental: 5, offplan: 5 };
  const effectiveRate = commissionRate ?? defaultRates[dealType] ?? 2;

  // Agent split by tier
  const tierSplits: Record<string, number> = { junior: 50, senior: 60, top: 70 };
  let effectiveSplitPct: number;
  if (agentTier === "custom" && agentSplitPct != null) {
    effectiveSplitPct = agentSplitPct;
  } else {
    effectiveSplitPct = tierSplits[agentTier] ?? 60;
  }

  const gross = Math.round(price * (effectiveRate / 100));
  const agentShare = Math.round(gross * (effectiveSplitPct / 100));
  const agencyShare = gross - agentShare;
  const vat = Math.round(gross * 0.05);
  const totalWithVat = gross + vat;

  return {
    price,
    dealType,
    commissionRate: effectiveRate,
    agentTier,
    agentSplitPct: effectiveSplitPct,
    breakdown: {
      gross_commission: {
        amount: gross,
        calculation: `${price.toLocaleString()} × ${effectiveRate}%`,
      },
      agent_share: {
        amount: agentShare,
        pct: effectiveSplitPct,
        calculation: `${gross.toLocaleString()} × ${effectiveSplitPct}%`,
      },
      agency_share: {
        amount: agencyShare,
        pct: 100 - effectiveSplitPct,
        calculation: `${gross.toLocaleString()} × ${100 - effectiveSplitPct}%`,
      },
      vat: {
        amount: vat,
        rate: "5%",
      },
      total_with_vat: {
        amount: totalWithVat,
      },
    },
    summary: `AED ${price.toLocaleString()} ${dealType} at ${effectiveRate}% = AED ${gross.toLocaleString()} gross. Agent (${effectiveSplitPct}%): AED ${agentShare.toLocaleString()}. Agency: AED ${agencyShare.toLocaleString()}. Total incl. VAT: AED ${totalWithVat.toLocaleString()}.`,
  };
};

// ═══════════════════════════════════════════════════
// generate_invoice
// ═══════════════════════════════════════════════════

export const generateInvoiceDefinition: ToolDefinition = {
  name: "generate_invoice",
  description:
    "Generate an invoice record. Auto-generates invoice number (INV-YYYY-NNNN), calculates 5% VAT, and optionally stores as a deliverable. Use when the agency needs to invoice a client for commission, management fees, or other services.",
  input_schema: {
    type: "object",
    properties: {
      invoiceType: { type: "string", description: "Type of invoice: commission, management_fee, consultation, marketing, other" },
      clientName: { type: "string", description: "Client's full name" },
      clientEmail: { type: "string", description: "Client's email address" },
      clientPhone: { type: "string", description: "Client's phone number" },
      description: { type: "string", description: "Invoice line item description" },
      amount: { type: "number", description: "Net amount in AED (before VAT)" },
      dueDate: { type: "string", description: "Payment due date (YYYY-MM-DD). Defaults to 30 days from today." },
      dealId: { type: "string", description: "Associated deal ID (optional)" },
      commissionId: { type: "string", description: "Associated commission ID (optional)" },
      agencyName: { type: "string", description: "Agency legal name for the invoice header" },
      agencyRera: { type: "string", description: "Agency RERA licence number" },
      agencyTrn: { type: "string", description: "Agency VAT TRN number" },
      notes: { type: "string", description: "Additional notes on the invoice" },
    },
    required: ["invoiceType", "clientName", "description", "amount"],
  },
};

export const generateInvoiceExecutor: ToolExecutor = async (input, ctx) => {
  const {
    invoiceType, clientName, clientEmail, clientPhone, description, amount,
    dueDate, dealId, commissionId, agencyName, agencyRera, agencyTrn, notes,
  } = input as {
    invoiceType: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    description: string;
    amount: number;
    dueDate?: string;
    dealId?: string;
    commissionId?: string;
    agencyName?: string;
    agencyRera?: string;
    agencyTrn?: string;
    notes?: string;
  };

  const t = aygentInvoices;

  // Generate sequential invoice number: INV-YYYY-NNNN
  const year = new Date().getFullYear();
  const countResult = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(t)
    .where(
      and(
        eq(t.companyId, ctx.companyId),
        gte(t.createdAt, new Date(`${year}-01-01T00:00:00Z`)),
      ),
    );
  const existingCount = Number(countResult[0]?.count ?? 0);
  const invoiceNumber = `INV-${year}-${String(existingCount + 1).padStart(4, "0")}`;

  // Calculate VAT
  const vatAmount = Math.round(amount * 0.05);
  const total = amount + vatAmount;

  // Default due date: 30 days from today
  const effectiveDueDate = dueDate
    ? new Date(dueDate)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const created = await ctx.db
    .insert(t)
    .values({
      companyId: ctx.companyId,
      commissionId: commissionId ?? null,
      dealId: dealId ?? null,
      invoiceNumber,
      invoiceType,
      clientName,
      clientEmail: clientEmail ?? null,
      clientPhone: clientPhone ?? null,
      description,
      amount,
      vatAmount,
      total,
      status: "draft",
      dueDate: effectiveDueDate,
      agencyName: agencyName ?? null,
      agencyRera: agencyRera ?? null,
      agencyTrn: agencyTrn ?? null,
      notes: notes ?? null,
    })
    .returning();

  const invoice = created[0]!;

  const deliverableId = ctx.issueId
    ? await storeDeliverable(ctx, {
        type: "invoice",
        title: `Invoice ${invoiceNumber} — ${clientName} (AED ${total.toLocaleString()})`,
        summary: `${invoiceType} invoice to ${clientName}. Net: AED ${amount.toLocaleString()}, VAT: AED ${vatAmount.toLocaleString()}, Total: AED ${total.toLocaleString()}. Due: ${effectiveDueDate.toISOString().split("T")[0]}.`,
        metadata: { invoiceId: invoice.id, invoiceNumber },
      })
    : null;

  return {
    invoice,
    deliverableId,
    message: `Invoice ${invoiceNumber} created for ${clientName}. Net: AED ${amount.toLocaleString()}, VAT: AED ${vatAmount.toLocaleString()}, Total: AED ${total.toLocaleString()}. Due: ${effectiveDueDate.toISOString().split("T")[0]}.`,
  };
};

// ═══════════════════════════════════════════════════
// track_payment
// ═══════════════════════════════════════════════════

export const trackPaymentDefinition: ToolDefinition = {
  name: "track_payment",
  description:
    "Track invoice payments. Record a payment against an invoice, list all outstanding invoices, or get an aging report grouping outstanding invoices by age bucket. Use when a client pays an invoice or when reviewing accounts receivable.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["record", "list_outstanding", "get_aging"], description: "Action to perform" },
      invoiceId: { type: "string", description: "Invoice ID (required for record)" },
      amountPaid: { type: "number", description: "Amount paid in AED (required for record)" },
      paymentDate: { type: "string", description: "Date payment was received (YYYY-MM-DD). Defaults to today." },
    },
    required: ["action"],
  },
};

export const trackPaymentExecutor: ToolExecutor = async (input, ctx) => {
  const { action, invoiceId, amountPaid, paymentDate } = input as {
    action: string;
    invoiceId?: string;
    amountPaid?: number;
    paymentDate?: string;
  };

  const t = aygentInvoices;

  if (action === "record") {
    if (!invoiceId) return { error: "invoiceId is required for record." };
    if (amountPaid === undefined || amountPaid === null) return { error: "amountPaid is required for record." };

    // Fetch invoice
    const results = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.id, invoiceId), eq(t.companyId, ctx.companyId)))
      .limit(1);

    if (results.length === 0) return { error: "Invoice not found." };
    const invoice = results[0]!;

    const previousPaid = invoice.paidAmount ?? 0;
    const newPaidAmount = previousPaid + amountPaid;
    const isFullyPaid = newPaidAmount >= invoice.total;

    const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();

    const updated = await ctx.db
      .update(t)
      .set({
        paidAmount: newPaidAmount,
        paidDate: isFullyPaid ? effectivePaymentDate : invoice.paidDate,
        status: isFullyPaid ? "paid" : "partial",
        updatedAt: new Date(),
      })
      .where(and(eq(t.id, invoiceId), eq(t.companyId, ctx.companyId)))
      .returning();

    return {
      invoice: updated[0],
      amountPaid,
      totalPaid: newPaidAmount,
      outstanding: Math.max(0, invoice.total - newPaidAmount),
      fullyPaid: isFullyPaid,
      message: isFullyPaid
        ? `Invoice ${invoice.invoiceNumber} fully paid. Total received: AED ${newPaidAmount.toLocaleString()}.`
        : `Partial payment of AED ${amountPaid.toLocaleString()} recorded. Outstanding: AED ${Math.max(0, invoice.total - newPaidAmount).toLocaleString()}.`,
    };
  }

  if (action === "list_outstanding") {
    const outstanding = await ctx.db
      .select()
      .from(t)
      .where(
        and(
          eq(t.companyId, ctx.companyId),
          ne(t.status, "paid"),
          ne(t.status, "cancelled"),
        ),
      )
      .orderBy(t.dueDate)
      .limit(100);

    const totalOutstanding = outstanding.reduce((s, inv) => s + (inv.total - (inv.paidAmount ?? 0)), 0);

    return {
      invoices: outstanding.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        invoiceType: inv.invoiceType,
        total: inv.total,
        paidAmount: inv.paidAmount ?? 0,
        outstanding: inv.total - (inv.paidAmount ?? 0),
        status: inv.status,
        dueDate: inv.dueDate?.toISOString().split("T")[0] ?? null,
      })),
      total: outstanding.length,
      totalOutstandingAed: totalOutstanding,
    };
  }

  if (action === "get_aging") {
    const outstanding = await ctx.db
      .select()
      .from(t)
      .where(
        and(
          eq(t.companyId, ctx.companyId),
          ne(t.status, "paid"),
          ne(t.status, "cancelled"),
        ),
      )
      .orderBy(t.dueDate);

    const now = Date.now();
    const buckets: Record<string, { invoices: unknown[]; total: number }> = {
      current: { invoices: [], total: 0 },
      "30_days": { invoices: [], total: 0 },
      "60_days": { invoices: [], total: 0 },
      "90_plus_days": { invoices: [], total: 0 },
    };

    for (const inv of outstanding) {
      const outstanding = inv.total - (inv.paidAmount ?? 0);
      const dueDate = inv.dueDate ? inv.dueDate.getTime() : now;
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

      const entry = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        outstanding,
        dueDate: inv.dueDate?.toISOString().split("T")[0] ?? null,
        daysOverdue: Math.max(0, daysOverdue),
      };

      if (daysOverdue <= 0) {
        buckets["current"]!.invoices.push(entry);
        buckets["current"]!.total += outstanding;
      } else if (daysOverdue <= 30) {
        buckets["30_days"]!.invoices.push(entry);
        buckets["30_days"]!.total += outstanding;
      } else if (daysOverdue <= 60) {
        buckets["60_days"]!.invoices.push(entry);
        buckets["60_days"]!.total += outstanding;
      } else {
        buckets["90_plus_days"]!.invoices.push(entry);
        buckets["90_plus_days"]!.total += outstanding;
      }
    }

    const grandTotal = Object.values(buckets).reduce((s, b) => s + b.total, 0);

    return {
      aging: buckets,
      grandTotalOutstanding: grandTotal,
      message: `Total outstanding: AED ${grandTotal.toLocaleString()}. Current: AED ${buckets["current"]!.total.toLocaleString()}, 1-30 days: AED ${buckets["30_days"]!.total.toLocaleString()}, 31-60 days: AED ${buckets["60_days"]!.total.toLocaleString()}, 90+ days: AED ${buckets["90_plus_days"]!.total.toLocaleString()}.`,
    };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// get_accounts_receivable
// ═══════════════════════════════════════════════════

export const getAccountsReceivableDefinition: ToolDefinition = {
  name: "get_accounts_receivable",
  description:
    "Get a full accounts receivable summary: total outstanding, breakdown by invoice type, and breakdown by client. Use when the owner or CEO wants to know what money is owed to the agency.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const getAccountsReceivableExecutor: ToolExecutor = async (_input, ctx) => {
  const t = aygentInvoices;

  const outstanding = await ctx.db
    .select()
    .from(t)
    .where(
      and(
        eq(t.companyId, ctx.companyId),
        ne(t.status, "paid"),
        ne(t.status, "cancelled"),
      ),
    );

  if (outstanding.length === 0) {
    return {
      total_outstanding: 0,
      invoice_count: 0,
      average_invoice: 0,
      by_type: {},
      by_client: {},
      message: "No outstanding invoices.",
    };
  }

  let totalOutstanding = 0;
  const byType: Record<string, { count: number; total: number }> = {};
  const byClient: Record<string, { count: number; total: number }> = {};

  for (const inv of outstanding) {
    const balance = inv.total - (inv.paidAmount ?? 0);
    totalOutstanding += balance;

    if (!byType[inv.invoiceType]) byType[inv.invoiceType] = { count: 0, total: 0 };
    byType[inv.invoiceType]!.count++;
    byType[inv.invoiceType]!.total += balance;

    if (!byClient[inv.clientName]) byClient[inv.clientName] = { count: 0, total: 0 };
    byClient[inv.clientName]!.count++;
    byClient[inv.clientName]!.total += balance;
  }

  const avgInvoice = Math.round(totalOutstanding / outstanding.length);

  return {
    total_outstanding: totalOutstanding,
    invoice_count: outstanding.length,
    average_invoice: avgInvoice,
    by_type: byType,
    by_client: byClient,
    message: `AED ${totalOutstanding.toLocaleString()} outstanding across ${outstanding.length} invoices from ${Object.keys(byClient).length} clients.`,
  };
};

// ═══════════════════════════════════════════════════
// calculate_vat
// ═══════════════════════════════════════════════════

export const calculateVatDefinition: ToolDefinition = {
  name: "calculate_vat",
  description:
    "Calculate VAT on an amount, or generate a quarterly VAT summary for FTA filing. Use for quick VAT calculations or to prepare for quarterly VAT returns.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["calculate", "quarterly_summary"], description: "Action to perform" },
      amount: { type: "number", description: "Amount in AED (required for calculate)" },
      isInclusive: { type: "boolean", description: "Is the amount VAT-inclusive? If true, extracts VAT from total. If false (default), adds VAT to net." },
      startDate: { type: "string", description: "Start date for quarterly summary (YYYY-MM-DD, required for quarterly_summary)" },
      endDate: { type: "string", description: "End date for quarterly summary (YYYY-MM-DD, required for quarterly_summary)" },
    },
    required: ["action"],
  },
};

export const calculateVatExecutor: ToolExecutor = async (input, ctx) => {
  const { action, amount, isInclusive = false, startDate, endDate } = input as {
    action: string;
    amount?: number;
    isInclusive?: boolean;
    startDate?: string;
    endDate?: string;
  };

  if (action === "calculate") {
    if (amount === undefined || amount === null) return { error: "amount is required for calculate." };

    let net: number;
    let vat: number;
    let gross: number;

    if (isInclusive) {
      // Extract VAT from inclusive amount: net = amount / 1.05
      net = Math.round(amount / 1.05);
      vat = amount - net;
      gross = amount;
    } else {
      net = amount;
      vat = Math.round(amount * 0.05);
      gross = net + vat;
    }

    return {
      isInclusive,
      net,
      vat,
      gross,
      vatRate: "5%",
      summary: isInclusive
        ? `AED ${amount.toLocaleString()} (inclusive) → Net: AED ${net.toLocaleString()}, VAT: AED ${vat.toLocaleString()}`
        : `AED ${amount.toLocaleString()} (net) → VAT: AED ${vat.toLocaleString()}, Total: AED ${gross.toLocaleString()}`,
    };
  }

  if (action === "quarterly_summary") {
    if (!startDate || !endDate) return { error: "startDate and endDate are required for quarterly_summary." };

    const start = new Date(startDate);
    const end = new Date(endDate);

    // VAT collected: from invoices
    const invoices = await ctx.db
      .select({ vatAmount: aygentInvoices.vatAmount })
      .from(aygentInvoices)
      .where(
        and(
          eq(aygentInvoices.companyId, ctx.companyId),
          eq(aygentInvoices.status, "paid"),
          gte(aygentInvoices.paidDate!, start),
          lte(aygentInvoices.paidDate!, end),
        ),
      );

    const vatCollected = invoices.reduce((s, inv) => s + inv.vatAmount, 0);

    // VAT paid: from expenses
    const expenses = await ctx.db
      .select({ vatAmount: aygentExpenses.vatAmount })
      .from(aygentExpenses)
      .where(
        and(
          eq(aygentExpenses.companyId, ctx.companyId),
          gte(aygentExpenses.date, start),
          lte(aygentExpenses.date, end),
        ),
      );

    const vatPaid = expenses.reduce((s, exp) => s + (exp.vatAmount ?? 0), 0);
    const netVatPayable = vatCollected - vatPaid;

    return {
      period: { startDate, endDate },
      vatCollected,
      vatPaid,
      netVatPayable,
      invoiceCount: invoices.length,
      expenseCount: expenses.length,
      message: `Q period ${startDate} to ${endDate}: Collected AED ${vatCollected.toLocaleString()}, Paid AED ${vatPaid.toLocaleString()}, Net payable to FTA: AED ${netVatPayable.toLocaleString()}.`,
    };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// track_expense
// ═══════════════════════════════════════════════════

export const trackExpenseDefinition: ToolDefinition = {
  name: "track_expense",
  description:
    "Track agency expenses. Create expense records, list expenses by category or date range, or get a category summary. Use when logging business costs (marketing, portals, office, technology, etc.).",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "list", "summary"], description: "Action to perform" },
      category: {
        type: "string",
        enum: ["marketing", "portals", "photography", "office", "salaries", "transport", "technology", "licensing", "other"],
        description: "Expense category (required for create; used as filter for list/summary)",
      },
      description: { type: "string", description: "Description of the expense (required for create)" },
      amount: { type: "number", description: "Expense amount in AED (required for create)" },
      date: { type: "string", description: "Expense date (YYYY-MM-DD, required for create). Defaults to today." },
      vatAmount: { type: "number", description: "VAT portion of the expense in AED (optional, auto-calculated at 5% if omitted for vatable expenses)" },
      recurring: { type: "string", description: "Recurrence pattern if applicable: monthly, quarterly, annual" },
      vendor: { type: "string", description: "Vendor or supplier name" },
      startDate: { type: "string", description: "Filter by start date (YYYY-MM-DD, for list/summary)" },
      endDate: { type: "string", description: "Filter by end date (YYYY-MM-DD, for list/summary)" },
    },
    required: ["action"],
  },
};

export const trackExpenseExecutor: ToolExecutor = async (input, ctx) => {
  const {
    action, category, description, amount, date, vatAmount,
    recurring, vendor, startDate, endDate,
  } = input as {
    action: string;
    category?: string;
    description?: string;
    amount?: number;
    date?: string;
    vatAmount?: number;
    recurring?: string;
    vendor?: string;
    startDate?: string;
    endDate?: string;
  };

  const t = aygentExpenses;

  if (action === "create") {
    if (!category) return { error: "category is required to create an expense." };
    if (!description) return { error: "description is required to create an expense." };
    if (amount === undefined || amount === null) return { error: "amount is required to create an expense." };

    const effectiveDate = date ? new Date(date) : new Date();
    const effectiveVat = vatAmount ?? 0;

    const created = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        category,
        description,
        amount,
        vatAmount: effectiveVat,
        date: effectiveDate,
        recurring: recurring ?? null,
        vendor: vendor ?? null,
      })
      .returning();

    return {
      expense: created[0],
      message: `Expense recorded: ${category} — ${description} — AED ${amount.toLocaleString()}${effectiveVat > 0 ? ` (+VAT AED ${effectiveVat.toLocaleString()})` : ""}.`,
    };
  }

  if (action === "list") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (category) conditions.push(eq(t.category, category));
    if (startDate) conditions.push(gte(t.date, new Date(startDate)));
    if (endDate) conditions.push(lte(t.date, new Date(endDate)));

    const expenses = await ctx.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(desc(t.date))
      .limit(100);

    const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
    const totalVat = expenses.reduce((s, e) => s + (e.vatAmount ?? 0), 0);

    return {
      expenses: expenses.map((e) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: e.amount,
        vatAmount: e.vatAmount ?? 0,
        date: e.date.toISOString().split("T")[0],
        recurring: e.recurring,
        vendor: e.vendor,
      })),
      total: expenses.length,
      totalAmount,
      totalVat,
    };
  }

  if (action === "summary") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (category) conditions.push(eq(t.category, category));
    if (startDate) conditions.push(gte(t.date, new Date(startDate)));
    if (endDate) conditions.push(lte(t.date, new Date(endDate)));

    const expenses = await ctx.db
      .select()
      .from(t)
      .where(and(...conditions));

    const byCategory: Record<string, { count: number; total: number; vatTotal: number }> = {};
    let grandTotal = 0;
    let grandVat = 0;

    for (const e of expenses) {
      if (!byCategory[e.category]) byCategory[e.category] = { count: 0, total: 0, vatTotal: 0 };
      byCategory[e.category]!.count++;
      byCategory[e.category]!.total += e.amount;
      byCategory[e.category]!.vatTotal += e.vatAmount ?? 0;
      grandTotal += e.amount;
      grandVat += e.vatAmount ?? 0;
    }

    return {
      byCategory,
      grandTotal,
      grandVat,
      expenseCount: expenses.length,
      message: `Total expenses: AED ${grandTotal.toLocaleString()} (incl. VAT AED ${grandVat.toLocaleString()}) across ${expenses.length} records in ${Object.keys(byCategory).length} categories.`,
    };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// get_agency_pnl
// ═══════════════════════════════════════════════════

export const getAgencyPnlDefinition: ToolDefinition = {
  name: "get_agency_pnl",
  description:
    "Get the agency P&L report for a given date range. Includes: collected commissions, other invoice revenue, expenses by category, agent AI compute costs, net profit, and margin. Use when the owner or CEO wants a financial overview.",
  input_schema: {
    type: "object",
    properties: {
      startDate: { type: "string", description: "Start of reporting period (YYYY-MM-DD)" },
      endDate: { type: "string", description: "End of reporting period (YYYY-MM-DD)" },
    },
    required: ["startDate", "endDate"],
  },
};

export const getAgencyPnlExecutor: ToolExecutor = async (input, ctx) => {
  const { startDate, endDate } = input as { startDate: string; endDate: string };

  const start = new Date(startDate);
  const end = new Date(endDate);

  // --- REVENUE ---

  // 1. Collected commissions (paidDate in range)
  const collectedCommissions = await ctx.db
    .select()
    .from(aygentCommissions)
    .where(
      and(
        eq(aygentCommissions.companyId, ctx.companyId),
        eq(aygentCommissions.status, "collected"),
        gte(aygentCommissions.paidDate!, start),
        lte(aygentCommissions.paidDate!, end),
      ),
    );

  const commissionRevenue = collectedCommissions.reduce((s, c) => s + c.grossAmount, 0);
  const commissionVatCollected = collectedCommissions.reduce((s, c) => s + (c.vatAmount ?? 0), 0);

  // 2. Other paid invoices (non-commission) with paidDate in range
  const otherInvoices = await ctx.db
    .select()
    .from(aygentInvoices)
    .where(
      and(
        eq(aygentInvoices.companyId, ctx.companyId),
        eq(aygentInvoices.status, "paid"),
        ne(aygentInvoices.invoiceType, "commission"),
        gte(aygentInvoices.paidDate!, start),
        lte(aygentInvoices.paidDate!, end),
      ),
    );

  const otherInvoiceRevenue = otherInvoices.reduce((s, inv) => s + inv.amount, 0);

  const totalRevenue = commissionRevenue + otherInvoiceRevenue;

  // Revenue breakdown by commission deal type
  const commissionByType: Record<string, number> = {};
  for (const c of collectedCommissions) {
    if (!commissionByType[c.dealType]) commissionByType[c.dealType] = 0;
    commissionByType[c.dealType]! += c.grossAmount;
  }

  // --- EXPENSES ---
  const expenses = await ctx.db
    .select()
    .from(aygentExpenses)
    .where(
      and(
        eq(aygentExpenses.companyId, ctx.companyId),
        gte(aygentExpenses.date, start),
        lte(aygentExpenses.date, end),
      ),
    );

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const expensesByCategory: Record<string, number> = {};
  for (const e of expenses) {
    if (!expensesByCategory[e.category]) expensesByCategory[e.category] = 0;
    expensesByCategory[e.category]! += e.amount;
  }

  // --- AI COMPUTE COSTS ---
  const computeRows = await ctx.db
    .select({ costCents: costEvents.costCents })
    .from(costEvents)
    .where(
      and(
        eq(costEvents.companyId, ctx.companyId),
        gte(costEvents.occurredAt, start),
        lte(costEvents.occurredAt, end),
      ),
    );

  const computeCostUsd = computeRows.reduce((s, r) => s + r.costCents, 0) / 100;
  // Convert to AED (approx 3.67 per USD) for reporting consistency
  const computeCostAed = Math.round(computeCostUsd * 3.67);

  // --- PROFIT ---
  const totalCosts = totalExpenses + computeCostAed;
  const netProfit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const result = {
    period: { startDate, endDate },
    revenue: {
      commissions: commissionRevenue,
      commissionsByDealType: commissionByType,
      commissionCount: collectedCommissions.length,
      otherInvoices: otherInvoiceRevenue,
      otherInvoiceCount: otherInvoices.length,
      total: totalRevenue,
    },
    expenses: {
      byCategory: expensesByCategory,
      total: totalExpenses,
      count: expenses.length,
    },
    computeCost: {
      usd: Math.round(computeCostUsd * 100) / 100,
      aed: computeCostAed,
      eventCount: computeRows.length,
    },
    summary: {
      totalRevenue,
      totalCosts,
      netProfit,
      marginPct: margin,
    },
    vatPosition: {
      vatCollectedOnCommissions: commissionVatCollected,
      note: "Run calculate_vat quarterly_summary for full VAT position including expenses.",
    },
    message: `P&L ${startDate} → ${endDate}: Revenue AED ${totalRevenue.toLocaleString()}, Costs AED ${totalCosts.toLocaleString()}, Net profit AED ${netProfit.toLocaleString()} (${margin}% margin).`,
  };

  const deliverableId = ctx.issueId
    ? await storeDeliverable(ctx, {
        type: "pnl_report",
        title: `P&L Report ${startDate} to ${endDate}`,
        summary: result.message,
        metadata: { result },
      })
    : null;

  return { ...result, deliverableId };
};
