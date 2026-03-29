// Gmail API client stub — wire real Google OAuth in Phase 2

const STUB = { status: "stub" as const, message: "Gmail API not yet connected. Wire real credentials in Phase 2." };

export async function sendEmail(_opts: {
  to: string;
  subject: string;
  body: string;
  from?: string;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}

export async function searchEmail(_opts: {
  query: string;
  maxResults?: number;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}
