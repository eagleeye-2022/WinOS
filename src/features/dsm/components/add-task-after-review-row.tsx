"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { addTaskAfterReview, type AddTaskAfterReviewState } from "../actions/add-task-after-review";

export function AddTaskAfterReviewRow({ entryId }: { entryId: string }) {
  const [adding, setAdding] = useState(false);
  const [priority, setPriority] = useState<string>("P1");
  const [kind, setKind] = useState<"TODAY" | "YESTERDAY">("TODAY");
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
        className="flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-blue-700 active:scale-95"
      >
        <Plus size={14} strokeWidth={2.5} /> Add a Task
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setAdding(false);
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-blue-500 bg-background px-2.5 py-1 shadow-sm"
    >
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="priority" value={priority} />

      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as "TODAY" | "YESTERDAY")}
        className="rounded-md border bg-card px-1.5 py-0.5 text-[11px] font-semibold text-foreground outline-none cursor-pointer"
        title="Select Day"
      >
        <option value="TODAY">Today</option>
        {/* <option value="YESTERDAY">Yesterday</option> */}
      </select>

      <input
        ref={inputRef}
        name="text"
        placeholder={kind === "YESTERDAY" ? "Type yesterday task..." : "Type new task..."}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && inputRef.current?.value.trim()) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        className="w-44 rounded-none border-none bg-transparent px-1.5 py-0.5 text-xs outline-none focus:ring-0"
      />

      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className="rounded-md border bg-card px-1.5 py-0.5 text-[11px] font-semibold text-foreground outline-none cursor-pointer"
        title="Select Priority"
      >
        <option value="P1">P1</option>
        <option value="P2">P2</option>
        <option value="P3">P3</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Med</option>
        <option value="LOW">Low</option>
      </select>

      <button
        type="submit"
        disabled={pending}
        title="Add task"
        className="rounded-full bg-blue-600 p-1 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
      </button>
      <button
        type="button"
        onClick={() => setAdding(false)}
        title="Cancel"
        className="rounded-full p-1 text-muted-foreground hover:bg-accent transition-colors"
      >
        <X size={13} strokeWidth={2} />
      </button>
      {state.message && state.message !== "created" && (
        <span className="text-xs text-destructive">{state.message}</span>
      )}
    </form>
  );
}
