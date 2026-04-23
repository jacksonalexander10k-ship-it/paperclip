import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * Profile templates for agents — a reusable "role configuration" that defines
 * how an agent behaves: their goal, playbook, tone, cadence, and hand-off rules.
 *
 * Stock templates have companyId = NULL (visible to every agency).
 * Custom templates created via the CEO wizard belong to a specific company.
 *
 * Apply a template to an agent via agents.profileTemplateId — the active profile
 * is injected into the agent's system prompt at draft time.
 */
export const aygentProfileTemplates = pgTable(
  "aygent_profile_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** NULL = stock template visible to all agencies */
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    /** Short human label e.g. "Booker", "Qualifier", "Concierge" */
    name: text("name").notNull(),
    /** One-line summary of what this profile does */
    tagline: text("tagline").notNull(),
    /** Which agent role this template applies to (sales | content | etc.) */
    appliesToRole: text("applies_to_role").notNull(),
    /**
     * Structured profile config. Shape (all optional except goal):
     *   {
     *     goal: string,         // primary mission e.g. "Book viewings"
     *     secondary?: string,   // secondary mission
     *     tone: string,         // "warm consultative", "direct", etc.
     *     cadence: string,      // when/how often agent reaches out
     *     handoffRules: string, // when to escalate to human
     *     dontDo: string,       // anti-goals (never push for sale, etc.)
     *     custom: string,       // free-form notes
     *   }
     */
    config: jsonb("config").$type<{
      goal: string;
      secondary?: string;
      tone?: string;
      cadence?: string;
      handoffRules?: string;
      dontDo?: string;
      custom?: string;
    }>().notNull(),
    /** Stock templates can't be edited by users; they're seeded */
    isStock: boolean("is_stock").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("aygent_profile_templates_company_idx").on(table.companyId),
    roleIdx: index("aygent_profile_templates_role_idx").on(table.appliesToRole),
  }),
);
