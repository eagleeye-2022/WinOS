// Pure helpers for iNotes card versions (no DB access, unit-tested).

export type NoteChecklistSnapshot = { text: string; checked: boolean }[];

/** A card as it was at one version. */
export type NoteSnapshot = {
  title: string | null;
  content: string;
  color: string | null;
  /** ISO string. */
  deadline: string | null;
  checklist: NoteChecklistSnapshot;
};

const asChecklist = (value: unknown): NoteChecklistSnapshot =>
  Array.isArray(value)
    ? value
        .filter((i) => i && typeof i === "object" && typeof (i as { text?: unknown }).text === "string")
        .map((i) => ({ text: (i as { text: string }).text, checked: (i as { checked?: unknown }).checked === true }))
    : [];

/** Normalises a stored version row (deadline as Date, checklist as JSON) into a snapshot. */
export function toNoteSnapshot(row: {
  title?: string | null;
  content?: string | null;
  color?: string | null;
  deadline?: Date | string | null;
  checklist?: unknown;
}): NoteSnapshot {
  return {
    title: row.title ?? null,
    content: row.content ?? "",
    color: row.color ?? null,
    deadline: row.deadline ? new Date(row.deadline).toISOString() : null,
    checklist: asChecklist(row.checklist),
  };
}

/** True when two versions hold the same card — a save without edits doesn't make a new version. */
export function sameNoteSnapshot(
  a: Parameters<typeof toNoteSnapshot>[0],
  b: Parameters<typeof toNoteSnapshot>[0]
): boolean {
  return JSON.stringify(toNoteSnapshot(a)) === JSON.stringify(toNoteSnapshot(b));
}

/** Card HTML → plain text lines (block tags and <br> become line breaks). */
export function noteHtmlToLines(html: string): string[] {
  const text = (html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|blockquote|pre)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

/** Line diff (longest common subsequence): what was removed from `before` and added in `after`. */
export function diffLines(before: string[], after: string[]): DiffLine[] {
  const n = before.length;
  const m = after.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      out.push({ kind: "same", text: before[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "removed", text: before[i++] });
    } else {
      out.push({ kind: "added", text: after[j++] });
    }
  }
  while (i < n) out.push({ kind: "removed", text: before[i++] });
  while (j < m) out.push({ kind: "added", text: after[j++] });
  return out;
}

/** Everything that changed between two versions, as diff lines per part of the card. */
export function diffNoteSnapshots(before: NoteSnapshot | null, after: NoteSnapshot) {
  const checklistLines = (s: NoteSnapshot | null) => (s?.checklist ?? []).map((i) => `${i.checked ? "☑" : "☐"} ${i.text}`);
  return {
    title: diffLines(before?.title ? [before.title] : [], after.title ? [after.title] : []),
    content: diffLines(before ? noteHtmlToLines(before.content) : [], noteHtmlToLines(after.content)),
    checklist: diffLines(checklistLines(before), checklistLines(after)),
    deadlineChanged: (before?.deadline ?? null) !== after.deadline,
    colorChanged: !!before && (before.color ?? null) !== after.color,
  };
}
