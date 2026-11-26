"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { MoveTaskToProjectDialog } from "@/features/projects/components/modals/move-task-to-project-dialog";
import { UNASSIGNED_PROJECT_NAME, isUnassignedProject } from "../utils";

/**
 * "Move to project" for a DSM row whose linked task is still in the Unassigned Work holding
 * project (timer started before a project was picked). Moves the task, with its time logs, into
 * the real project (see moveTaskToProjectAction), then refreshes the page. Renders nothing for a
 * task in any other project.
 */
export function MoveUnassignedTaskButton({
  task,
}: {
  task: { id: string; code: string | null; title: string; project?: { id: string; code?: string | null } | null } | null | undefined;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!task || !isUnassignedProject(task.project)) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title={`Move this task and its logged time out of ${UNASSIGNED_PROJECT_NAME} into its real project`}
        className="mt-1 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10"
      >
        <ArrowRightLeft size={11} /> Move to project
      </button>
      {open && (
        <MoveTaskToProjectDialog
          open
          onClose={() => setOpen(false)}
          taskId={task.id}
          taskCode={task.code ?? ""}
          taskTitle={task.title}
          currentProjectId={task.project?.id}
          onMoved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
