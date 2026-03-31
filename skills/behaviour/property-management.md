---
name: property-management
description: >
  Search, match, and manage property listings in the agency inventory.
  Use when: a lead asks about available properties, you need to suggest listings,
  or you need to create/update a property record.
  Don't use when: the task is about market research or DLD transactions (use market tools).
---

# Property Management

## Searching Properties

Query the agency's property inventory:

```bash
curl -s "$AYGENCY_URL/api/companies/$COMPANY_ID/properties?listingType=sale&area=JVC&bedrooms=2" \
  -H "Authorization: Bearer $API_KEY" | jq '.items'
```

### Available Filters
- `listingType` — `sale` or `rental`
- `pipelineStatus` — `available`, `viewing_scheduled`, `offer_received`, `under_negotiation`, `sold` (sale) or `application_received`, `under_contract`, `rented` (rental)
- `area` — location name (partial match)
- `bedrooms` — exact number
- `propertyType` — `apartment`, `villa`, `townhouse`, `studio`, `penthouse`
- `priceMin`, `priceMax` — AED range (applies to sale_value)

## Matching Leads to Properties

When qualifying a lead, extract their preferences and search:
1. Get lead budget range, preferred area, bedroom count
2. Query properties: `?listingType=sale&area={area}&bedrooms={beds}&priceMin={min}&priceMax={max}`
3. Present top 2-3 matches to the lead with key details (building, area, price, sqft)
4. Link interested leads: POST to `/properties/{id}/leads` with `{ "leadId": "...", "interestLevel": "interested" }`

## Updating Pipeline Status

When a property's status changes:

```bash
curl -X PATCH "$AYGENCY_URL/api/companies/$COMPANY_ID/properties/$PROPERTY_ID" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pipelineStatus": "viewing_scheduled"}'
```

### Valid Transitions
- Sales: available → viewing_scheduled → offer_received → under_negotiation → sold
- Rentals: available → viewing_scheduled → application_received → under_contract → rented

## Creating Draft Listings

When onboarding a new property (e.g., from a landlord conversation):

```bash
curl -X POST "$AYGENCY_URL/api/companies/$COMPANY_ID/properties" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "listingType": "rental",
    "buildingName": "...",
    "area": "...",
    "propertyType": "apartment",
    "bedrooms": 2,
    "bathrooms": 2,
    "sqft": 1200,
    "rentalPrice": 85000,
    "pipelineStatus": "draft",
    "notes": "New listing from landlord onboarding"
  }'
```

Draft listings require owner approval before becoming visible.

## Escalation Rules
- **Offer received**: Immediately notify CEO with offer details
- **Stale listing (30+ days available)**: Flag to CEO, suggest price adjustment
- **High-demand property (5+ leads)**: Suggest scheduling open house or raising price
