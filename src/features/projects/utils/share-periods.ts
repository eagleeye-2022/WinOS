/**
 * Quick periods for sharing a project's effort logs ("Last 7 days", "Last month"…), resolved to an
 * inclusive YYYY-MM-DD from/to against a given "today". Pure — safe on client and server.
 */

export const SHARE_PERIOD_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "last_7", label: "Last 7 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_30", label: "Last 30 days" },
] as const;

export type SharePeriodPreset = (typeof SHARE_PERIOD_PRESETS)[number]["value"];

export function toYYYYMMDD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Weeks start on Monday. */
function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

export function resolveSharePeriod(preset: SharePeriodPreset, today: Date): { from: string; to: string } {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const range = (from: Date, to: Date) => ({ from: toYYYYMMDD(from), to: toYYYYMMDD(to) });
  switch (preset) {
    case "today":
      return range(t, t);
    case "yesterday":
      return range(addDays(t, -1), addDays(t, -1));
    case "this_week":
      return range(mondayOf(t), t);
    case "last_week": {
      const lastMonday = addDays(mondayOf(t), -7);
      return range(lastMonday, addDays(lastMonday, 6));
    }
    case "last_7":
      return range(addDays(t, -6), t);
    case "this_month":
      return range(new Date(t.getFullYear(), t.getMonth(), 1), t);
    case "last_month":
      return range(new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0));
    case "last_30":
      return range(addDays(t, -29), t);
  }
}
