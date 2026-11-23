// Server-only helpers shared by the Setu server actions (not itself a "use server" module, so
// nothing here is callable from the browser).
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TeamMember } from "../types";
import { isoDate, nextCode } from "../utils";
import { toTeamMember } from "./data";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const success = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const failure = <T = never>(error: string): ActionResult<T> => ({ ok: false, error });

/**
 * The signed-in user, re-read from the DB (guards against a stale JWT after a DB reset).
 * Setu is open to every active internal user; CLIENT logins are refused.
 */
export async function requireSetuUser(): Promise<TeamMember | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findFirst({
    where: { OR: [{ id: session.user.id }, ...(session.user.email ? [{ email: session.user.email }] : [])] },
    select: { id: true, name: true, email: true, title: true, isActive: true, profileRole: true },
  });
  if (!user || !user.isActive || user.profileRole === "CLIENT") return null;
  return toTeamMember(user);
}

export const UNAUTHORIZED = "Your session is no longer valid or you don't have access to Setu. Please sign in again.";

/** Wraps an action body: auth, then the body, mapping unexpected errors to a friendly message. */
export async function withSetuUser<T>(name: string, body: (me: TeamMember) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const me = await requireSetuUser();
    if (!me) return failure(UNAUTHORIZED);
    return await body(me);
  } catch (err) {
    console.error(`[setu:${name}]`, err);
    return failure("Something went wrong saving that. Please try again.");
  }
}

/** Every Setu page reads the layout snapshot, so any write refreshes the whole section. */
export function revalidateSetu() {
  revalidatePath("/setu", "layout");
}

/** True when every id is an active internal user. */
export async function areTeamMembers(ids: string[]): Promise<boolean> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return true;
  const count = await db.user.count({ where: { id: { in: unique }, isActive: true, NOT: { profileRole: "CLIENT" } } });
  return count === unique.length;
}

/** Next free LD-/DEAL- code for this (IST) year. Callers retry on a unique-constraint clash. */
export async function nextDealCode(prefix: "LD" | "DEAL"): Promise<string> {
  const year = Number(isoDate(new Date()).slice(0, 4));
  const head = `${prefix}-${year}-`;
  const field = prefix === "LD" ? "leadCode" : "dealCode";
  const last = await db.crmDeal.findFirst({
    where: { [field]: { startsWith: head } },
    orderBy: { [field]: "desc" },
    select: { leadCode: true, dealCode: true },
  });
  return nextCode(prefix, [last?.[field] ?? undefined], year);
}

/** Prisma unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}
