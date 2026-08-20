"use client";

import { useActionState, useState, useRef, useEffect, startTransition } from "react";
import { PlusCircle, X, Loader2, Zap, TrendingDown } from "lucide-react";
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
          <span key={i} className="font-semibold text-info">
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
  onEnterSubmit,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  onEnterSubmit?: () => void;
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
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnterSubmit?.();
          }
        }}
        placeholder=""
        className={cn(
          "relative z-10 w-full bg-transparent text-sm outline-none caret-primary text-transparent selection:bg-primary/20 selection:text-foreground",
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
                onEnterSubmit={allowAdd && i === items.length - 1 && item.text.trim() ? add : undefined}
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
                task.priority.toUpperCase() === "P1" && "bg-success/10 text-success border border-success/30",
                task.priority.toUpperCase() === "P2" && "bg-info/10 text-info border border-info/30",
                task.priority.toUpperCase() === "P3" && "bg-warning/10 text-warning border border-warning/30",
                !["P1", "P2", "P3"].includes(task.priority.toUpperCase()) && "bg-primary/10 text-primary border border-primary/20"
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!readOnly && i === items.length - 1 && item.text.trim()) {
                      add();
                    }
                  }
                }}
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
          <div className="flex gap-4 w-full">
            <button
              type="button"
              disabled={readOnly}
              onClick={() => !readOnly && onSentiment(sentiment === "BREAKTHROUGH" ? "" : "BREAKTHROUGH")}
              className={cn(
                "flex items-center w-fit justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer shadow-2xs active:scale-[0.99]",
                sentiment === "BREAKTHROUGH"
                  ? "border-success/40 bg-success/15 text-success shadow-xs font-semibold"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                readOnly && "cursor-not-allowed opacity-80"
              )}
            >
              <Zap size={16} className={sentiment === "BREAKTHROUGH" ? "text-success fill-current" : "text-success"} />
              <span>Breakthrough</span>
            </button>

            <button
              type="button"
              disabled={readOnly}
              onClick={() => !readOnly && onSentiment(sentiment === "BREAKDOWN" ? "" : "BREAKDOWN")}
              className={cn(
                "flex items-center w-fit justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer shadow-2xs active:scale-[0.99]",
                sentiment === "BREAKDOWN"
                  ? "border-destructive/40 bg-destructive/15 text-destructive shadow-xs font-semibold"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                readOnly && "cursor-not-allowed opacity-80"
              )}
            >
              <TrendingDown size={16} className={sentiment === "BREAKDOWN" ? "text-destructive" : "text-destructive"} />
              <span>Breakdown</span>
            </button>
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
  onPendingChange?: (pending: boolean) => void;
  readOnly?: boolean;
  onCancel?: () => void;
};

