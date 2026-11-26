import {
  expandOccurrences,
  describeRule,
  parseRule,
  serializeRule,
  type RecurrenceRule,
} from "@/features/calendar/recurrence";
import { toIsoDateStr } from "./utils";

export { describeRule, parseRule, serializeRule, type RecurrenceRule };

/**
 * Checks whether a recurring DSM task starting at `startDate` (UTC midnight)
 * should appear on `targetDate` (UTC midnight).
 *
 * Uses `expandOccurrences` from the calendar recurrence engine, anchoring
 * UTC-midnight DSM dates into IST (+05:30) where UTC 00:00 = 05:30 IST on the
 * same calendar date.
 */
export function matchesDsmRecurrence(
  startDate: Date,
  rule: RecurrenceRule,
  targetDate: Date,
  endDate?: Date | null
): boolean {
  const targetKey = toIsoDateStr(targetDate);
  const startKey = toIsoDateStr(startDate);
  if (targetKey < startKey) return false;
  if (endDate && targetKey > toIsoDateStr(endDate)) return false;

  const dayStart = new Date(targetKey + "T00:00:00.000Z");
  const dayEnd = new Date(targetKey + "T23:59:59.999Z");
  const anchorStart = new Date(startKey + "T00:00:00.000Z");
  const anchorEnd = new Date(startKey + "T01:00:00.000Z");

  const occs = expandOccurrences(anchorStart, anchorEnd, rule, dayStart, dayEnd);
  return occs.some((o) => toIsoDateStr(o.start) === targetKey);
}

/**
 * Compact badge label for a recurring DSM task row (e.g. "Daily", "Mon–Fri", "Weekly").
 */
export function formatRecurrenceBadge(rule: RecurrenceRule, startDate: Date): string {
  if (rule.freq === "DAILY" && rule.interval === 1) return "Daily";
  if (
    rule.freq === "WEEKLY" &&
    rule.interval === 1 &&
    rule.byDay &&
    rule.byDay.length === 5 &&
    ["MO", "TU", "WE", "TH", "FR"].every((d) => rule.byDay!.includes(d as RecurrenceRule["byDay"] extends (infer U)[] | undefined ? U : never))
  ) {
    return "Weekdays";
  }
  if (rule.freq === "WEEKLY" && rule.interval === 1) return "Weekly";
  if (rule.freq === "MONTHLY" && rule.interval === 1) return "Monthly";
  if (rule.freq === "YEARLY" && rule.interval === 1) return "Yearly";
  return describeRule(rule, startDate);
}
