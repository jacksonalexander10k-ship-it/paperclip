---
name: facebook-ads
description: >
  Create, launch, optimise, and report on Facebook/Instagram ad campaigns
  for Dubai real estate lead generation.
  Use when: owner wants to run paid ads, generate leads via Facebook/Instagram,
  launch a marketing campaign, boost a post, or get more enquiries.
  Don't use when: sending organic posts (use content-instagram),
  managing drip campaigns (use campaign-management),
  or handling inbound leads (use lead-response).
---

# Facebook & Instagram Ads — Dubai Real Estate Playbook

## Overview

Facebook/Instagram Lead Ads are the primary paid lead generation channel for Dubai real estate.
The agency connects their Facebook Ad Account via OAuth. You create campaigns via the Facebook
Marketing API tools. Leads submit their info inside Facebook (no landing page needed). The lead
data arrives via webhook and the Lead Agent follows up within minutes.

Your job: propose the right campaign, get approval, launch it, monitor it, optimise it, report on it.

---

## Campaign Objectives — When to Use Each

### Lead Generation (DEFAULT for real estate)
- Uses Facebook Lead Forms — prospects submit name/phone/email WITHOUT leaving Facebook/Instagram
- Best for: generating buyer/investor enquiries for specific projects or areas
- Target CPL in Dubai RE: AED 15–60 depending on segment and project tier
- ALWAYS use this unless the owner specifically requests something else
- Pre-filled fields from Facebook profile increase completion rate by 30–50%

### Traffic (to landing page)
- Use when: the agency has a specific project landing page or you generate one with `generate_landing_page`
- Best for: high-value luxury projects where a richer experience sells better
- Higher cost per lead but often higher quality leads (more intent to click through)
- Combine with Facebook Pixel on the landing page for retargeting

### Engagement / Brand Awareness
- Use for: new agency brand building, market presence, community growth
- Lower priority — only suggest if the owner explicitly asks for brand building
- Good for luxury agencies that want to build reputation before generating leads

### Remarketing / Retargeting
- Use when: agency has website traffic or existing lead lists
- Show ads to people who visited the landing page but didn't submit
- Show new project ads to people who enquired about similar projects before
- Usually highest ROI because the audience is already warm

---

## The Campaign Creation Flow

When the owner asks for leads or marketing, follow this sequence:

