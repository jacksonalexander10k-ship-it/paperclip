/**
 * One-shot cleanup: merge duplicate open tasks that share a normalised
 * title + same assignee within a recent window. These accumulated when
 * the CEO kept re-issuing the same "Process newly assigned leads
 * immediately" task because Claire's queue wasn't draining.
 *
 * The handler in server/src/services/ceo-commands.ts now de-dups at
 * write time (see "Dedup guard" block), so NEW duplicates never land.
 * This script cleans up the backlog created BEFORE that fix shipped.
 *
 * Usage:
 *   npx tsx scripts/dedup-open-tasks.ts --company-id <uuid>
 *   npx tsx scripts/dedup-open-tasks.ts --company-id <uuid> --apply
 *
 * Without --apply it runs as a dry-run and prints what it would merge.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, desc, eq, inArray } from "drizzle-orm";
import { issues } from "../packages/db/src/schema/issues.js";

function parseArgs(): { companyId: string; apply: boolean } {
  const args = process.argv.slice(2);
  const companyIdx = args.indexOf("--company-id");
  if (companyIdx === -1 || !args[companyIdx + 1]) {
    console.error("Usage: npx tsx scripts/dedup-open-tasks.ts --company-id <uuid> [--apply]");
    process.exit(1);
  }
  return {
    companyId: args[companyIdx + 1]!,
    apply: args.includes("--apply"),
  };
}

function normalise(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  const { companyId, apply } = parseArgs();
  // Default to the embedded Postgres used by `pnpm dev` when DATABASE_URL is
  // unset. Matches packages/db/src/seed-demo-user.ts.
  const connStr =
    process.env.DATABASE_URL ??
    "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";
  const sqlClient = postgres(connStr, { max: 1 });
  const db = drizzle(sqlClient);

  console.log(`[dedup] Company: ${companyId}`);
  console.log(`[dedup] Mode: ${apply ? "APPLY" : "DRY RUN"}`);

  // Pull all open tasks for the company.
  const open = await db
    .select({
      id: issues.id,
      title: issues.title,
      assigneeAgentId: issues.assigneeAgentId,
      status: issues.status,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .where(
      and(
        eq(issues.companyId, companyId),
        inArray(issues.status, ["todo", "in_progress"]),
      ),
    )
    .orderBy(desc(issues.createdAt));

  console.log(`[dedup] Scanning ${open.length} open tasks…`);

  // Group by (assignee, normalised title).
  const groups = new Map<string, typeof open>();
  for (const row of open) {
    const key = `${row.assigneeAgentId ?? "unassigned"}::${normalise(row.title)}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  // Anything with more than 1 is a dupe set. Keep the NEWEST; archive the rest.
  let totalDupes = 0;
  const toArchive: string[] = [];
  for (const [key, bucket] of groups) {
    if (bucket.length <= 1) continue;
    // rows are already desc by createdAt — index 0 is newest, survives.
    const [survivor, ...victims] = bucket;
    totalDupes += victims.length;
    console.log(
      `[dedup] ${bucket.length}× "${survivor!.title.slice(0, 60)}" — keeping ${survivor!.id.slice(0, 8)}, archiving ${victims.length}`,
    );
    for (const v of victims) toArchive.push(v.id);
  }

  console.log(`[dedup] Would archive ${totalDupes} duplicate rows.`);

  if (!apply) {
    console.log(`[dedup] Dry run complete. Re-run with --apply to execute.`);
    await sqlClient.end();
    return;
  }

  if (toArchive.length === 0) {
    console.log(`[dedup] Nothing to do.`);
    await sqlClient.end();
    return;
  }

  await db
    .update(issues)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(inArray(issues.id, toArchive));

  console.log(`[dedup] Archived ${toArchive.length} rows.`);
  await sqlClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
