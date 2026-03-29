// WhatsApp API client stub — wire real Meta Cloud API / 360dialog in Phase 2

const STUB = { status: "stub" as const, message: "WhatsApp API not yet connected. Wire real credentials in Phase 2." };

export async function sendWhatsApp(_opts: {
  to: string;
  message: string;
  phoneNumberId?: string;
  accessToken?: string;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}

export async function searchWhatsApp(_opts: {
  query?: string;
  contactName?: string;
  phone?: string;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}
