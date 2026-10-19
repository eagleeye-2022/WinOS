/**
 * Dot colour shown next to a team's name on the DSM and Report team boards (/dsm/all, /report/all).
 * Known teams get a fixed colour by name so it doesn't shift when teams are filtered or reordered;
 * any other team falls back to the old position-based palette.
 */

// Checked in order; SMM first so a name like "SMM Marketing" stays cyan.
const TEAM_DOT_COLORS: { match: RegExp; className: string }[] = [
  { match: /\bsmm\b/i, className: "bg-cyan-500" },
  { match: /marketing/i, className: "bg-blue-500" },
  { match: /creative/i, className: "bg-yellow-400" },
  { match: /\btech/i, className: "bg-violet-500" },
];

const FALLBACK_DOT_COLORS = ["bg-primary", "bg-primary", "bg-success", "bg-warning"] as const;

export function teamDotColor(teamName: string, fallbackIndex = 0): string {
  return (
    TEAM_DOT_COLORS.find((c) => c.match.test(teamName))?.className ??
    FALLBACK_DOT_COLORS[fallbackIndex % FALLBACK_DOT_COLORS.length]
  );
}
