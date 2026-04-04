/**
 * Billing Service — Stripe Integration
 *
 * Manages subscriptions, usage metering, and customer portal for Aygency World.
 *
 * Tiers:
 * - Starter: CEO + 2 agents ($49/month)
 * - Growth: CEO + 5 agents ($99/month)
 * - Scale: CEO + 10 agents ($199/month)
 * - Enterprise: Unlimited + white-label (custom)
 *
 * Usage metering: heartbeat runs beyond tier limits billed per-run.
 */

import Stripe from "stripe";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies, companySubscriptions } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

function getStripe(): Stripe | null {
  if (!STRIPE_SECRET_KEY) return null;
  return new Stripe(STRIPE_SECRET_KEY);
}

export interface BillingTier {
  id: string;
  name: string;
  priceMonthly: number;
  maxAgents: number;
  includedRunsPerMonth: number;
  features: string[];
}

export const BILLING_TIERS: BillingTier[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 4900, // cents
    maxAgents: 3,       // CEO + 2
    includedRunsPerMonth: 500,
    features: [
      "CEO + 2 agents",
      "500 heartbeat runs/month",
      "CEO Chat",
      "Approval workflow",
      "WhatsApp integration",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthly: 9900,
    maxAgents: 6,       // CEO + 5
    includedRunsPerMonth: 2000,
    features: [
      "CEO + 5 agents",
      "2,000 heartbeat runs/month",
      "Everything in Starter",
      "Market intelligence",
      "Content automation",
      "Priority support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    priceMonthly: 19900,
    maxAgents: 11,      // CEO + 10
    includedRunsPerMonth: 5000,
    features: [
      "CEO + 10 agents",
      "5,000 heartbeat runs/month",
      "Everything in Growth",
      "Portfolio management",
      "AI calling (add-on)",
      "Custom agent roles",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 0, // custom
    maxAgents: -1,    // unlimited
    includedRunsPerMonth: -1,
    features: [
      "Unlimited agents",
      "Unlimited runs",
      "Everything in Scale",
      "White-label branding",
      "Dedicated support",
      "Custom SLA",
    ],
  },
];

export function billingService(db: Db) {
  return {
    /** Get available billing tiers */
    getTiers: () => BILLING_TIERS,

    /** Get current subscription status for a company */
    getSubscription: async (companyId: string) => {
      const row = await db
        .select()
        .from(companySubscriptions)
        .where(eq(companySubscriptions.companyId, companyId))
        .then((rows) => rows[0] ?? null);

      if (!row) {
        return {
          companyId,
          tierId: "starter",
          tierName: "Starter",
          status: "none" as const,
          stripeCustomerId: null,
          trialEndsAt: null,
        };
      }

      const tier = BILLING_TIERS.find((t) => t.id === row.tierId) ?? BILLING_TIERS[0]!;
      return {
        companyId,
        tierId: tier.id,
        tierName: tier.name,
        priceMonthly: tier.priceMonthly,
        maxAgents: tier.maxAgents,
        status: row.status,
        stripeCustomerId: row.stripeCustomerId,
        trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
        currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
      };
    },

    /** Create a Stripe Checkout session for subscribing */
    createCheckoutSession: async (
      companyId: string,
      tierId: string,
      successUrl: string,
      cancelUrl: string,
    ) => {
      const stripe = getStripe();
      if (!stripe) {
        return { url: null, error: "Stripe not configured. Set STRIPE_SECRET_KEY." };
      }

      const tier = BILLING_TIERS.find((t) => t.id === tierId);
      if (!tier || tier.priceMonthly === 0) {
        return { url: null, error: "Invalid tier or enterprise tier requires custom setup." };
      }

      try {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `Aygency World — ${tier.name}`,
                  description: tier.features.join(", "),
                },
                unit_amount: tier.priceMonthly,
                recurring: { interval: "month" },
              },
              quantity: 1,
            },
          ],
          subscription_data: {
            trial_period_days: 7,
            metadata: { companyId, tierId },
          },
          metadata: { companyId, tierId },
          success_url: successUrl,
          cancel_url: cancelUrl,
        });

        return { url: session.url, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Checkout session creation failed";
        logger.error({ err, companyId, tierId }, "billing: checkout session failed");
        return { url: null, error: msg };
      }
    },

    /** Create a Stripe Customer Portal session for self-service billing */
    createPortalSession: async (companyId: string, returnUrl: string) => {
      const stripe = getStripe();
      if (!stripe) {
        return { url: null, error: "Stripe not configured." };
      }

      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      const metadata = (company as Record<string, unknown> | null)?.metadata as Record<string, unknown> | null;
      const customerId = metadata?.stripeCustomerId as string | undefined;

      if (!customerId) {
        return { url: null, error: "No Stripe customer found. Subscribe first." };
      }

      try {
        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
        });
        return { url: session.url, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Portal session creation failed";
        logger.error({ err }, "billing: portal session failed");
        return { url: null, error: msg };
      }
    },

    /** Handle Stripe webhook events */
    handleWebhook: async (event: Stripe.Event) => {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const companyId = session.metadata?.companyId;
          const tierId = session.metadata?.tierId ?? "starter";
          const customerId = typeof session.customer === "string" ? session.customer : null;
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

          if (companyId && customerId) {
            await db.insert(companySubscriptions).values({
              companyId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              tierId,
              status: "trialing",
              trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            }).onConflictDoUpdate({
              target: companySubscriptions.companyId,
              set: {
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                tierId,
                status: "trialing",
                trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                updatedAt: new Date(),
              },
            });
            logger.info({ companyId, tierId, customerId }, "billing: subscription created");
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const failedCustomerId = typeof invoice.customer === "string" ? invoice.customer : null;
          logger.warn(
            { customerId: failedCustomerId, invoiceId: invoice.id },
            "billing: payment failed — grace period starts",
          );

          // Mark subscription as past_due — grace period logic is in isActive()
          if (failedCustomerId) {
            await db
              .update(companySubscriptions)
              .set({ status: "past_due", updatedAt: new Date() })
              .where(eq(companySubscriptions.stripeCustomerId, failedCustomerId));
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const cancelledCustomerId = typeof subscription.customer === "string" ? subscription.customer : null;
          logger.warn(
            { customerId: cancelledCustomerId, subscriptionId: subscription.id },
            "billing: subscription cancelled — pausing all agents",
          );

          if (cancelledCustomerId) {
            // Find the company and pause all their agents
            const [sub] = await db
              .select()
              .from(companySubscriptions)
              .where(eq(companySubscriptions.stripeCustomerId, cancelledCustomerId));

            if (sub) {
              await db
                .update(companySubscriptions)
                .set({ status: "cancelled", updatedAt: new Date() })
                .where(eq(companySubscriptions.companyId, sub.companyId));

              // Pause all agents for this company
              try {
                const { agentService: getAgentSvc } = await import("./agents.js");
                const agentSvc = getAgentSvc(db);
                const companyAgents = await agentSvc.list(sub.companyId);
                for (const agent of companyAgents) {
                  if (agent.status !== "paused" && agent.status !== "terminated") {
                    await agentSvc.pause(agent.id, "system");
                  }
                }
                logger.info(
                  { companyId: sub.companyId, agentCount: companyAgents.length },
                  "billing: all agents paused due to subscription cancellation",
                );
              } catch (err) {
                logger.error({ err, companyId: sub.companyId }, "billing: failed to pause agents");
              }
            }
          }
          break;
        }

        default:
          break;
      }
    },

    /** Report heartbeat run usage to Stripe (for metered billing) */
    reportUsage: async (companyId: string, runs: number) => {
      const stripe = getStripe();
      if (!stripe || runs <= 0) return;

      // In production, this would use Stripe Meters API
      logger.info({ companyId, runs }, "billing: usage reported");
    },

    /** Check whether a company's subscription is active (including grace period) */
    isActive: async (companyId: string): Promise<boolean> => {
      const row = await db
        .select()
        .from(companySubscriptions)
        .where(eq(companySubscriptions.companyId, companyId))
        .then((rows) => rows[0] ?? null);

      if (!row) return true; // No subscription record = not yet billed (allow during setup)
      if (row.status === "trialing" || row.status === "active") return true;
      if (row.status === "past_due") {
        // 3-day grace period
        const gracePeriodEnd = new Date((row.currentPeriodEnd ?? new Date()).getTime() + 3 * 24 * 60 * 60 * 1000);
        return new Date() < gracePeriodEnd;
      }
      return false;
    },
  };
}
