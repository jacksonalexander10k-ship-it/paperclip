CREATE TABLE "aygent_agent_credential_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"credential_id" uuid NOT NULL,
	"role" text DEFAULT 'joined' NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_company_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"service" text NOT NULL,
	"account_label" text,
	"connected_by_agent_id" uuid,
	"access_token" text,
	"refresh_token" text,
	"provider_account_id" text,
	"whatsapp_phone_number_id" text,
	"gmail_address" text,
	"scopes" text,
	"expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aygent_agent_credential_links" ADD CONSTRAINT "aygent_agent_credential_links_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_agent_credential_links" ADD CONSTRAINT "aygent_agent_credential_links_credential_id_aygent_company_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."aygent_company_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_company_credentials" ADD CONSTRAINT "aygent_company_credentials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_company_credentials" ADD CONSTRAINT "aygent_company_credentials_connected_by_agent_id_agents_id_fk" FOREIGN KEY ("connected_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_agent_cred_link_agent_cred_uniq_idx" ON "aygent_agent_credential_links" USING btree ("agent_id","credential_id");--> statement-breakpoint
CREATE INDEX "aygent_agent_cred_link_agent_idx" ON "aygent_agent_credential_links" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "aygent_agent_cred_link_cred_idx" ON "aygent_agent_credential_links" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "aygent_company_cred_company_service_idx" ON "aygent_company_credentials" USING btree ("company_id","service");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_company_cred_company_service_account_uniq_idx" ON "aygent_company_credentials" USING btree ("company_id","service","provider_account_id");--> statement-breakpoint
CREATE INDEX "aygent_company_cred_whatsapp_phone_idx" ON "aygent_company_credentials" USING btree ("whatsapp_phone_number_id");--> statement-breakpoint
CREATE INDEX "aygent_company_cred_gmail_address_idx" ON "aygent_company_credentials" USING btree ("gmail_address");--> statement-breakpoint
-- ──────────────────────────────────────────────────────────────────────
-- BACKFILL: Copy every existing aygent_agent_credentials row into the
-- new company/links tables. Each existing row becomes:
--   1. A new aygent_company_credentials row (with the same token data)
--   2. A matching aygent_agent_credential_links row with role="owner"
--
-- The old aygent_agent_credentials table is NOT dropped. The service layer
-- uses a shim to read from the new tables; the old table is preserved for
-- rollback safety and will be dropped in a later cleanup migration once
-- we've verified the new schema is stable in production.
--
-- IMPORTANT: we generate matching UUIDs per row via a CTE so the
-- company_credentials row and its link row can reference each other.
-- ──────────────────────────────────────────────────────────────────────
-- Step 1: copy every legacy credential row into aygent_company_credentials,
-- capturing the (new_cred_id, original_agent_id) mapping in a temp table.
CREATE TEMPORARY TABLE "_cred_migration_map" (
  "legacy_id" uuid NOT NULL,
  "new_cred_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL
) ON COMMIT DROP;--> statement-breakpoint

WITH legacy AS (
  SELECT
    "id" AS legacy_id,
    gen_random_uuid() AS new_cred_id,
    "company_id",
    "agent_id",
    "service",
    COALESCE("gmail_address", "whatsapp_phone_number_id", "provider_account_id") AS account_label,
    "access_token",
    "refresh_token",
    "provider_account_id",
    "whatsapp_phone_number_id",
    "gmail_address",
    "scopes",
    "expires_at",
    "connected_at",
    "created_at",
    "updated_at"
  FROM "aygent_agent_credentials"
),
inserted AS (
  INSERT INTO "aygent_company_credentials" (
    "id",
    "company_id",
    "service",
    "account_label",
    "connected_by_agent_id",
    "access_token",
    "refresh_token",
    "provider_account_id",
    "whatsapp_phone_number_id",
    "gmail_address",
    "scopes",
    "expires_at",
    "connected_at",
    "created_at",
    "updated_at"
  )
  SELECT
    "new_cred_id",
    "company_id",
    "service",
    "account_label",
    "agent_id",
    "access_token",
    "refresh_token",
    "provider_account_id",
    "whatsapp_phone_number_id",
    "gmail_address",
    "scopes",
    "expires_at",
    "connected_at",
    "created_at",
    "updated_at"
  FROM legacy
  RETURNING "id", "connected_by_agent_id"
)
INSERT INTO "_cred_migration_map" ("legacy_id", "new_cred_id", "agent_id")
SELECT legacy."legacy_id", inserted."id", inserted."connected_by_agent_id"
FROM legacy
JOIN inserted ON inserted."id" = legacy."new_cred_id";--> statement-breakpoint

-- Step 2: create owner-role link rows for every migrated credential.
INSERT INTO "aygent_agent_credential_links" (
  "agent_id",
  "credential_id",
  "role",
  "linked_at",
  "created_at",
  "updated_at"
)
SELECT
  "agent_id",
  "new_cred_id",
  'owner',
  now(),
  now(),
  now()
FROM "_cred_migration_map"
WHERE "agent_id" IS NOT NULL;