import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { aygentProperties } from "./aygent-properties.js";
import { aygentLeads } from "./aygent-leads.js";

export const aygentPropertyLeads = pgTable(
  "aygent_property_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => aygentProperties.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => aygentLeads.id, { onDelete: "cascade" }),
    interestLevel: text("interest_level").default("interested"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyIdx: index("aygent_property_leads_company_idx").on(table.companyId),
    propertyIdx: index("aygent_property_leads_property_idx").on(table.propertyId),
    leadIdx: index("aygent_property_leads_lead_idx").on(table.leadId),
    uniquePropertyLead: unique("aygent_property_leads_unique").on(
      table.propertyId,
      table.leadId,
    ),
  }),
);
