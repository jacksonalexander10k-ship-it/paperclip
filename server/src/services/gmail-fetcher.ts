/**
 * Gmail Email Fetcher
 *
 * Fetches recent unread emails from the Gmail API using an agent's access token.
 * Marks fetched emails as read after processing.
 */

export interface FetchedEmail {
  id: string;
  subject: string;
  from: string;
  body: string;
  receivedAt: string;
}

export async function fetchRecentEmails(
  accessToken: string,
  maxResults: number = 10,
): Promise<FetchedEmail[]> {
  // 1. List recent unread messages
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+newer_than:1h&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!listRes.ok) {
    console.error(`[gmail-fetcher] List failed: ${listRes.status}`);
    return [];
  }

  const listData = await listRes.json() as { messages?: Array<{ id: string }> };
  if (!listData.messages?.length) return [];

  // 2. Fetch each message's full content
  const emails: FetchedEmail[] = [];
  for (const msg of listData.messages) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!msgRes.ok) continue;

    const msgData = await msgRes.json() as {
      id: string;
      payload: {
        headers: Array<{ name: string; value: string }>;
        body?: { data?: string };
        parts?: Array<{ mimeType: string; body?: { data?: string } }>;
      };
      internalDate: string;
    };

    const headers = msgData.payload.headers;
    const subject = headers.find(h => h.name.toLowerCase() === "subject")?.value ?? "";
    const from = headers.find(h => h.name.toLowerCase() === "from")?.value ?? "";

    // Extract body — try text/plain first, then text/html
    let body = "";
    if (msgData.payload.body?.data) {
      body = Buffer.from(msgData.payload.body.data, "base64url").toString("utf8");
    } else if (msgData.payload.parts) {
      const textPart = msgData.payload.parts.find(p => p.mimeType === "text/plain");
      const htmlPart = msgData.payload.parts.find(p => p.mimeType === "text/html");
      const part = textPart ?? htmlPart;
      if (part?.body?.data) {
        body = Buffer.from(part.body.data, "base64url").toString("utf8");
      }
    }

    emails.push({
      id: msgData.id,
      subject,
      from,
      body,
      receivedAt: new Date(parseInt(msgData.internalDate)).toISOString(),
    });

    // Mark as read after processing
    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      },
    );
  }

  return emails;
}
