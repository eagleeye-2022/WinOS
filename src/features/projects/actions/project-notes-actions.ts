"use server";

// Project iNotes: read side for the Projects module. Cards are ordinary iNotes cards that their
// author shared to a project (BoardNoteProjectShare); edits go through the iNotes updateBoardNote.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isPrivilegedUser,
  isProjectMember,
  projectMembershipWhere,
  resolveProjectId,
} from "@/features/notes/project-notes-access";
import { canEditProjectCard, canViewProjectCards } from "@/features/notes/project-notes-utils";

export type ProjectNoteCard = {
  id: string;
  title: string | null;
  content: string;
  color: string | null;
  deadline: string | null;
  updatedAt: string;
  sharedAt: string;
  authorName: string;
  /** Where the card lives in iNotes, e.g. "Sprint board / In progress". */
  source: string;
  canEdit: boolean;
  checklistItems: { id: string; text: string; checked: boolean }[];
};

export type ProjectNotesResult =
  | { success: true; projectId: string; projectName: string; isManager: boolean; cards: ProjectNoteCard[] }
  | { success: false; error: string };

const displayName = (u: { name: string | null; email: string } | null | undefined) =>
  u?.name || u?.email?.split("@")[0] || "Unknown";

/** Every iNotes card shared to the project. Members read; managers (and authors) edit. */
export async function getProjectNotesAction(projectIdOrCode: string): Promise<ProjectNotesResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  const userId = session.user.id;

  const projectId = await resolveProjectId(projectIdOrCode);
  if (!projectId) return { success: false, error: "Project not found" };

  const isPrivileged = await isPrivilegedUser(userId);
  const isMember = isPrivileged ? false : await isProjectMember(userId, projectId);
  if (!canViewProjectCards({ isPrivileged, isProjectMember: isMember })) {
    return { success: false, error: "Only members of this project can view its notes" };
  }

  const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true } });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = db as any;
  const shares = await d.boardNoteProjectShare.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      note: {
        include: {
          author: { select: { name: true, email: true } },
          checklistItems: { orderBy: { position: "asc" } },
          thread: { select: { title: true, board: { select: { name: true } } } },
        },
      },
    },
  });

  return {
    success: true,
    projectId,
    projectName: project?.name || "",
    isManager: isPrivileged,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cards: shares.map((s: any) => {
      const n = s.note;
      return {
        id: n.id,
        title: n.title,
        content: n.content,
        color: n.color,
        deadline: n.deadline ? new Date(n.deadline).toISOString() : null,
        updatedAt: new Date(n.updatedAt).toISOString(),
        sharedAt: new Date(s.createdAt).toISOString(),
        authorName: displayName(n.author),
        source: [n.thread?.board?.name, n.thread?.title].filter(Boolean).join(" / "),
        canEdit: canEditProjectCard({ isPrivileged, isAuthor: n.authorId === userId }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        checklistItems: n.checklistItems.map((c: any) => ({ id: c.id, text: c.text, checked: c.checked })),
      };
    }),
  };
}

export type ProjectNoteSummary = {
  count: number;
  /** Title of the most recently shared card (null when it has no title or nothing is shared). */
  latestTitle: string | null;
};

/**
 * Shared-card summary per project for the "Project iNotes" column, keyed by the id or code the
 * caller passed in. Projects the viewer cannot read are left out.
 */
export async function getProjectNoteSummariesAction(
  projectIdsOrCodes: string[]
): Promise<Record<string, ProjectNoteSummary>> {
  const session = await auth();
  if (!session?.user?.id || projectIdsOrCodes.length === 0) return {};
  const userId = session.user.id;
  const keys = Array.from(new Set(projectIdsOrCodes.filter(Boolean))).slice(0, 1000);

  const isPrivileged = await isPrivilegedUser(userId);
  const projects = await db.project.findMany({
    where: {
      AND: [
        { OR: [{ id: { in: keys } }, { code: { in: keys } }] },
        ...(isPrivileged ? [] : [projectMembershipWhere(userId)]),
      ],
    },
    select: { id: true, code: true },
  });
  if (projects.length === 0) return {};

  // Newest first, so the first row seen per project is its latest shared card.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shares: { projectId: string; note: { title: string | null } | null }[] = await (db as any).boardNoteProjectShare.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    select: { projectId: true, note: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });

  const byProject = new Map<string, ProjectNoteSummary>();
  for (const s of shares) {
    const current = byProject.get(s.projectId);
    if (current) current.count += 1;
    else byProject.set(s.projectId, { count: 1, latestTitle: s.note?.title?.trim() || null });
  }

  const result: Record<string, ProjectNoteSummary> = {};
  for (const p of projects) {
    const summary = byProject.get(p.id) || { count: 0, latestTitle: null };
    if (keys.includes(p.id)) result[p.id] = summary;
    if (p.code && keys.includes(p.code)) result[p.code] = summary;
  }
  return result;
}
