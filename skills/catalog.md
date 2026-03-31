---
name: skill-catalog
description: >
  Master skill menu for the CEO agent. Lists all available skills by category.
  The CEO uses this to assign skills when hiring agents and to understand
  what capabilities each agent has.
---

# Aygency World — Skill Catalog

The CEO uses this catalog to assign skills when hiring agents. Each skill can be assigned to any agent. Domain skills are automatic; behaviour skills and tool groups are assigned per role.

## Domain Knowledge (assigned to all agents automatically)

- **dubai-market** — Dubai areas, pricing per sqft, developer tiers (Emaar/Nakheel/DAMAC etc.), Golden Visa rules, payment plan structures, off-plan vs secondary vs rental market differences, investment analysis framework.
- **dubai-compliance** — RERA advertising rules (no guaranteed yields, RERA-registered projects only), PDPA data protection, opt-out handling, financial disclaimers, escrow accounts, AML awareness.
- **dubai-buyers** — Buyer personas by nationality (Arabic, Russian, Chinese, English, Indian/South Asian), communication preferences, motivations, what to emphasise per segment, red flags.
- **multilingual** — Language detection from first message, respond in same language, greeting conventions per language (Arabic, English, Russian, Mandarin, Hindi, Urdu, French), translation for approval cards.

## Behaviour Skills (assigned per role)

- **lead-response** — First reply rules: respond within 5 minutes, match language, max 3 sentences, never quote exact price, include agent name, one question to start conversation. Templates per language.
- **lead-qualification** — Qualify leads over 2-3 messages (budget, timeline, financing, area, property type). Scoring rubric 0-10 based on source quality + signals. Escalation triggers: score 8+, budget > AED 5M, explicit request for human.
- **lead-followup** — Follow-up cadence by score (hot=daily, warm=48h, cool=weekly, cold=monthly). Stale lead reactivation at 14/30/90 days. Message variation rules. When to stop: 3 unanswered messages.
- **lead-handoff** — When to escalate to human broker (score 8+, budget > 5M, 3+ weeks without progress). Handoff protocol: escalation card, wait for approval, notify broker, tag and release. Monitor: 2-hour broker contact SLA.
- **viewing-scheduling** — Propose 3 time slots, send WhatsApp confirmation + calendar event, day-before reminder, post-viewing follow-up within 2 hours. Handle rescheduling, cancellation, no-shows.
- **content-instagram** — Daily content calendar (7 pillars), carousel structure (hook-value-CTA), caption formula, posting schedule (12pm/6pm/9pm Dubai), hashtag strategy (15-20 per post, rotated).
- **content-pitch-deck** — Mandatory 3-step flow: collect details one at a time, confirm summary, generate. Investor-grade PDF with ROI metrics, payment plans, Golden Visa eligibility, DLD fees.
- **market-monitoring** — Daily DLD transaction scans, weekly price movement analysis (flag >5% changes), new launch detection, listing alerts, competitor activity. Reports: morning brief, weekly summary, immediate alerts.
- **portfolio-management** — Tenancy lifecycle: 90/60/30-day renewal alerts, RERA rent increase calculation (5-band system), vacancy management, landlord monthly reports, maintenance tracking.
- **campaign-management** — Drip campaigns: welcome series, nurture, re-engagement, post-deal. Enrolment rules: one campaign per lead, remove on opt-out or broker assignment. Performance: open/reply/conversion rates.
- **whatsapp-outbound** — Rules for all outbound WhatsApp: 24-hour window management (free-form vs template), template selection by scenario, first contact rules, follow-up cadence, broadcast strategy, opt-out handling, number quality management, 3-strike rule.
- **facebook-ads** — Create, launch, optimise, and report on Facebook/Instagram ad campaigns for Dubai RE lead generation. Campaign setup flow (objective, audience, budget, creative, lead form), approval cards, daily/weekly reporting, optimisation playbook, audience targeting by nationality.
- **call-handling** — Inbound: greet with agency name, capture name/phone/interest/budget. Outbound: prepare context, opening script, post-call logging. Voicemail handling. Call windows: 10am-12pm, 4pm-6pm.

## Tool Groups (assigned per role — CEO assigns relevant groups when hiring)

### Search & Intel (7 tools)
`search_projects`, `get_project_details`, `search_listings`, `watch_listings`, `search_dld_transactions`, `scrape_dxb_transactions`, `get_building_analysis`

### Communication (10 tools)
`search_whatsapp`, `send_whatsapp`, `search_email`, `send_email`, `search_instagram_dms`, `send_instagram_dm`, `post_to_instagram`, `list_whatsapp_templates`, `use_whatsapp_template`, `make_call`

### Lead Pipeline (14 tools)
`search_leads`, `update_lead`, `get_lead_activity`, `tag_lead`, `untag_lead`, `create_tag`, `list_tags`, `get_follow_ups`, `bulk_follow_up`, `bulk_lead_action`, `reactivate_stale_leads`, `match_deal_to_leads`, `deduplicate_leads`, `merge_leads`

### Content Generation (9 tools)
`generate_pitch_deck`, `generate_pitch_presentation`, `generate_landing_page`, `generate_social_content`, `generate_content`, `generate_market_report`, `launch_campaign`, `create_drip_campaign`, `enroll_lead_in_campaign`

### Calendar & Viewings (5 tools)
`get_calendar`, `create_event`, `check_availability`, `schedule_viewing`, `get_viewings`

### Portfolio (5 tools)
`manage_landlord`, `manage_property`, `manage_tenancy`, `calculate_rera_rent`, `calculate_dld_fees`

### Client & Docs (5 tools)
`create_portal`, `get_portal_activity`, `list_documents`, `extract_document_data`, `scrape_url`

### Paid Ads (8 tools)
`create_fb_campaign`, `create_fb_ad_set`, `create_fb_ad`, `create_fb_lead_form`, `get_fb_campaign_stats`, `pause_fb_campaign`, `update_fb_budget`, `get_fb_audiences`

### Market & Admin (7 tools)
`analyze_investment`, `web_search`, `get_news`, `get_campaign_stats`, `create_task`, `remember`, `set_guardrails`

## Default Role-to-Skill Mapping

When the CEO hires an agent, these are the default skill assignments. The CEO can customize.

| Role | Domain Skills | Behaviour Skills | Tool Groups |
|------|--------------|-----------------|-------------|
| CEO | All 4 | catalog (this file) | All groups (read-heavy, write-gated) |
| Lead Agent | All 4 | lead-response, lead-qualification, lead-followup, lead-handoff, whatsapp-outbound | Communication, Lead Pipeline, Search & Intel |
| Content Agent | All 4 | content-instagram, content-pitch-deck, campaign-management, facebook-ads, whatsapp-outbound | Content Generation, Paid Ads, Communication |
| Market Agent | All 4 | market-monitoring | Search & Intel, Market & Admin |
| Viewing Agent | All 4 | viewing-scheduling, whatsapp-outbound | Calendar & Viewings, Communication (send_whatsapp, send_email only) |
| Portfolio Agent | All 4 | portfolio-management, whatsapp-outbound | Portfolio, Client & Docs, Communication (send_email, send_whatsapp only) |
| Call Agent | All 4 | call-handling, whatsapp-outbound | Communication (make_call, send_whatsapp, send_email), Lead Pipeline (search_leads, update_lead) |
| Social Agent | All 4 | content-instagram | Communication (search_instagram_dms, post_to_instagram, send_instagram_dm) |
