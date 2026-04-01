import { pgTable, uuid, text, timestamp, jsonb, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserIdx: index("push_subscriptions_company_user_idx").on(table.companyId, table.userId),
    uniqueEndpoint: unique("push_subscriptions_endpoint_unique").on(table.endpoint),
  }),
);