### Step 1 — Understand the Goal
Ask or infer:
- Which project, area, or property type?
- Any budget preference? (suggest if they don't know)
- Specific audience in mind? (nationality, budget range, investor vs end-user)
- Do they have creative assets (photos/videos) or should you generate?
- Timeline — when to start, how long to run?

If the owner says "I don't know, you suggest" — use agency_context to check their focus areas,
active inventory, and recent performance. Propose the most logical campaign.

### Step 2 — Assemble the Campaign
Build the full campaign structure:
- **Campaign**: objective + name
- **Ad Set**: audience targeting + budget + schedule + placements
- **Ad**: creative (image/video/carousel) + copy (headline, primary text, description)
- **Lead Form** (if Lead Gen objective): fields + intro + thank you screen

### Step 3 — Present for Approval
Create an approval card with the FULL campaign previewed:

```json
{
  "type": "approval_required",
  "action": "launch_fb_campaign",
  "campaign_name": "JVC Off-Plan — Lead Gen",
  "objective": "Lead Generation",
  "budget": "AED 150/day for 14 days (AED 2,100 total)",
  "audience": "UAE, age 28-55, interests: real estate investment, Dubai property",
  "placements": "Facebook Feed + Instagram Feed + Instagram Stories (automatic)",
  "creative_type": "Carousel — 4 project images",
  "ad_copy": {
    "headline": "JVC Off-Plan from AED 800K",
    "primary_text": "New payment plans available. 1-3 BR apartments in Jumeirah Village Circle. Register for exclusive pricing and floor plans.",
    "cta": "Learn More"
  },
  "lead_form_fields": ["Full Name", "Phone", "Email", "Budget Range"],
  "estimated_results": "15-40 leads over 14 days",
  "estimated_cpl": "AED 50-140"
}
```

### Step 4 — Launch
On approval, execute the tools in order:
1. `create_fb_campaign` — campaign with objective
2. `create_fb_ad_set` — targeting, budget, schedule
3. `create_fb_lead_form` — form fields and messaging
4. `create_fb_ad` — creative + copy attached to ad set
5. Confirm to CEO: "Campaign is live. I'll report on performance daily."

### Step 5 — Monitor & Report
- Day 1-3: Let Facebook's algorithm learn. Do NOT make changes.
- Day 4+: Check performance daily. Report to CEO in morning brief.
- Report format:
  ```
  Facebook Ads Update:
  - "JVC Off-Plan" campaign: 12 leads in 4 days, AED 62/lead, AED 744 spent
  - Best performing ad: Carousel variant A (8 leads)
  - Lead quality: 9 of 12 responded to Lead Agent, 3 scored 7+
  ```

### Step 6 — Optimise
- If CPL > 2x target after 7 days: suggest audience or creative changes
- If one ad set outperforms others: suggest shifting budget to winner
- If lead quality is low (leads not responding): suggest tighter targeting or qualifying questions in lead form
- Always get approval before making changes to live campaigns

---

## Audience Targeting — Dubai Real Estate Specific

### Primary Audiences (start here for any campaign)

**Location:**
- UAE-wide (default)
- Or specific emirates if the project is location-sensitive

**Demographics:**
- Age: 28–55 (primary buying demographic)
- All genders (unless project specifically targets, e.g. family communities)

**Interest-Based Targeting:**
- Real estate investment
- Dubai property / Dubai real estate
- Luxury real estate / luxury lifestyle
- Property development
- Mortgage / home financing
- Golden Visa UAE (strong intent signal)

**Behaviour-Based:**
- Frequent international travellers (indicates wealth + mobility)
- Expats living in UAE
- Small business owners (investment-minded)

### Nationality-Specific Targeting (Dubai's key buyer segments)

**Indian/South Asian investors:**
- Interests: NRI investment, India-UAE business corridor, Bollywood (cultural affinity)
- Language: English or Hindi
- Motivation: Golden Visa, rental yield, portfolio diversification
- What to emphasise: payment plans, rental ROI %, Golden Visa eligibility

**Russian/CIS buyers:**
- Interests: luxury lifestyle, international property, business relocation
- Language: Russian
- Motivation: lifestyle, asset protection, residency
- What to emphasise: lifestyle imagery, price per sqft, direct ROI numbers
- Ad copy style: direct, metrics-first, no fluff

**British/European expats:**
- Interests: expat life Dubai, relocation, international schools
- Language: English
- Motivation: lifestyle upgrade, tax efficiency, end-user living
- What to emphasise: community amenities, schools nearby, lifestyle

**Chinese investors:**
- Interests: overseas property investment, China-Dubai trade
- Language: Mandarin (Phase 2)
- Motivation: diversification, Golden Visa, education for children
- What to emphasise: developer reputation, handover timeline, payment security

**Arab/GCC buyers:**
- Interests: luxury brands, premium property, family living
- Language: Arabic
- Motivation: end-user, family home, upgrade
- What to emphasise: community, privacy, premium finishes, developer prestige

### Lookalike Audiences (MOST POWERFUL — always recommend)
- Upload the agency's existing lead list (100+ contacts minimum) as a Custom Audience
- Create a 1% Lookalike = Facebook finds people similar to existing leads
- This almost always outperforms interest-based targeting
- Suggest this whenever the agency has historical lead data

### Retargeting Audiences
- Website visitors (requires Facebook Pixel on agency website/landing pages)
- Lead form openers who didn't submit (people who started but didn't finish)
- People who engaged with the agency's Instagram/Facebook page
- Existing leads who went cold (re-engage with new projects)

---

## Budget Guidelines

### Minimum Viable Test
- AED 100/day for 7 days = AED 700 total
- Enough to get initial data but may not exit Facebook's learning phase
- Use only for testing a new audience or creative concept

### Recommended Starting Budget
- AED 150–200/day for 14 days = AED 2,100–2,800 total
- This gives Facebook enough data to optimise (target: 50 lead events to exit learning phase)
- Good balance of cost and data quality

### Scaling Budget
- AED 300–500/day for established campaigns with proven CPL
- Only scale campaigns that have demonstrated good lead quality (not just low CPL)

### Budget Rules
- Never launch below AED 50/day — insufficient data, Facebook can't optimise
- Facebook needs approximately 50 conversions (leads) to exit the "learning phase"
- During learning phase, performance is unstable — warn the owner
- Increase budget by max 20% per day to avoid resetting the learning phase
- If budget cap is hit, pause and inform CEO — never auto-increase spend

### What to Tell the Owner About Costs
- "A typical Dubai RE Facebook campaign costs AED 30–80 per lead"
- "We need about AED 2,000–3,000 to properly test a campaign"
- "Once we know what works, we can scale to your target lead volume"
- Never guarantee specific results — use ranges and benchmarks

