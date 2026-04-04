import { eq, and, desc, lte, gte, sql } from "drizzle-orm";
import {
  aygentRentCheques,
  aygentMaintenanceRequests,
  aygentTenancies,
  aygentLandlords,
  aygentProperties,
  aygentComplianceChecks,
} from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import { storeDeliverable } from "./lib/deliverables.js";

// ═══════════════════════════════════════════════════
// track_rent_cheques
// ═══════════════════════════════════════════════════

export const trackRentChequesDefinition: ToolDefinition = {
  name: "track_rent_cheques",
  description:
    "Track rent cheques for a tenancy. Create a single cheque or auto-generate a series, update cheque status, list cheques by tenancy/status, or check for overdue cheques. Use when managing rental payment schedules.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "update", "list", "check_overdue"],
        description: "Action to perform",
      },
      tenancyId: { type: "string", description: "Tenancy ID (required for create and list)" },
      chequeId: { type: "string", description: "Cheque ID (required for update)" },
      chequeNumber: { type: "string", description: "Cheque number (for single create)" },
      amount: { type: "number", description: "Cheque amount in AED (for single create)" },
      dueDate: { type: "string", description: "Due date (YYYY-MM-DD, for single create)" },
      bankName: { type: "string", description: "Bank name (for create)" },
      count: {
        type: "number",
        description: "Number of cheques to auto-generate in a series (e.g. 4 for quarterly)",
      },
      startDate: {
        type: "string",
        description: "Start date for series generation (YYYY-MM-DD)",
      },
      frequency: {
        type: "string",
        enum: ["monthly", "quarterly"],
        description: "Frequency for series generation",
      },
      status: {
        type: "string",
        enum: ["pending", "deposited", "cleared", "bounced"],
        description: "Filter by status (list) or new status (update)",
      },
      date: {
        type: "string",
        description:
          "Date for the status change — depositedDate, clearedDate, or bouncedDate (YYYY-MM-DD, for update)",
      },
      notes: { type: "string", description: "Notes about this cheque" },
    },
    required: ["action"],
  },
};

