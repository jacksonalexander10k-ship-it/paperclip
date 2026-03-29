// Google Calendar API client stub — wire real Google OAuth in Phase 2

const STUB = { status: "stub" as const, message: "Google Calendar API not yet connected. Wire real credentials in Phase 2." };

export async function getCalendar(_opts: {
  startDate?: string;
  endDate?: string;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}

export async function createEvent(_opts: {
  title: string;
  date: string;
  startTime: string;
  duration?: number;
  description?: string;
  location?: string;
  attendees?: string[];
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}

export async function checkAvailability(_opts: {
  date: string;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}
