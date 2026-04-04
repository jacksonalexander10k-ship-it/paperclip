import { eq, and, ilike, desc } from "drizzle-orm";
import {
  aygentLandlords,
  aygentProperties,
  aygentTenancies,
} from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import { storeDeliverable } from "./lib/deliverables.js";

// ═══════════════════════════════════════════════════
// manage_landlord
// ═══════════════════════════════════════════════════

export const manageLandlordDefinition: ToolDefinition = {
  name: "manage_landlord",
  description:
    "Manage landlords in the agent's rental portfolio. Create, update, list, or view landlord details with their properties and tenants. Use when agent mentions landlords, property owners, or rental portfolio.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", "list", "get"], description: "Action to perform" },
      landlordId: { type: "string", description: "Landlord ID (for update/get)" },
      name: { type: "string", description: "Landlord's full name" },
      phone: { type: "string", description: "Landlord's phone number" },
      email: { type: "string", description: "Landlord's email" },
      address: { type: "string", description: "Landlord's address" },
      dob: { type: "string", description: "Date of birth (DD/MM/YYYY)" },
      passport: { type: "string", description: "Passport number" },
      emiratesId: { type: "string", description: "Emirates ID number" },
      nationality: { type: "string", description: "Nationality" },
      notes: { type: "string", description: "Notes about the landlord" },
    },
    required: ["action"],
  },
};

export const manageLandlordExecutor: ToolExecutor = async (input, ctx) => {
  const { action, landlordId, name, phone, email, address, dob, passport, emiratesId, nationality, notes } = input as {
    action: string; landlordId?: string; name?: string; phone?: string;
    email?: string; address?: string; dob?: string; passport?: string;
    emiratesId?: string; nationality?: string; notes?: string;
  };

  const t = aygentLandlords;

  if (action === "list") {
    const landlords = await ctx.db
      .select()
      .from(t)
      .where(eq(t.companyId, ctx.companyId))
      .orderBy(desc(t.updatedAt));
    return {
      landlords: landlords.map((l) => ({
        id: l.id, name: l.name, phone: l.phone, email: l.email,
        nationality: l.nationality, notes: l.notes?.slice(0, 200) ?? null,
      })),
      total: landlords.length,
    };
  }

  if (action === "get" && landlordId) {
    const results = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.id, landlordId), eq(t.companyId, ctx.companyId)))
      .limit(1);
    if (results.length === 0) return { error: "Landlord not found." };

    // Get properties for this landlord
    const properties = await ctx.db
      .select()
      .from(aygentProperties)
      .where(and(eq(aygentProperties.landlordId, landlordId), eq(aygentProperties.companyId, ctx.companyId)));

    return { ...results[0], properties };
  }

  if (action === "create") {
    if (!name) return { error: "Name is required to create a landlord." };
    const created = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        name, phone, email, address, dob, passport, emiratesId, nationality, notes,
      })
      .returning();
    return { landlord: created[0], message: `Landlord "${name}" created.` };
  }

  if (action === "update" && landlordId) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (email) updates.email = email;
    if (address) updates.address = address;
    if (dob) updates.dob = dob;
    if (passport) updates.passport = passport;
    if (emiratesId) updates.emiratesId = emiratesId;
    if (nationality) updates.nationality = nationality;
    if (notes) updates.notes = notes;

    const updated = await ctx.db
      .update(t)
      .set(updates)
      .where(and(eq(t.id, landlordId), eq(t.companyId, ctx.companyId)))
      .returning();
    return { landlord: updated[0], message: "Landlord updated." };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// manage_property
// ═══════════════════════════════════════════════════

