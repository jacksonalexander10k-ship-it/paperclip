/**
 * Meta OAuth service — helpers for the Facebook + Instagram OAuth flow.
 *
 * Handles:
 *   - Building the OAuth authorization URL with the right scopes
 *   - Exchanging the authorization code for a user access token
 *   - Upgrading the short-lived token to a long-lived token (60 days)
 *   - Fetching the user's Facebook Pages + linked Instagram Business accounts
 *   - Refreshing long-lived tokens before they expire
 *
 * Credentials required in environment:
 *   - META_APP_ID
 *   - META_APP_SECRET
 *   - META_OAUTH_REDIRECT_URI (default: http://localhost:3001/oauth/meta/callback)
 *
 * Written without external Meta SDK — uses fetch directly against
 * graph.facebook.com so we have zero new dependencies.
 *
 * See `.planning/notes/meta-app-setup-guide.md` for how to create the
 * Meta App that backs these env vars.
 */

import { logger } from "../middleware/logger.js";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Scopes we request for a full Aygency agent connection. This is the
 * "kitchen sink" scope list — we ask for everything Aisha might need
 * so brokers only see ONE OAuth popup instead of one per capability.
 *
 * Each scope is explained here because Meta's docs are scattered:
 *   - public_profile, email: basic user identity (default)
 *   - pages_show_list: list the user's Facebook Pages
 *   - pages_read_engagement: read Page posts, comments, reactions
 *   - pages_manage_posts: publish posts to Pages
 *   - pages_manage_ads: run ads on behalf of Pages
 *   - ads_management: create/manage ad campaigns in the user's ad accounts
 *   - ads_read: read ad insights and performance data
 *   - business_management: read business account structure (for picking ad accounts)
 *   - instagram_basic: read Instagram Business account profile
 *   - instagram_content_publish: publish posts to Instagram (feed, reels, stories)
 *   - instagram_manage_comments: read/reply to Instagram comments
 *   - instagram_manage_insights: read Instagram post analytics
 *   - leads_retrieval: fetch Lead Ads form submissions
 */
// Scopes start minimal — just what Marketing API use case unlocks out of the box.
// Add Instagram/pages_manage_* scopes here once you've added the Instagram and
// Facebook Login for Business products to the Meta App dashboard.
export const META_OAUTH_SCOPES = [
  "public_profile",
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
] as const;

export interface MetaOAuthConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export interface MetaPage {
  id: string;
  name: string;
  /** Page-level access token — has the Page's permissions and is long-lived. */
  accessToken: string;
  category: string | null;
  tasks: string[];
  /** Connected Instagram Business account, if any */
  instagramBusinessAccount: {
    id: string;
    username: string | null;
  } | null;
}

export interface MetaAdAccount {
  id: string; // format: "act_1234567890"
  name: string;
  accountStatus: number;
  currency: string;
  timezoneName: string;
}

/**
 * Load Meta OAuth config from env vars. Throws a clear error if missing
 * so callers can surface a "Meta App not configured" message to the user.
 */
export function loadMetaOAuthConfig(): MetaOAuthConfig | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    return null;
  }

  return { appId, appSecret, redirectUri };
}

/**
 * Build the Meta OAuth authorization URL. The user is redirected here
 * in a popup window; after they approve, Meta redirects back to our
 * callback with a `code` parameter.
 *
 * The `state` parameter carries the agent ID so we know which agent
 * to link the new credential to when the callback fires.
 */
export function buildAuthorizeUrl(opts: {
  config: MetaOAuthConfig;
  agentId: string;
  nonce: string;
  /** Optional override scope list (defaults to META_OAUTH_SCOPES) */
  scopes?: readonly string[];
}): string {
  const { config, agentId, nonce, scopes = META_OAUTH_SCOPES } = opts;
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    state: `${agentId}:${nonce}`,
    scope: scopes.join(","),
    response_type: "code",
    // Force a fresh consent screen so users see what they're authorizing
    auth_type: "rerequest",
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange the authorization code for a short-lived user access token.
 * Short-lived tokens live for ~1 hour, so immediately after this we
 * should call `upgradeToLongLivedToken` to get a 60-day token.
 */
export async function exchangeCodeForToken(opts: {
  config: MetaOAuthConfig;
  code: string;
}): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const { config, code } = opts;
  const url = `${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code,
  }).toString()}`;

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Meta code exchange failed: ${response.status} ${response.statusText} — ${body.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    expiresInSeconds: data.expires_in ?? 3600,
  };
}

/**
 * Upgrade a short-lived user token to a long-lived token (~60 days).
 * This should be called immediately after `exchangeCodeForToken`.
 */
