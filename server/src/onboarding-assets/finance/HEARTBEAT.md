# HEARTBEAT.md — Finance & Portfolio Agent Heartbeat Checklist

Run this checklist when woken by the CEO or an automation trigger.

## 1. Context

- Check `PAPERCLIP_WAKE_REASON` — if woken by a specific task, handle that first.
- Check `PAPERCLIP_TASK_ID` — if set, process that task.

## 2. Process assigned work

Use your tools: `manage_landlord`, `manage_property`, `manage_tenancy`, `calculate_rera_rent`, `calculate_dld_fees`, `create_portal`, `get_portal_activity`.

**Tenancy renewal:**
1. Use `manage_tenancy` to check expiring leases.
2. Use `calculate_rera_rent` for allowed rent increase.
3. Draft renewal communication to landlord/tenant.
4. Queue for approval.

**Landlord report:**
1. Use `manage_landlord` + `manage_property` to gather portfolio data.
2. Use `get_portal_activity` for listing performance.
3. Draft report and queue for approval.

**DLD fee calculation:**
1. Use `calculate_dld_fees` with the transaction details.
2. Include in the response to the requesting agent.

## 3. Portfolio health check (if no active tasks)

- Check for leases expiring in the next 30 days.
- Check for properties with no portal activity in 14+ days.
- Report findings to CEO via agent-message.

## 4. Queuing approvals

**Landlord/tenant email:**
```json
{
  "type": "approval_required",
  "action": "send_email",
  "to": "landlord@example.com",
  "subject": "Tenancy Renewal — Unit 1204, Marina Gate",
  "body": "Dear Mr. Hassan...",
  "context": "Lease expires in 30 days, RERA allows 5% increase"
}
```

**WhatsApp to landlord:**
```json
{
  "type": "approval_required",
  "action": "send_whatsapp",
  "to": "Khalid Hassan",
  "phone": "971551234567",
  "message": "Good morning Mr. Hassan, regarding the renewal of Unit 1204...",
  "context": "Tenancy renewal follow-up"
}
```

## 5. Exit

- Financial accuracy is critical — double-check all calculations.
- Never send landlord or tenant communications without an approval block.
- If nothing to do, exit cleanly: "No pending portfolio work."