export function DsrForm({ entry, prefill, todayDateStr, onRegisterSubmit, onPendingChange, readOnly, onCancel }: Props) {
  const [state, action, pending] = useActionState<SaveDsrState, FormData>(saveDsr, {});

  useEffect(() => {
    onPendingChange?.(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);
  const formRef = useRef<HTMLFormElement>(null);
  const isLoadedRef = useRef(false);
  const isEditMode = entry?.status === "SUBMITTED" || entry?.status === "PENDING_REVIEW";
  const draftKey = `winos_dsr_draft_${todayDateStr}`;

  // Read saved draft synchronously on initial render
  const savedDraft = typeof window !== "undefined" && !readOnly && !isEditMode ? (() => {
    try {
      const saved = localStorage.getItem(draftKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })() : null;

  // Initialize state from draft, existing entry, or DSM prefill
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (savedDraft?.tasks?.length) return savedDraft.tasks;
    if (entry?.plannedTasks.length) {
      return entry.plannedTasks.map((t) => ({
        id: t.id, text: t.text, priority: t.priority, completed: t.completed,
      }));
    }
    return prefill.plannedTasks.map((t) => ({
      text: t.text, priority: t.priority, completed: false,
    }));
  });

  const [additionalWorks, setAdditionalWorks] = useState<TextItem[]>(() => {
    if (savedDraft?.additionalWorks) return savedDraft.additionalWorks;
    return entry?.additionalWorks.map((w) => ({ id: w.id, text: w.text })) ?? [];
  });

  const [blockers, setBlockers] = useState<CheckItem[]>(() => {
    if (savedDraft?.blockers?.length) return savedDraft.blockers;
    if (entry?.resolvedBlockers.length) {
      return entry.resolvedBlockers.map((b) => ({ id: b.id, text: b.text, completed: b.resolved }));
    }
    return prefill.blockers.map((b) => ({ text: b.text, completed: false }));
  });

  const [followUps, setFollowUps] = useState<CheckItem[]>(() => {
    if (savedDraft?.followUps?.length) return savedDraft.followUps;
    if (entry?.followUpsDone.length) {
      return entry.followUpsDone.map((f) => ({ id: f.id, text: f.text, completed: f.completed }));
    }
    return prefill.followUps.map((f) => ({ text: f.text, completed: false }));
  });

  const [learningItems, setLearningItems] = useState<CheckItem[]>(() => {
    if (savedDraft?.learningItems?.length) return savedDraft.learningItems;
    if (entry?.learningItems?.length) {
      return entry.learningItems.map((l) => ({ id: l.id, text: l.text, completed: l.completed }));
    }
    return prefill.learningItems.map((l) => ({ text: l.text, completed: false }));
  });

  const [sentiment, setSentiment] = useState<string>(savedDraft?.sentiment ?? entry?.sentiment ?? "");
  const [resultOfDay, setResultOfDay] = useState<string>(savedDraft?.resultOfDay ?? entry?.resultOfDay ?? "");
  const [reflection, setReflection] = useState<string>(savedDraft?.reflection ?? entry?.reflection ?? "");

  useEffect(() => {
    isLoadedRef.current = true;
  }, []);

  // Auto-save form draft to localStorage on every change
  useEffect(() => {
    if (!isLoadedRef.current || readOnly || isEditMode) return;
    const draftData = {
      tasks,
      additionalWorks,
      blockers,
      followUps,
      learningItems,
      sentiment,
      resultOfDay,
      reflection,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch {
      // Ignore storage error
    }
  }, [draftKey, readOnly, isEditMode, tasks, additionalWorks, blockers, followUps, learningItems, sentiment, resultOfDay, reflection]);

  // Clear draft upon successful save or submission
  useEffect(() => {
    if (state.message === "submitted" || state.message === "saved") {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // Ignore
      }
    }
  }, [state.message, draftKey]);

  function buildAndSubmit(actionValue: "draft" | "submit") {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("action", actionValue);
    fd.set("plannedTasksJson", JSON.stringify(tasks));
    fd.set("additionalWorksJson", JSON.stringify(additionalWorks.filter((w) => w.text.trim())));
    fd.set("resolvedBlockersJson", JSON.stringify(blockers.filter((b) => b.text.trim()).map((b) => ({
      id: b.id, text: b.text.trim(), resolved: b.completed,
    }))));
    fd.set("followUpsDoneJson", JSON.stringify(followUps.filter((f) => f.text.trim()).map((f) => ({
      id: f.id, text: f.text.trim(), completed: f.completed,
    }))));
    fd.set("learningItemsJson", JSON.stringify(learningItems.filter((l) => l.text.trim()).map((l) => ({
      id: l.id, text: l.text.trim(), completed: l.completed,
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
        title="Blockers (Dependencies) Resolved"
        badge={`${blockers.filter((b) => b.completed).length}/${blockers.length} BLOCKERS RESOLVED`}
        items={blockers}
        onChange={setBlockers}
        allowAdd
        addLabel="Add Resolved Blocker (Dependencies)"
        readOnly={readOnly}
      />

      <CheckSection
        title="Support Needed (Meeting) Resolved"
        badge={`${followUps.filter((f) => f.completed).length}/${followUps.length} RESOLVED`}
        items={followUps}
        onChange={setFollowUps}
        allowAdd
        addLabel="Add Support Needed (Meeting)"
        readOnly={readOnly}
      />

      <CheckSection
        title="What Will You Learn Today( Whyfi School )?"
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground py-2 text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              {pending && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
              Save Draft
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => buildAndSubmit("submit")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] dark:text-[#F8FAFC]"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {pending ? "Saving…" : isEditMode ? "Save Changes" : "Submit DSR"}
          </button>
        </div>
      )}
    </form>
  );
}
