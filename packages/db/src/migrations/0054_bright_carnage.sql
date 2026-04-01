CREATE TABLE "aygent_agent_learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"approval_id" uuid,
	"type" text NOT NULL,
	"action_type" text,
	"context" text,
	"original" text,
	"corrected" text,
	"reason" text,
	"applied_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"from_agent_id" uuid NOT NULL,
	"to_agent_id" uuid,
	"priority" text DEFAULT 'info' NOT NULL,
	"message_type" text NOT NULL,
	"summary" text,
	"data" jsonb,
	"read_by_agents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"acted_on" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aygent_agent_learnings" ADD CONSTRAINT "aygent_agent_learnings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_agent_learnings" ADD CONSTRAINT "aygent_agent_learnings_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_agent_learnings" ADD CONSTRAINT "aygent_agent_learnings_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_agent_messages" ADD CONSTRAINT "aygent_agent_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_agent_messages" ADD CONSTRAINT "aygent_agent_messages_from_agent_id_agents_id_fk" FOREIGN KEY ("from_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_agent_messages" ADD CONSTRAINT "aygent_agent_messages_to_agent_id_agents_id_fk" FOREIGN KEY ("to_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aygent_learnings_company_agent_active_idx" ON "aygent_agent_learnings" USING btree ("company_id","agent_id","active");--> statement-breakpoint
CREATE INDEX "aygent_learnings_company_agent_type_idx" ON "aygent_agent_learnings" USING btree ("company_id","agent_id","type");--> statement-breakpoint
CREATE INDEX "aygent_learnings_approval_idx" ON "aygent_agent_learnings" USING btree ("approval_id");--> statement-breakpoint
CREATE INDEX "aygent_messages_company_to_agent_idx" ON "aygent_agent_messages" USING btree ("company_id","to_agent_id");--> statement-breakpoint
CREATE INDEX "aygent_messages_company_from_agent_idx" ON "aygent_agent_messages" USING btree ("company_id","from_agent_id");--> statement-breakpoint
CREATE INDEX "aygent_messages_company_expires_idx" ON "aygent_agent_messages" USING btree ("company_id","expires_at");