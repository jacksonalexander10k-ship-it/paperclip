/**
 * Billing Routes — Stripe subscription management
 */

import { Router } from "express";
import Stripe from "stripe";
import type { Db } from "@paperclipai/db";
import { billingService } from "../services/billing.js";
import { assertCompanyAccess, assertBoard } from "./authz.js";
import { logger } from "../middleware/logger.js";

export function billingRoutes(db: Db) {
  const router = Router();
  const billing = billingService(db);

  // Get available tiers
  router.get("/billing/tiers", (_req, res) => {
    res.json(billing.getTiers());
  });

  // Get subscription status for a company
  router.get("/companies/:companyId/billing", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const subscription = await billing.getSubscription(companyId);
    if (!subscription) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(subscription);
  });

  // Get billing active status for a company
  router.get("/companies/:companyId/billing/status", async (req, res) => {
    const { companyId } = req.params;
    assertCompanyAccess(req, companyId);

    const active = await billing.isActive(companyId);
    const subscription = await billing.getSubscription(companyId);
    res.json({ active, ...subscription });
  });

  // Create checkout session (subscribe to a tier)
  router.post("/companies/:companyId/billing/checkout", async (req, res) => {
    const { companyId } = req.params;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const { tierId } = req.body;
    if (!tierId || typeof tierId !== "string") {
      res.status(400).json({ error: "tierId is required" });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await billing.createCheckoutSession(
      companyId,
      tierId,
      `${baseUrl}/company/settings?billing=success`,
      `${baseUrl}/company/settings?billing=cancelled`,
    );

    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ url: result.url });
  });

  // Create customer portal session (manage subscription)
  router.post("/companies/:companyId/billing/portal", async (req, res) => {
    const { companyId } = req.params;
    assertBoard(req);
    assertCompanyAccess(req, companyId);

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await billing.createPortalSession(
      companyId,
      `${baseUrl}/company/settings`,
    );

    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ url: result.url });
  });

  return router;
}

/**
 * Stripe webhook handler — mounted before auth middleware.
 * Receives events from Stripe about subscription changes, payments, etc.
 */
export function stripeWebhookRoutes(db: Db) {
  const router = Router();
  const billing = billingService(db);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  router.post("/webhook/stripe", async (req, res) => {
    if (!webhookSecret || !process.env.STRIPE_SECRET_KEY) {
      res.sendStatus(200);
      return;
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers["stripe-signature"] as string;
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

    if (!sig || !rawBody) {
      res.sendStatus(400);
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      logger.warn({ err }, "stripe-webhook: signature verification failed");
      res.sendStatus(400);
      return;
    }

    await billing.handleWebhook(event);
    res.sendStatus(200);
  });

  return router;
}
