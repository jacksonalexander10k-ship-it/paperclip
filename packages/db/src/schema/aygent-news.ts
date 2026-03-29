import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const aygentNews = pgTable(
  "aygent_news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url"),
    source: text("source"),
    category: text("category"),
    summary: text("summary"),
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUrlUniqueIdx: uniqueIndex("aygent_news_company_url_idx").on(table.companyId, table.url),
    sourceIdx: index("aygent_news_source_idx").on(table.source),
    categoryIdx: index("aygent_news_category_idx").on(table.category),
    publishedAtIdx: index("aygent_news_published_at_idx").on(table.publishedAt),
  }),
);
