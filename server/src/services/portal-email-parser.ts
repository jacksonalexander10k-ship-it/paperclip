/**
 * Portal Email Parser
 *
 * Parses lead notification emails from Dubai real estate portals:
 * Property Finder, Bayut, and Dubizzle.
 *
 * Returns a structured ParsedLead or null if the email is not a portal lead.
 */

export interface ParsedLead {
  source: "property_finder" | "bayut" | "dubizzle";
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  propertyRef: string | null;
}

export function parsePortalEmail(
  from: string,
  subject: string,
  body: string,
): ParsedLead | null {
  const fromLower = from.toLowerCase();
  const subjectLower = subject.toLowerCase();

  // Detect portal source
  let source: ParsedLead["source"] | null = null;
  if (fromLower.includes("propertyfinder") || fromLower.includes("property finder")) {
    source = "property_finder";
  } else if (fromLower.includes("bayut")) {
    source = "bayut";
  } else if (fromLower.includes("dubizzle")) {
    source = "dubizzle";
  }

  if (!source) return null;

  // Also check subject for lead-related keywords
  if (
    !subjectLower.includes("lead") &&
    !subjectLower.includes("enquir") &&
    !subjectLower.includes("interest")
  ) {
    return null;
  }

  // Extract fields using common patterns
  const name = extractField(body, /(?:name|client|buyer|tenant)[:\s]*([^\n\r]+)/i);
  const phone = extractPhone(body);
  const email = extractEmail(body);
  const message = extractField(body, /(?:message|comments?|notes?)[:\s]*([^\n\r]+)/i);
  const propertyRef = extractField(body, /(?:reference|ref|property|listing)[:\s#]*([A-Z0-9-]+)/i);

  // Must have at least a name or phone to be useful
  if (!name && !phone && !email) return null;

  return { source, name, phone, email, message, propertyRef };
}

function extractField(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

function extractPhone(text: string): string | null {
  // Match UAE phone numbers: +971..., 05..., 04...
  const match = text.match(/(\+971[\s-]?\d[\s-]?\d{3}[\s-]?\d{4}|0[45]\d[\s-]?\d{3}[\s-]?\d{4})/);
  if (match) return match[1].replace(/[\s-]/g, "");
  // Also try generic international numbers
  const intl = text.match(/(\+\d{10,15})/);
  return intl?.[1] ?? null;
}

function extractEmail(text: string): string | null {
  const match = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match?.[1] ?? null;
}
