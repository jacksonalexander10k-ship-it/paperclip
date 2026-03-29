import { eq, and, ilike, desc } from "drizzle-orm";
import { aygentDocuments } from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";

// ═══════════════════════════════════════════════════
// list_documents
// ═══════════════════════════════════════════════════

export const listDocumentsDefinition: ToolDefinition = {
  name: "list_documents",
  description:
    "List documents in the vault. Can filter by lead, project, or document type. Use when the agent asks to see documents for a lead, or wants to find a specific brochure/floor plan.",
  input_schema: {
    type: "object",
    properties: {
      leadId: { type: "string", description: "Filter by lead ID" },
      projectId: { type: "string", description: "Filter by project ID" },
      type: {
        type: "string",
        description:
          "Filter by type: brochure | floor_plan | spa | noc | payment_plan | mortgage | id_copy | other",
      },
      query: { type: "string", description: "Search by document name" },
    },
  },
};

export const listDocumentsExecutor: ToolExecutor = async (input, ctx) => {
  const { leadId, projectId, type, query } = input as {
    leadId?: string;
    projectId?: string;
    type?: string;
    query?: string;
  };

  const t = aygentDocuments;
  const conditions = [eq(t.companyId, ctx.companyId)];

  if (leadId) conditions.push(eq(t.leadId, leadId));
  if (projectId) conditions.push(eq(t.projectId, projectId));
  if (type) conditions.push(eq(t.type, type));
  if (query) conditions.push(ilike(t.name, `%${query}%`));

  const docs = await ctx.db
    .select()
    .from(t)
    .where(and(...conditions))
    .orderBy(desc(t.createdAt))
    .limit(50);

  return {
    documents: docs.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      fileUrl: d.fileUrl,
      fileSize: d.fileSize,
      mimeType: d.mimeType,
      leadId: d.leadId,
      projectId: d.projectId,
      landlordId: d.landlordId,
      managedPropertyId: d.managedPropertyId,
      tenancyId: d.tenancyId,
      notes: d.notes,
      expiresAt: d.expiresAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    total: docs.length,
  };
};

// ═══════════════════════════════════════════════════
// extract_document_data
// ═══════════════════════════════════════════════════

export const extractDocumentDataDefinition: ToolDefinition = {
  name: "extract_document_data",
  description:
    "Extract structured data from a document using OCR (AI vision). Supports passports, Emirates IDs, tenancy contracts, Ejari certificates, and other documents. The AI reads the document image and extracts key fields like names, dates, ID numbers, rent amounts, etc. Use when the agent asks to 'read', 'extract', 'scan', or 'OCR' a document.",
  input_schema: {
    type: "object",
    properties: {
      documentId: {
        type: "string",
        description: "The document's database ID (from list_documents results)",
      },
    },
    required: ["documentId"],
  },
};

export const extractDocumentDataExecutor: ToolExecutor = async (input, ctx) => {
  const { documentId } = input as { documentId: string };

  // Fetch document to get URL
  const docs = await ctx.db
    .select()
    .from(aygentDocuments)
    .where(and(eq(aygentDocuments.id, documentId), eq(aygentDocuments.companyId, ctx.companyId)))
    .limit(1);

  if (docs.length === 0) {
    return { error: "Document not found." };
  }

  const doc = docs[0]!;
  return {
    status: "ai_extraction",
    message: "Document extraction uses Claude Vision. Pass the document URL to the AI for OCR processing.",
    documentId,
    name: doc.name,
    type: doc.type,
    fileUrl: doc.fileUrl,
    mimeType: doc.mimeType,
  };
};

// ═══════════════════════════════════════════════════
// scrape_url
// ═══════════════════════════════════════════════════

export const scrapeUrlDefinition: ToolDefinition = {
  name: "scrape_url",
  description:
    "Fetch and extract the main text content from any webpage URL. Use this as a fallback when other tools don't have the data — for example, to read a specific Gulf News or CNN article, fetch a market report PDF link, or grab data from any website the agent mentions. Returns the page title, extracted text content, and metadata.",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The full URL to scrape (e.g. 'https://gulfnews.com/...')" },
      maxLength: { type: "number", description: "Maximum characters of text to return (default 5000)" },
    },
    required: ["url"],
  },
};

export const scrapeUrlExecutor: ToolExecutor = async (input, _ctx) => {
  const { url, maxLength } = input as { url: string; maxLength?: number };
  // Stub — Jina AI reader not connected yet
  return {
    status: "stub",
    message: "URL scraper (Jina AI reader) not yet connected. Wire real implementation in Phase 2.",
    url,
    maxLength: maxLength ?? 5000,
  };
};
