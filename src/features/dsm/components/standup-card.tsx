"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeleteConfirmBar } from "@/components/shared/delete-confirm-bar";
import type { EntryWithDetails } from "../queries";
import { deleteStandup } from "../actions/delete-standup";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

type StandupCardProps = {
  entry: EntryWithDetails & { user?: { name: string | null; email: string } };
  showAuthor?: boolean;
};

export function StandupCard({ entry, showAuthor }: StandupCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteStandup, {});

  useEffect(() => {
    if (deleteState.message && deleteState.message !== "deleted") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfirmingDelete(false);
    }
  }, [deleteState.message]);

  const iconBtn =
    "rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40";

  const todayTasks = entry.tasks.filter((t) => t.kind === "TODAY");

  return (
    <article className="rounded-md border bg-card p-4 text-card-foreground">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <time className="text-sm font-semibold">{formatDate(entry.date)}</time>
          {showAuthor && entry.user && (
            <span className="text-xs text-muted-foreground">
              {entry.user.name ?? entry.user.email}
            </span>
          )}
        </div>

        {!confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            title="Delete"
            className={cn(iconBtn, "hover:text-destructive")}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {todayTasks.length > 0 && (
        <div className="flex flex-col gap-1">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Today
          </dt>
          {todayTasks.map((t) => (
            <dd key={t.id} className="text-sm leading-relaxed">
              {t.text}
            </dd>
          ))}
        </div>
      )}

      {confirmingDelete && (
        <div className="mt-3">
          <DeleteConfirmBar
            message="Delete This Standup Entry?"
            action={deleteAction}
            id={entry.id}
            pending={deletePending}
            onCancel={() => setConfirmingDelete(false)}
          />
        </div>
      )}

      {deleteState.message && deleteState.message !== "deleted" && (
        <p className="mt-2 text-xs text-destructive">
          {deleteState.message === "Not found"
            ? "Entry Not Found or You Don't Have Permission to Delete It."
            : "Something Went Wrong. Please Try Again."}
        </p>
      )}
    </article>
  );
}
