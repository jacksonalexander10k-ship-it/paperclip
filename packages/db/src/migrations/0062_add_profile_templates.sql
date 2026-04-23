-- Profile templates: reusable role configurations applied to agents.
-- Stock templates have company_id NULL (visible to all). Custom ones are scoped to a company.

CREATE TABLE IF NOT EXISTS "aygent_profile_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid REFERENCES "companies"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "tagline" text NOT NULL,
  "applies_to_role" text NOT NULL,
  "config" jsonb NOT NULL,
  "is_stock" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "aygent_profile_templates_company_idx"
  ON "aygent_profile_templates" ("company_id");
CREATE INDEX IF NOT EXISTS "aygent_profile_templates_role_idx"
  ON "aygent_profile_templates" ("applies_to_role");

ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "profile_template_id" uuid;
