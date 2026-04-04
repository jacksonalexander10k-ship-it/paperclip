CREATE TABLE "aygent_broker_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"broker_name" text NOT NULL,
	"rera_card_number" text,
	"rera_brn" text,
	"issue_date" timestamp with time zone,
	"expiry_date" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"drei_training_date" timestamp with time zone,
	"drei_certificate_id" text,
	"aml_training_date" timestamp with time zone,
	"aml_training_expiry" timestamp with time zone,
	"phone" text,
	"email" text,
	"areas_focus" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"agent_id" uuid,
	"deal_type" text NOT NULL,
	"gross_amount" integer NOT NULL,
	"commission_rate" numeric(5, 2),
	"agent_split_pct" numeric(5, 2),
	"agent_amount" integer,
	"agency_amount" integer,
	"vat_amount" integer,
	"total_with_vat" integer,
	"status" text DEFAULT 'earned' NOT NULL,
	"invoice_number" text,
	"invoice_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"paid_date" timestamp with time zone,
	"paid_amount" integer,
	"source" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_compliance_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"deal_id" uuid,
	"lead_id" uuid,
	"client_name" text NOT NULL,
	"client_type" text NOT NULL,
	"nationality" text,
	"emirates_id" text,
	"passport_number" text,
	"check_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"documents_collected" jsonb DEFAULT '{}'::jsonb,
	"risk_level" text,
	"flag_reason" text,
	"resolution" text,
	"checked_by" text,
	"checked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_id" uuid,
	"agent_id" uuid,
	"deal_type" text NOT NULL,
	"stage" text DEFAULT 'offer' NOT NULL,
	"fell_through_reason" text,
	"property_address" text NOT NULL,
	"property_type" text,
	"area" text,
	"developer" text,
	"project_name" text,
	"price" integer NOT NULL,
	"buyer_name" text,
	"buyer_phone" text,
	"buyer_email" text,
	"seller_name" text,
	"seller_phone" text,
	"form_f_date" timestamp with time zone,
	"noc_applied_date" timestamp with time zone,
	"noc_received_date" timestamp with time zone,
	"noc_expiry_date" timestamp with time zone,
	"mortgage_bank" text,
	"mortgage_status" text,
	"transfer_date" timestamp with time zone,
	"completion_date" timestamp with time zone,
	"documents_checklist" jsonb DEFAULT '{}'::jsonb,
	"expected_close_date" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"vat_amount" integer DEFAULT 0,
	"date" timestamp with time zone NOT NULL,
	"recurring" text,
	"vendor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"commission_id" uuid,
	"deal_id" uuid,
	"invoice_number" text NOT NULL,
	"invoice_type" text NOT NULL,
	"client_name" text NOT NULL,
	"client_email" text,
	"client_phone" text,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"vat_amount" integer NOT NULL,
	"total" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"due_date" timestamp with time zone,
	"sent_date" timestamp with time zone,
	"paid_date" timestamp with time zone,
	"paid_amount" integer DEFAULT 0,
	"agency_name" text,
	"agency_rera" text,
	"agency_trn" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aygent_broker_cards" ADD CONSTRAINT "aygent_broker_cards_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_commissions" ADD CONSTRAINT "aygent_commissions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_commissions" ADD CONSTRAINT "aygent_commissions_deal_id_aygent_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."aygent_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_commissions" ADD CONSTRAINT "aygent_commissions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_compliance_checks" ADD CONSTRAINT "aygent_compliance_checks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_compliance_checks" ADD CONSTRAINT "aygent_compliance_checks_deal_id_aygent_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."aygent_deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_compliance_checks" ADD CONSTRAINT "aygent_compliance_checks_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_deals" ADD CONSTRAINT "aygent_deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_deals" ADD CONSTRAINT "aygent_deals_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_deals" ADD CONSTRAINT "aygent_deals_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_expenses" ADD CONSTRAINT "aygent_expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_invoices" ADD CONSTRAINT "aygent_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_invoices" ADD CONSTRAINT "aygent_invoices_commission_id_aygent_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."aygent_commissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_invoices" ADD CONSTRAINT "aygent_invoices_deal_id_aygent_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."aygent_deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aygent_broker_cards_company_status_idx" ON "aygent_broker_cards" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "aygent_broker_cards_company_expiry_date_idx" ON "aygent_broker_cards" USING btree ("company_id","expiry_date");--> statement-breakpoint
CREATE INDEX "aygent_commissions_company_status_idx" ON "aygent_commissions" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "aygent_commissions_deal_idx" ON "aygent_commissions" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "aygent_commissions_agent_idx" ON "aygent_commissions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "aygent_compliance_checks_company_check_type_status_idx" ON "aygent_compliance_checks" USING btree ("company_id","check_type","status");--> statement-breakpoint
CREATE INDEX "aygent_compliance_checks_deal_idx" ON "aygent_compliance_checks" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "aygent_compliance_checks_client_name_idx" ON "aygent_compliance_checks" USING btree ("client_name");--> statement-breakpoint
CREATE INDEX "aygent_deals_company_stage_idx" ON "aygent_deals" USING btree ("company_id","stage");--> statement-breakpoint
CREATE INDEX "aygent_deals_company_deal_type_idx" ON "aygent_deals" USING btree ("company_id","deal_type");--> statement-breakpoint
CREATE INDEX "aygent_deals_lead_idx" ON "aygent_deals" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "aygent_deals_agent_idx" ON "aygent_deals" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "aygent_expenses_company_category_idx" ON "aygent_expenses" USING btree ("company_id","category");--> statement-breakpoint
CREATE INDEX "aygent_expenses_company_date_idx" ON "aygent_expenses" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "aygent_invoices_company_status_idx" ON "aygent_invoices" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "aygent_invoices_company_invoice_type_idx" ON "aygent_invoices" USING btree ("company_id","invoice_type");