CREATE TABLE "aygent_agent_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"service" text NOT NULL,
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
CREATE TABLE "aygent_agent_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"content" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_call_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"agent_name" text DEFAULT 'Ayla',
	"agency_name" text,
	"voice" text DEFAULT 'Kore',
	"language" text DEFAULT 'auto',
	"system_prompt_base" text,
	"filler_phrases" jsonb,
	"no_answer_behavior" text DEFAULT 'hangup',
	"voicemail_script" text,
	"retry_count" integer DEFAULT 2,
	"inbound_enabled" boolean DEFAULT false,
	"inbound_greeting" text,
	"inbound_after_hours" text,
	"inbound_always_answer" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_call_scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"opening_line" text,
	"key_points" jsonb,
	"on_yes" text,
	"on_no" text,
	"on_callback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"lead_id" uuid,
	"twilio_call_sid" text,
	"direction" text,
	"purpose" text,
	"status" text,
	"duration_sec" integer,
	"outcome" text,
	"transcript" text,
	"summary" text,
	"cost_usd" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_campaign_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"current_step" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"next_send_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"opens" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_campaign_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"subject" text,
	"body" text,
	"delay_days" integer DEFAULT 1,
	"delay_hours" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"status" text DEFAULT 'active',
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_dld_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"transaction_id" text,
	"procedure_name_en" text,
	"project_name_en" text,
	"actual_worth" real,
	"property_usage_en" text,
	"instance_date" text,
	"building_name_en" text,
	"trans_group_en" text,
	"property_type_en" text,
	"property_sub_type_en" text,
	"rooms_en" text,
	"area_name_en" text,
	"reg_type_en" text,
	"master_project_en" text,
	"meter_sale_price" real,
	"nearest_metro_en" text,
	"nearest_mall_en" text,
	"nearest_landmark_en" text,
	"has_parking" boolean,
	"no_of_buyers" integer,
	"no_of_sellers" integer,
	"unit_number" text,
	"price_per_sqft" real,
	"size_sqft" real,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"name" text NOT NULL,
	"type" text,
	"file_url" text,
	"file_size" integer,
	"mime_type" text,
	"lead_id" uuid,
	"project_id" uuid,
	"landlord_id" uuid,
	"managed_property_id" uuid,
	"tenancy_id" uuid,
	"expires_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_guardrails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"rule" text NOT NULL,
	"condition" text,
	"action" text,
	"enabled" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_landlords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"dob" text,
	"passport" text,
	"emirates_id" text,
	"nationality" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_listing_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"purpose" text,
	"location" text,
	"bedrooms" integer,
	"max_price" real,
	"property_type" text,
	"is_active" boolean DEFAULT true,
	"last_checked" timestamp with time zone,
	"last_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"source" text,
	"category" text,
	"summary" text,
	"image_url" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_portal_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_id" uuid NOT NULL,
	"type" text,
	"project_id" uuid,
	"document_id" uuid,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_portals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"slug" text,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp with time zone,
	"shared_projects" jsonb,
	"shared_documents" jsonb,
	"custom_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"landlord_id" uuid,
	"unit" text,
	"building_name" text,
	"street_address" text,
	"area" text,
	"property_type" text,
	"bedrooms" integer,
	"bathrooms" integer,
	"sqft" real,
	"floor" text,
	"view_type" text,
	"parking_spaces" integer,
	"title_deed_no" text,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"sale_value" real,
	"purchase_price" real,
	"service_charge" real,
	"status" text DEFAULT 'vacant',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_tenancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"managed_property_id" uuid NOT NULL,
	"tenant_name" text,
	"tenant_phone" text,
	"tenant_email" text,
	"tenant_passport" text,
	"tenant_emirates_id" text,
	"tenant_nationality" text,
	"tenant_notes" text,
	"rent" real,
	"lease_start" timestamp with time zone,
	"lease_end" timestamp with time zone,
	"security_deposit" real,
	"payment_frequency" text,
	"ejari_number" text,
	"status" text DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_viewings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"lead_id" uuid,
	"project_id" uuid,
	"calendar_event_id" text,
	"datetime" timestamp with time zone,
	"location" text,
	"status" text DEFAULT 'scheduled',
	"reminder_sent" boolean DEFAULT false,
	"confirmation_sent" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_whatsapp_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"content" text,
	"is_default" boolean DEFAULT false,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aygent_whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"lead_id" uuid,
	"chat_jid" text,
	"message_id" text,
	"from_me" boolean,
	"sender_name" text,
	"sender_phone" text,
	"content" text,
	"media_type" text,
	"media_url" text,
	"status" text DEFAULT 'received',
	"timestamp" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aygent_agent_credentials" ADD CONSTRAINT "aygent_agent_credentials_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_agent_credentials" ADD CONSTRAINT "aygent_agent_credentials_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_agent_memory" ADD CONSTRAINT "aygent_agent_memory_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_agent_memory" ADD CONSTRAINT "aygent_agent_memory_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_call_configs" ADD CONSTRAINT "aygent_call_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_call_configs" ADD CONSTRAINT "aygent_call_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_call_scripts" ADD CONSTRAINT "aygent_call_scripts_config_id_aygent_call_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."aygent_call_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_call_logs" ADD CONSTRAINT "aygent_call_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_call_logs" ADD CONSTRAINT "aygent_call_logs_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_campaign_enrollments" ADD CONSTRAINT "aygent_campaign_enrollments_campaign_id_aygent_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."aygent_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_campaign_enrollments" ADD CONSTRAINT "aygent_campaign_enrollments_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_campaign_steps" ADD CONSTRAINT "aygent_campaign_steps_campaign_id_aygent_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."aygent_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_campaigns" ADD CONSTRAINT "aygent_campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_dld_transactions" ADD CONSTRAINT "aygent_dld_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_documents" ADD CONSTRAINT "aygent_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_documents" ADD CONSTRAINT "aygent_documents_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_guardrails" ADD CONSTRAINT "aygent_guardrails_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_guardrails" ADD CONSTRAINT "aygent_guardrails_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_landlords" ADD CONSTRAINT "aygent_landlords_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_listing_watches" ADD CONSTRAINT "aygent_listing_watches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_listing_watches" ADD CONSTRAINT "aygent_listing_watches_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_news" ADD CONSTRAINT "aygent_news_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_portal_activity" ADD CONSTRAINT "aygent_portal_activity_portal_id_aygent_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."aygent_portals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_portals" ADD CONSTRAINT "aygent_portals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_portals" ADD CONSTRAINT "aygent_portals_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_properties" ADD CONSTRAINT "aygent_properties_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_properties" ADD CONSTRAINT "aygent_properties_landlord_id_aygent_landlords_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."aygent_landlords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_tenancies" ADD CONSTRAINT "aygent_tenancies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_tenancies" ADD CONSTRAINT "aygent_tenancies_managed_property_id_aygent_properties_id_fk" FOREIGN KEY ("managed_property_id") REFERENCES "public"."aygent_properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_viewings" ADD CONSTRAINT "aygent_viewings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_viewings" ADD CONSTRAINT "aygent_viewings_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_whatsapp_templates" ADD CONSTRAINT "aygent_whatsapp_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_whatsapp_messages" ADD CONSTRAINT "aygent_whatsapp_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_whatsapp_messages" ADD CONSTRAINT "aygent_whatsapp_messages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_whatsapp_messages" ADD CONSTRAINT "aygent_whatsapp_messages_lead_id_aygent_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."aygent_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aygent_agent_cred_agent_service_idx" ON "aygent_agent_credentials" USING btree ("agent_id","service");--> statement-breakpoint