export const managePropertyDefinition: ToolDefinition = {
  name: "manage_property",
  description:
    "Create or update a managed property in the agent's rental portfolio. Properties belong to landlords. Use when agent mentions adding a property for a landlord, updating property details, or viewing their properties.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", description: "'create', 'update', 'list', or 'get'" },
      propertyId: { type: "string", description: "Property ID (for update/get)" },
      landlordId: { type: "string", description: "Landlord ID (for create — required)" },
      landlordName: { type: "string", description: "Landlord name (for create — will find-or-create)" },
      landlordPhone: { type: "string", description: "Landlord phone (used with landlordName)" },
      unit: { type: "string", description: "Unit identifier (e.g. 'Apt 1804, Marina Gate 2')" },
      area: { type: "string", description: "Area/community" },
      propertyType: { type: "string", description: "apartment, villa, townhouse, office, shop" },
      bedrooms: { type: "string", description: "Number of bedrooms" },
      saleValue: { type: "number", description: "Current market value in AED" },
      purchasePrice: { type: "number", description: "Purchase price in AED" },
      serviceCharge: { type: "number", description: "Annual service charge in AED" },
      status: { type: "string", description: "'occupied', 'vacant', 'notice_given'" },
      notes: { type: "string", description: "Any notes about the property" },
    },
    required: ["action"],
  },
};

export const managePropertyExecutor: ToolExecutor = async (input, ctx) => {
  const {
    action, propertyId, landlordId, landlordName, landlordPhone,
    unit, area, propertyType, bedrooms, saleValue, purchasePrice,
    serviceCharge, status, notes,
  } = input as {
    action: string; propertyId?: string; landlordId?: string;
    landlordName?: string; landlordPhone?: string;
    unit?: string; area?: string; propertyType?: string;
    bedrooms?: string; saleValue?: number; purchasePrice?: number;
    serviceCharge?: number; status?: string; notes?: string;
  };

  const t = aygentProperties;

  if (action === "list") {
    const conditions = [eq(t.companyId, ctx.companyId)];
    if (landlordId) conditions.push(eq(t.landlordId, landlordId));

    const properties = await ctx.db
      .select()
      .from(t)
      .where(and(...conditions))
      .orderBy(desc(t.updatedAt));
    return {
      properties: properties.map((p) => ({
        id: p.id, unit: p.unit, area: p.area, propertyType: p.propertyType,
        bedrooms: p.bedrooms, status: p.status, saleValue: p.saleValue,
        landlordId: p.landlordId,
      })),
      total: properties.length,
    };
  }

  if (action === "get" && propertyId) {
    const results = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.id, propertyId), eq(t.companyId, ctx.companyId)))
      .limit(1);
    if (results.length === 0) return { error: "Property not found." };

    // Get tenancies
    const tenancies = await ctx.db
      .select()
      .from(aygentTenancies)
      .where(eq(aygentTenancies.managedPropertyId, propertyId))
      .orderBy(desc(aygentTenancies.leaseStart));

    return { ...results[0], tenancies };
  }

  if (action === "create") {
    let resolvedLandlordId = landlordId;

    // Find-or-create landlord by name
    if (!resolvedLandlordId && landlordName) {
      const existing = await ctx.db
        .select()
        .from(aygentLandlords)
        .where(and(eq(aygentLandlords.companyId, ctx.companyId), ilike(aygentLandlords.name, landlordName)))
        .limit(1);

      if (existing.length > 0) {
        resolvedLandlordId = existing[0]!.id;
      } else {
        const created = await ctx.db
          .insert(aygentLandlords)
          .values({ companyId: ctx.companyId, name: landlordName, phone: landlordPhone ?? null })
          .returning();
        resolvedLandlordId = created[0]?.id;
      }
    }

    if (!resolvedLandlordId) return { error: "landlordId or landlordName is required." };

    const bedroomNum = bedrooms ? (bedrooms === "studio" ? 0 : parseInt(bedrooms, 10)) : null;
    const property = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        landlordId: resolvedLandlordId,
        unit, area,
        propertyType: propertyType ?? null,
        bedrooms: isNaN(bedroomNum!) ? null : bedroomNum,
        saleValue: saleValue ?? null,
        purchasePrice: purchasePrice ?? null,
        serviceCharge: serviceCharge ?? null,
        status: status ?? "vacant",
        notes,
      })
      .returning();

    return { property: property[0], message: "Property created." };
  }

  if (action === "update" && propertyId) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (unit) updates.unit = unit;
    if (area) updates.area = area;
    if (propertyType) updates.propertyType = propertyType;
    if (bedrooms) updates.bedrooms = bedrooms === "studio" ? 0 : parseInt(bedrooms, 10);
    if (saleValue !== undefined) updates.saleValue = saleValue;
    if (purchasePrice !== undefined) updates.purchasePrice = purchasePrice;
    if (serviceCharge !== undefined) updates.serviceCharge = serviceCharge;
    if (status) updates.status = status;
    if (notes) updates.notes = notes;

    const updated = await ctx.db
      .update(t)
      .set(updates)
      .where(and(eq(t.id, propertyId), eq(t.companyId, ctx.companyId)))
      .returning();
    return { property: updated[0], message: "Property updated." };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// manage_tenancy
