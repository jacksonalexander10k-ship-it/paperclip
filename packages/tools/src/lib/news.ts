// News aggregator stub — wire real news sources in Phase 2

const STUB = { status: "stub" as const, message: "News aggregator not yet connected. Wire real implementation in Phase 2." };

export async function getArticles(_opts: {
  category?: string;
  query?: string;
  limit?: number;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}
