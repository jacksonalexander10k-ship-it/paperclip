CREATE TABLE "aygent_property_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"interest_level" text DEFAULT 'interested',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aygent_property_leads_unique" UNIQUE("property_id","lead_id")
);
--> statement-breakpoint
ALTER TABLE "aygent_properties" ADD COLUMN "listing_type" text DEFAULT 'sale';--> statement-breakpoint
ALTER TABLE "aygent_properties" ADD COLUMN "rental_price" real;--> statement-breakpoint
ALTER TABLE "aygent_properties" ADD COLUMN "pipeline_status" text DEFAULT 'available';--> statement-breakpoint
ALTER TABLE "aygent_property_leads" ADD CONSTRAINT "aygent_property_leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_property_leads" ADD CONSTRAINT "aygent_property_leads_property_id_aygent_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."aygent_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_property_leads" ADD CONSTRAINT "aygent_property_leads_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aygent_property_leads_company_idx" ON "aygent_property_leads" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "aygent_property_leads_property_idx" ON "aygent_property_leads" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "aygent_property_leads_lead_idx" ON "aygent_property_leads" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "aygent_properties_company_listing_idx" ON "aygent_properties" USING btree ("company_id","listing_type");--> statement-breakpoint
CREATE INDEX "aygent_properties_company_pipeline_idx" ON "aygent_properties" USING btree ("company_id","pipeline_status");