export async function upgradeToLongLivedToken(opts: {
  config: MetaOAuthConfig;
  shortLivedToken: string;
}): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const { config, shortLivedToken } = opts;
  const url = `${GRAPH_API_BASE}/oauth/access_token?${new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortLivedToken,
  }).toString()}`;

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Meta long-lived token upgrade failed: ${response.status} ${response.statusText} — ${body.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    // Default to 60 days if Meta doesn't return expires_in (long-lived user tokens)
    expiresInSeconds: data.expires_in ?? 60 * 24 * 60 * 60,
  };
}

/**
 * Refresh a long-lived token by exchanging it for another long-lived
 * token. Meta allows refreshing a long-lived token before it expires;
 * the new token also lasts ~60 days from the moment of refresh.
 *
 * Called by the token-refresh worker for credentials expiring soon.
 */
export async function refreshLongLivedToken(opts: {
  config: MetaOAuthConfig;
  currentToken: string;
}): Promise<{ accessToken: string; expiresInSeconds: number }> {
  // Same endpoint as upgrade — Meta handles both flows identically.
  return upgradeToLongLivedToken({
    config: opts.config,
    shortLivedToken: opts.currentToken,
  });
}

/**
 * Fetch the user's Facebook Pages along with their page access tokens
 * and linked Instagram Business accounts. This is what we actually
 * store as per-agent credentials — not the short-lived user token, but
 * the long-lived page tokens (which have the same long-lived semantics
 * and are scoped to each Page).
 *
 * If a user has 3 Facebook Pages, this returns 3 results. The caller
 * (the OAuth callback handler) decides whether to save them all or
 * prompt the user to pick one.
 */
export async function fetchUserPages(opts: {
  userAccessToken: string;
}): Promise<MetaPage[]> {
  const { userAccessToken } = opts;
  const url = `${GRAPH_API_BASE}/me/accounts?${new URLSearchParams({
    access_token: userAccessToken,
    fields: "id,name,access_token,category,tasks,instagram_business_account{id,username}",
  }).toString()}`;

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Meta fetchUserPages failed: ${response.status} ${response.statusText} — ${body.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as {
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      category?: string;
      tasks?: string[];
      instagram_business_account?: {
        id: string;
        username?: string;
      };
    }>;
  };

  return data.data.map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    category: page.category ?? null,
    tasks: page.tasks ?? [],
    instagramBusinessAccount: page.instagram_business_account
      ? {
          id: page.instagram_business_account.id,
          username: page.instagram_business_account.username ?? null,
        }
      : null,
  }));
}

/**
 * Fetch the user's ad accounts. Each ad account is where Facebook ad
 * campaigns are created. Users typically have 1-3 ad accounts; we
 * return them all so the UI can pick.
 */
export async function fetchUserAdAccounts(opts: {
  userAccessToken: string;
}): Promise<MetaAdAccount[]> {
  const { userAccessToken } = opts;
  const url = `${GRAPH_API_BASE}/me/adaccounts?${new URLSearchParams({
    access_token: userAccessToken,
    fields: "id,name,account_status,currency,timezone_name",
  }).toString()}`;

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // Ad accounts may not exist yet for first-time users; log but don't throw
    logger.warn(
      { status: response.status, body: body.slice(0, 300) },
      "meta-oauth: fetchUserAdAccounts failed — user may have no ad accounts yet",
    );
    return [];
  }

  const data = (await response.json()) as {
    data: Array<{
      id: string;
      name: string;
      account_status: number;
      currency: string;
      timezone_name: string;
    }>;
  };

  return data.data.map((acc) => ({
    id: acc.id,
    name: acc.name,
    accountStatus: acc.account_status,
    currency: acc.currency,
    timezoneName: acc.timezone_name,
  }));
}

/**
 * Generate a cryptographic nonce for OAuth state parameter. Prevents
 * CSRF attacks where an attacker could trick a user into linking the
 * attacker's Facebook account to the user's agent.
 */
export function generateNonce(): string {
  // Simple URL-safe nonce; 24 chars of base64url is plenty
  return crypto.randomUUID();
}

/**
 * Parse the `state` parameter back into agent ID + nonce. Returns null
 * if the format is wrong, which the caller should treat as an error.
 */
export function parseState(state: string): { agentId: string; nonce: string } | null {
  const idx = state.indexOf(":");
  if (idx === -1) return null;
  const agentId = state.slice(0, idx);
  const nonce = state.slice(idx + 1);
  if (!agentId || !nonce) return null;
  return { agentId, nonce };
}
