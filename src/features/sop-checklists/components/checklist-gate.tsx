"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, ListChecks, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/shared/toast";
import { projectTaskHref } from "@/lib/project-task-href";
import { updateTaskAction } from "@/features/projects/actions/project-actions";
import type { ChecklistCloseBlock } from "../types";

export interface ChecklistGateRequest extends ChecklistCloseBlock {
  /** The done status the user tried to set — used by a manager's "Close anyway". */
  status: string;
  /** Instead of navigating to the task page (e.g. already on it: just switch to the tab). */
  onOpenChecklist?: () => void;
  /** After a manager closed it anyway — re-apply the status locally. */
  onForced?: () => void;
}

// One popup for the whole app, opened from wherever a task close was refused (like the toasts).
let listener: ((req: ChecklistGateRequest | null) => void) | null = null;

/** Shows "Please select / complete the checklist" for a refused task close. */
export function showChecklistGate(req: ChecklistGateRequest) {
  if (listener) listener(req);
  else toast.error(req.message);
}

/** Mounted once in the dashboard layout. */
export function ChecklistGateHost() {
  const router = useRouter();
  const [req, setReq] = useState<ChecklistGateRequest | null>(null);
  const [isForcing, setIsForcing] = useState(false);

  useEffect(() => {
    listener = setReq;
    return () => {
      listener = null;
    };
  }, []);

  if (!req) return null;
  const noChecklist = req.reason === "NO_CHECKLIST";
  const pct = req.total ? Math.round((req.done / req.total) * 100) : 0;

  const openChecklist = () => {
    const current = req;
    setReq(null);
    if (current.onOpenChecklist) {
      current.onOpenChecklist();
      return;
    }
    const href = projectTaskHref(current.projectCode, current.taskCode);
    if (href) router.push(`${href}?tab=checklist`);
  };

  const closeAnyway = async () => {
    setIsForcing(true);
    try {
      const res = await updateTaskAction(req.taskId, { status: req.status as never }, { forceClose: true });
      if (!res.success) {
        toast.error(res.error || "Couldn't close the task");
        return;
      }
      toast.success(`${req.taskCode} closed`);
      req.onForced?.();
      setReq(null);
      router.refresh();
    } finally {
      setIsForcing(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && setReq(null)}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-warning" />
            {noChecklist ? "Please select a checklist" : "Please complete the checklist"}
          </DialogTitle>
          {/* <DialogDescription>
            <span className="font-mono">{req.taskCode}</span> can&apos;t be closed yet.{" "}
            {noChecklist
              ? "Select an SOP checklist for this task and complete it first."
              : "Every item of its SOP checklist has to be ticked first."}
          </DialogDescription> */}
        </DialogHeader>

        {!noChecklist && (
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Checklist progress</span>
              <span className="font-semibold tabular-nums text-foreground">
                {req.done}/{req.total} done
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setReq(null)}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
          >
            Cancel
          </button>
          {/* "Close anyway" (manager override) — never offered now: canForce is always false, and
              the server refuses a forced close too. Managers select / complete the checklist. */}
          {req.canForce && (
            <button
              type="button"
              disabled={isForcing}
              onClick={closeAnyway}
              className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
              title="Managers only — noted in the task's activity"
            >
              {isForcing && <Loader2 size={12} className="animate-spin" />}
              Close anyway
            </button>
          )}
          <button
            type="button"
            onClick={openChecklist}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            <ListChecks size={13} />
            {noChecklist ? "Select checklist" : "Open checklist"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
