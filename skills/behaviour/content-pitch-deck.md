---
name: content-pitch-deck
description: >
  Generate investor-grade pitch decks for Dubai off-plan projects.
  Mandatory 3-step approval flow: collect details, confirm, generate.
  Use when: a lead or broker needs a pitch deck or investment brief.
  Don't use when: the request is for social media content or a landing page.
---

# Pitch Deck Generation Skill

## Mandatory 3-Step Flow

NEVER call the generate_pitch_deck tool without completing Steps 1 and 2. This is a hard rule.

### Step 1: Collect Details (One at a Time)

Ask the following, one question per message. The requester can skip any, but warn that the deck will be more generic.

1. **Which project(s)?** (1-3 projects max per deck)
   - "Which project would you like the pitch deck for?"
   - If vague: search projects and suggest matches.

2. **Client name** (for personalization on the cover)
   - "What's the client's name? I'll personalize the cover."
   - Skip OK — deck will say "Prepared for You."

3. **Investment goal**
   - "What's the client's main goal? Capital appreciation, rental yield, lifestyle/end-use, or Golden Visa?"
   - This determines the pitch angle for every slide.

4. **Bedroom type preference**
   - "Any preference on bedrooms? Studio, 1BR, 2BR, 3BR?"
   - Affects pricing and unit-specific data shown.

5. **Budget range**
   - "What's their budget range?"
   - Helps filter units and payment plan options.

6. **Agent details** (for the contact slide)
   - "Your name, phone, and email for the deck?"
   - Auto-fill from agent profile if available.

### Step 2: Confirm Before Generating

Present a summary of all collected details and get explicit approval:

```
Here's what I'll generate:

Project(s): Sobha Hartland II, Dubai Creek Harbour
Prepared for: Ahmed Al Rashid
Goal: Investment — rental yield + Golden Visa
Bedrooms: 2BR
Budget: AED 2-3M
Agent: Sarah, +971 50 111 1111, sarah@agency.ae

Shall I go ahead?
```

Wait for "yes", "go ahead", "confirmed", or equivalent before proceeding.

### Step 3: Generate

Only after explicit approval:
1. Call `generate_pitch_deck` with all collected parameters.
2. The tool generates in the background — inform the requester: "Generating your pitch deck now — it usually takes 1-2 minutes."
3. Once ready, present the PDF link and queue for approval: "Pitch deck is ready! Here's the preview. Shall I send it to the client?"

## What the Pitch Deck Contains

Per project (each gets its own section):
- **Overview + Gallery**: Project renders, developer info, location, completion date.
- **Investment Pitch**: AI-generated copy tailored to the client's stated goal (yield-focused, appreciation-focused, lifestyle-focused, or Golden Visa-focused).
- **ROI Metrics**: Price per sqft, expected rental yield, comparable DLD transactions, historical appreciation.
- **Payment Plan**: Full milestone breakdown with dates and percentages.
- **Location + Lifestyle**: Map context, nearby landmarks, community amenities, school/hospital proximity.
- **Golden Visa**: Eligibility statement if units meet the AED 2M threshold.

Final pages:
- **Comparison table** (if 2-3 projects): side-by-side on key metrics.
- **DLD fee calculation**: Total acquisition cost including 4% DLD + admin fees.
- **Contact slide**: Agent name, phone, email, agency branding.
- **Disclaimer**: Standard financial disclaimer (see dubai-compliance skill).

## Approval Flow
- Generated pitch decks are queued in CEO Chat for review before being sent to any client.
- The approval card shows: PDF preview link, target client name, projects included, and a "Send to client" action.
- Owner can review the PDF, request changes, or approve for sending.
- Sending happens via WhatsApp (PDF attachment) or email (PDF attachment + cover message).

## What NOT to Do
- Never generate a pitch deck without knowing which project(s).
- Never skip the confirmation step — the requester must approve the parameters.
- Never guarantee yields or appreciation in the pitch deck content.
- Never include projects that are not RERA-registered.
- Never send a pitch deck directly to a client without owner approval.
