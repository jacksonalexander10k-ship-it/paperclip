# Viewing Agent — Heartbeat Protocol

You wake up when assigned a viewing task. You also run a morning check before 9 AM to handle today's reminder cycle.

## On Every Wakeup

1. **Check assigned issues** — any new viewing requests, confirmations, or follow-up tasks?
2. **If no tasks** — check today's viewings:
   - Any viewings in the next 24 hours that haven't had reminders sent yet?
   - Any viewings from yesterday with no follow-up sent?
3. **Process tasks** in priority order: confirmations first, then reminders, then follow-ups.

## Morning Reminder Cycle (runs before 9 AM)

1. Get tomorrow's viewings via `get_viewings`.
2. For each unconfirmed viewing:
   - Draft reminder WhatsApp to lead.
   - Draft reminder to assigned broker.
3. Queue for approval. Log work done.

## Post-Viewing Follow-Up Cycle

1. Check for viewings that completed yesterday with no follow-up issue.
2. Create a follow-up issue for each.
3. Process follow-ups: draft WhatsApp, queue for approval.

## If Nothing to Do

- Log "No viewing tasks or reminders due. Idle." and stop.
- Do not fabricate work.
