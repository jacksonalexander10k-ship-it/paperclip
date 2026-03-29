// Instagram API client stub — wire real Meta Graph API in Phase 2

const STUB = { status: "stub" as const, message: "Instagram API not yet connected. Wire real credentials in Phase 2." };

export async function publishToInstagram(_opts: {
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  caption: string;
  mediaType?: "feed" | "story" | "reel";
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}

export async function getDMs(_opts: {
  limit?: number;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}

export async function sendDM(_opts: {
  recipientId: string;
  message: string;
}): Promise<{ status: "stub"; message: string }> {
  return STUB;
}
