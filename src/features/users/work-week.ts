// Work week (which Saturdays are off) as the profile forms send it: text like "1,3", or "none" when
// every Saturday is a working day. Stored as User.saturdaysOff (Int[]); Sundays are always off.
// Pure helpers — shared by the profile field rules, the server actions and the picker.

import { ALL_SATURDAYS_OFF, normalizeSaturdaysOff, SATURDAY_WEEKS } from "@/features/attendance/utils";

export const SATURDAY_ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"] as const;

/** Form value for "no Saturday off" (an empty string means "not given"). */
export const NO_SATURDAYS_OFF = "none";

export function encodeSaturdaysOff(v: readonly number[] | null | undefined): string {
  const list = normalizeSaturdaysOff(v);
  return list.length ? list.join(",") : NO_SATURDAYS_OFF;
}

/** Parses the form value. Returns null for anything that isn't a valid list. */
export function decodeSaturdaysOff(raw: string): number[] | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === NO_SATURDAYS_OFF) return [];
  if (!/^[1-5](\s*,\s*[1-5])*$/.test(v)) return null;
  return normalizeSaturdaysOff(v.split(",").map((s) => Number(s.trim())));
}

/** "1st & 3rd" / "1st, 2nd & 4th". */
function joinOrdinals(list: readonly number[]): string {
  const words = list.map((n) => SATURDAY_ORDINALS[n - 1]);
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} & ${words[words.length - 1]}` : words[0] ?? "";
}

/** How a work week reads on the profile. */
export function describeSaturdaysOff(v: readonly number[] | null | undefined): string {
  const list = normalizeSaturdaysOff(v);
  if (list.length === SATURDAY_WEEKS.length) return "Saturday & Sunday off";
  if (list.length === 0) return "Only Sunday off (all Saturdays working)";
  return `Sunday + ${joinOrdinals(list)} Saturday off`;
}

/** Quick picks in the work-week picker; any other combination shows as "Custom". */
export const WORK_WEEK_PRESETS: { label: string; value: readonly number[] }[] = [
  { label: "Saturday & Sunday off", value: ALL_SATURDAYS_OFF },
  { label: "Only Sunday off", value: [] },
  { label: "1st & 3rd Saturday off", value: [1, 3] },
  { label: "2nd & 4th Saturday off", value: [2, 4] },
  { label: "3rd & 4th Saturday off", value: [3, 4] },
  { label: "Alternate Saturdays off (1st, 3rd & 5th)", value: [1, 3, 5] },
];
