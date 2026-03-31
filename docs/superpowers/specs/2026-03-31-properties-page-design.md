# Properties Page — Design Spec

**Date:** 2026-03-31
**Status:** Approved

## Overview

A standalone `/properties` page where agency owners manage their property inventory — listings they are selling (secondary/resale) and renting. Two tabs: Sales and Rentals. Card grid layout (Property Finder / Bayut style). Each property has a full pipeline from "Available" through to "Sold" or "Rented."

This page also serves as the structured property database that agents reference when qualifying leads, generating content, scheduling viewings, and reporting to the CEO.

## Key Decisions

- **Layout:** Card grid (Variation B) — photo-first, 3 columns on desktop, 2 tablet, 1 mobile
- **Tabs:** Sales / Rentals with count badges
- **Pipeline:** Full status pipeline per listing type, displayed as clickable filter pills
- **Lead linking:** Properties link to interested leads (many-to-many), count shown on card
- **Owner details:** Visible on detail page, not on card grid
- **Agent integration:** Agents can query, match, and create draft properties (via approvals)
- **Entry methods:** Manual form + agent-created (through approval system) + CSV import

## Data Model

### Schema changes to `aygent_properties`

Add three columns to the existing table:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `listing_type` | `text` | `'sale'` | `'sale'` or `'rental'` — drives tab split |
| `rental_price` | `real` | `null` | Annual rent in AED (separate from `sale_value`) |
| `pipeline_status` | `text` | `'available'` | Pipeline stage for sales/rental tracking. The existing `status` field (default `'vacant'`) remains for occupancy state — `pipeline_status` is the new field that drives the UI pipeline bar and card badges. |

### Pipeline stages

**Sales:** `available` → `viewing_scheduled` → `offer_received` → `under_negotiation` → `sold`

**Rentals:** `available` → `viewing_scheduled` → `application_received` → `under_contract` → `rented`

### New join table: `aygent_property_leads`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK, auto-generated |
| `company_id` | `uuid` | FK → companies, for scoping |
| `property_id` | `uuid` | FK → aygent_properties |
| `lead_id` | `uuid` | FK → aygent_leads |
| `interest_level` | `text` | `'interested'`, `'viewing'`, `'offered'` |
| `created_at` | `timestamp` | Auto |

Indexes: `(company_id)`, `(property_id)`, `(lead_id)`, unique `(property_id, lead_id)`.

### Existing relationships (no changes needed)

- `aygent_properties.landlord_id` → `aygent_landlords` (owner details)
- `aygent_viewings` already has property context via lead + location fields
- `aygent_properties.photos` is `jsonb` array of photo URLs

## API Routes

New file: `server/src/routes/properties.ts`

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/properties` | List properties for company. Returns items + pipeline summary counts. Query params: `listing_type`, `pipeline_status`, `area`, `bedrooms`, `property_type`, `price_min`, `price_max` |
| `GET` | `/properties/:id` | Single property with linked leads (+ counts), landlord details, recent activity |
| `POST` | `/properties` | Create property |
| `PATCH` | `/properties/:id` | Update fields or pipeline status |
| `DELETE` | `/properties/:id` | Soft delete (set status to `inactive`) |
| `GET` | `/properties/:id/leads` | List leads interested in this property |
| `POST` | `/properties/:id/leads` | Link a lead to this property with interest level |
| `DELETE` | `/properties/:id/leads/:leadId` | Unlink a lead |

### Response shape for `GET /properties`

```json
{
  "items": [
    {
      "id": "uuid",
      "listing_type": "sale",
      "pipeline_status": "available",
      "building_name": "Binghatti Hills",
      "area": "JVC",
      "property_type": "apartment",
      "bedrooms": 2,
      "bathrooms": 2,
      "sqft": 1245,
      "sale_value": 1850000,
      "photos": ["url1", "url2"],
      "lead_count": 3,
      "created_at": "2026-03-19T...",
      "landlord_name": "Ahmed Al Hashimi"
    }
  ],
  "summary": {
    "available": 4,
    "viewing_scheduled": 2,
    "offer_received": 1,
    "sold": 1
  }
}
```

Service layer: `server/src/services/properties.ts` — Drizzle queries with lead count as a subquery (no N+1).

All routes scoped by `company_id` via middleware (existing pattern).

## UI Pages & Components

### New files

| File | Purpose |
|------|---------|
| `ui/src/pages/Properties.tsx` | List page — card grid with tabs, pipeline bar, filters |
| `ui/src/pages/PropertyDetail.tsx` | Detail page — full property info, owner, linked leads, activity |
| `ui/src/api/properties.ts` | API client + React Query hooks |

### Properties.tsx (list page)

**Structure:**
1. `PageHeader` — title "Properties", Filter button (ghost), "+ Add Property" button (primary)
2. `PageTabBar` — Sales / Rentals tabs with count badges (same component as Agents page)
3. Pipeline status bar — row of clickable pills showing count per stage, doubles as filter
4. Card grid — `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5`
5. Empty state when no properties — icon + message + "Add your first property" CTA

**Each property card:**
- Photo area (140px height): property photo or gradient placeholder with building emoji
  - Status badge overlay (top-left): colored dot + stage label
  - Photo count badge (top-right): "6 photos"
- Body:
  - Price: `AED 1,850,000` (sale) or `AED 120,000/yr` (rental) — 16px, font-weight 800
  - Location: `Building Name · Area` — 12px, muted
  - Specs row (border-top separator): `2 Beds · 2 Baths · 1,245 sqft` — 11.5px, muted
  - Footer row: lead count (primary color) + days listed (muted)
- Sold/rented cards rendered at 50% opacity
- Hover: border-color shifts to primary/25%, translateY(-1px), subtle shadow

**Card click:** navigates to `/properties/:id`

**Filters (expandable panel):**
- Area (text input or dropdown of areas from existing properties)
- Bedrooms (1, 2, 3, 4, 5+)
- Price range (min/max)
- Property type (apartment, villa, townhouse, studio, penthouse)

**Add Property dialog:**
- Form fields: listing type (sale/rental toggle), building name, area, unit, property type, bedrooms, bathrooms, sqft, floor, view type, parking spaces, price (sale value or rental price based on type), photos upload, landlord picker (search existing or create new), notes
- On submit: POST to `/properties`, invalidate query cache, close dialog

### PropertyDetail.tsx (detail page)

**Structure:**
1. `PageHeader` with back button + building name as title
2. Photo gallery — horizontal scroll of property photos (or placeholder)
3. Key info card:
   - Price (large) + status badge
   - Specs: beds, baths, sqft, floor, view, parking
   - Location: building, area, street address
   - Pipeline status stepper — visual progress showing current stage highlighted
4. Owner section:
   - Landlord name, phone (clickable), email
   - "Add Owner" button if no landlord linked
5. Interested leads section:
   - List of linked leads: name, score badge, interest level, last contact date
   - "Link Lead" button to associate an existing lead
6. Activity timeline:
   - Status changes, agent actions, viewings — chronological
7. Edit button — opens form pre-filled with current values

### Navigation

Add to sidebar between "Work" and "Team" sections:

```tsx
<SidebarSection label="Inventory">
  <SidebarNavItem to="/properties" label="Properties" icon={Building2} />
