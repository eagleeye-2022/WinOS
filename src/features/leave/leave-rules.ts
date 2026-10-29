// Pure leave-policy rules used by applyLeaveAction / approveLeaveRequestAction.
// DB-free (dates are "YYYY-MM-DD" keys) so they can be unit-tested.

import { addDaysToKey, dateFromKey, isWeekendKey } from "@/features/attendance/utils";

export type LeaveDurationType = "FULL_DAY" | "HALF_DAY" | "EARLY_LEAVE" | "QUARTER_DAY" | "HOURLY";
type Unit = "DAYS" | "WEEKS" | "MONTHS" | "YEARS" | "HOURS";

/** The LeaveType columns the rules read. */
export interface LeavePolicy {
  name: string;
  isActive: boolean;
  effectiveDate: Date;
  expiryDate: Date | null;
  exceededRule: "DO_NOT_ALLOW" | "ALLOW_WITHOUT_LIMIT" | "ALLOW_UNTIL_YEAR_END" | "MARK_AS_LOP";
  allowFullDay: boolean;
  allowHalfDay: boolean;
  allowQuarterDay: boolean;
  allowHourly: boolean;
  allowPastDays: boolean;
  pastDaysLimit: number;
  pastDaysUnit: Unit;
  allowAdvanceDays: boolean;
  advanceDaysLimit: number;
  advanceDaysUnit: Unit;
  minAdvanceNotice: number;
  minAdvanceNoticeUnit: Unit;
  minLeavePerRequest: number;
  maxLeavePerRequest: number;
  maxConsecutiveDays: number;
  applicableDays: string[];
  sandwichPolicy: boolean;
  sandwichWeekends: boolean;
  sandwichHolidays: boolean;
  supportingDocPolicy: "NOT_REQUIRED" | "ALWAYS_REQUIRED" | "REQUIRED_WHEN_EXCEEDS";
  docExceedsDays: number | null;
}

const UNIT_DAYS: Record<Unit, number> = { DAYS: 1, WEEKS: 7, MONTHS: 30, YEARS: 365, HOURS: 1 / 24 };
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDays = (value: number, unit: Unit) => value * (UNIT_DAYS[unit] ?? 1);
const round = (n: number) => Math.round(n * 100) / 100;
const plural = (n: number, word = "day") => `${n} ${word}${n === 1 ? "" : "s"}`;