export const trackRentChequesExecutor: ToolExecutor = async (input, ctx) => {
  const {
    action,
    tenancyId,
    chequeId,
    chequeNumber,
    amount,
    dueDate,
    bankName,
    count,
    startDate,
    frequency,
    status,
    date,
    notes,
  } = input as {
    action: string;
    tenancyId?: string;
    chequeId?: string;
    chequeNumber?: string;
    amount?: number;
    dueDate?: string;
    bankName?: string;
    count?: number;
    startDate?: string;
    frequency?: "monthly" | "quarterly";
    status?: string;
    date?: string;
    notes?: string;
  };

  const t = aygentRentCheques;

  if (action === "create") {
    if (!tenancyId) return { error: "tenancyId is required for create." };

    // Series creation
    if (count && count > 1) {
      if (!startDate) return { error: "startDate is required for series creation." };
      if (!amount) return { error: "amount is required for series creation." };
      if (!frequency) return { error: "frequency is required for series creation." };

      const intervalMonths = frequency === "monthly" ? 1 : 3;
      const start = new Date(startDate);
      const created = [];

      for (let i = 0; i < count; i++) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + i * intervalMonths);

        const row = await ctx.db
          .insert(t)
          .values({
            companyId: ctx.companyId,
            tenancyId,
            chequeNumber: chequeNumber ? `${chequeNumber}-${i + 1}` : `CHQ-${i + 1}`,
            amount: Math.round(amount),
            dueDate: due,
            bankName: bankName ?? null,
            notes: notes ?? null,
          })
          .returning();

        created.push(row[0]);
      }

      return {
        cheques: created,
        message: `Created ${count} ${frequency} cheques starting ${startDate}. Total: AED ${(amount * count).toLocaleString()}.`,
      };
    }

    // Single cheque
    if (!chequeNumber) return { error: "chequeNumber is required for create." };
    if (amount === undefined) return { error: "amount is required for create." };
    if (!dueDate) return { error: "dueDate is required for create." };

    const created = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        tenancyId,
        chequeNumber,
        amount: Math.round(amount),
        dueDate: new Date(dueDate),
        bankName: bankName ?? null,
        notes: notes ?? null,
      })
      .returning();

    return {
      cheque: created[0],
      message: `Cheque ${chequeNumber} created for AED ${amount.toLocaleString()}, due ${dueDate}.`,
    };
  }

  if (action === "update") {
    if (!chequeId) return { error: "chequeId is required for update." };
    if (!status) return { error: "status is required for update." };

    const updates: Record<string, unknown> = { status };
    const effectiveDate = date ? new Date(date) : new Date();

    if (status === "deposited") updates.depositedDate = effectiveDate;
    if (status === "cleared") updates.clearedDate = effectiveDate;
    if (status === "bounced") updates.bouncedDate = effectiveDate;
    if (notes) updates.notes = notes;

    const updated = await ctx.db
      .update(t)
      .set(updates)
      .where(and(eq(t.id, chequeId), eq(t.companyId, ctx.companyId)))
      .returning();

    if (updated.length === 0) return { error: "Cheque not found." };

    const cheque = updated[0]!;
    let message = `Cheque ${cheque.chequeNumber} marked as ${status}.`;
    if (status === "bounced") {
      message += " WARNING: Bounced cheque — consider escalating to landlord and issuing legal notice.";
    }

    return { cheque, message };
  }

  if (action === "list") {
    if (!tenancyId) return { error: "tenancyId is required for list." };

    const conditions = [eq(t.companyId, ctx.companyId), eq(t.tenancyId, tenancyId)];
    if (status) conditions.push(eq(t.status, status));

    const cheques = await ctx.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(t.dueDate);

    // Calculate totals per status
    const totals: Record<string, number> = {};
    for (const c of cheques) {
      totals[c.status] = (totals[c.status] ?? 0) + c.amount;
    }

    return {
      cheques: cheques.map((c) => ({
        id: c.id,
        chequeNumber: c.chequeNumber,
        amount: c.amount,
        dueDate: c.dueDate.toISOString().split("T")[0],
        status: c.status,
        bankName: c.bankName,
        depositedDate: c.depositedDate?.toISOString().split("T")[0] ?? null,
        clearedDate: c.clearedDate?.toISOString().split("T")[0] ?? null,
        bouncedDate: c.bouncedDate?.toISOString().split("T")[0] ?? null,
      })),
      total_cheques: cheques.length,
      totals_by_status: totals,
    };
  }

  if (action === "check_overdue") {
    const now = new Date();

    const overdue = await ctx.db
      .select()
      .from(t)
      .where(
        and(
          eq(t.companyId, ctx.companyId),
          eq(t.status, "pending"),
          lte(t.dueDate, now),
        ),
      )
      .orderBy(t.dueDate);

    const result = overdue.map((c) => {
      const daysOverdue = Math.floor(
        (now.getTime() - c.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: c.id,
        tenancyId: c.tenancyId,
        chequeNumber: c.chequeNumber,
        amount: c.amount,
        dueDate: c.dueDate.toISOString().split("T")[0],
        bankName: c.bankName,
        days_overdue: daysOverdue,
      };
    });

    const totalOverdue = result.reduce((sum, c) => sum + c.amount, 0);

    return {
      overdue_cheques: result,
      count: result.length,
      total_overdue_aed: totalOverdue,
      message:
        result.length === 0
          ? "No overdue cheques."
          : `${result.length} overdue cheque(s) totalling AED ${totalOverdue.toLocaleString()}.`,
    };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// collect_rent_payment
// ═══════════════════════════════════════════════════

export const collectRentPaymentDefinition: ToolDefinition = {
  name: "collect_rent_payment",
  description:
    "Record a rent payment against a cheque (deposited, cleared, or bounced) or list all rent arrears grouped by landlord. Use when a landlord reports a payment received or when reviewing overdue rent.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["record", "list_arrears"],
        description: "Action to perform",
      },
      chequeId: { type: "string", description: "Cheque ID to update (required for record)" },
      newStatus: {
        type: "string",
        enum: ["deposited", "cleared", "bounced"],
        description: "New payment status (required for record)",
      },
      date: {
        type: "string",
        description: "Date of the status change (YYYY-MM-DD, defaults to today)",
      },
    },
    required: ["action"],
  },
};

