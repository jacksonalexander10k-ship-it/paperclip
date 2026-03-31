CREATE TABLE "aygent_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"reelly_id" integer,
	"name" text NOT NULL,
	"developer" text,
	"description" text,
	"short_description" text,
	"district" text,
	"region" text,
	"city" text,
	"sector" text,
	"location" text,
	"latitude" real,
	"longitude" real,
	"min_price" real,
	"max_price" real,
	"min_size" real,
	"max_size" real,
	"price_currency" text,
	"area_unit" text,
	"construction_status" text,
	"sale_status" text,
	"completion_date" text,
	"completion_datetime" timestamp with time zone,
	"readiness_progress" real,
	"furnishing" text,
	"service_charge" real,
	"escrow_number" text,
	"post_handover" boolean,
	"building_count" integer,
	"units_count" integer,
	"amenities" jsonb DEFAULT '[]'::jsonb,
	"payment_plans" jsonb DEFAULT '[]'::jsonb,
	"nearby_landmarks" jsonb DEFAULT '[]'::jsonb,
	"buildings" jsonb DEFAULT '[]'::jsonb,
	"parkings" jsonb DEFAULT '[]'::jsonb,
	"unit_breakdown" jsonb DEFAULT '[]'::jsonb,
	"cover_image_url" text,
	"brochure_url" text,
	"floor_plan_url" text,
	"general_plan_url" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"brand" text,
	"managing_company" text,
	"is_partner_project" boolean DEFAULT false,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"assigned_broker_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"nationality" text,
	"budget" jsonb,
	"preferred_areas" jsonb DEFAULT '[]'::jsonb,
	"property_type" text,
	"timeline" text,
	"market_preference" text,
	"source" text,
	"stage" text DEFAULT 'lead' NOT NULL,
	"notes" text,
	"score" integer DEFAULT 0 NOT NULL,
	"score_breakdown" jsonb,
	"scored_at" timestamp with time zone,
	"language" text,
	"last_contact_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"agent_id" uuid,
	"type" text NOT NULL,
	"title" text,
	"body" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"behavior" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_lead_tags" (
	"lead_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aygent_lead_tags_lead_id_tag_id_pk" PRIMARY KEY("lead_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "aygent_projects" ADD CONSTRAINT "aygent_projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aygent_leads" ADD CONSTRAINT "aygent_leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aygent_leads" ADD CONSTRAINT "aygent_leads_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aygent_activities" ADD CONSTRAINT "aygent_activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aygent_activities" ADD CONSTRAINT "aygent_activities_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aygent_tags" ADD CONSTRAINT "aygent_tags_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aygent_lead_tags" ADD CONSTRAINT "aygent_lead_tags_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "aygent_lead_tags" ADD CONSTRAINT "aygent_lead_tags_tag_id_aygent_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."aygent_tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "aygent_projects_company_idx" ON "aygent_projects" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "aygent_projects_developer_idx" ON "aygent_projects" USING btree ("developer");
--> statement-breakpoint
CREATE INDEX "aygent_projects_district_idx" ON "aygent_projects" USING btree ("district");
--> statement-breakpoint
CREATE INDEX "aygent_projects_sale_status_idx" ON "aygent_projects" USING btree ("sale_status");
--> statement-breakpoint
CREATE INDEX "aygent_projects_price_range_idx" ON "aygent_projects" USING btree ("min_price","max_price");
--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_projects_company_reelly_idx" ON "aygent_projects" USING btree ("company_id","reelly_id");
--> statement-breakpoint
CREATE INDEX "aygent_leads_company_stage_idx" ON "aygent_leads" USING btree ("company_id","stage");
--> statement-breakpoint
CREATE INDEX "aygent_leads_company_score_idx" ON "aygent_leads" USING btree ("company_id","score");
--> statement-breakpoint
CREATE INDEX "aygent_leads_agent_idx" ON "aygent_leads" USING btree ("agent_id");
--> statement-breakpoint
CREATE INDEX "aygent_leads_company_updated_idx" ON "aygent_leads" USING btree ("company_id","updated_at");
--> statement-breakpoint
CREATE INDEX "aygent_activities_lead_created_idx" ON "aygent_activities" USING btree ("lead_id","created_at");
--> statement-breakpoint
CREATE INDEX "aygent_activities_company_type_idx" ON "aygent_activities" USING btree ("company_id","type");
--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_tags_company_name_idx" ON "aygent_tags" USING btree ("company_id","name");