// ═══════════════════════════════════════════════════

export const manageTenancyDefinition: ToolDefinition = {
  name: "manage_tenancy",
  description:
    "Manage tenancies for rental properties. Create new tenancies, renew leases, terminate leases, or view tenancy history with rent progression. Use when agent mentions tenants, leases, rent, Ejari, or tenancy management.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "renew", "terminate", "history"], description: "Action to perform" },
      propertyId: { type: "string", description: "Property ID" },
      tenancyId: { type: "string", description: "Tenancy ID (for renew/terminate)" },
      tenantName: { type: "string", description: "Tenant's full name" },
      tenantPhone: { type: "string", description: "Tenant's phone" },
      tenantEmail: { type: "string", description: "Tenant's email" },
      tenantPassport: { type: "string", description: "Tenant's passport number" },
      tenantEmiratesId: { type: "string", description: "Tenant's Emirates ID" },
      tenantNationality: { type: "string", description: "Tenant's nationality" },
      rent: { type: "number", description: "Annual rent in AED" },
      leaseStart: { type: "string", description: "Lease start date (YYYY-MM-DD)" },
      leaseEnd: { type: "string", description: "Lease end date (YYYY-MM-DD)" },
      securityDeposit: { type: "number", description: "Security deposit in AED" },
      paymentFrequency: { type: "string", enum: ["monthly", "quarterly", "semi_annual", "annual"], description: "Rent payment frequency" },
      ejariNumber: { type: "string", description: "Ejari registration number" },
      status: { type: "string", enum: ["active", "expired", "terminated", "renewed"], description: "Tenancy status override" },
    },
    required: ["action"],
  },
};

