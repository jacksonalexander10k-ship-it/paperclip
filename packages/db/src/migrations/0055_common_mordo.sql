CREATE TABLE "aygent_baileys_auth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"creds_json" text,
	"phone_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_baileys_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"key_type" text NOT NULL,
	"key_id" text NOT NULL,
	"key_data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aygent_baileys_auth" ADD CONSTRAINT "aygent_baileys_auth_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_baileys_auth" ADD CONSTRAINT "aygent_baileys_auth_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_baileys_keys" ADD CONSTRAINT "aygent_baileys_keys_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_baileys_auth_agent_idx" ON "aygent_baileys_auth" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "aygent_baileys_auth_company_idx" ON "aygent_baileys_auth" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_baileys_keys_unique" ON "aygent_baileys_keys" USING btree ("agent_id","key_type","key_id");--> statement-breakpoint
CREATE INDEX "aygent_baileys_keys_agent_idx" ON "aygent_baileys_keys" USING btree ("agent_id");