export const collectRentPaymentExecutor: ToolExecutor = async (input, ctx) => {
  const { action, chequeId, newStatus, date } = input as {
    action: string;
    chequeId?: string;
    newStatus?: string;
    date?: string;
  };

  const t = aygentRentCheques;

  if (action === "record") {
    if (!chequeId) return { error: "chequeId is required for record." };
    if (!newStatus) return { error: "newStatus is required for record." };

    const effectiveDate = date ? new Date(date) : new Date();
    const updates: Record<string, unknown> = { status: newStatus };

    if (newStatus === "deposited") updates.depositedDate = effectiveDate;
    if (newStatus === "cleared") updates.clearedDate = effectiveDate;
    if (newStatus === "bounced") updates.bouncedDate = effectiveDate;

    const updated = await ctx.db
      .update(t)
      .set(updates)
      .where(and(eq(t.id, chequeId), eq(t.companyId, ctx.companyId)))
      .returning();

    if (updated.length === 0) return { error: "Cheque not found." };

    const cheque = updated[0]!;

    if (newStatus === "bounced") {
      return {
        cheque,
        status: "bounced",
        warning: `Cheque ${cheque.chequeNumber} for AED ${cheque.amount.toLocaleString()} has bounced. Suggested actions: 1) Notify landlord immediately. 2) Issue a formal notice to tenant. 3) Request replacement cheque + penalty fee. 4) Escalate if tenant is unresponsive.`,
      };
    }

    return {
      cheque,
      status: newStatus,
      message: `Cheque ${cheque.chequeNumber} for AED ${cheque.amount.toLocaleString()} marked as ${newStatus} on ${effectiveDate.toISOString().split("T")[0]}.`,
    };
  }

  if (action === "list_arrears") {
    const now = new Date();

    const overdue = await ctx.db
      .select()
      .from(t)
      .where(
        and(
          eq(t.companyId, ctx.companyId),
          eq(t.status, "pending"),
          lte(t.dueDate, now),
        ),
      )
      .orderBy(t.dueDate);

    if (overdue.length === 0) {
      return { arrears: [], total_arrears_aed: 0, message: "No rent arrears." };
    }

    // Get tenancies to resolve landlord
    const tenancyIds = [...new Set(overdue.map((c) => c.tenancyId))];

    const tenancies = await ctx.db
      .select({
        id: aygentTenancies.id,
        tenantName: aygentTenancies.tenantName,
        managedPropertyId: aygentTenancies.managedPropertyId,
      })
      .from(aygentTenancies)
      .where(
        and(
          eq(aygentTenancies.companyId, ctx.companyId),
          sql`${aygentTenancies.id} = ANY(${sql.raw(`ARRAY[${tenancyIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
        ),
      );

    const tenancyMap = new Map(tenancies.map((t) => [t.id, t]));
    const propertyIds = [...new Set(tenancies.map((t) => t.managedPropertyId))];

    const properties = await ctx.db
      .select({
        id: aygentProperties.id,
        unit: aygentProperties.unit,
        buildingName: aygentProperties.buildingName,
        area: aygentProperties.area,
        landlordId: aygentProperties.landlordId,
      })
      .from(aygentProperties)
      .where(
        and(
          eq(aygentProperties.companyId, ctx.companyId),
          sql`${aygentProperties.id} = ANY(${sql.raw(`ARRAY[${propertyIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
        ),
      );

    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    const landlordIds = [...new Set(properties.map((p) => p.landlordId).filter(Boolean) as string[])];

    const landlords = landlordIds.length > 0
      ? await ctx.db
          .select({ id: aygentLandlords.id, name: aygentLandlords.name })
          .from(aygentLandlords)
          .where(
            and(
              eq(aygentLandlords.companyId, ctx.companyId),
              sql`${aygentLandlords.id} = ANY(${sql.raw(`ARRAY[${landlordIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
            ),
          )
      : [];

    const landlordMap = new Map(landlords.map((l) => [l.id, l.name]));

    // Group arrears by landlord
    const byLandlord: Record<
      string,
      { landlordName: string; total_arrears: number; cheques: unknown[] }
    > = {};

    for (const cheque of overdue) {
      const tenancy = tenancyMap.get(cheque.tenancyId);
      const property = tenancy ? propertyMap.get(tenancy.managedPropertyId) : undefined;
      const landlordId = property?.landlordId ?? "unknown";
      const landlordName = landlordId !== "unknown" ? (landlordMap.get(landlordId) ?? "Unknown Landlord") : "Unknown Landlord";

      if (!byLandlord[landlordId]) {
        byLandlord[landlordId] = { landlordName, total_arrears: 0, cheques: [] };
      }

      const daysOverdue = Math.floor((now.getTime() - cheque.dueDate.getTime()) / (1000 * 60 * 60 * 24));

      byLandlord[landlordId]!.total_arrears += cheque.amount;
      byLandlord[landlordId]!.cheques.push({
        chequeId: cheque.id,
        chequeNumber: cheque.chequeNumber,
        amount: cheque.amount,
        dueDate: cheque.dueDate.toISOString().split("T")[0],
        days_overdue: daysOverdue,
        property: property
          ? `${property.unit ?? ""} ${property.buildingName ?? ""} ${property.area ?? ""}`.trim()
          : null,
        tenantName: tenancy?.tenantName ?? null,
      });
    }

    const totalArrears = overdue.reduce((sum, c) => sum + c.amount, 0);

    return {
      arrears: Object.values(byLandlord),
      total_arrears_aed: totalArrears,
      landlord_count: Object.keys(byLandlord).length,
      cheque_count: overdue.length,
    };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// generate_landlord_statement
// ═══════════════════════════════════════════════════

export const generateLandlordStatementDefinition: ToolDefinition = {
  name: "generate_landlord_statement",
  description:
    "Generate a financial statement for a landlord covering a date range. Shows gross rent collected, management fees, maintenance costs, and net payout. Stores as a deliverable. Use when a landlord requests their monthly/quarterly statement.",
  input_schema: {
    type: "object",
    properties: {
      landlordId: { type: "string", description: "Landlord ID (required)" },
      startDate: { type: "string", description: "Statement start date (YYYY-MM-DD, required)" },
      endDate: { type: "string", description: "Statement end date (YYYY-MM-DD, required)" },
      managementFeePct: {
        type: "number",
        description: "Management fee percentage (default 5)",
      },
    },
    required: ["landlordId", "startDate", "endDate"],
  },
};

export const generateLandlordStatementExecutor: ToolExecutor = async (input, ctx) => {
  const { landlordId, startDate, endDate, managementFeePct = 5 } = input as {
    landlordId: string;
    startDate: string;
    endDate: string;
    managementFeePct?: number;
  };

  const start = new Date(startDate);
  const end = new Date(endDate);

  // 1. Get landlord details
  const landlordRows = await ctx.db
    .select()
    .from(aygentLandlords)
    .where(and(eq(aygentLandlords.id, landlordId), eq(aygentLandlords.companyId, ctx.companyId)))
    .limit(1);

  if (landlordRows.length === 0) return { error: "Landlord not found." };
  const landlord = landlordRows[0]!;

  // 2. Get all properties for this landlord
  const properties = await ctx.db
    .select()
    .from(aygentProperties)
    .where(
      and(
        eq(aygentProperties.companyId, ctx.companyId),
        eq(aygentProperties.landlordId, landlordId),
      ),
    );

  if (properties.length === 0) {
    return { error: "No properties found for this landlord." };
  }

  const propertyIds = properties.map((p) => p.id);

  // 3. Get active tenancies for these properties
  const allTenancies = propertyIds.length > 0
    ? await ctx.db
        .select()
        .from(aygentTenancies)
        .where(
          and(
            eq(aygentTenancies.companyId, ctx.companyId),
            sql`${aygentTenancies.managedPropertyId} = ANY(${sql.raw(`ARRAY[${propertyIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
          ),
        )
    : [];

  const tenancyIds = allTenancies.map((t) => t.id);

  // 4. Get cleared cheques in the date range
  const clearedCheques = tenancyIds.length > 0
    ? await ctx.db
        .select()
        .from(aygentRentCheques)
        .where(
          and(
            eq(aygentRentCheques.companyId, ctx.companyId),
            eq(aygentRentCheques.status, "cleared"),
            sql`${aygentRentCheques.tenancyId} = ANY(${sql.raw(`ARRAY[${tenancyIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
            gte(aygentRentCheques.dueDate, start),
            lte(aygentRentCheques.dueDate, end),
          ),
        )
    : [];

  // 5. Get completed maintenance costs in the date range
  const maintenanceCosts = propertyIds.length > 0
    ? await ctx.db
        .select()
        .from(aygentMaintenanceRequests)
        .where(
          and(
            eq(aygentMaintenanceRequests.companyId, ctx.companyId),
            eq(aygentMaintenanceRequests.status, "completed"),
            sql`${aygentMaintenanceRequests.propertyId} = ANY(${sql.raw(`ARRAY[${propertyIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
            gte(aygentMaintenanceRequests.completedDate, start),
            lte(aygentMaintenanceRequests.completedDate, end),
          ),
        )
    : [];

  // 6. Calculate financials
  const grossRentCollected = clearedCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalMaintenanceCosts = maintenanceCosts.reduce(
    (sum, m) => sum + (m.actualCost ?? 0),
    0,
  );
  const managementFee = Math.round(grossRentCollected * (managementFeePct / 100));
  const netPayout = grossRentCollected - managementFee - totalMaintenanceCosts;

  // 7. Build per-property breakdown
  const tenancyMap = new Map(allTenancies.map((t) => [t.id, t]));
  const propertyBreakdown = properties.map((prop) => {
    const propTenancies = allTenancies.filter((t) => t.managedPropertyId === prop.id);
    const propTenancyIds = new Set(propTenancies.map((t) => t.id));
    const propCheques = clearedCheques.filter((c) => propTenancyIds.has(c.tenancyId));
    const propMaintenance = maintenanceCosts.filter((m) => m.propertyId === prop.id);
    const propRent = propCheques.reduce((sum, c) => sum + c.amount, 0);
    const propMaintCost = propMaintenance.reduce((sum, m) => sum + (m.actualCost ?? 0), 0);
    const activeTenancy = propTenancies.find((t) => t.status === "active") ?? propTenancies[0];

    return {
      propertyId: prop.id,
      property: `${prop.unit ?? ""} ${prop.buildingName ?? ""} ${prop.area ?? ""}`.trim(),
      tenant: activeTenancy?.tenantName ?? "Vacant",
      rent_collected: propRent,
      maintenance_costs: propMaintCost,
      cheque_count: propCheques.length,
      maintenance_jobs: propMaintenance.length,
    };
  });

  const statement = {
    landlord: {
      id: landlord.id,
      name: landlord.name,
      phone: landlord.phone,
      email: landlord.email,
    },
    period: { start: startDate, end: endDate },
    properties_count: properties.length,
    financials: {
      gross_rent_collected: grossRentCollected,
      management_fee: managementFee,
      management_fee_pct: managementFeePct,
      maintenance_costs: totalMaintenanceCosts,
      net_payout: netPayout,
    },
    property_breakdown: propertyBreakdown,
    cheques_cleared: clearedCheques.length,
    maintenance_jobs_completed: maintenanceCosts.length,
  };

  const deliverableId = ctx.issueId
    ? await storeDeliverable(ctx, {
        type: "landlord_statement",
        title: `Landlord Statement — ${landlord.name} (${startDate} to ${endDate})`,
        summary: `Gross rent: AED ${grossRentCollected.toLocaleString()}. Mgmt fee: AED ${managementFee.toLocaleString()}. Maintenance: AED ${totalMaintenanceCosts.toLocaleString()}. Net payout: AED ${netPayout.toLocaleString()}.`,
        metadata: { toolInput: input, statement },
      })
    : null;

  return { ...statement, deliverableId };
};

// ═══════════════════════════════════════════════════
// create_maintenance_request
// ═══════════════════════════════════════════════════

export const createMaintenanceRequestDefinition: ToolDefinition = {
  name: "create_maintenance_request",
  description:
    "Manage property maintenance requests. Create a new request, update its status/contractor/cost, list requests by property or status, or get a single request. Use when a tenant reports an issue or when tracking repair work.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["create", "update", "list", "get"],
        description: "Action to perform",
      },
      requestId: { type: "string", description: "Request ID (required for update and get)" },
      propertyId: { type: "string", description: "Property ID (required for create; filter for list)" },
      tenancyId: { type: "string", description: "Tenancy ID (optional for create)" },
      category: {
        type: "string",
        description:
          "Maintenance category: plumbing, electrical, ac, painting, pest, general, other",
      },
      description: { type: "string", description: "Description of the issue (required for create)" },
      priority: {
        type: "string",
        enum: ["low", "medium", "high", "urgent"],
        description: "Priority level (default: medium)",
      },
      status: {
        type: "string",
        enum: ["open", "assigned", "in_progress", "completed", "cancelled"],
        description: "Filter by status (list) or new status (update)",
      },
      contractorName: { type: "string", description: "Contractor name (for update)" },
      contractorPhone: { type: "string", description: "Contractor phone (for update)" },
      estimatedCost: { type: "number", description: "Estimated repair cost in AED (for update)" },
      actualCost: { type: "number", description: "Actual repair cost in AED (for update)" },
      completedDate: {
        type: "string",
        description: "Completion date (YYYY-MM-DD, for update when marking completed)",
      },
      notes: { type: "string", description: "Notes about this request" },
    },
    required: ["action"],
  },
};

export const createMaintenanceRequestExecutor: ToolExecutor = async (input, ctx) => {
  const {
    action,
    requestId,
    propertyId,
    tenancyId,
    category,
    description,
    priority,
    status,
    contractorName,
    contractorPhone,
    estimatedCost,
    actualCost,
    completedDate,
    notes,
  } = input as {
    action: string;
    requestId?: string;
    propertyId?: string;
    tenancyId?: string;
    category?: string;
    description?: string;
    priority?: string;
    status?: string;
    contractorName?: string;
    contractorPhone?: string;
    estimatedCost?: number;
    actualCost?: number;
    completedDate?: string;
    notes?: string;
  };

  const t = aygentMaintenanceRequests;

  if (action === "create") {
    if (!propertyId) return { error: "propertyId is required for create." };
    if (!category) return { error: "category is required for create." };
    if (!description) return { error: "description is required for create." };

    const created = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        propertyId,
        tenancyId: tenancyId ?? null,
        category,
        description,
        priority: priority ?? "medium",
        notes: notes ?? null,
      })
      .returning();

    return {
      request: created[0],
      message: `Maintenance request created for ${category} issue. Priority: ${priority ?? "medium"}.`,
    };
  }

  if (action === "update") {
    if (!requestId) return { error: "requestId is required for update." };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (contractorName) updates.contractorName = contractorName;
    if (contractorPhone) updates.contractorPhone = contractorPhone;
    if (estimatedCost !== undefined) updates.estimatedCost = Math.round(estimatedCost);
    if (actualCost !== undefined) updates.actualCost = Math.round(actualCost);
    if (completedDate) updates.completedDate = new Date(completedDate);
    if (notes) updates.notes = notes;

    if (status === "assigned" && contractorName) {
      updates.assignedDate = new Date();
    }

    const updated = await ctx.db
      .update(t)
      .set(updates)
      .where(and(eq(t.id, requestId), eq(t.companyId, ctx.companyId)))
      .returning();

    if (updated.length === 0) return { error: "Maintenance request not found." };

    return { request: updated[0], message: "Maintenance request updated." };
  }

  if (action === "list") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (propertyId) conditions.push(eq(t.propertyId, propertyId));
    if (status) conditions.push(eq(t.status, status));
    if (priority) conditions.push(eq(t.priority, priority));

    const requests = await ctx.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(
        // Priority order: urgent > high > medium > low
        sql`CASE ${t.priority}
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END`,
        desc(t.createdAt),
      )
      .limit(50);

    return {
      requests: requests.map((r) => ({
        id: r.id,
        propertyId: r.propertyId,
        tenancyId: r.tenancyId,
        category: r.category,
        description: r.description,
        priority: r.priority,
        status: r.status,
        contractorName: r.contractorName,
        estimatedCost: r.estimatedCost,
        actualCost: r.actualCost,
        completedDate: r.completedDate?.toISOString().split("T")[0] ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total: requests.length,
    };
  }

  if (action === "get") {
    if (!requestId) return { error: "requestId is required for get." };

    const results = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.id, requestId), eq(t.companyId, ctx.companyId)))
      .limit(1);

    if (results.length === 0) return { error: "Maintenance request not found." };
    return { request: results[0] };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// screen_tenant
// ═══════════════════════════════════════════════════

export const screenTenantDefinition: ToolDefinition = {
  name: "screen_tenant",
  description:
    "Screen a prospective tenant by calculating their rent-to-income ratio and creating a KYC compliance check record. Returns a recommendation (APPROVE / REVIEW / REJECT), risk level, and required documents checklist. Use before accepting a new tenancy.",
  input_schema: {
    type: "object",
    properties: {
      tenantName: { type: "string", description: "Full name of prospective tenant (required)" },
      employerName: { type: "string", description: "Employer or company name" },
      monthlyIncome: { type: "number", description: "Monthly income in AED (required)" },
      requestedRent: {
        type: "number",
        description: "Requested annual rent in AED (required)",
      },
      nationality: { type: "string", description: "Tenant nationality" },
      passportNumber: { type: "string", description: "Passport number" },
      emiratesId: { type: "string", description: "Emirates ID number" },
    },
    required: ["tenantName", "monthlyIncome", "requestedRent"],
  },
};

export const screenTenantExecutor: ToolExecutor = async (input, ctx) => {
  const {
    tenantName,
    employerName,
    monthlyIncome,
    requestedRent,
    nationality,
    passportNumber,
    emiratesId,
  } = input as {
    tenantName: string;
    employerName?: string;
    monthlyIncome: number;
    requestedRent: number;
    nationality?: string;
    passportNumber?: string;
    emiratesId?: string;
  };

  // Calculate rent-to-income ratio
  const monthlyRent = requestedRent / 12;
  const ratio = monthlyRent / monthlyIncome;
  const ratioFormatted = Math.round(ratio * 1000) / 10; // e.g. 28.5%

  let recommendation: "APPROVE" | "REVIEW" | "REJECT";
  let riskLevel: "low" | "medium" | "high";
  let rationale: string;

  if (ratio < 0.3) {
    recommendation = "APPROVE";
    riskLevel = "low";
    rationale = `Rent-to-income ratio is ${ratioFormatted}% (below 30%). Tenant can comfortably afford this property.`;
  } else if (ratio <= 0.4) {
    recommendation = "REVIEW";
    riskLevel = "medium";
    rationale = `Rent-to-income ratio is ${ratioFormatted}% (30–40%). Tenant may qualify with additional security deposit or guarantor.`;
  } else {
    recommendation = "REJECT";
    riskLevel = "high";
    rationale = `Rent-to-income ratio is ${ratioFormatted}% (above 40%). Monthly rent of AED ${Math.round(monthlyRent).toLocaleString()} exceeds 40% of monthly income of AED ${monthlyIncome.toLocaleString()}. Income insufficient.`;
  }

  const requiredDocuments = {
    passport: false,
    visa: false,
    emirates_id: false,
    employment_letter: false,
    salary_certificate: false,
    bank_statements_3months: false,
  };

  // Create compliance check record
  const check = await ctx.db
    .insert(aygentComplianceChecks)
    .values({
      companyId: ctx.companyId,
      clientName: tenantName,
      clientType: "tenant",
      checkType: "kyc",
      status: recommendation === "APPROVE" ? "pending" : recommendation === "REVIEW" ? "pending" : "flagged",
      nationality: nationality ?? null,
      passportNumber: passportNumber ?? null,
      emiratesId: emiratesId ?? null,
      riskLevel,
      documentsCollected: requiredDocuments,
      flagReason:
        recommendation === "REJECT"
          ? `High rent-to-income ratio: ${ratioFormatted}%`
          : recommendation === "REVIEW"
          ? `Moderate rent-to-income ratio: ${ratioFormatted}% — requires further review`
          : null,
    })
    .returning();

  return {
    compliance_check_id: check[0]?.id ?? null,
    tenant: tenantName,
    employer: employerName ?? null,
    recommendation,
    risk_level: riskLevel,
    calculation: {
      monthly_income: monthlyIncome,
      annual_rent: requestedRent,
      monthly_rent: Math.round(monthlyRent),
      rent_to_income_ratio_pct: ratioFormatted,
    },
    rationale,
    required_documents: requiredDocuments,
    next_steps:
      recommendation === "APPROVE"
        ? "Tenant financially qualifies. Proceed to collect required documents and prepare tenancy contract."
        : recommendation === "REVIEW"
        ? "Request additional security deposit (2+ months) or a UAE-based guarantor. Collect full document set before proceeding."
        : "Do not proceed with this tenancy. Inform the landlord and suggest looking for a tenant with lower rent-to-income requirements.",
  };
};
