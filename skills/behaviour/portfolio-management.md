---
name: portfolio-management
description: >
  Manage rental property portfolios — tenancy lifecycle, RERA rent calculations,
  lease renewals, vacancy management.
  Use when: managing landlord properties, tenancy renewals, or rent calculations.
  Don't use when: dealing with off-plan sales or lead qualification.
---

# Portfolio Management Skill

## Tenancy Lifecycle

### Active Tenancy Monitoring
For each managed property, track:
- Lease start date and end date.
- Current annual rent.
- Payment frequency (cheques: 1, 2, 4, 6, or 12).
- Tenant name and contact.
- Landlord name and contact.
- Last maintenance request.

### Renewal Timeline (Automated Alerts)

| Days Before Lease End | Action |
|----------------------|--------|
| 90 days | Alert agency owner: "Lease for [Property] expires on [Date]. Tenant: [Name]. Current rent: AED [X]. Recommend starting renewal discussion." |
| 60 days | Draft renewal notice with RERA-calculated maximum increase. Queue for owner approval. |
| 45 days | If no response from tenant to renewal offer: send follow-up. If tenant declines: alert owner to begin vacancy marketing. |
| 30 days | Escalate if no resolution. "Lease for [Property] expires in 30 days. Status: [pending/declined/no response]. Action needed." |
| 14 days | Final escalation. If no renewal signed, prepare vacancy listing. |

### Renewal Notice Template
```
Dear [Tenant Name],

Your tenancy agreement for [Property Address] expires on [Date].

We would like to offer a renewal at AED [New Rent]/year, effective [New Start Date].
This represents a [X%] [increase/no change] from your current rent of AED [Current Rent].

This adjustment is within the RERA-permitted maximum of [Y%] based on the current RERA Rental Index for this area.

Please confirm your acceptance by [Response Deadline — 14 days from notice].

Best regards,
[Agent Name], [Agency Name]
```

## RERA Rent Increase Calculation

Use the `calculate_rera_rent` tool. The 5-band system:

| Current Rent vs RERA Index | Maximum Increase |
|---------------------------|-----------------|
| 0-10% below market rate | No increase allowed |
| 11-20% below market rate | Up to 5% |
| 21-30% below market rate | Up to 10% |
| 31-40% below market rate | Up to 15% |
| 40%+ below market rate | Up to 20% |

### Rules
- Always calculate the RERA-permitted maximum before proposing any rent increase.
- Never propose an increase above the RERA maximum — it is illegal.
- If the current rent is within 10% of market rate, advise the landlord that no increase is permitted.
- Present the calculation to the owner: "Current rent: AED X. RERA index for this area: AED Y. Difference: Z%. Maximum permitted increase: W%."

## Vacancy Management

When a property becomes vacant:
1. Create a listing: property details, photos, asking rent based on RERA index and comparable listings.
2. Search existing lead pipeline for potential tenants using `match_deal_to_leads`.
3. List on portals (if connected): Property Finder, Bayut, Dubizzle.
4. Report to owner: "Property [Address] is now vacant. Listed at AED [X]/year. [Y] potential matches in pipeline."
5. Track days vacant. Escalate to owner if vacant > 30 days with recommendations (price reduction, staging, etc.).

## Landlord Communication

### Monthly Report (to landlord via email)
For managed properties, send monthly:
- Rent collection status (paid/pending/overdue).
- Maintenance requests and resolution status.
- Market update for their area (rent trends).
- Upcoming lease events (renewals, inspections).

### Maintenance Requests
- Log all maintenance requests with date, description, urgency.
- Structural issues: landlord's responsibility. Notify immediately.
- Wear and tear: tenant's responsibility. Advise accordingly.
- Emergency (AC failure in summer, water leak): escalate immediately to owner.

## DLD Fee Calculations

For property acquisitions managed on behalf of landlords, use `calculate_dld_fees`:
- DLD transfer: 4% + AED 580 admin.
- Title deed: AED 4,200.
- NOC from developer: AED 500-5,000.
- Mortgage registration (if applicable): 0.25% of loan amount.
- Always present total acquisition cost, not just the property price.

## Tools Used
- `manage_property` — CRUD for managed properties
- `manage_landlord` — landlord records
- `manage_tenancy` — tenancy records and lifecycle
- `calculate_rera_rent` — RERA-compliant rent increase calculation
- `calculate_dld_fees` — total acquisition cost calculation
- `list_documents` — property documents
- `create_portal` — tenant/landlord portal
- `get_portal_activity` — portal engagement tracking
- `send_email` — landlord/tenant communications
- `send_whatsapp` — quick notifications
