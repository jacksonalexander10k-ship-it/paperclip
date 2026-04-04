CREATE TABLE "aygent_auto_reply_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"lead_id" uuid,
	"channel" text NOT NULL,
	"recipient" text NOT NULL,
	"template_id" uuid,
	"message_content" text,
	"email_subject" text,
	"lead_source" text,
	"send_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_auto_reply_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_source" text NOT NULL,
	"reply_channel" text DEFAULT 'whatsapp' NOT NULL,
	"template_id" uuid,
	"fixed_message" text,
	"email_subject" text,
	"delay_secs" integer DEFAULT 60 NOT NULL,
	"enabled" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aygent_auto_reply_queue" ADD CONSTRAINT "aygent_auto_reply_queue_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_auto_reply_queue" ADD CONSTRAINT "aygent_auto_reply_queue_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_auto_reply_queue" ADD CONSTRAINT "aygent_auto_reply_queue_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_auto_reply_rules" ADD CONSTRAINT "aygent_auto_reply_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aygent_auto_reply_pending_idx" ON "aygent_auto_reply_queue" USING btree ("status","send_at");--> statement-breakpoint
CREATE INDEX "aygent_auto_reply_company_idx" ON "aygent_auto_reply_queue" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "aygent_auto_reply_rules_company_source_idx" ON "aygent_auto_reply_rules" USING btree ("company_id","lead_source");