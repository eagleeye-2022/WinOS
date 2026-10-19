/** Shared avatar helpers — use these everywhere so a person gets the same initials and the same
 *  colour on every screen (DSM, Srijan, Whyfi, ...). */

const AVATAR_COLORS = [
  "bg-amber-500 text-white",
  "bg-emerald-500 text-white",
  "bg-sky-500 text-white",
  "bg-purple-500 text-white",
  "bg-rose-500 text-white",
  "bg-indigo-500 text-white",
  "bg-teal-500 text-white",
  "bg-orange-500 text-white",
];

/** First + last name initials ("Mohit Kumar Thakre" → "MT"); single names use their first two letters. */
export function getInitials(name?: string | null, fallback = "U"): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

/** Stable background + text classes derived from the name. */
export function getAvatarColor(name?: string | null): string {
  const s = name || "";
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
