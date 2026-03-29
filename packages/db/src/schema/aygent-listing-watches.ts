import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const aygentListingWatches = pgTable(
  "aygent_listing_watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    purpose: text("purpose"),
    location: text("location"),
    bedrooms: integer("bedrooms"),
    maxPrice: real("max_price"),
    propertyType: text("property_type"),
    isActive: boolean("is_active").default(true),
    lastChecked: timestamp("last_checked", { withTimezone: true }),
    lastCount: integer("last_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyActiveIdx: index("aygent_listing_watches_company_active_idx").on(table.companyId, table.isActive),
  }),
);
