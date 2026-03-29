---
name: viewing-scheduling
description: >
  Book property viewings, propose time slots, send confirmations and reminders,
  handle no-shows, and post-viewing follow-up.
  Use when: a lead wants to see a property or a viewing needs to be scheduled.
  Don't use when: the lead is still in early qualification and has not expressed interest in visiting.
---

# Viewing Scheduling Skill

## Booking Flow

### Step 1: Propose Time Slots
When a lead expresses interest in viewing a property:
1. Check the assigned broker's calendar availability using `check_availability`.
2. Propose 3 time slots to the lead via WhatsApp:
   ```
   Great! I have a few slots available for a viewing of [Property/Project]:

   1. [Day], [Date] at [Time]
   2. [Day], [Date] at [Time]
   3. [Day], [Date] at [Time]

   Which works best for you? Or suggest another time and I'll check.
   ```
3. Slots should be spread across 2-3 days. Avoid proposing all slots on the same day.
4. Prefer morning (10am-12pm) and late afternoon (4pm-6pm) — Dubai heat makes midday viewings unpleasant.

### Step 2: Confirm the Viewing
Once the lead selects a slot:
1. Create a calendar event using `create_event` with: property address, lead name, broker name, lead phone.
2. Send WhatsApp confirmation to the lead:
   ```
   Confirmed! Your viewing of [Property/Project] is set for [Day], [Date] at [Time].

   Location: [Address / Google Maps link]
   You'll be meeting: [Broker Name]

   See you there!
   ```
3. Notify the assigned broker via WhatsApp: "Viewing confirmed: [Lead Name] at [Property] on [Date] at [Time]. Lead info: [phone], [brief context]."

### Step 3: Day-Before Reminder
Send a reminder to the lead 24 hours before the viewing:
```
Just a friendly reminder — your viewing of [Property/Project] is tomorrow at [Time].

Location: [Address / Google Maps link]
See you there!
```

Also remind the broker: "Reminder: Viewing with [Lead Name] tomorrow at [Time] at [Property]."

### Step 4: Post-Viewing Follow-Up
Within 2 hours after the scheduled viewing time, send:
```
Hi [Name]! How did the viewing go? Would you like to:
- See more options in the area?
- Get the payment plan details?
- Schedule another viewing?

Let me know!
```

## Handling Changes

### Rescheduling
If the lead asks to reschedule:
1. Cancel the existing calendar event.
2. Propose 3 new time slots.
3. Update the broker.
4. Send new confirmation once a slot is selected.

### Cancellation
If the lead cancels:
1. Cancel the calendar event.
2. Notify the broker.
3. Respond to the lead: "No problem! Let me know whenever you'd like to reschedule."
4. Follow up in 48 hours: "Hi [Name], would you still like to view [Property]? Happy to find a time that works."

### No-Show
If the broker reports the lead didn't show up:
1. Send ONE follow-up message: "Hi [Name], we missed you at today's viewing. No worries — would you like to reschedule?"
2. Do not send a second message if there is no response. Log the no-show.
3. Flag to CEO if the lead had a high score (8+) — they may have gone cold or switched to a competitor.

## Rules
- Never book a viewing without broker availability confirmation.
- Always include the property address and a map link in confirmations.
- Viewings should be at least 45 minutes apart to allow travel time between properties.
- If multiple viewings are requested on the same day, propose a logical route to minimize travel.
- Weekend viewings (Friday/Saturday in Dubai) are common — do not avoid them.
- Virtual viewings (video call) can be offered for overseas leads who cannot attend in person.

## Approval Flow
- Viewing confirmations: require approval via CEO Chat unless auto-approve is configured for viewings.
- The approval card shows: lead name, property, date/time, assigned broker.
