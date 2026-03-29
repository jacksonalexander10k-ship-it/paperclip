import { eq, and, gte, desc } from "drizzle-orm";
import { aygentViewings } from "@paperclipai/db";
import type { ToolDefinition, ToolExecutor } from "./types.js";
import * as calendarClient from "./lib/calendar-client.js";

// ═══════════════════════════════════════════════════
// get_calendar
// ═══════════════════════════════════════════════════

export const getCalendarDefinition: ToolDefinition = {
  name: "get_calendar",
  description:
    "Get the agent's calendar events for a specific date or date range. Use this when the agent asks about their schedule, what's on their calendar, or when they're free/busy.",
  input_schema: {
    type: "object",
    properties: {
      startDate: {
        type: "string",
        description:
          "Start date in ISO format (e.g. '2025-03-15' or '2025-03-15T09:00:00'). Defaults to start of today.",
      },
      endDate: {
        type: "string",
        description:
          "End date in ISO format. Defaults to end of the start date (full day).",
      },
    },
  },
};

export const getCalendarExecutor: ToolExecutor = async (input, _ctx) => {
  const { startDate, endDate } = input as { startDate?: string; endDate?: string };
  return calendarClient.getCalendar({ startDate, endDate });
};

// ═══════════════════════════════════════════════════
// create_event
// ═══════════════════════════════════════════════════

export const createEventDefinition: ToolDefinition = {
  name: "create_event",
  description:
    "Draft a calendar event for the agent. This NEVER creates directly — it returns a preview for the agent to approve, edit, or cancel. Use this when the agent asks to schedule a viewing, meeting, or any calendar event.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Event title (e.g. 'Viewing at Sobha One with Ahmed')",
      },
      date: {
        type: "string",
        description: "Date in ISO format (e.g. '2025-03-15')",
      },
      startTime: {
        type: "string",
        description: "Start time in 24h format (e.g. '15:00')",
      },
      duration: {
        type: "number",
        description: "Duration in minutes (default 60)",
      },
      description: {
        type: "string",
        description: "Event description/notes",
      },
      location: {
        type: "string",
        description: "Event location",
      },
      attendees: {
        type: "array",
        items: { type: "string" },
        description: "List of attendee email addresses",
      },
    },
    required: ["title", "date", "startTime"],
  },
};

export const createEventExecutor: ToolExecutor = async (input, _ctx) => {
  const { title, date, startTime, duration, description, location, attendees } = input as {
    title: string;
    date: string;
    startTime: string;
    duration?: number;
    description?: string;
    location?: string;
    attendees?: string[];
  };
  return {
    type: "approval_required",
    action: "create_event",
    title,
    date,
    startTime,
    duration: duration ?? 60,
    description,
    location,
    attendees,
    status: "pending_approval",
    instructions: "This event will NOT be created until approved. Review and approve, edit, or reject.",
  };
};

// ═══════════════════════════════════════════════════
// check_availability
// ═══════════════════════════════════════════════════

export const checkAvailabilityDefinition: ToolDefinition = {
  name: "check_availability",
  description:
    "Check the agent's calendar availability (free/busy) for a specific date. Returns busy time slots so you can suggest available times. Use this when the agent asks when they're free or wants to find a time for a meeting.",
  input_schema: {
    type: "object",
    properties: {
      date: {
        type: "string",
        description: "Date to check in ISO format (e.g. '2025-03-15')",
      },
    },
    required: ["date"],
  },
};

export const checkAvailabilityExecutor: ToolExecutor = async (input, _ctx) => {
  const { date } = input as { date: string };
  return calendarClient.checkAvailability({ date });
};

// ═══════════════════════════════════════════════════
// schedule_viewing
// ═══════════════════════════════════════════════════

export const scheduleViewingDefinition: ToolDefinition = {
  name: "schedule_viewing",
  description:
    "Schedule a property viewing for a lead. Creates the event in Google Calendar, logs it to the lead's activity timeline, and drafts a WhatsApp confirmation message for the agent to approve. Use when the agent wants to book a viewing or showing.",
  input_schema: {
    type: "object",
    properties: {
      leadId: { type: "string", description: "The lead's database ID" },
      projectName: {
        type: "string",
        description: "Name of the project/development to view",
      },
      datetime: {
        type: "string",
        description: "ISO 8601 datetime string for the viewing",
      },
      location: { type: "string", description: "Address or meeting point" },
      notes: { type: "string", description: "Any additional notes" },
      projectId: {
        type: "string",
        description: "Optional project DB ID if known",
      },
    },
    required: ["leadId", "projectName", "datetime"],
  },
};

export const scheduleViewingExecutor: ToolExecutor = async (input, ctx) => {
  const { leadId, projectName, datetime, location, notes, projectId } = input as {
    leadId: string;
    projectName: string;
    datetime: string;
    location?: string;
    notes?: string;
    projectId?: string;
  };

  const viewing = await ctx.db
    .insert(aygentViewings)
    .values({
      companyId: ctx.companyId,
      agentId: ctx.agentId,
      leadId,
      projectId: projectId ?? null,
      datetime: new Date(datetime),
      location: location ?? projectName,
      notes,
      status: "scheduled",
    })
    .returning();

  return {
    type: "approval_required",
    action: "schedule_viewing",
    viewingId: viewing[0]?.id,
    leadId,
    projectName,
    datetime,
    location: location ?? projectName,
    notes,
    status: "pending_approval",
    instructions: "Viewing created in DB. A WhatsApp confirmation will be drafted for approval.",
  };
};

// ═══════════════════════════════════════════════════
// get_viewings
// ═══════════════════════════════════════════════════

export const getViewingsDefinition: ToolDefinition = {
  name: "get_viewings",
  description:
    "Get scheduled viewings. Can filter by lead or show only upcoming viewings. Use when the agent asks about their viewing schedule.",
  input_schema: {
    type: "object",
    properties: {
      leadId: { type: "string", description: "Filter by specific lead" },
      upcoming: {
        type: "boolean",
        description: "Only show future viewings (default true)",
      },
      limit: {
        type: "number",
        description: "Number to return (default 10)",
      },
    },
  },
};

export const getViewingsExecutor: ToolExecutor = async (input, ctx) => {
  const { leadId, upcoming, limit } = input as {
    leadId?: string;
    upcoming?: boolean;
    limit?: number;
  };

  const take = Math.min(limit ?? 10, 50);
  const t = aygentViewings;
  const conditions = [eq(t.companyId, ctx.companyId)];

  if (leadId) {
    conditions.push(eq(t.leadId, leadId));
  }
  if (upcoming !== false) {
    conditions.push(gte(t.datetime, new Date()));
  }

  const viewings = await ctx.db
    .select()
    .from(t)
    .where(and(...conditions))
    .orderBy(desc(t.datetime))
    .limit(take);

  return {
    viewings: viewings.map((v) => ({
      id: v.id,
      leadId: v.leadId,
      projectId: v.projectId,
      datetime: v.datetime?.toISOString() ?? null,
      location: v.location,
      status: v.status,
      reminderSent: v.reminderSent,
      confirmationSent: v.confirmationSent,
      notes: v.notes,
    })),
    total: viewings.length,
  };
};