</SidebarSection>
```

### Routes (App.tsx)

```tsx
<Route path="/properties" element={<Properties />} />
<Route path="/properties/:id" element={<PropertyDetail />} />
```

## Agent Integration

### How agents use properties

| Agent | Usage |
|-------|-------|
| **Lead Agent** | Queries `GET /properties` filtered by lead's budget/area/bedroom preferences. Suggests matching listings in WhatsApp conversations. Auto-links interested leads via `POST /properties/:id/leads`. |
| **Content Agent** | Pulls property details + photos to generate Instagram posts, pitch decks, landing pages. Structured data means no manual copy-paste. |
| **Viewing Agent** | References property record for address, unit, floor when scheduling viewings. |
| **Portfolio Agent** | Creates draft property listings when onboarding new landlords. Updates pipeline status after viewings/offers. |
| **CEO** | Morning brief includes inventory summary: count by status, new listings this week, stale listings (30+ days available). |

### Agent-created properties (approval flow)

1. Agent creates property via `POST /properties` with `pipeline_status: 'draft'`
2. Approval card appears in CEO Chat showing property details
3. Owner approves → status updated to `available`, appears in grid
4. Owner edits → modified version saved, then published
5. Owner rejects → property remains in draft / deleted

### New skill file

`skills/behaviour/property-management.md` — instructs agents on:
- How to search properties (`GET /properties` with filters)
- How to match leads to properties (budget range, area overlap, bedroom match)
- How to create draft listings (required fields, photo handling)
- How to update pipeline status (valid transitions only)
- How to link leads to properties with appropriate interest level
- When to escalate (offer received → notify CEO, stale listing 30+ days → suggest price adjustment)

## Status Colors

Consistent across pipeline pills, card badges, and detail page stepper:

| Stage | Light mode | Dark mode |
|-------|-----------|-----------|
| Available | `oklch(0.38 0.15 162)` — green | `oklch(0.72 0.18 162)` — emerald |
| Viewing Scheduled | `oklch(0.45 0.2 280)` — purple | `oklch(0.75 0.2 280)` — violet |
| Offer Received / Application Received | `oklch(0.55 0.15 60)` — amber | `oklch(0.828 0.189 84.429)` — gold |
| Under Negotiation / Under Contract | `oklch(0.5 0.18 40)` — orange | `oklch(0.646 0.222 41.116)` — orange |
| Sold / Rented | `var(--muted-fg)` at 50% opacity | `var(--muted-fg)` at 50% opacity |

## Seed Data

Extend `packages/db/src/seed-demo.ts` with 8-12 demo properties across both Sales and Rentals tabs, various pipeline stages, linked to existing demo leads. Covers: JVC, Downtown, Marina, Arjan, MBR City areas. Mix of apartments, studios, villas.
