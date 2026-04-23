/**
 * Meta OAuth routes — Facebook + Instagram connection flow.
 *
 * Two endpoints:
 *
 *   1. GET  /agents/:agentId/connect/meta/oauth-url
 *      Generates a Meta OAuth URL the UI opens in a popup. The state
 *      parameter carries the agent ID + a nonce so the callback can
 *      verify and route the credential.
 *
 *   2. GET  /oauth/meta/callback?code=...&state=...
 *      Exchanges the code for a long-lived user token, fetches the
 *      user's Facebook Pages + Instagram Business accounts + ad
 *      accounts, and stores them as per-agent credentials via the
 *      Sprint 0 credentials service. Redirects back to a tiny HTML
 *      page that closes the popup and notifies the parent window.
 *
 * Nonce storage: in-memory Map for Sprint 2. Lives for the duration of
 * the OAuth flow (typically seconds). Moving to Redis or DB would make
 * this multi-server safe but is overkill for dev mode.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";
import { agentService } from "../services/index.js";
import { assertCompanyAccess, assertBoard } from "./authz.js";
import { logger } from "../middleware/logger.js";
import {
  loadMetaOAuthConfig,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  upgradeToLongLivedToken,
  fetchUserPages,
  fetchUserAdAccounts,
  generateNonce,
  parseState,
} from "../services/meta-oauth.js";

// In-memory nonce store: agentId → { nonce, expiresAt }
// Nonces expire after 10 minutes to prevent stale state reuse.
const NONCE_TTL_MS = 10 * 60 * 1000;
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

function storeNonce(agentId: string, nonce: string): void {
  nonceStore.set(agentId, {
    nonce,
    expiresAt: Date.now() + NONCE_TTL_MS,
  });
}

function consumeNonce(agentId: string, nonce: string): boolean {
  const entry = nonceStore.get(agentId);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    nonceStore.delete(agentId);
    return false;
  }
  if (entry.nonce !== nonce) return false;
  nonceStore.delete(agentId);
  return true;
}

// Periodic cleanup of expired nonces (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [agentId, entry] of nonceStore.entries()) {
    if (entry.expiresAt < now) nonceStore.delete(agentId);
  }
}, 5 * 60 * 1000).unref();

export function metaConnectRoutes(db: Db) {
  const router = Router();
  const credSvc = agentCredentialService(db);
  const agentsSvc = agentService(db);

  /**
   * GET /agents/:agentId/connect/meta/oauth-url
   *
   * Returns a Meta OAuth URL for the UI to open in a popup. Stores
   * a nonce keyed to this agent for callback verification.
   */
  router.get("/agents/:agentId/connect/meta/oauth-url", async (req, res) => {
    const { agentId } = req.params;

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const config = loadMetaOAuthConfig();
    if (!config) {
      res.status(503).json({
        error:
          "Meta OAuth is not configured. Set META_APP_ID, META_APP_SECRET, and META_OAUTH_REDIRECT_URI in the server .env file. See .planning/notes/meta-app-setup-guide.md for the full setup walkthrough.",
      });
      return;
    }

    const nonce = generateNonce();
    storeNonce(agentId, nonce);

    const url = buildAuthorizeUrl({ config, agentId, nonce });
    logger.info({ agentId }, "meta-connect: generated OAuth URL");
    res.json({ url });
  });

  /**
   * GET /oauth/meta/callback?code=...&state=...
   *
   * Meta redirects here after the user approves the OAuth popup. We:
   *   1. Verify the state param matches a stored nonce
   *   2. Exchange the code for a short-lived user token
   *   3. Upgrade to a long-lived user token (60 days)
   *   4. Fetch the user's Pages + Instagram accounts + ad accounts
   *   5. Store credentials per agent for each relevant service
   *   6. Return a tiny HTML page that closes the popup
   *
   * This endpoint is intentionally public (no auth header) because
   * it's called directly by Meta. Security comes from the nonce.
   */
  router.get("/oauth/meta/callback", async (req, res) => {
    const { code, state, error, error_description } = req.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    // User denied permission, or Meta rejected the request
    if (error) {
      logger.warn({ error, error_description }, "meta-connect: user denied or Meta error");
      res.status(400).send(renderCallbackPage({
        status: "error",
        message: `Meta rejected the request: ${error_description ?? error}`,
      }));
      return;
    }

    if (!code || !state) {
      res.status(400).send(renderCallbackPage({
        status: "error",
        message: "Missing code or state parameter",
      }));
      return;
    }

    const parsed = parseState(state);
    if (!parsed) {
      res.status(400).send(renderCallbackPage({
        status: "error",
        message: "Invalid state parameter",
      }));
      return;
    }

    if (!consumeNonce(parsed.agentId, parsed.nonce)) {
      logger.warn({ agentId: parsed.agentId }, "meta-connect: nonce verification failed");
      res.status(400).send(renderCallbackPage({
        status: "error",
        message: "OAuth state verification failed. Please try connecting again.",
      }));
      return;
    }

    const agent = await agentsSvc.getById(parsed.agentId);
    if (!agent) {
      res.status(404).send(renderCallbackPage({
        status: "error",
        message: "Agent not found",
      }));
      return;
    }

    const config = loadMetaOAuthConfig();
    if (!config) {
      res.status(503).send(renderCallbackPage({
        status: "error",
        message: "Meta OAuth is not configured on the server",
      }));
      return;
    }

    try {
      // Step 1: code → short-lived token
      const short = await exchangeCodeForToken({ config, code });

      // Step 2: short-lived → long-lived (60 days)
      const long = await upgradeToLongLivedToken({
        config,
        shortLivedToken: short.accessToken,
      });

      const expiresAt = new Date(Date.now() + long.expiresInSeconds * 1000);

      // Step 3: fetch Facebook Pages + Instagram accounts
      const pages = await fetchUserPages({ userAccessToken: long.accessToken });

      // Step 4: fetch ad accounts (optional — may be empty)
      const adAccounts = await fetchUserAdAccounts({
        userAccessToken: long.accessToken,
      });

      if (pages.length === 0) {
        logger.warn(
          { agentId: parsed.agentId },
          "meta-connect: user has no Facebook Pages — cannot create credentials",
        );
        res.status(400).send(renderCallbackPage({
          status: "error",
          message:
            "You don't have any Facebook Pages connected to your account. Create a Page at facebook.com first, then try again.",
        }));
        return;
      }

      // Step 5a: store the Facebook Ads credential using the first ad
      // account (or the first page's access token if no ad accounts).
      // For now we pick the first page — a later enhancement will prompt
      // the user to choose if they have multiple.
      const primaryPage = pages[0];
      const primaryAdAccount = adAccounts[0];

      await credSvc.connect(agent.companyId, parsed.agentId, "facebook", {
        accessToken: primaryPage.accessToken,
        providerAccountId: primaryAdAccount?.id ?? primaryPage.id,
        scopes: "ads_management,ads_read,pages_manage_ads,leads_retrieval",
        expiresAt,
        accountLabel: primaryAdAccount
          ? `${primaryAdAccount.name} (${primaryAdAccount.id})`
          : primaryPage.name,
      });

      // Step 5b: store Instagram credential if the page has an IG Business account
      if (primaryPage.instagramBusinessAccount) {
        await credSvc.connect(agent.companyId, parsed.agentId, "instagram", {
          accessToken: primaryPage.accessToken,
          providerAccountId: primaryPage.instagramBusinessAccount.id,
          scopes: "instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights",
          expiresAt,
          accountLabel: primaryPage.instagramBusinessAccount.username
            ? `@${primaryPage.instagramBusinessAccount.username}`
            : `Instagram (${primaryPage.instagramBusinessAccount.id})`,
        });
      }

      logger.info(
        {
          agentId: parsed.agentId,
          pageName: primaryPage.name,
          igConnected: Boolean(primaryPage.instagramBusinessAccount),
          adAccount: primaryAdAccount?.id ?? null,
        },
        "meta-connect: OAuth successful",
      );

      res.status(200).send(renderCallbackPage({
        status: "success",
        message: primaryPage.instagramBusinessAccount
          ? `Connected ${primaryPage.name} (Facebook Ads) and @${primaryPage.instagramBusinessAccount.username ?? "Instagram"} to ${agent.name ?? "your agent"}.`
          : `Connected ${primaryPage.name} (Facebook Ads) to ${agent.name ?? "your agent"}. No Instagram Business account was found linked to this Page — if you want Instagram access, link an IG Business account to the Page and reconnect.`,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg, agentId: parsed.agentId }, "meta-connect: OAuth failed");
      res.status(500).send(renderCallbackPage({
        status: "error",
        message: `Meta OAuth failed: ${msg}`,
      }));
    }
  });

  return router;
}

/**
 * Tiny HTML page shown in the OAuth popup after callback. Posts a
 * message to the parent window and closes itself after a short delay.
 */
function renderCallbackPage(opts: { status: "success" | "error"; message: string }): string {
  const escapedMessage = opts.message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const color = opts.status === "success" ? "#10b981" : "#ef4444";
  const title = opts.status === "success" ? "Connected!" : "Connection failed";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
      padding: 40px 24px;
      text-align: center;
      color: #1f2937;
      background: #f9fafb;
    }
    h1 {
      color: ${color};
      margin: 0 0 12px;
      font-size: 24px;
    }
    p {
      color: #6b7280;
      margin: 0 0 24px;
      font-size: 14px;
      line-height: 1.5;
      max-width: 420px;
      margin-left: auto;
      margin-right: auto;
    }
    .hint {
      color: #9ca3af;
      font-size: 12px;
      margin-top: 32px;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${escapedMessage}</p>
  <p class="hint">This window will close automatically in 3 seconds.</p>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage(
          { type: "meta-oauth-complete", status: "${opts.status}" },
          "*"
        );
      }
    } catch (e) { /* ignore */ }
    setTimeout(() => window.close(), 3000);
  </script>
</body>
</html>`;
}
