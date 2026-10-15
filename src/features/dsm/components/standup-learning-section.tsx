"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Check, GraduationCap, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateLearningText, type UpdateLearningState } from "@/features/dsm/manager/actions/update-learning";
import { TimerWidget } from "@/features/projects/components/timer-widget";
import { MemberTaskTimerBadge } from "@/features/dsm/manager/components/member-task-timer-badge";
import { DueDateCell, WrappedTaskText, ProjectPill, TaskIdChip } from "@/components/shared/task-table-parts";
import { projectTaskHref } from "@/lib/project-task-href";
import { isTaskDone } from "@/features/projects/types";
import { getWhyfiTasksByCodesAction, type WhyfiPickerTask } from "@/features/whyfi/actions";
import { formatLearningLine, parseLearningLineCode, stripLearningLineCode } from "@/features/whyfi/constants";

/**
 * "What Will You Learn Today (Whyfi School)?" on a submitted DSM card — laid out like the
 * "Today's Task" table above it: lines linked to a Whyfi School card ("[WL-1-T3] …") show the
 * list, task ID (ⓘ opens it), status, due date and the start/stop timer (today) or the logged
 * effort (other days). Once reviewed, lines can still be edited, removed and added here.
 */
export function StandupLearningSection({
  entryId,
  learningText,
  isReviewed = false,
  isToday = false,
  memberId,
  dateStr,
}: {
  entryId: string;
  learningText: string | null;
  isReviewed?: boolean;
  /** Today's card: show the live start/stop timer instead of the logged effort. */
  isToday?: boolean;
  memberId?: string;
  /** The card's day, "YYYY-MM-DD" — for the logged-effort badge on past days. */
  dateStr: string;
}) {
  const [, action, pending] = useActionState<UpdateLearningState, FormData>(updateLearningText, {});
  const [, startTransition] = useTransition();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [editText, setEditText] = useState("");

  const lines = useMemo(
    () => (learningText ? learningText.split("\n").map((l) => l.trim()).filter(Boolean) : []),
    [learningText]
  );

  // Linked Whyfi School cards (open or done) for the lines on this card.
  const codesKey = lines.map(parseLearningLineCode).filter(Boolean).join(",");
  const [cards, setCards] = useState<Map<string, WhyfiPickerTask>>(new Map());
  useEffect(() => {
    if (!codesKey) return;
    let cancelled = false;
    getWhyfiTasksByCodesAction(codesKey.split(","))
      .then((res) => {
        if (!cancelled) setCards(new Map(res.map((t) => [t.code, t])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [codesKey]);

  const handleSaveAll = (newLines: string[]) => {
    const fd = new FormData();
    fd.set("entryId", entryId);
    fd.set("learningText", newLines.join("\n"));
    startTransition(() => {
      action(fd);
    });
  };

  const handleEdit = (index: number) => {
    if (!editText.trim()) return;
    const updated = [...lines];
    // Keep the line's card link while its text is edited.
    const code = parseLearningLineCode(lines[index]);
    updated[index] = code ? formatLearningLine(code, editText) : editText.trim();
    handleSaveAll(updated);
    setEditingIndex(null);
    setEditText("");
  };

  const handleDelete = (index: number) => {
    handleSaveAll(lines.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (!newText.trim()) return;
    handleSaveAll([...lines, newText.trim()]);
    setNewText("");
    setAdding(false);
  };

  // If not reviewed and has no lines, don't show an empty box
  if (!isReviewed && lines.length === 0) {
    return null;
  }

  return (
    // Its own section, separate from "Today's Task" above it.
    // Light blue tint in light mode; plain dark card (no blue) in dark mode, like "Today's Task".
    <section className="mb-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-3 dark:border-border dark:bg-card">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">

        <GraduationCap size={14} className="text-primary" />
        What Will You Learn Today (Whyfi School)?
        <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold normal-case tracking-normal text-primary">
          {lines.length}
        </span>
      </p>

      {lines.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="w-10 whitespace-nowrap pb-2.5 pr-2 font-semibold">#</th>
                <th className="whitespace-nowrap pb-2.5 pr-3 font-semibold">List</th>
                <th className="whitespace-nowrap pb-2.5 pr-3 font-semibold">Task ID</th>
                <th className="whitespace-nowrap pb-2.5 pr-3 font-semibold">Learning Task</th>
                <th className="w-24 whitespace-nowrap pb-2.5 pr-3 font-semibold">Status</th>
                <th className="whitespace-nowrap pb-2.5 pr-3 font-semibold">Due Date</th>
                <th className="whitespace-nowrap pb-2.5 pr-3 font-semibold">Effort Logs</th>
                {isReviewed && <th className="w-24 whitespace-nowrap pb-2.5 pr-2 text-center font-semibold">Action</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const code = parseLearningLineCode(line);
                const card = code ? cards.get(code) : undefined;
                const text = stripLearningLineCode(line);
                const done = card ? isTaskDone(card.status) : false;

                return (
                  <tr key={`${i}-${line}`} className="border-b transition-colors last:border-b-0 hover:bg-muted/40">
                    <td className="py-2.5 pr-2 align-top">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                        L{i + 1}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      {card ? <ProjectPill name={card.listName} /> : <span className="text-xs text-muted-foreground/60">—</span>}
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      {code ? (
                        <TaskIdChip
                          code={code}
                          title={card?.title || text}
                          href={card ? projectTaskHref(card.projectId, code) : null}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      {isReviewed && editingIndex === i ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleEdit(i);
                              } else if (e.key === "Escape") {
                                setEditingIndex(null);
                              }
                            }}
                            className="min-w-[160px] flex-1 rounded border px-2 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                          />
                          <button
                            type="button"
                            onClick={() => handleEdit(i)}
                            disabled={pending}
                            className="rounded-md bg-success/10 p-1.5 text-success transition-colors hover:bg-success/20"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIndex(null)}
                            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <span className={cn("text-sm", done && "text-muted-foreground line-through")}>
                          <WrappedTaskText text={text} />
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 align-top whitespace-nowrap">
                      {card ? (
                        <span
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                            done
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : card.status === "In Progress"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                          )}
                        >
                          {card.status}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      <DueDateCell dueDate={card?.dueDate || null} />
                    </td>
                    <td className="py-2.5 pr-3 align-top">
                      {code && isToday ? (
                        <TimerWidget
                          instanceId={`standup-day-learning-${entryId}-${i}`}
                          taskId={card?.id}
                          taskCode={code}
                          taskTitle={card?.title || text}
                          projectId={card?.projectId}
                          defaultExpanded={true}
                        />
                      ) : code && card ? (
                        <MemberTaskTimerBadge taskId={card.id} taskCode={code} memberId={memberId} dateStr={dateStr} />
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </td>
                    {isReviewed && (
                      <td className="py-2.5 pr-2 text-center align-top">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIndex(i);
                              setEditText(text);
                            }}
                            title="Edit learning item"
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(i)}
                            title="Delete learning item"
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-1 text-xs italic text-muted-foreground">No learning items logged for today.</p>
      )}

      {isReviewed && (
        <div className="mt-2.5">
          {adding ? (
            <div className="flex items-center gap-2 rounded-lg border bg-background p-1.5">
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                autoFocus
                placeholder="Describe what will be learned (Whyfi School)..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                className="flex-1 rounded border px-2.5 py-1 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={pending || !newText.trim()}
                className="rounded-md bg-success/10 p-1.5 text-success transition-colors hover:bg-success/20 disabled:opacity-50"
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewText("");
                }}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-1.5 text-xs font-medium text-primary/70 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-[#3B82F6]/40 dark:text-[#3B82F6] dark:hover:text-[#2563EB]"
            >
              <Plus size={13} className="dark:text-[#93C5FD]" /> Add Learning Task
            </button>
          )}
        </div>
      )}
    </section>
  );
}
