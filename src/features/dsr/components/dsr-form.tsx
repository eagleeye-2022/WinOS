"use client";

import { useActionState, useState, useRef, useEffect, startTransition } from "react";
import { PlusCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveDsr, type SaveDsrState } from "../actions/save-dsr";
import type { DsrEntryData, DsrStandupPrefill } from "../queries";

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskItem = { id?: string; text: string; priority: string | null; completed: boolean };
type TextItem = { id?: string; text: string };
type CheckItem = { id?: string; text: string; completed: boolean };

// ── Mention Highlight Helper ──────────────────────────────────────────────────

export function renderTextWithMentions(text: string) {
  if (!text) return null;
  const parts = text.split(/(@[a-zA-Z0-9_.-]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="font-semibold text-blue-600 dark:text-blue-400">
            {part}
          </span>
        ) : (
          <span key={i} className="text-foreground">
            {part}
          </span>
        )
      )}
    </>
  );
}

function MentionableInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative flex-1 flex items-center min-w-0">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center text-sm whitespace-pre overflow-hidden select-none",
          className
        )}
      >
        {value ? (
          renderTextWithMentions(value)
        ) : (
          <span className="text-muted-foreground/40">{placeholder}</span>
        )}
      </div>
      <input
        type="text"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=""
        className={cn(
          "relative z-10 w-full bg-transparent text-sm outline-none caret-blue-600 text-transparent selection:bg-blue-500/20 selection:text-foreground",
          className
        )}
      />
    </div>
  );
}

// ── Reusable checkbox list section ────────────────────────────────────────────