function keyDiff(a: string, b: string): number {
  return Math.round((dateFromKey(a)!.getTime() - dateFromKey(b)!.getTime()) / 86_400_000);
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isPartialDay(type: LeaveDurationType): boolean {
  return type !== "FULL_DAY";
}

function durationAllowed(policy: LeavePolicy, type: LeaveDurationType): boolean {
  if (type === "FULL_DAY") return policy.allowFullDay;
  if (type === "HALF_DAY") return policy.allowHalfDay;
  if (type === "QUARTER_DAY") return policy.allowQuarterDay;
  return policy.allowHourly; // HOURLY, EARLY_LEAVE
}

const DURATION_LABEL: Record<LeaveDurationType, string> = {
  FULL_DAY: "Full-day",
  HALF_DAY: "Half-day",
  QUARTER_DAY: "Quarter-day",
  HOURLY: "Hourly",
  EARLY_LEAVE: "Early leave",
};

export interface LeaveDayCount {
  /** Leave days charged against the balance. */
  days: number;
  /** Working days inside the range (the ones the leave actually covers). */
  workingKeys: string[];
}

/**
 * Days a request costs. Full-day leave counts working days, plus weekends/holidays that fall between
 * two leave days when the sandwich policy says so. Partial-day leave is always a single working day.
 * Returns an error message when nothing in the range can be taken as leave.
 */
export function countLeaveDays(args: {
  fromKey: string;
  toKey: string;
  durationType: LeaveDurationType;
  /** Client-supplied fraction for hourly / early leave (e.g. 0.25). */
  requestedDays: number;
  isHoliday: (key: string) => boolean;
  policy: Pick<LeavePolicy, "sandwichPolicy" | "sandwichWeekends" | "sandwichHolidays">;
}): LeaveDayCount | { error: string } {
  const { fromKey, toKey, durationType, isHoliday, policy } = args;
  const isOff = (k: string) => isWeekendKey(k) || isHoliday(k);

  if (isPartialDay(durationType)) {
    if (fromKey !== toKey) return { error: `${DURATION_LABEL[durationType]} leave must be on a single date.` };
    if (isOff(fromKey)) return { error: "That date is a weekend or holiday — no leave is needed." };
    const days =
      durationType === "HALF_DAY"
        ? 0.5
        : durationType === "QUARTER_DAY"
        ? 0.25
        : Math.min(1, Math.max(0.05, Number(args.requestedDays) || 0.25));
    return { days: round(days), workingKeys: [fromKey] };
  }

  const keys: string[] = [];
  for (let k = fromKey; k <= toKey; k = addDaysToKey(k, 1)) keys.push(k);
  const workingKeys = keys.filter((k) => !isOff(k));
  if (workingKeys.length === 0) return { error: "The selected dates are all weekends or holidays." };

  const first = workingKeys[0];
  const last = workingKeys[workingKeys.length - 1];
  const sandwiched = policy.sandwichPolicy
    ? keys.filter(
        (k) =>
          k > first &&
          k < last &&
          isOff(k) &&
          ((isHoliday(k) && policy.sandwichHolidays) || (!isHoliday(k) && isWeekendKey(k) && policy.sandwichWeekends))
      ).length
    : 0;

  return { days: workingKeys.length + sandwiched, workingKeys };
}

/** Checks a request against the leave type's application rules. Returns an error message or null. */
export function validateLeaveRequest(args: {
  policy: LeavePolicy;
  fromKey: string;
  toKey: string;
  todayKey: string;
  durationType: LeaveDurationType;
  days: number;
  workingKeys: string[];
  hasAttachment: boolean;
}): string | null {
  const { policy, fromKey, toKey, todayKey, durationType, days, workingKeys, hasAttachment } = args;

  if (!policy.isActive) return `${policy.name} is not active.`;
  if (fromKey < dateKey(policy.effectiveDate)) {
    return `${policy.name} can only be taken from ${dateKey(policy.effectiveDate)}.`;
  }
  if (policy.expiryDate && toKey > dateKey(policy.expiryDate)) {
    return `${policy.name} can't be taken after ${dateKey(policy.expiryDate)}.`;
  }
  if (!durationAllowed(policy, durationType)) {
    return `${DURATION_LABEL[durationType]} leave isn't allowed for ${policy.name}.`;
  }

  // Past / advance window and notice period.
  if (fromKey < todayKey) {
    if (!policy.allowPastDays) return `${policy.name} can't be applied for past dates.`;
    const back = keyDiff(todayKey, fromKey);
    const limit = toDays(policy.pastDaysLimit, policy.pastDaysUnit);
    if (back > limit) return `${policy.name} can be applied at most ${plural(round(limit))} after the date.`;
  }
  if (fromKey > todayKey) {
    if (!policy.allowAdvanceDays) return `${policy.name} can't be applied in advance.`;
    const ahead = keyDiff(fromKey, todayKey);
    const limit = toDays(policy.advanceDaysLimit, policy.advanceDaysUnit);
    if (ahead > limit) return `${policy.name} can be applied at most ${plural(round(limit))} in advance.`;
    const notice = toDays(policy.minAdvanceNotice, policy.minAdvanceNoticeUnit);
    if (notice > 0 && ahead < notice) {
      return `${policy.name} needs at least ${plural(Math.ceil(notice))} notice.`;
    }
  }

  // Size of the request.
  if (!isPartialDay(durationType) || durationType === "HALF_DAY") {
    if (policy.minLeavePerRequest > 0 && days < policy.minLeavePerRequest) {
      return `${policy.name} needs at least ${plural(policy.minLeavePerRequest)} per request.`;
    }
  }
  if (policy.maxLeavePerRequest > 0 && days > policy.maxLeavePerRequest) {
    return `${policy.name} allows at most ${plural(policy.maxLeavePerRequest)} per request.`;
  }
  const span = keyDiff(toKey, fromKey) + 1;
  if (policy.maxConsecutiveDays > 0 && span > policy.maxConsecutiveDays) {
    return `${policy.name} allows at most ${plural(policy.maxConsecutiveDays)} in a row.`;
  }

  // Weekdays the leave type can be taken on (only the days actually charged).
  if (policy.applicableDays.length > 0) {
    const blocked = workingKeys.find((k) => !policy.applicableDays.includes(SHORT_DAYS[dateFromKey(k)!.getUTCDay()]));
    if (blocked) {
      return `${policy.name} can only be taken on ${policy.applicableDays.join(", ")}.`;
    }
  }

  // Supporting documents.
  if (!hasAttachment) {
    if (policy.supportingDocPolicy === "ALWAYS_REQUIRED") {
      return `${policy.name} needs a supporting document.`;
    }
    if (
      policy.supportingDocPolicy === "REQUIRED_WHEN_EXCEEDS" &&
      policy.docExceedsDays !== null &&
      days > policy.docExceedsDays
    ) {
      return `${policy.name} longer than ${plural(policy.docExceedsDays)} needs a supporting document.`;
    }
  }

  return null;
}

export interface BalanceOutcome {
  isLossOfPay: boolean;
  lopDays: number;
}

/**
 * What happens when `days` is booked against `available`, per the leave type's exceeded rule.
 * Returns an error message when the rule refuses the request.
 */
export function applyExceededRule(args: {
  policy: Pick<LeavePolicy, "name" | "exceededRule">;
  days: number;
  available: number;
}): BalanceOutcome | { error: string } {
  const { policy, days } = args;
  const available = round(args.available);
  if (days <= available) return { isLossOfPay: false, lopDays: 0 };

  switch (policy.exceededRule) {
    case "DO_NOT_ALLOW":
      return {
        error: `Not enough ${policy.name} balance: ${plural(Math.max(0, available))} available, ${plural(days)} requested.`,
      };
    case "MARK_AS_LOP":
      return { isLossOfPay: true, lopDays: round(days - Math.max(0, available)) };
    default:
      // ALLOW_WITHOUT_LIMIT / ALLOW_UNTIL_YEAR_END — the balance goes negative, no LOP.
      return { isLossOfPay: false, lopDays: 0 };
  }
}

/** Balance the employee can still apply against: entitlement minus booked and pending days. */
export function availableToApply(b: {
  allocatedDays: number;
  carriedForward: number;
  adjustedDays: number;
  bookedDays: number;
  pendingDays: number;
}): number {
  return round(b.allocatedDays + b.carriedForward + b.adjustedDays - b.bookedDays - b.pendingDays);
}

// ── Eligibility (applicable to / departments / employment types / service period) ─────────────

export interface EligibilityPolicy {
  name: string;
  applicableTo: "ALL_EMPLOYEES" | "FULL_TIME_ONLY" | "PROBATIONARY" | "CONTRACTORS" | "CUSTOM_DEPARTMENT";
  departments: string[];
  employmentTypes: string[];
  minServicePeriod: number | null;
  minServiceUnit: Unit;
}

export interface EmployeeFacts {
  department: string | null;
  employmentType: string | null;
  profileRole: string | null;
  dateOfJoining: Date | null;
  dateOfConfirmation: Date | null;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Whether the employee may use this leave type on `onKey`. Returns an error message or null.
 * Rules are only enforced on facts the profile actually has — a missing department / employment
 * type / joining date never blocks (an incomplete profile isn't the employee's fault).
 */
export function checkEligibility(policy: EligibilityPolicy, emp: EmployeeFacts, onKey: string): string | null {
  if (policy.departments.length && emp.department && !policy.departments.some((d) => same(d, emp.department!))) {
    return `${policy.name} is only for ${policy.departments.join(", ")}.`;
  }
  if (policy.employmentTypes.length && emp.employmentType && !policy.employmentTypes.some((t) => same(t, emp.employmentType!))) {
    return `${policy.name} is only for ${policy.employmentTypes.join(", ")} employees.`;
  }

  const type = (emp.employmentType || "").toLowerCase();
  if (policy.applicableTo === "FULL_TIME_ONLY" && type && !/full|permanent/.test(type)) {
    return `${policy.name} is only for full-time employees.`;
  }
  if (policy.applicableTo === "CONTRACTORS" && (type || emp.profileRole) && !/contract/.test(type) && emp.profileRole !== "CONTRACTOR") {
    return `${policy.name} is only for contractors.`;
  }
  if (policy.applicableTo === "PROBATIONARY" && emp.dateOfConfirmation && dateKey(emp.dateOfConfirmation) <= onKey) {
    return `${policy.name} is only for employees on probation.`;
  }

  if (policy.minServicePeriod && policy.minServicePeriod > 0 && emp.dateOfJoining) {
    const served = keyDiff(onKey, dateKey(emp.dateOfJoining));
    const needed = toDays(policy.minServicePeriod, policy.minServiceUnit);
    if (served < needed) {
      const unit = policy.minServiceUnit.toLowerCase().replace(/s$/, "");
      return `${policy.name} is available after ${policy.minServicePeriod} ${unit}${policy.minServicePeriod === 1 ? "" : "s"} of service.`;
    }
  }
  return null;
}

// ── Request limits (gap between requests, requests per period, clubbing) ────────────────────

export interface OtherLeave {
  code: string;
  fromKey: string;
  toKey: string;
}

export interface LimitPolicy {
  name: string;
  code: string;
  minGapBetweenRequests: number;
  maxRequestsCount: number;
  maxRequestsPeriod: Unit;
  clubbingRestrictedCodes: string[];
}

/** The working day before / after `key` (weekends skipped). */
function prevWorking(key: string): string {
  let k = addDaysToKey(key, -1);
  while (isWeekendKey(k)) k = addDaysToKey(k, -1);
  return k;
}
function nextWorking(key: string): string {
  let k = addDaysToKey(key, 1);
  while (isWeekendKey(k)) k = addDaysToKey(k, 1);
  return k;
}

function periodWindow(fromKey: string, unit: Unit): [string, string] {
  if (unit === "MONTHS") {
    const start = `${fromKey.slice(0, 7)}-01`;
    const d = dateFromKey(start)!;
    d.setUTCMonth(d.getUTCMonth() + 1);
    return [start, addDaysToKey(d.toISOString().slice(0, 10), -1)];
  }
  if (unit === "YEARS") return [`${fromKey.slice(0, 4)}-01-01`, `${fromKey.slice(0, 4)}-12-31`];
  // DAYS / WEEKS / HOURS: a rolling window ending on the request's start.
  const span = Math.max(1, Math.round(toDays(1, unit) * 1));
  return [addDaysToKey(fromKey, -(span - 1)), fromKey];
}

/**
 * Checks the request against the employee's other pending/approved leave.
 * `others` must not include the request itself.
 */
export function checkRequestLimits(policy: LimitPolicy, fromKey: string, toKey: string, others: OtherLeave[]): string | null {
  const sameType = others.filter((o) => same(o.code, policy.code));

  if (policy.minGapBetweenRequests > 0) {
    const gap = policy.minGapBetweenRequests;
    const tooClose = sameType.find((o) => {
      const before = keyDiff(fromKey, o.toKey) - 1; // whole days between the other leave and this one
      const after = keyDiff(o.fromKey, toKey) - 1;
      return (o.toKey < fromKey && before < gap) || (o.fromKey > toKey && after < gap);
    });
    if (tooClose) {
      return `${policy.name} requests need at least ${plural(gap)} between them (you have one on ${tooClose.fromKey.split("-").reverse().join("/")}).`;
    }
  }

  if (policy.maxRequestsCount > 0) {
    const [start, end] = periodWindow(fromKey, policy.maxRequestsPeriod);
    const inPeriod = sameType.filter((o) => o.fromKey >= start && o.fromKey <= end).length;
    if (inPeriod >= policy.maxRequestsCount) {
      const per = { MONTHS: "month", YEARS: "year", WEEKS: "week", DAYS: "day", HOURS: "day" }[policy.maxRequestsPeriod];
      return `${policy.name} allows at most ${policy.maxRequestsCount} request${policy.maxRequestsCount === 1 ? "" : "s"} per ${per}.`;
    }
  }

  const restricted = policy.clubbingRestrictedCodes.filter((c) => !same(c, policy.code));
  if (restricted.length) {
    const before = prevWorking(fromKey);
    const after = nextWorking(toKey);
    const clash = others.find(
      (o) => restricted.some((c) => same(c, o.code)) && (o.toKey === before || o.fromKey === after || (o.fromKey <= toKey && o.toKey >= fromKey))
    );
    if (clash) return `${policy.name} can't be combined with ${clash.code} leave on the next/previous working day.`;
  }
  return null;
}

// ── Balance calendar: accrual, carry-forward, comp-off validity ─────────────────────────────

/**
 * Part of the yearly allocation that has been earned by `asOfKey`. Monthly / quarterly types earn
 * in steps at the start of each month / quarter; others get the whole allocation up front.
 */
export function accruedAllocation(
  allocationFrequency: string,
  allocatedDays: number,
  annualEntitlement: number,
  asOfKey: string
): number {
  const month = Number(asOfKey.slice(5, 7)); // 1–12
  let earnedOfEntitlement: number | null = null;
  if (allocationFrequency === "MONTHLY") earnedOfEntitlement = (annualEntitlement * month) / 12;
  if (allocationFrequency === "QUARTERLY") earnedOfEntitlement = (annualEntitlement * Math.ceil(month / 3)) / 4;
  if (earnedOfEntitlement === null) return allocatedDays;
  // Anything credited on top of the entitlement (e.g. comp-offs) is available at once.
  const extra = Math.max(0, allocatedDays - annualEntitlement);
  return round(Math.min(allocatedDays, earnedOfEntitlement + extra));
}

/** Days carried into a new year from last year's balance, per the leave type's reset rule. */
export function carryForwardFrom(
  previous: { allocatedDays: number; carriedForward: number; adjustedDays: number; bookedDays: number } | null,
  policy: { allowCarryForward: boolean; carryForwardLimit: number | null; balanceResetRule: string }
): number {
  if (!previous || !policy.allowCarryForward || policy.balanceResetRule !== "CARRY_FORWARD_UP_TO_LIMIT") return 0;
  const left = previous.allocatedDays + previous.carriedForward + previous.adjustedDays - previous.bookedDays;
  return round(Math.max(0, Math.min(left, policy.carryForwardLimit ?? left)));
}

/**
 * Comp-off days still usable on `onKey`. Credits are used oldest-expiry-first; credits that expired
 * before being used are lost. `used` = COMP days already booked or pending.
 */
export function validCompOffDays(credits: { days: number; expiryKey: string }[], used: number, onKey: string): number {
  const total = credits.reduce((s, c) => s + c.days, 0);
  const expired = credits.filter((c) => c.expiryKey < onKey).reduce((s, c) => s + c.days, 0);
  return round(Math.max(0, total - Math.max(used, expired)));
}

/** Comp-off validity: one month after the work date (what the comp-off form tells the employee). */
export function compOffExpiry(workDate: Date): Date {
  const d = new Date(workDate);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/** Credited days for a comp-off duration. */
export function compOffCredit(duration: "FULL_DAY" | "HALF_DAY" | "QUARTER_DAY"): number {
  return duration === "FULL_DAY" ? 1 : duration === "HALF_DAY" ? 0.5 : 0.25;
}
