import type { Db } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";

export function startTokenRefreshWorker(db: Db) {
  const credentialSvc = agentCredentialService(db);

  const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  async function refreshExpiring() {
    try {
      // Find credentials expiring within 120 minutes
      const expiring = await credentialSvc.listExpiring(120);

      for (const cred of expiring) {
        try {
          if (cred.service === "gmail" && cred.refreshToken) {
            const response = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID ?? "",
                client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
                refresh_token: cred.refreshToken,
                grant_type: "refresh_token",
              }),
            });

            if (response.ok) {
              const data = (await response.json()) as {
                access_token: string;
                expires_in: number;
              };
              const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
              await credentialSvc.updateToken(cred.id, data.access_token, newExpiresAt);
              console.log(
                `[token-refresh] ✓ Refreshed Gmail token for credential ${cred.id}`,
              );
            } else {
              console.error(
                `[token-refresh] ✗ Gmail refresh failed for ${cred.id}: ${response.status}`,
              );
            }
          }
          if (cred.service === "whatsapp" && !cred.refreshToken) {
            console.warn(
              `[token-refresh] ⚠ WhatsApp credential ${cred.id} expiring, no refresh mechanism`,
            );
          }
        } catch (err) {
          console.error(`[token-refresh] ✗ Failed for credential ${cred.id}:`, err);
        }
      }

      if (expiring.length > 0) {
        console.log(
          `[token-refresh] Processed ${expiring.length} expiring credentials`,
        );
      }
    } catch (err) {
      console.error("[token-refresh] Worker error:", err);
    }
  }

  // Run once shortly after server start, then every 30 minutes
  setTimeout(() => {
    void refreshExpiring();
  }, 5000);
  const interval = setInterval(() => {
    void refreshExpiring();
  }, INTERVAL_MS);

  return { stop: () => clearInterval(interval) };
}