function CheckSection({
  title,
  badge,
  items,
  onChange,
  allowAdd,
  addLabel,
  readOnly,
}: {
  title: string;
  badge: string;
  items: CheckItem[];
  onChange: (items: CheckItem[]) => void;
  allowAdd?: boolean;
  addLabel?: string;
  readOnly?: boolean;
}) {
  const toggle = (i: number) => {
    if (readOnly) return;
    onChange(items.map((item, j) => (j === i ? { ...item, completed: !item.completed } : item)));
  };
  const add = () => {
    if (readOnly) return;
    onChange([...items, { text: "", completed: true }]);
  };
  const update = (i: number, text: string) => {
    if (readOnly) return;
    onChange(items.map((item, j) => (j === i ? { ...item, text } : item)));
  };
  const remove = (i: number) => {
    if (readOnly) return;
    onChange(items.filter((_, j) => j !== i));
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{badge}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => toggle(i)}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                item.completed
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background",
                readOnly && "cursor-not-allowed opacity-80"
              )}
            >
              {item.completed && (
                <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5">
                  <polyline points="1,4 3,6 7,2" />
                </svg>
              )}
            </button>
            {readOnly ? (
              <span className={cn("flex-1 text-sm leading-snug", !item.completed && "text-muted-foreground")}>
                {renderTextWithMentions(item.text)}
              </span>
            ) : (
              <MentionableInput
                value={item.text}
                onChange={(val) => update(i, val)}
                placeholder="Add item..."
                className={cn(!item.completed && "opacity-70")}
              />
            )}
            {allowAdd && !readOnly && (
              <button type="button" onClick={() => remove(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        {allowAdd && !readOnly && (
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
          >
            <PlusCircle size={13} /> {addLabel ?? "Add item"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Planned tasks section (with priority chips) ───────────────────────────────

function PlannedTasksSection({
  tasks,
  onChange,
  readOnly,
}: {
  tasks: TaskItem[];
  onChange: (t: TaskItem[]) => void;
  readOnly?: boolean;
}) {
  const completed = tasks.filter((t) => t.completed).length;
  const toggle = (i: number) => {
    if (readOnly) return;
    onChange(tasks.map((t, j) => (j === i ? { ...t, completed: !t.completed } : t)));
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Today&apos;s Planned Tasks Completed</h3>
        <span className="text-xs text-muted-foreground">{completed}/{tasks.length} TASKS PLANNED</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-center gap-3">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => toggle(i)}
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                task.completed
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background",
                readOnly && "cursor-not-allowed opacity-80"
              )}
            >
              {task.completed && (
                <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5">
                  <polyline points="1,4 3,6 7,2" />
                </svg>
              )}
            </button>
            <span className={cn(
              "flex-1 text-sm",
              !task.completed && "text-muted-foreground"
            )}>
              T{i + 1}: {renderTextWithMentions(task.text)}
            </span>
            {task.priority && (
              <span className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold uppercase",
                task.priority.toUpperCase() === "P1" && "bg-emerald-100 text-emerald-800 border border-emerald-300",
                task.priority.toUpperCase() === "P2" && "bg-blue-100 text-blue-800 border border-blue-300",
                task.priority.toUpperCase() === "P3" && "bg-amber-100 text-amber-800 border border-amber-300",
                !["P1","P2","P3"].includes(task.priority.toUpperCase()) && "bg-primary/10 text-primary border border-primary/20"
              )}>
                {task.priority.toUpperCase()}
              </span>
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground/60">
            No Planned Tasks from Today&apos;s DSM. Add Tasks in the Blockers Section or Submit Anyway.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Additional work section ───────────────────────────────────────────────────

function AdditionalWorkSection({
  items,
  taskLabels,
  onChange,
  readOnly,
}: {
  items: TextItem[];
  taskLabels: string[];
  onChange: (items: TextItem[]) => void;
  readOnly?: boolean;
}) {
  const add = () => {
    if (readOnly) return;
    onChange([...items, { text: "" }]);
  };
  const update = (i: number, text: string) => {
    if (readOnly) return;
    onChange(items.map((item, j) => (j === i ? { text } : item)));
  };
  const remove = (i: number) => {
    if (readOnly) return;
    onChange(items.filter((_, j) => j !== i));
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Additional Work Done Today</h3>
        {!readOnly && (
          <button
            type="button"
            onClick={add}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-80"
          >
            <PlusCircle size={16} />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {taskLabels[i] ? `T${i + 1}` : `T${i + 1}`}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled={readOnly}
                value={item.text}
                onChange={(e) => update(i, e.target.value)}
                placeholder={`Additional Work for T${i + 1}...`}
                className={cn(
                  "flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50",
                  readOnly && "cursor-not-allowed bg-muted/20 text-foreground"
                )}
              />
              {!readOnly && (
                <button type="button" onClick={() => remove(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground/50 italic">
            {readOnly ? "No Additional Work Recorded." : "Click + to Add Any Extra Work Completed Outside the Planned Tasks."}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Day reflection section ────────────────────────────────────────────────────

function DayReflection({
  sentiment,
  onSentiment,
  reflection,
  onReflection,
  resultOfDay,
  onResultOfDay,
  errors,
  resultOfDayErrors,
  readOnly,
}: {
  sentiment: string;
  onSentiment: (s: string) => void;
  reflection: string;
  onReflection: (s: string) => void;
  resultOfDay: string;
  onResultOfDay: (s: string) => void;
  errors?: string[];
  resultOfDayErrors?: string[];
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">Day Reflection</h3>

      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sentiment
          </label>
          <div className="flex gap-2">
            {["BREAKTHROUGH", "BREAKDOWN"].map((s) => (
              <button
                key={s}
                type="button"
                disabled={readOnly}
                onClick={() => !readOnly && onSentiment(sentiment === s ? "" : s)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  sentiment === s
                    ? s === "BREAKTHROUGH"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-destructive/50 bg-destructive/5 text-destructive"
                    : "border-border text-muted-foreground hover:bg-accent",
                  readOnly && "cursor-not-allowed opacity-80"
                )}
              >
                {s === "BREAKTHROUGH" ? "⚡" : "↘"} {s === "BREAKTHROUGH" ? "Breakthrough" : "Breakdown"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Outcome of the Day
            {!readOnly && <span className="text-destructive">*</span>}
          </label>
          <textarea
            disabled={readOnly}
            value={resultOfDay}
            onChange={(e) => onResultOfDay(e.target.value)}
            placeholder="What Was the Singular Most Important Outcome of Today?"
            rows={3}
            className={cn(
              "w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50",
              readOnly && "cursor-not-allowed bg-muted/20 text-foreground"
            )}
          />
          {resultOfDayErrors?.[0] && <p className="mt-1 text-xs text-destructive">{resultOfDayErrors[0]}</p>}
        </div>

        <div>
          <label className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            What Did You Learn?
            {!readOnly && <span className="text-destructive">*</span>}
          </label>
          <textarea
            disabled={readOnly}
            value={reflection}
            onChange={(e) => onReflection(e.target.value)}
            placeholder="Documenting New Learnings..."
            rows={3}
            className={cn(
              "w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50",
              readOnly && "cursor-not-allowed bg-muted/20 text-foreground"
            )}
          />
          {errors?.[0] && <p className="mt-1 text-xs text-destructive">{errors[0]}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

type Props = {
  entry: DsrEntryData | null;
  prefill: DsrStandupPrefill;
  todayDateStr: string;
  onRegisterSubmit?: (fn: () => void) => void;
  readOnly?: boolean;
  onCancel?: () => void;
};

export function DsrForm({ entry, prefill, todayDateStr, onRegisterSubmit, readOnly, onCancel }: Props) {
  const [state, action, pending] = useActionState<SaveDsrState, FormData>(saveDsr, {});
  const formRef = useRef<HTMLFormElement>(null);
  const isEditMode = entry?.status === "SUBMITTED" || entry?.status === "PENDING_REVIEW";

  // Initialize state from existing entry or DSM prefill
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (entry?.plannedTasks.length) {
      return entry.plannedTasks.map((t) => ({
        id: t.id, text: t.text, priority: t.priority, completed: t.completed,
      }));
    }
    return prefill.plannedTasks.map((t) => ({
      text: t.text, priority: t.priority, completed: false,
    }));
  });

  const [additionalWorks, setAdditionalWorks] = useState<TextItem[]>(() =>
    entry?.additionalWorks.map((w) => ({ id: w.id, text: w.text })) ?? []
  );

  const [blockers, setBlockers] = useState<CheckItem[]>(() => {
    if (entry?.resolvedBlockers.length) {
      return entry.resolvedBlockers.map((b) => ({ id: b.id, text: b.text, completed: b.resolved }));
    }
    return prefill.blockers.map((b) => ({ text: b.text, completed: false }));
  });

  const [followUps, setFollowUps] = useState<CheckItem[]>(() => {
    if (entry?.followUpsDone.length) {
      return entry.followUpsDone.map((f) => ({ id: f.id, text: f.text, completed: f.completed }));
    }
    return prefill.followUps.map((f) => ({ text: f.text, completed: false }));
  });

  const [learningItems, setLearningItems] = useState<CheckItem[]>(() => {
    if (entry?.learningItems?.length) {
      return entry.learningItems.map((l) => ({ id: l.id, text: l.text, completed: l.completed }));
    }
    return prefill.learningItems.map((l) => ({ text: l.text, completed: false }));
  });

  const [sentiment, setSentiment] = useState<string>(entry?.sentiment ?? "");
  const [resultOfDay, setResultOfDay] = useState<string>(entry?.resultOfDay ?? "");
  const [reflection, setReflection] = useState<string>(entry?.reflection ?? "");

  function buildAndSubmit(actionValue: "draft" | "submit") {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("action", actionValue);
    fd.set("plannedTasksJson", JSON.stringify(tasks));
    fd.set("additionalWorksJson", JSON.stringify(additionalWorks));
    fd.set("resolvedBlockersJson", JSON.stringify(blockers.map((b) => ({
      id: b.id, text: b.text, resolved: b.completed,
    }))));
    fd.set("followUpsDoneJson", JSON.stringify(followUps.map((f) => ({
      id: f.id, text: f.text, completed: f.completed,
    }))));
    fd.set("learningItemsJson", JSON.stringify(learningItems.map((l) => ({
      id: l.id, text: l.text, completed: l.completed,
    }))));
    fd.set("sentiment", sentiment);
    fd.set("reflection", reflection);
    fd.set("resultOfDay", resultOfDay);
    startTransition(() => {
      action(fd);
    });
  }

  // Keep a ref to buildAndSubmit so the panel's registered callback always uses fresh state
  const buildAndSubmitRef = useRef(buildAndSubmit);
  useEffect(() => {
    buildAndSubmitRef.current = buildAndSubmit;
  });

  useEffect(() => {
    onRegisterSubmit?.(() => buildAndSubmitRef.current("submit"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form ref={formRef} className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <input type="hidden" name="date" value={todayDateStr} />
      <input type="hidden" name="action" value="draft" />
      <input type="hidden" name="plannedTasksJson" value={JSON.stringify(tasks)} />
      <input type="hidden" name="additionalWorksJson" value="[]" />
      <input type="hidden" name="resolvedBlockersJson" value="[]" />
      <input type="hidden" name="followUpsDoneJson" value="[]" />
      <input type="hidden" name="learningItemsJson" value="[]" />
      <input type="hidden" name="sentiment" value={sentiment} />
      <input type="hidden" name="reflection" value={reflection} />
      <input type="hidden" name="resultOfDay" value={resultOfDay} />

      {(isEditMode || onCancel) && (
        <div className="flex items-center justify-between rounded-xl border bg-card px-5 py-3">
          <h2 className="text-sm font-semibold">
            {isEditMode ? "Edit Today's DSR" : "Today's DSR"}
          </h2>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <PlannedTasksSection tasks={tasks} onChange={setTasks} readOnly={readOnly} />

      <AdditionalWorkSection
        items={additionalWorks}
        taskLabels={tasks.map((t) => t.text)}
        onChange={setAdditionalWorks}
        readOnly={readOnly}
      />

      <CheckSection
        title="Blockers Resolved"
        badge={`${blockers.filter((b) => b.completed).length}/${blockers.length} BLOCKERS RESOLVED`}
        items={blockers}
        onChange={setBlockers}
        allowAdd
        addLabel="Add Resolved Blocker"
        readOnly={readOnly}
      />

      <CheckSection
        title="Follow-Ups Done"
        badge={`${followUps.filter((f) => f.completed).length}/${followUps.length} FOLLOW-UPS COMPLETED`}
        items={followUps}
        onChange={setFollowUps}
        allowAdd
        addLabel="Add Follow-Up"
        readOnly={readOnly}
      />

      <CheckSection
        title="What Will You Learn Today?"
        badge={`${learningItems.filter((l) => l.completed).length}/${learningItems.length} LEARNED`}
        items={learningItems}
        onChange={setLearningItems}
        allowAdd
        addLabel="Add Learning Item"
        readOnly={readOnly}
      />

      <DayReflection
        sentiment={sentiment}
        onSentiment={setSentiment}
        reflection={reflection}
        onReflection={setReflection}
        resultOfDay={resultOfDay}
        onResultOfDay={setResultOfDay}
        errors={state.errors?.reflection}
        resultOfDayErrors={state.errors?.resultOfDay}
        readOnly={readOnly}
      />

      {state.message === "saved" && (
        <p className="text-xs text-muted-foreground">Draft Saved.</p>
      )}
      {state.message && state.message !== "saved" && (
        <p className="text-xs text-destructive">
          {state.message === "Unauthorized" ? "Session Expired. Please Sign In Again." : state.message}
        </p>
      )}

      {/* Mobile-only submit (desktop uses panel button) */}
      {!readOnly && (
        <div className="sticky bottom-4 z-30 flex items-center gap-3 rounded-xl border bg-background/95 p-3 backdrop-blur-md shadow-lg xl:hidden">
          {!isEditMode && (
            <button
              type="button"
              disabled={pending}
              onClick={() => buildAndSubmit("draft")}
              className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Save Draft
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => buildAndSubmit("submit")}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : isEditMode ? "Save Changes" : "Submit DSR"}
          </button>
        </div>
      )}
    </form>
  );
}