export const manageTenancyExecutor: ToolExecutor = async (input, ctx) => {
  const {
    action, propertyId, tenancyId, tenantName, tenantPhone, tenantEmail,
    tenantPassport, tenantEmiratesId, tenantNationality,
    rent, leaseStart, leaseEnd, securityDeposit, paymentFrequency, ejariNumber, status,
  } = input as {
    action: string; propertyId?: string; tenancyId?: string;
    tenantName?: string; tenantPhone?: string; tenantEmail?: string;
    tenantPassport?: string; tenantEmiratesId?: string; tenantNationality?: string;
    rent?: number; leaseStart?: string; leaseEnd?: string;
    securityDeposit?: number; paymentFrequency?: string; ejariNumber?: string; status?: string;
  };

  const t = aygentTenancies;

  if (action === "history") {
    if (!propertyId) return { error: "propertyId is required for history." };
    const tenancies = await ctx.db
      .select()
      .from(t)
      .where(and(eq(t.managedPropertyId, propertyId), eq(t.companyId, ctx.companyId)))
      .orderBy(desc(t.leaseStart));

    return {
      tenancies: tenancies.map((tn) => ({
        id: tn.id, tenantName: tn.tenantName, rent: tn.rent,
        leaseStart: tn.leaseStart?.toISOString().split("T")[0] ?? null,
        leaseEnd: tn.leaseEnd?.toISOString().split("T")[0] ?? null,
        status: tn.status, paymentFrequency: tn.paymentFrequency,
        ejariNumber: tn.ejariNumber,
      })),
      total: tenancies.length,
    };
  }

  if (action === "create") {
    if (!propertyId) return { error: "propertyId is required." };
    if (!tenantName) return { error: "tenantName is required." };

    const tenancy = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        managedPropertyId: propertyId,
        tenantName, tenantPhone, tenantEmail,
        tenantPassport, tenantEmiratesId, tenantNationality,
        rent: rent ?? null,
        leaseStart: leaseStart ? new Date(leaseStart) : null,
        leaseEnd: leaseEnd ? new Date(leaseEnd) : null,
        securityDeposit: securityDeposit ?? null,
        paymentFrequency: paymentFrequency ?? null,
        ejariNumber: ejariNumber ?? null,
        status: "active",
      })
      .returning();

    // Update property status to occupied
    await ctx.db
      .update(aygentProperties)
      .set({ status: "occupied", updatedAt: new Date() })
      .where(and(eq(aygentProperties.id, propertyId), eq(aygentProperties.companyId, ctx.companyId)));

    return { tenancy: tenancy[0], message: "Tenancy created. Property status set to occupied." };
  }

  if (action === "renew" && tenancyId) {
    // Mark old as renewed
    await ctx.db
      .update(t)
      .set({ status: "renewed", updatedAt: new Date() })
      .where(and(eq(t.id, tenancyId), eq(t.companyId, ctx.companyId)));

    // Get old tenancy for defaults
    const old = await ctx.db.select().from(t).where(eq(t.id, tenancyId)).limit(1);
    const prev = old[0];
    if (!prev) return { error: "Tenancy not found." };

    const newTenancy = await ctx.db
      .insert(t)
      .values({
        companyId: ctx.companyId,
        managedPropertyId: prev.managedPropertyId,
        tenantName: tenantName ?? prev.tenantName,
        tenantPhone: tenantPhone ?? prev.tenantPhone,
        tenantEmail: tenantEmail ?? prev.tenantEmail,
        tenantPassport: tenantPassport ?? prev.tenantPassport,
        tenantEmiratesId: tenantEmiratesId ?? prev.tenantEmiratesId,
        tenantNationality: tenantNationality ?? prev.tenantNationality,
        rent: rent ?? prev.rent,
        leaseStart: leaseStart ? new Date(leaseStart) : prev.leaseEnd,
        leaseEnd: leaseEnd ? new Date(leaseEnd) : null,
        securityDeposit: securityDeposit ?? prev.securityDeposit,
        paymentFrequency: paymentFrequency ?? prev.paymentFrequency,
        ejariNumber: ejariNumber ?? null,
        status: "active",
      })
      .returning();

    return {
      newTenancy: newTenancy[0],
      previousRent: prev.rent,
      newRent: rent ?? prev.rent,
      message: "Tenancy renewed. Previous tenancy marked as renewed.",
    };
  }

  if (action === "terminate" && tenancyId) {
    const terminated = await ctx.db
      .update(t)
      .set({ status: "terminated", updatedAt: new Date() })
      .where(and(eq(t.id, tenancyId), eq(t.companyId, ctx.companyId)))
      .returning();

    if (terminated[0]) {
      await ctx.db
        .update(aygentProperties)
        .set({ status: "vacant", updatedAt: new Date() })
        .where(eq(aygentProperties.id, terminated[0].managedPropertyId));
    }

    return { tenancy: terminated[0], message: "Tenancy terminated. Property status set to vacant." };
  }

  return { error: `Unknown action: ${action}` };
};

// ═══════════════════════════════════════════════════
// calculate_rera_rent
// ═══════════════════════════════════════════════════