---

## Ad Creative — Dubai Real Estate Best Practices

### Format Performance (ranked for Dubai RE)
1. **Carousel** (4–6 images) — best for showcasing multiple units/views of a project
2. **Single Image** — best for urgency ("Last 5 units") or simple offers
3. **Video** (15–30 seconds) — best for luxury projects and lifestyle positioning
4. **Collection** — best for agencies with multiple projects to showcase

### Image Guidelines
- High-quality renders or real photography (never stock photos of generic buildings)
- Show interiors AND exteriors
- Include the view/scenery if the project has one (Marina, Creek, Golf Course)
- Text overlay: project name + "From AED X" + area name (keep text under 20% of image)
- Bright, aspirational imagery — Dubai's luxury positioning matters

### Video Guidelines
- First 3 seconds: show the most impressive visual (aerial shot, interior, pool area)
- 15–30 seconds optimal length (longer = higher drop-off)
- Include text captions (many watch without sound)
- End with clear CTA: "Register for exclusive pricing"
- Use tool `generate_social_content` or request owner for existing video assets

### Ad Copy Formula (Dubai RE proven structure)

**Primary Text (above the image):**
```
[Hook — what makes this special]
[2-3 key selling points with specific details]
[CTA — what to do next]

Example:
"New launch in JVC — 1 & 2 BR apartments starting from AED 800K.
- 5-year post-handover payment plan
- 7-8% estimated rental yield
- Golden Visa eligible (2BR+)
Register now for exclusive floor plans and pricing."
```

**Headline (below the image):**
- Short, specific, include price or key hook
- Examples: "JVC Apartments from AED 800K" / "10% Down — Move In 2026" / "Last Units Available"

**Description (small text below headline):**
- Agency name + brief qualifier
- Example: "Dubai Properties — RERA Licensed | 15+ Years Experience"

### Creative Rules — NEVER Do
- Never use guaranteed rental yield language ("guaranteed 8% return") — RERA violation
- Never use unofficial renders or floor plans
- Never copy competitor creatives
- Never use misleading pricing (always "from" or "starting from")
- Never use stock photos of people in Dubai settings (looks fake)

### Creative Generation
If the owner doesn't have creative assets:
- Use `generate_social_content` to create ad images
- Use the agency's existing project materials (brochures, renders from developer)
- Ask: "Do you have marketing materials from the developer for [project]?"
- For video: use HeyGen or ask owner for existing walkthrough footage

---

## Lead Form Design (for Lead Gen campaigns)

### Standard Fields (ALWAYS include)
1. **Full Name** — pre-filled from Facebook profile
2. **Phone Number** — pre-filled from Facebook profile
3. **Email** — pre-filled from Facebook profile

### Custom Questions (pick 1–2 maximum)
Choose based on what matters most to this agency:

- "What is your budget range?"
  - Under AED 500K / 500K–1M / 1M–2M / 2M–5M / Above 5M
- "When are you looking to buy?"
  - Immediately / Within 3 months / Within 6 months / Just exploring
- "Are you looking for investment or personal use?"
  - Investment / Personal use / Both
- "Preferred area?"
  - [List 4-5 areas relevant to this campaign]

### Form Rules
- Maximum 4 fields total (3 standard + 1 custom). Every extra field reduces submissions by ~15%.
- Include a brief intro screen: "Register to receive exclusive pricing and floor plans for [Project Name]."
- Thank you screen: "Thanks! Our team will contact you within the hour."
  (This sets the expectation for Lead Agent's fast follow-up.)
- Privacy policy link: use the agency's website privacy policy URL

---

## Optimisation Playbook

### Days 1–3: Learning Phase
- DO NOT make any changes
- Performance will be volatile — this is normal
- Tell the CEO: "Campaign is in Facebook's learning phase. I'll have meaningful data by day 4."

### Days 4–7: Initial Assessment
- Check CPL (cost per lead) vs target
- Check CTR (click-through rate) — benchmark: 0.8–2% for Dubai RE
- Check lead form completion rate — benchmark: 15–30%
- If CPL > 2x target: flag to CEO with diagnosis (audience too broad? creative not resonating?)

### Day 7+: Optimisation Cycle
**What to optimise (in order of impact):**
1. **Kill underperformers**: Pause ad sets with CTR < 0.5% or CPL > 3x target
2. **Scale winners**: Increase budget by 20% on ad sets with CPL below target
3. **Creative refresh**: If CTR drops below 0.8%, the creative is fatiguing — create new variants
4. **Audience expansion**: If winning audience is small, create a lookalike or broaden interests

**What NOT to do:**
- Don't change targeting AND creative at the same time (can't tell what worked)
- Don't increase budget by more than 20%/day (resets learning phase)
- Don't pause and restart campaigns (kills accumulated learning)

