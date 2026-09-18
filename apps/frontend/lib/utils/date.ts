/**
 * Date formatting helpers.
 *
 * All API timestamps arrive as ISO-8601 strings. These functions take strings
 * and never `Date`, so the parse boundary stays in one place.
 *
 * The locale is pinned to `en-US` rather than the visitor's locale: an
 * unpinned locale formats differently on the server and the client, which
 * React reports as a hydration mismatch.
 */

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const FULL_DATE = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Parses an ISO string, returning `null` for absent or malformed input. */
function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats as `Jan 2024`. Returns an empty string on invalid input. */
export function formatMonthYear(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? MONTH_YEAR.format(date) : "";
}

/** Formats as `15 January 2024`. Returns an empty string on invalid input. */
export function formatFullDate(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? FULL_DATE.format(date) : "";
}

/**
 * Formats a date range as `Jan 2022 — Present`.
 *
 * A `null` end date means the role or course is ongoing, which is why the
 * backend distinguishes an explicit `null` from an omitted field.
 */
export function formatDateRange(
  startIso: string,
  endIso: string | null,
  ongoingLabel = "Present",
): string {
  const start = formatMonthYear(startIso);
  if (!start) return "";
  return `${start} — ${endIso ? formatMonthYear(endIso) : ongoingLabel}`;
}

/**
 * Returns a duration such as `2 yrs 3 mos`.
 *
 * Months are computed from the calendar difference rather than by dividing
 * elapsed milliseconds, so leap years and unequal month lengths do not
 * accumulate into an off-by-one.
 */
export function formatDuration(
  startIso: string,
  endIso: string | null,
): string {
  const start = parse(startIso);
  if (!start) return "";
  const end = parse(endIso) ?? new Date();

  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());

  // A start later in the month than the end means the final month is partial.
  if (end.getUTCDate() < start.getUTCDate()) months -= 1;
  if (months < 0) return "";

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  if (remainingMonths > 0) parts.push(`${remainingMonths} mo${remainingMonths === 1 ? "" : "s"}`);

  // Anything under a month still represents real time spent.
  return parts.length > 0 ? parts.join(" ") : "< 1 mo";
}

/** Formats a relative time such as `3 days ago`, for guestbook entries. */
export function formatRelativeTime(iso: string): string {
  const date = parse(iso);
  if (!date) return "";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

  const thresholds: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];

  for (const [unit, secondsPerUnit] of thresholds) {
    if (Math.abs(seconds) >= secondsPerUnit) {
      return formatter.format(-Math.round(seconds / secondsPerUnit), unit);
    }
  }

  return formatter.format(-seconds, "second");
}
