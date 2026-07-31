"use client";

import { useActionState, useState, useEffect } from "react";
import { Plus, X, ChevronRight, CheckCircle2, Ban, ClipboardList, HandHelping, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveDsm, type SaveDsmState } from "../actions/save-dsm";
import type { EntryWithDetails, TeamMember } from "../queries";
import { MentionInput } from "@/components/shared/mention-input";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
type Priority = (typeof PRIORITIES)[number];

const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low Priority",
  MEDIUM: "Medium Priority",
  HIGH: "High Priority",
};

// ── Shared input classes ──────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50";

// ── Mention helpers ───────────────────────────────────────────────────────────

/** Strips the "@Name " text MentionInput just inserted, since the mention is tracked as a chip instead */
function stripMentionInsertion(value: string, member: { name: string | null; email: string }): string {
  const label = member.name || member.email.split("@")[0];
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value.replace(new RegExp(`@${escaped}\\s?`), "").replace(/\s{2,}/g, " ");
}

// ── Task rows ─────────────────────────────────────────────────────────────────

type Task = { text: string; priority: string; carried: boolean };

function TaskRows({
  tasks,
  teamMembers,
  onChange,
}: {
  tasks: Task[];
  teamMembers: TeamMember[];
  onChange: (t: Task[]) => void;
}) {
  const updateField = (i: number, field: "text" | "priority", v: string) => {
    const n = [...tasks];
    n[i] = { ...n[i], [field]: v };
    onChange(n);
  };
  const remove = (i: number) => onChange(tasks.filter((_, j) => j !== i));
  const add = () => onChange([...tasks, { text: "", priority: "", carried: false }]);

  const levels = Array.from({ length: tasks.length }, (_, k) => `P${k + 1}`);

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task, i) => {
        const takenPriorities = tasks
          .filter((_, idx) => idx !== i && _.priority)
          .map((_) => _.priority);
        const availableLevels = levels.filter(
          (p) => !takenPriorities.includes(p) || p === task.priority
        );

        return (
          <div key={i} className="flex flex-col gap-1.5 rounded-md border bg-background p-2.5 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold",
                task.text ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                T{i + 1}
              </span>
              <MentionInput
                name="taskText"
                value={task.text}
                onChange={(v) => updateField(i, "text", v)}
                placeholder="Add task details... (Type @ for people, @file: for files)"
                teamMembers={teamMembers}
                onSelectMention={(mId, updatedText) => {
                  if (updatedText !== undefined) updateField(i, "text", updatedText);
                }}
              />
              {task.carried && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Carried over
                </span>
              )}
              {(tasks.length > 1 || task.carried) && (
                <button type="button" onClick={() => remove(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <X size={14} />
                </button>
              )}
            </div>
            {/* Dynamic Priority Selection (P1..PN matching task count, unique per task) */}
            <div className="flex items-center gap-2 border-t pt-1.5 px-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Priority:
              </span>
              <select
                name="taskPriority"
                value={task.priority}
                onChange={(e) => updateField(i, "priority", e.target.value)}
                className={cn(
                  "cursor-pointer bg-transparent text-xs outline-none rounded px-1.5 py-0.5 border font-semibold transition-colors",
                  task.priority ? "border-primary/40 bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground font-normal"
                )}
              >
                <option value="">Select priority</option>
                {availableLevels.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Plus size={13} /> Add task
      </button>
    </div>
  );
}

// ── Blocker rows ──────────────────────────────────────────────────────────────

function BlockerRows({
  blockers,
  teamMembers,
  onChange,
}: {
  blockers: { text: string; priority: string; mentionedUserIds: string[] }[];
  teamMembers: TeamMember[];
  onChange: (b: { text: string; priority: string; mentionedUserIds: string[] }[]) => void;
}) {
  const updateField = (i: number, field: "text" | "priority", v: string) => {
    const n = [...blockers];
    n[i] = { ...n[i], [field]: v };
    onChange(n);
  };
  const addMention = (i: number, mId: string, updatedText?: string) => {
    const n = [...blockers];
    const existing = n[i].mentionedUserIds;
    n[i] = {
      ...n[i],
      mentionedUserIds: existing.includes(mId) ? existing : [...existing, mId],
      text: updatedText !== undefined ? updatedText : n[i].text,
    };
    onChange(n);
  };
  const removeMention = (i: number, mId: string) => {
    const n = [...blockers];
    n[i] = { ...n[i], mentionedUserIds: n[i].mentionedUserIds.filter((id) => id !== mId) };
    onChange(n);
  };
  const remove = (i: number) => onChange(blockers.filter((_, j) => j !== i));
  const add = () => onChange([...blockers, { text: "", priority: "", mentionedUserIds: [] }]);

  const memberById = (id: string) => teamMembers.find((m) => m.id === id);
  const mentionLabel = (m: TeamMember) => m.name?.split(" ")[0] ?? m.email.split("@")[0];

  return (
    <div className="flex flex-col gap-2">
      {blockers.map((b, i) => {
        const mentionedMembers = b.mentionedUserIds.map(memberById).filter(Boolean) as TeamMember[];
        return (
          <div key={i} className="flex items-start gap-2">
            {/* Emit comma-separated user IDs in a single hidden input to preserve row-index alignment */}
            <input type="hidden" name="blockerUserId" value={b.mentionedUserIds.join(",")} />

            {/* Main input card */}
            <div className="flex-1 rounded-md border bg-background transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
              {/* Top: chips + text input */}
              <div className="flex flex-row flex-wrap items-center gap-1.5 px-3 py-2">
                {mentionedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary select-none"
                  >
                    @{mentionLabel(m).toLowerCase()}
                    <button
                      type="button"
                      onClick={() => removeMention(i, m.id)}
                      className="text-primary/50 hover:text-destructive transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <MentionInput
                  name="blockerText"
                  value={b.text}
                  onChange={(v) => updateField(i, "text", v)}
                  placeholder={mentionedMembers.length > 0 ? "Add description..." : "Describe the blocker... (@ to mention people)"}
                  teamMembers={teamMembers}
                  onSelectMention={(mId, updatedText) => addMention(i, mId, updatedText)}
                  className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent min-w-[120px] flex-1 text-sm"
                />
              </div>

              {/* Bottom: priority picker */}
              <div className="flex items-center gap-1.5 border-t px-3 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Priority:
                </span>
                <select
                  name="blockerPriority"
                  value={b.priority}
                  onChange={(e) => updateField(i, "priority", e.target.value)}
                  className={cn(
                    "cursor-pointer bg-transparent text-xs outline-none rounded px-1",
                    b.priority === "HIGH" && "font-semibold text-red-600",
                    b.priority === "MEDIUM" && "font-semibold text-amber-600",
                    b.priority === "LOW" && "font-semibold text-sky-600",
                    !b.priority && "text-muted-foreground"
                  )}
                >
                  <option value="">Select priority</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Remove row button */}
            {blockers.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="mt-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-destructive/60 transition-colors hover:border-destructive/40 hover:text-destructive"
      >
        <Plus size={13} /> Add Blocker
      </button>
    </div>
  );
}

// ── Support rows ──────────────────────────────────────────────────────────────

function SupportRows({
  supports,
  teamMembers,
  onChange,
}: {
  supports: { text: string; mentionedUserIds: string[] }[];
  teamMembers: TeamMember[];
  onChange: (s: { text: string; mentionedUserIds: string[] }[]) => void;
}) {
  const updateText = (i: number, v: string) => {
    const n = [...supports];
    n[i] = { ...n[i], text: v };
    onChange(n);
  };
  const addMention = (i: number, mId: string, updatedText?: string) => {
    const n = [...supports];
    const existing = n[i].mentionedUserIds;
    n[i] = {
      ...n[i],
      mentionedUserIds: existing.includes(mId) ? existing : [...existing, mId],
      text: updatedText !== undefined ? updatedText : n[i].text,
    };
    onChange(n);
  };
  const removeMention = (i: number, mId: string) => {
    const n = [...supports];
    n[i] = { ...n[i], mentionedUserIds: n[i].mentionedUserIds.filter((id) => id !== mId) };
    onChange(n);
  };
  const remove = (i: number) => onChange(supports.filter((_, j) => j !== i));
  const add = () => onChange([...supports, { text: "", mentionedUserIds: [] }]);

  const memberById = (id: string) => teamMembers.find((m) => m.id === id);
  const mentionLabel = (m: TeamMember) => m.name?.split(" ")[0] ?? m.email.split("@")[0];

  return (
    <div className="flex flex-col gap-2">
      {supports.map((s, i) => {
        const mentionedMembers = s.mentionedUserIds.map(memberById).filter(Boolean) as TeamMember[];
        return (
          <div key={i} className="flex items-start gap-2">
            {/* Emit comma-separated user IDs in a single hidden input to preserve row-index alignment */}
            <input type="hidden" name="supportUserId" value={s.mentionedUserIds.join(",")} />

            {/* Main input card */}
            <div className="flex-1 rounded-md border bg-background transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring min-h-[38px]">
              {/* Chips + text input in a flex-wrap row */}
              <div className="flex flex-row flex-wrap items-center gap-1.5 px-3 py-2">
                {mentionedMembers.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary select-none"
                  >
                    @{mentionLabel(m).toLowerCase()}
                    <button
                      type="button"
                      onClick={() => removeMention(i, m.id)}
                      className="text-primary/50 hover:text-destructive transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <MentionInput
                  name="supportText"
                  value={s.text}
                  onChange={(v) => updateText(i, v)}
                  placeholder={mentionedMembers.length > 0 ? "Add details..." : "Add support details... (@ to mention people)"}
                  teamMembers={teamMembers}
                  onSelectMention={(mId, updatedText) => addMention(i, mId, updatedText)}
                  className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent min-w-[120px] flex-1 text-sm"
                />
              </div>
            </div>

            {/* Remove row button */}
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-2 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Plus size={13} /> Add Support Needed
      </button>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function Section({ icon, title, required, children }: {
  icon: React.ReactNode;
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">
          {title}
          {required && <span className="ml-1 text-destructive">*</span>}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

type SubmitDsmFormProps = {
  entry: EntryWithDetails | null;
  yesterdayTasks: string[];
  yesterdayIncompleteTasks: string[];
  yesterdayBlockers: { text: string; priority: "LOW" | "MEDIUM" | "HIGH"; mentionedUserId?: string | null }[];
  teamMembers: TeamMember[];
  todayDateStr: string; // "YYYY-MM-DD"
  onCancel?: () => void;
};

const initialState: SaveDsmState = {};

export function SubmitDsmForm({
  entry,
  yesterdayTasks,
  yesterdayIncompleteTasks,
  yesterdayBlockers,
  teamMembers,
  todayDateStr,
  onCancel,
}: SubmitDsmFormProps) {
  const [state, action, pending] = useActionState(saveDsm, initialState);
  const isEditMode = entry?.status === "SUBMITTED" || entry?.status === "PENDING_REVIEW";

  const [tasks, setTasks] = useState<Task[]>(() => {
    const existingToday = entry?.tasks.filter((t) => t.kind === "TODAY") ?? [];
    if (existingToday.length > 0) {
      return existingToday.map((t) => ({ text: t.text, priority: t.priority ?? "", carried: false }));
    }
    if (yesterdayIncompleteTasks.length > 0) {
      return yesterdayIncompleteTasks.map((text) => ({ text, priority: "", carried: true }));
    }
    return [{ text: "", priority: "", carried: false }, { text: "", priority: "", carried: false }];
  });

  const [blockers, setBlockers] = useState<{ text: string; priority: string; mentionedUserIds: string[] }[]>(() => {
    if (entry?.blockers && entry.blockers.length > 0) {
      return entry.blockers.map((b) => ({
        text: b.text,
        priority: b.priority,
        mentionedUserIds: b.mentionedUserIds
          ? b.mentionedUserIds.split(",").filter(Boolean)
          : b.mentionedUserId
            ? [b.mentionedUserId]
            : [],
      }));
    }
    if (yesterdayBlockers && yesterdayBlockers.length > 0) {
      return yesterdayBlockers.map((b) => ({
        text: b.text,
        priority: b.priority,
        mentionedUserIds: b.mentionedUserId ? [b.mentionedUserId] : [],
      }));
    }
    return [{ text: "", priority: "", mentionedUserIds: [] }];
  });
  const [supports, setSupports] = useState<{ text: string; mentionedUserIds: string[] }[]>(() =>
    entry?.supportNeeds.map((s) => ({
      text: s.text,
      mentionedUserIds: s.mentionedUserIds
        ? s.mentionedUserIds.split(",").filter(Boolean)
        : s.mentionedUser?.id
          ? [s.mentionedUser.id]
          : [],
    })) ?? [{ text: "", mentionedUserIds: [] }]
  );
  const [learningText, setLearningText] = useState(entry?.learningText ?? "");

  // If save-draft succeeded, update state silently (no reset needed — user continues editing)
  useEffect(() => {
    if (state.message === "saved") {
      // Draft saved — feedback handled by status message below
    }
  }, [state.message]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-base font-semibold">
          {isEditMode ? "Edit Today's Standup" : "Submit Today's Standup"}
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

      <form action={action} className="flex flex-col gap-6 px-5 py-5">
        <input type="hidden" name="date" value={todayDateStr} />

        {/* Yesterday — read-only completed tasks */}
        <Section icon={<CheckCircle2 size={16} className="text-primary" />} title="What Did You Complete Yesterday?">
          {yesterdayTasks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {yesterdayTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle2 size={18} className="shrink-0 text-primary" />
                  <span>{task}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/60">No Entries for Yesterday.</p>
          )}
        </Section>

        {/* Today's tasks */}
        <Section
          icon={<ClipboardList size={16} className="text-primary" />}
          title="What Will You Do Today?"
          required
        >
          <TaskRows tasks={tasks} teamMembers={teamMembers} onChange={setTasks} />
          {state.errors?.tasks && (
            <p className="text-xs text-destructive">{state.errors.tasks[0]}</p>
          )}
        </Section>

        {/* What will you learn today */}
        <Section
          icon={<GraduationCap size={16} className="text-primary" />}
          title="What Will You Learn Today?"
        >
          <textarea
            name="learningText"
            rows={3}
            value={learningText}
            onChange={(e) => setLearningText(e.target.value)}
            placeholder="What New Skill, Topic, or Concept Are You Planning to Learn Today?"
            className={cn(inputCls, "resize-none")}
          />
        </Section>

        {/* Blockers */}
        <Section icon={<Ban size={16} className="text-muted-foreground" />} title="Any Blockers (Data Needed)?">
          <BlockerRows blockers={blockers} teamMembers={teamMembers} onChange={setBlockers} />
        </Section>

        {/* Support needed */}
        <Section icon={<HandHelping size={16} className="text-muted-foreground" />} title="Any Support Needed (Meeting)?">
          <SupportRows supports={supports} teamMembers={teamMembers} onChange={setSupports} />
        </Section>

        {/* Footer */}
        <div className={cn("flex items-center border-t pt-4", isEditMode ? "justify-end" : "justify-between")}>
          {!isEditMode && (
            <button
              name="action"
              value="draft"
              type="submit"
              disabled={pending}
              className="rounded-lg border px-5 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            >
              Save Draft
            </button>
          )}
          <div className="flex items-center gap-3">
            {state.message === "saved" && (
              <p className="text-xs text-muted-foreground">Draft Saved.</p>
            )}
            {state.message && state.message !== "saved" && (
              <p className="text-xs text-destructive">
                {state.message === "Unauthorized" ? "Session Expired. Please Sign In Again." : state.message}
              </p>
            )}
            <button
              name="action"
              value="submit"
              type="submit"
              disabled={pending}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : isEditMode ? "Save Changes" : "Submit DSM"}
              {!pending && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
