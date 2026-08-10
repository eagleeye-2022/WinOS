import type { ReactNode } from "react";

type MentionedUser = { id: string; name: string | null; email: string };

/**
 * MentionInput writes "@Label" directly into the plain text at the point the user
 * typed it, so saved text already has mentions embedded inline. Callers must not
 * re-prefix the mentioned users before the text or the mention renders twice.
 */
export function renderTextWithMentions(
  text: string,
  mentioned: MentionedUser[],
  mentionClassName: string
): ReactNode {
  if (mentioned.length === 0) return text;

  const labels = Array.from(
    new Set(mentioned.map((m) => m.name?.split(" ")[0] || m.email.split("@")[0]).filter(Boolean))
  );
  if (labels.length === 0) return text;

  const escaped = labels
    .slice()
    .sort((a, b) => b.length - a.length) // longest first avoids partial overlaps
    .map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(@(?:${escaped.join("|")}))`, "g");
  const tokens = new Set(labels.map((l) => `@${l}`));
  const parts = text.split(pattern);

  return parts.map((part, i) =>
    tokens.has(part) ? (
      <span key={i} className={mentionClassName}>
        {part}
      </span>
    ) : (
      part
    )
  );
}
