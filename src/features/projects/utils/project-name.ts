/**
 * Project pill label (DSM project column): the part before the first ":" ("MGM : MalavGram" →
 * "MGM"); with no ":", the first 5 characters + "." when longer ("Kosmetics" → "Kosme.").
 */
export function projectPillName(name: string | null | undefined): string {
  const full = (name || "").trim();
  const idx = full.indexOf(":");
  const beforeColon = idx === -1 ? "" : full.slice(0, idx).trim();
  if (beforeColon) return beforeColon;
  return full.length > 5 ? `${full.slice(0, 5)}.` : full;
}

/** Short project name for /projects: the part before the first ":" ("MGM : MalavGram" → "MGM");
 *  the full name when there's no ":" (or nothing before it). Show the full name on hover. */
export function shortProjectName(name: string | null | undefined): string {
  const full = (name || "").trim();
  const idx = full.indexOf(":");
  if (idx === -1) return full;
  const short = full.slice(0, idx).trim();
  return short || full;
}
