CREATE TABLE "aygent_whatsapp_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"chat_jid" text NOT NULL,
	"window_opened_at" timestamp with time zone NOT NULL,
	"window_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "aygent_whatsapp_windows_unique" UNIQUE("agent_id","chat_jid")
);
--> statement-breakpoint
ALTER TABLE "aygent_whatsapp_windows" ADD CONSTRAINT "aygent_whatsapp_windows_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_whatsapp_windows" ADD CONSTRAINT "aygent_whatsapp_windows_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aygent_whatsapp_windows_company_idx" ON "aygent_whatsapp_windows" USING btree ("company_id");