CREATE INDEX "aygent_agent_cred_company_idx" ON "aygent_agent_credentials" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_agent_memory_agent_subject_type_idx" ON "aygent_agent_memory" USING btree ("agent_id","subject","type");--> statement-breakpoint
CREATE INDEX "aygent_agent_memory_agent_type_idx" ON "aygent_agent_memory" USING btree ("agent_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_call_configs_company_agent_idx" ON "aygent_call_configs" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_call_scripts_config_purpose_idx" ON "aygent_call_scripts" USING btree ("config_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_call_logs_twilio_sid_idx" ON "aygent_call_logs" USING btree ("twilio_call_sid");--> statement-breakpoint
CREATE INDEX "aygent_call_logs_company_created_idx" ON "aygent_call_logs" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "aygent_call_logs_lead_idx" ON "aygent_call_logs" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_campaign_enroll_campaign_lead_idx" ON "aygent_campaign_enrollments" USING btree ("campaign_id","lead_id");--> statement-breakpoint
CREATE INDEX "aygent_campaign_enroll_status_next_idx" ON "aygent_campaign_enrollments" USING btree ("status","next_send_at");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_campaign_steps_campaign_step_idx" ON "aygent_campaign_steps" USING btree ("campaign_id","step_number");--> statement-breakpoint
CREATE INDEX "aygent_campaigns_company_idx" ON "aygent_campaigns" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "aygent_campaigns_status_idx" ON "aygent_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "aygent_dld_area_name_idx" ON "aygent_dld_transactions" USING btree ("area_name_en");--> statement-breakpoint
CREATE INDEX "aygent_dld_trans_group_idx" ON "aygent_dld_transactions" USING btree ("trans_group_en");--> statement-breakpoint
CREATE INDEX "aygent_dld_instance_date_idx" ON "aygent_dld_transactions" USING btree ("instance_date");--> statement-breakpoint
CREATE INDEX "aygent_dld_property_sub_type_idx" ON "aygent_dld_transactions" USING btree ("property_sub_type_en");--> statement-breakpoint
CREATE INDEX "aygent_dld_area_date_idx" ON "aygent_dld_transactions" USING btree ("area_name_en","instance_date");--> statement-breakpoint
CREATE INDEX "aygent_dld_building_date_idx" ON "aygent_dld_transactions" USING btree ("building_name_en","instance_date");--> statement-breakpoint
CREATE INDEX "aygent_dld_source_idx" ON "aygent_dld_transactions" USING btree ("source");--> statement-breakpoint
CREATE INDEX "aygent_documents_company_idx" ON "aygent_documents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "aygent_documents_lead_idx" ON "aygent_documents" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "aygent_documents_project_idx" ON "aygent_documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "aygent_guardrails_company_agent_idx" ON "aygent_guardrails" USING btree ("company_id","agent_id");--> statement-breakpoint
CREATE INDEX "aygent_landlords_company_idx" ON "aygent_landlords" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "aygent_landlords_company_name_idx" ON "aygent_landlords" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "aygent_listing_watches_company_active_idx" ON "aygent_listing_watches" USING btree ("company_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_news_company_url_idx" ON "aygent_news" USING btree ("company_id","url");--> statement-breakpoint
CREATE INDEX "aygent_news_source_idx" ON "aygent_news" USING btree ("source");--> statement-breakpoint
CREATE INDEX "aygent_news_category_idx" ON "aygent_news" USING btree ("category");--> statement-breakpoint
CREATE INDEX "aygent_news_published_at_idx" ON "aygent_news" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "aygent_portal_activity_portal_created_idx" ON "aygent_portal_activity" USING btree ("portal_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_portals_lead_idx" ON "aygent_portals" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_portals_slug_idx" ON "aygent_portals" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "aygent_portals_company_idx" ON "aygent_portals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "aygent_properties_company_idx" ON "aygent_properties" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "aygent_properties_company_status_idx" ON "aygent_properties" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "aygent_properties_landlord_idx" ON "aygent_properties" USING btree ("landlord_id");--> statement-breakpoint
CREATE INDEX "aygent_tenancies_company_idx" ON "aygent_tenancies" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "aygent_tenancies_property_idx" ON "aygent_tenancies" USING btree ("managed_property_id");--> statement-breakpoint
CREATE INDEX "aygent_tenancies_company_status_lease_idx" ON "aygent_tenancies" USING btree ("company_id","status","lease_end");--> statement-breakpoint
CREATE INDEX "aygent_viewings_company_datetime_idx" ON "aygent_viewings" USING btree ("company_id","datetime");--> statement-breakpoint
CREATE INDEX "aygent_viewings_lead_idx" ON "aygent_viewings" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "aygent_viewings_status_idx" ON "aygent_viewings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "aygent_wa_tpl_company_category_idx" ON "aygent_whatsapp_templates" USING btree ("company_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "aygent_wa_msg_message_id_idx" ON "aygent_whatsapp_messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "aygent_wa_msg_company_agent_chat_idx" ON "aygent_whatsapp_messages" USING btree ("company_id","agent_id","chat_jid","timestamp");--> statement-breakpoint
CREATE INDEX "aygent_wa_msg_lead_idx" ON "aygent_whatsapp_messages" USING btree ("lead_id");