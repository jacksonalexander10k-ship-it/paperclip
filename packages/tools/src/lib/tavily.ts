// Tavily web search stub — wire real Tavily API key in Phase 2

const STUB = { status: "stub" as const, message: "Web search API not yet connected. Wire Tavily API key in Phase 2." };

export async function webSearch(_opts: {
  query: string;
  maxResults?: number;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}