### Lead Quality Assessment (critical)
Low CPL means nothing if the leads don't respond. Track:
- What % of Facebook leads responded to Lead Agent's first WhatsApp? (target: 40%+)
- What % qualified as score 5+? (target: 20%+)
- What % booked a viewing? (target: 5%+)

If lead quality is poor:
- Add a qualifying question to the lead form (filters out tyre-kickers)
- Tighten targeting (narrower interests, smaller lookalike %)
- Change ad copy to be more specific about price/requirements (self-qualifying)

### When to Recommend Stopping a Campaign
- CPL > 3x target after 14 days of optimisation
- Lead quality consistently poor (< 10% response rate over 2 weeks)
- Owner's budget cap reached
- Project sold out or no longer available

Always frame as a recommendation: "I recommend pausing this campaign. Here's why: [data]. Shall I stop it or try a different approach?"

---

## Reporting to CEO

### Daily (included in morning brief when campaigns are active)
```
Facebook Ads:
- [Campaign Name]: X leads today, AED Y/lead, AED Z spent today
- Total leads this week: X | Avg CPL: AED Y | Budget remaining: AED Z
```

### Weekly (detailed performance review)
```
Facebook Ads Weekly Report:
- Campaign: [Name]
- Leads this week: X (target: Y)
- Cost per lead: AED X (target: AED Y)
- Total spend: AED X of AED Y budget
- Lead quality: X% responded, X scored 5+, X booked viewings
- Top performing ad: [Variant name] — X leads at AED Y/lead
- Recommendation: [Scale / Maintain / Adjust targeting / Pause]
```

### Campaign Completion Report
When a campaign ends or is paused, provide a full summary:
- Total leads generated
- Average CPL
- Total spend
- Lead quality breakdown (responded / qualified / viewing / closed)
- ROI estimate if any deals closed from campaign leads
- Recommendation for next campaign

---

## Multi-Campaign Management

### Running Multiple Campaigns
- Maximum 3 active campaigns per ad account (to avoid audience overlap)
- If audiences overlap > 30%, consolidate into one campaign with multiple ad sets
- Use campaign budget optimisation (CBO) to let Facebook distribute budget across ad sets

### Campaign Naming Convention
`[Agency Short Name] — [Project/Area] — [Objective] — [Date]`
Example: "DubaiProp — JVC Off-Plan — LeadGen — Mar2026"

### A/B Testing
- Test one variable at a time: creative OR audience OR copy
- Run each variant for minimum 5 days before judging
- Need at least 100 impressions per variant for statistical significance
- Report test results to CEO with clear winner and recommendation

---

## Google Ads (Future — Same Principles)

When Google Ads tools become available, the same playbook applies with these differences:
- Search ads target people actively searching ("buy apartment JVC Dubai")
- Higher intent than Facebook (they're searching) but more expensive per lead
- Performance Max campaigns let Google's AI optimise across Search, Display, YouTube, Gmail
- Use Google Ads alongside Facebook, not instead of — they serve different stages of awareness

---

## Tools Used

- `create_fb_campaign` — create campaign with objective and budget structure
- `create_fb_ad_set` — define targeting, budget, schedule, placements
- `create_fb_ad` — attach creative and copy to ad set
- `create_fb_lead_form` — define lead form fields, intro, and thank you screen
- `get_fb_campaign_stats` — pull performance metrics (impressions, clicks, leads, CPL, spend)
- `pause_fb_campaign` — pause a running campaign
- `update_fb_budget` — adjust daily or lifetime budget
- `get_fb_audiences` — list available targeting options and custom/lookalike audiences
- `generate_social_content` — generate ad creative images
- `generate_landing_page` — create landing page for traffic campaigns

## Approval Rules
- New campaign launch: ALWAYS requires CEO approval (full campaign preview in approval card)
- Budget increase > 20%: requires CEO approval
- Campaign pause: requires CEO approval
- Creative refresh (same campaign, new ads): requires CEO approval
- Daily monitoring and reporting: automatic, no approval needed
- Audience adjustments within same budget: requires CEO approval
