/**
 * Shared time-formatting helpers.
 *
 * All timestamps the server emits are intended to be UTC. Some routes return
 * ISO-8601 strings without an explicit `Z` suffix (e.g. PG `timestamp without
 * time zone` columns). Browsers treat such strings as *local* time, which
 * produces offsets of +4h in Dubai (+0400). `parseServerTimestamp` normalises
 * these so every caller sees the same wall-clock time regardless of column
 * type.
 */

export function parseServerTimestamp(input: string | number | Date | null | undefined): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.valueOf()) ? null : input;
  if (typeof input === "number") {
    const d = new Date(input);
    return Number.isNaN(d.valueOf()) ? null : d;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  // Already includes a timezone designator? Pass through.
  const hasTimezone = /(Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const withTz = hasTimezone ? trimmed : `${trimmed}Z`;
  const parsed = new Date(withTz);
  if (Number.isNaN(parsed.valueOf())) {
    // Last-ditch: try the raw value so at least some date renders.
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.valueOf()) ? null : fallback;
  }
  return parsed;
}

export function formatClockTime(
  input: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
): string {
  const d = parseServerTimestamp(input);
  if (!d) return "";
  return d.toLocaleTimeString([], opts);
}

export function formatShortDate(
  input: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  const d = parseServerTimestamp(input);
  if (!d) return "";
  return d.toLocaleDateString([], opts);
}

export function formatDateTime(
  input: string | number | Date | null | undefined,
): string {
  const d = parseServerTimestamp(input);
  if (!d) return "";
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
