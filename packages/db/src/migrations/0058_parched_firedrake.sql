CREATE TABLE "aygent_maintenance_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"property_id" uuid,
	"tenancy_id" uuid,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"contractor_name" text,
	"contractor_phone" text,
	"estimated_cost" integer,
	"actual_cost" integer,
	"assigned_date" timestamp with time zone,
	"completed_date" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_rent_cheques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"tenancy_id" uuid NOT NULL,
	"cheque_number" text NOT NULL,
	"amount" integer NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"deposited_date" timestamp with time zone,
	"cleared_date" timestamp with time zone,
	"bounced_date" timestamp with time zone,
	"bank_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aygent_maintenance_requests" ADD CONSTRAINT "aygent_maintenance_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_maintenance_requests" ADD CONSTRAINT "aygent_maintenance_requests_property_id_aygent_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."aygent_properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_maintenance_requests" ADD CONSTRAINT "aygent_maintenance_requests_tenancy_id_aygent_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."aygent_tenancies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_rent_cheques" ADD CONSTRAINT "aygent_rent_cheques_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_rent_cheques" ADD CONSTRAINT "aygent_rent_cheques_tenancy_id_aygent_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."aygent_tenancies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aygent_maintenance_company_status_idx" ON "aygent_maintenance_requests" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "aygent_maintenance_property_idx" ON "aygent_maintenance_requests" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "aygent_maintenance_priority_idx" ON "aygent_maintenance_requests" USING btree ("company_id","priority");--> statement-breakpoint
CREATE INDEX "aygent_rent_cheques_company_status_idx" ON "aygent_rent_cheques" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "aygent_rent_cheques_tenancy_idx" ON "aygent_rent_cheques" USING btree ("tenancy_id");--> statement-breakpoint
CREATE INDEX "aygent_rent_cheques_due_date_idx" ON "aygent_rent_cheques" USING btree ("company_id","due_date");