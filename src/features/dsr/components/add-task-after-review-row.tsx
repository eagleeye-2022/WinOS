"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { addTaskAfterReview, type AddTaskAfterReviewState } from "../actions/add-task-after-review";

export function AddTaskAfterReviewRow({ entryId }: { entryId: string }) {
  const [adding, setAdding] = useState(false);
  const [state, action, pending] = useActionState<AddTaskAfterReviewState, FormData>(
    addTaskAfterReview,
    {}
  );
  const inputRef = useRef<HTMLInputElement>(null);

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs font-medium text-primary/70 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
      >
        <Plus size={13} /> Add a Task
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setAdding(false);
      }}
      className="flex flex-col gap-1.5 rounded-lg border p-2 bg-background"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          name="text"
          placeholder="Type new task description..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputRef.current?.value.trim()) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val && e.currentTarget.form) {
              e.currentTarget.form.requestSubmit();
            }
          }}
          className="flex-1 rounded border px-2.5 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={pending}
          title="Add task"
          className="rounded-md bg-success/10 p-1.5 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
        </button>
        <button
          type="button"
          onClick={() => setAdding(false)}
          title="Cancel"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      {state.message && state.message !== "created" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
    </form>
  );
}
