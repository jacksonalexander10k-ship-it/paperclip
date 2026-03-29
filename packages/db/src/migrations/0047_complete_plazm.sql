ALTER TABLE "aygent_activities" DROP CONSTRAINT "aygent_activities_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "aygent_leads" DROP CONSTRAINT "aygent_leads_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "aygent_projects" DROP CONSTRAINT "aygent_projects_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "aygent_tags" DROP CONSTRAINT "aygent_tags_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "aygent_activities" ADD CONSTRAINT "aygent_activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_leads" ADD CONSTRAINT "aygent_leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_projects" ADD CONSTRAINT "aygent_projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aygent_tags" ADD CONSTRAINT "aygent_tags_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;