export const calculateReraRentDefinition: ToolDefinition = {
  name: "calculate_rera_rent",
  description:
    "Calculate the maximum allowed rent increase under RERA guidelines for a lease renewal. Uses the RERA rental increase bands based on how far current rent is below market average. Use when agent asks about rent increases, renewals, RERA calculator, or tenant negotiations.",
  input_schema: {
    type: "object",
    properties: {
      currentRent: { type: "number", description: "Current annual rent in AED" },
      marketRent: { type: "number", description: "Average market rent for similar property in same area (AED/year)" },
      propertyId: { type: "string", description: "Property ID to auto-fetch current rent from latest active tenancy" },
      propertyType: { type: "string", description: "Type: apartment, villa, townhouse, office, shop" },
      bedrooms: { type: "string", description: "Number of bedrooms: studio, 1, 2, 3, 4, 5+" },
      area: { type: "string", description: "Area/community name" },
    },
    required: ["marketRent"],
  },
};

export const calculateReraRentExecutor: ToolExecutor = async (input, ctx) => {
  let currentRent = input.currentRent as number | undefined;
  const marketRent = input.marketRent as number;
  const propertyType = (input.propertyType as string) ?? "apartment";
  const bedrooms = (input.bedrooms as string) ?? "unknown";
  const area = (input.area as string) ?? "unknown";

  // Auto-fetch current rent from active tenancy if propertyId provided
  if (!currentRent && input.propertyId) {
    const activeTenancy = await ctx.db
      .select()
      .from(aygentTenancies)
      .where(
        and(
          eq(aygentTenancies.managedPropertyId, input.propertyId as string),
          eq(aygentTenancies.companyId, ctx.companyId),
          eq(aygentTenancies.status, "active"),
        ),
      )
      .orderBy(desc(aygentTenancies.leaseStart))
      .limit(1);

    if (activeTenancy[0]?.rent) {
      currentRent = activeTenancy[0].rent;
    }
  }

  if (!currentRent) {
    return { error: "currentRent is required (or provide propertyId with an active tenancy)" };
  }

  if (!marketRent || marketRent <= 0) {
    return { error: "marketRent must be a positive number." };
  }

  const gapPercent = marketRent > 0 ? ((marketRent - currentRent) / marketRent) * 100 : 0;

  let maxIncrease = 0;
  let band = "";
  if (gapPercent <= 10) { maxIncrease = 0; band = "0-10% below market — no increase allowed"; }
  else if (gapPercent <= 20) { maxIncrease = 5; band = "11-20% below market — up to 5% increase"; }
  else if (gapPercent <= 30) { maxIncrease = 10; band = "21-30% below market — up to 10% increase"; }
  else if (gapPercent <= 40) { maxIncrease = 15; band = "31-40% below market — up to 15% increase"; }
  else { maxIncrease = 20; band = "40%+ below market — up to 20% increase"; }

  const maxNewRent = currentRent * (1 + maxIncrease / 100);
  const recommendedRent = Math.min(maxNewRent, marketRent * 0.95);

  return {
    currentRent,
    marketRent,
    gapBelowMarket: `${gapPercent.toFixed(1)}%`,
    reraBand: band,
    maxAllowedIncrease: `${maxIncrease}%`,
    maxNewRent: Math.round(maxNewRent),
    recommendedRent: Math.round(recommendedRent),
    recommendation: maxIncrease === 0
      ? `Current rent (${currentRent.toLocaleString()} AED) is within 10% of market (${marketRent.toLocaleString()} AED). RERA does not allow an increase. Renew at the same rate.`
      : `Current rent is ${gapPercent.toFixed(0)}% below market. You can increase up to ${maxIncrease}% to ${Math.round(maxNewRent).toLocaleString()} AED. I recommend ${Math.round(recommendedRent).toLocaleString()} AED — competitive enough to retain the tenant while closing the gap.`,
    context: { propertyType, bedrooms, area },
  };
};

// ═══════════════════════════════════════════════════
// calculate_dld_fees
// ═══════════════════════════════════════════════════

