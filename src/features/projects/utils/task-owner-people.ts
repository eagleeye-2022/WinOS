import type { StackPerson } from "@/components/shared/avatar-stack";
import type { TaskItem } from "../types";

/**
 * A task's owners for an avatar stack. `owners` (names) and `ownerIds` come from the same rows in
 * the same order; when an owner's name couldn't be resolved the lists differ in length, so ids
 * are only paired up when they line up — otherwise each photo is found by name.
 */
export function taskOwnerPeople(
  task: Pick<TaskItem, "owners" | "ownerIds" | "owner">,
  fallbackName?: string
): StackPerson[] {
  const names =
    task.owners && task.owners.length > 0
      ? task.owners
      : [fallbackName || task.owner || ""].filter((n) => n && n !== "Unassigned");
  const idsLineUp = (task.ownerIds?.length ?? 0) === names.length;
  return names.map((name, i) => ({ name, id: idsLineUp ? task.ownerIds![i] : undefined }));
}
