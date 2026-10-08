// Pure rules for Project iNotes (iNotes cards shared to a project). No DB access here so the
// rules can be unit-tested; `project-notes-access.ts` gathers the facts and calls these.

/**
 * "Manager" for Project iNotes is the app-wide `User.role === "MANAGER"` — the same flag the iNotes
 * workspace UI (`isManager`) uses, so what the screen offers and what the server allows match.
 */
export function isPrivilegedRole(role: string | null | undefined): boolean {
  return String(role || "").toUpperCase() === "MANAGER";
}

/** Project-shared cards are readable by any manager and by members of that project. */
export function canViewProjectCards(f: { isPrivileged: boolean; isProjectMember: boolean }): boolean {
  return f.isPrivileged || f.isProjectMember;
}

/** A card's author may share it to a project they belong to; managers may share to any project. */
export function canShareToProject(f: { isPrivileged: boolean; isProjectMember: boolean }): boolean {
  return f.isPrivileged || f.isProjectMember;
}

/** A project-shared card can be edited by any manager or by its own author. Members only read. */
export function canEditProjectCard(f: { isPrivileged: boolean; isAuthor: boolean }): boolean {
  return f.isPrivileged || f.isAuthor;
}

/** Parses the comma-separated id list a form posts; trims, drops blanks and duplicates. */
export function parseIdList(raw: string | null | undefined): string[] {
  return Array.from(
    new Set(
      String(raw || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}
