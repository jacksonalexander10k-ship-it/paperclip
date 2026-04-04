/**
 * Gmail Connection Routes
 *
 * Two flows:
 * 1. OAuth flow: UI opens Google OAuth popup, callback stores tokens
 * 2. Manual entry: User pastes access/refresh tokens directly
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { agentCredentialService } from "../services/agent-credentials.js";
import { agentService } from "../services/index.js";
import { assertCompanyAccess, assertBoard } from "./authz.js";
import { logger } from "../middleware/logger.js";

const GOOGLE_SCOPES = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify";

export function gmailConnectRoutes(db: Db) {
  const router = Router();
  const credSvc = agentCredentialService(db);
  const agentsSvc = agentService(db);

  /**
   * Get Gmail connection status for an agent
   */
  router.get("/agents/:agentId/connect/gmail", async (req, res) => {
    const { agentId } = req.params;

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const cred = await credSvc.getByAgentAndService(agentId, "gmail");

    res.json({
      connected: cred !== null,
      gmailAddress: cred?.gmailAddress ?? null,
      connectedAt: cred?.connectedAt ?? null,
    });
  });

  /**
   * Get the Google OAuth URL to redirect the user to
   */
  router.get("/agents/:agentId/connect/gmail/oauth-url", async (req, res) => {
    const { agentId } = req.params;
    assertBoard(req);

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ?? `${process.env.PUBLIC_URL ?? "http://localhost:3001"}/oauth/google/callback`;

    if (!clientId) {
      res.status(500).json({ error: "GOOGLE_CLIENT_ID not configured" });
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES,
      access_type: "offline",
      prompt: "consent",
      state: agentId, // Pass agentId through OAuth state
    });

    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  });

  /**
   * Google OAuth callback — exchanges code for tokens and stores them
   */
  router.get("/oauth/google/callback", async (req, res) => {
    const { code, state: agentId } = req.query;

    if (!code || !agentId || typeof code !== "string" || typeof agentId !== "string") {
      res.status(400).send("Missing code or agent ID");
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ?? `${process.env.PUBLIC_URL ?? "http://localhost:3001"}/oauth/google/callback`;

    if (!clientId || !clientSecret) {
      res.status(500).send("Google OAuth not configured");
      return;
    }

    try {
      // Exchange authorization code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        logger.error({ status: tokenRes.status, errBody }, "gmail-connect: token exchange failed");
        res.status(400).send("Failed to exchange authorization code");
        return;
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Get the user's Gmail address
      const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      let gmailAddress = "unknown";
      if (profileRes.ok) {
        const profile = (await profileRes.json()) as { emailAddress: string };
        gmailAddress = profile.emailAddress;
      }

      // Look up the agent to get companyId
      const agent = await agentsSvc.getById(agentId);
      if (!agent) {
        res.status(404).send("Agent not found");
        return;
      }

      // Store credential
      await credSvc.connect(agent.companyId, agentId, "gmail", {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        gmailAddress,
        scopes: GOOGLE_SCOPES,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      });

      logger.info(
        { agentId, gmailAddress, agentName: agent.name },
        "gmail-connect: agent connected to Gmail via OAuth",
      );

      // Close the popup window and notify the parent
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: "gmail-connected", agentId: "${agentId}" }, "*");
              }
              window.close();
            </script>
            <p>Gmail connected successfully. You can close this window.</p>
          </body>
        </html>
      `);
    } catch (err) {
      logger.error({ err }, "gmail-connect: OAuth callback error");
      res.status(500).send("OAuth error");
    }
  });

  /**
   * Manual Gmail connection (paste tokens directly)
   */
  router.post("/agents/:agentId/connect/gmail", async (req, res) => {
    const { agentId } = req.params;
    assertBoard(req);

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const { accessToken, refreshToken, gmailAddress, expiresAt } = req.body;

    if (!accessToken || !gmailAddress) {
      res.status(400).json({ error: "accessToken and gmailAddress are required" });
      return;
    }

    // Verify the token works by fetching the profile
    try {
      const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileRes.ok) {
        res.status(400).json({
          error: "Invalid access token — Gmail API returned an error. Check the token and try again.",
        });
        return;
      }
    } catch {
      // If verification fails due to network, allow connection anyway (offline dev)
      logger.warn("gmail-connect: could not verify Gmail token (network error)");
    }

    await credSvc.connect(agent.companyId, agentId, "gmail", {
      accessToken,
      refreshToken: refreshToken ?? null,
      gmailAddress,
      scopes: GOOGLE_SCOPES,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    logger.info(
      { agentId, gmailAddress, agentName: agent.name },
      "gmail-connect: agent connected to Gmail (manual)",
    );

    res.json({ connected: true, gmailAddress });
  });

  /**
   * Disconnect Gmail from an agent
   */
  router.delete("/agents/:agentId/connect/gmail", async (req, res) => {
    const { agentId } = req.params;
    assertBoard(req);

    const agent = await agentsSvc.getById(agentId);
    if (!agent) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    assertCompanyAccess(req, agent.companyId);

    const cred = await credSvc.getByAgentAndService(agentId, "gmail");
    if (!cred) {
      res.status(404).json({ error: "No Gmail connection found" });
      return;
    }

    await credSvc.disconnect(cred.id);
    logger.info({ agentId, agentName: agent.name }, "gmail-connect: disconnected");

    res.json({ disconnected: true });
  });

  return router;
}