export const calculateDldFeesDefinition: ToolDefinition = {
  name: "calculate_dld_fees",
  description:
    "Calculate the full cost breakdown for buying a property in Dubai (secondary/resale or off-plan). Includes DLD transfer fee, admin fees, agent commission, NOC fee, mortgage registration. Use when agent asks about buying costs, transfer fees, or total acquisition cost.",
  input_schema: {
    type: "object",
    properties: {
      purchasePrice: { type: "number", description: "Property purchase price in AED" },
      isOffPlan: { type: "boolean", description: "True if off-plan, false if secondary/resale. Defaults to false." },
      isMortgaged: { type: "boolean", description: "True if buyer is using a mortgage. Defaults to false." },
      mortgageLTV: { type: "number", description: "Loan-to-value percentage (e.g. 75 for 75%). Defaults to 75." },
      agentCommission: { type: "number", description: "Agent commission percentage. Defaults to 2 for secondary, 0 for off-plan." },
      nocFee: { type: "number", description: "NOC fee from developer in AED. Defaults to 1000 for secondary, 0 for off-plan." },
    },
    required: ["purchasePrice"],
  },
};

export const calculateDldFeesExecutor: ToolExecutor = async (input, ctx) => {
  const price = input.purchasePrice as number;
  const isOffPlan = (input.isOffPlan as boolean) ?? false;
  const isMortgaged = (input.isMortgaged as boolean) ?? false;
  const mortgageLTV = (input.mortgageLTV as number) ?? 75;
  const agentComm = (input.agentCommission as number) ?? (isOffPlan ? 0 : 2);
  const nocFee = (input.nocFee as number) ?? (isOffPlan ? 0 : 1000);

  const dldFee = price * 0.04;
  const adminFee = 580;
  const titleDeed = 4200;
  const agentFee = price * (agentComm / 100);
  const mortgageReg = isMortgaged ? (price * (mortgageLTV / 100)) * 0.0025 : 0;
  const mortgageAmount = isMortgaged ? price * (mortgageLTV / 100) : 0;
  const downPayment = isMortgaged ? price - mortgageAmount : price;

  const totalFees = dldFee + adminFee + titleDeed + agentFee + nocFee + mortgageReg;
  const totalCost = price + totalFees;

  const result = {
    purchasePrice: price,
    breakdown: {
      dld_transfer_fee: { amount: dldFee, rate: "4%", description: "DLD Transfer Fee" },
      admin_fee: { amount: adminFee, description: "DLD Admin Fee (buyer)" },
      title_deed: { amount: titleDeed, description: "Title Deed Issuance" },
      agent_commission: { amount: agentFee, rate: `${agentComm}%`, description: isOffPlan ? "Paid by developer" : "Agent Commission" },
      noc_fee: { amount: nocFee, description: isOffPlan ? "N/A for off-plan" : "NOC from Developer" },
      mortgage_registration: { amount: mortgageReg, rate: "0.25% of loan", description: isMortgaged ? "Mortgage Registration Fee" : "N/A — cash purchase" },
    },
    totalFees,
    totalAcquisitionCost: totalCost,
    financing: isMortgaged ? {
      mortgageAmount,
      downPayment,
      ltv: `${mortgageLTV}%`,
      totalCashNeeded: downPayment + totalFees,
    } : { totalCashNeeded: totalCost },
    marketType: isOffPlan ? "off-plan" : "secondary/resale",
  };

  const deliverableId = await storeDeliverable(ctx, {
    type: "dld_fee_calculation",
    title: `DLD Fee Calculation — AED ${price.toLocaleString()} (${isOffPlan ? "off-plan" : "secondary"})`,
    summary: `Total acquisition cost: AED ${totalCost.toLocaleString()}. Fees: AED ${totalFees.toLocaleString()}.`,
    metadata: { toolInput: input, result },
  });

  return { ...result, deliverableId };
};
