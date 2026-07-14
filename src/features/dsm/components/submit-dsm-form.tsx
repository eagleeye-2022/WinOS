"use client";

import { useActionState, useState, useEffect } from "react";
import { Plus, X, ChevronRight, CheckCircle2, Ban, ClipboardList, HandHelping } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveDsm, type SaveDsmState } from "../actions/save-dsm";
import type { EntryWithDetails, TeamMember } from "../queries";

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

// ── Task rows ─────────────────────────────────────────────────────────────────

type Task = { text: string; carried: boolean };

function TaskRows({
  tasks,
  onChange,
}: {
  tasks: Task[];
  onChange: (t: Task[]) => void;
}) {
  const update = (i: number, v: string) => {
    const n = [...tasks];
    n[i] = { ...n[i], text: v };
    onChange(n);
  };
  const remove = (i: number) => onChange(tasks.filter((_, j) => j !== i));
  const add = () => onChange([...tasks, { text: "", carried: false }]);

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold",
            task.text ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            T{i + 1}
          </span>
          <input
            name="taskText"
            value={task.text}
            onChange={(e) => update(i, e.target.value)}
            placeholder="Add task details..."
            className={inputCls}
          />
          {task.carried && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              Carried over
            </span>
          )}
          {(tasks.length > 1 || task.carried) && (
            <button type="button" onClick={() => remove(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
              <X size={14} />
            </button>
          )}
        </div>
      ))}
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
  blockers: { text: string; priority: string; mentionedUserId: string }[];
  teamMembers: TeamMember[];
  onChange: (b: { text: string; priority: string; mentionedUserId: string }[]) => void;
}) {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const update = (i: number, field: "text" | "priority" | "mentionedUserId", v: string) => {
    const n = [...blockers];
    n[i] = { ...n[i], [field]: v };
    onChange(n);
  };
  const remove = (i: number) => onChange(blockers.filter((_, j) => j !== i));
  const add = () => onChange([...blockers, { text: "", priority: "", mentionedUserId: "" }]);

  const memberById = (id: string) => teamMembers.find((m) => m.id === id);
  const mentionLabel = (m: TeamMember) => m.name?.split(" ")[0] ?? m.email.split("@")[0];

  return (
    <div className="flex flex-col gap-2">
      {blockers.map((b, i) => {
        const mentioned = b.mentionedUserId ? memberById(b.mentionedUserId) : null;
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input type="hidden" name="blockerUserId" value={b.mentionedUserId} />
              <div className="relative flex-1 flex items-center overflow-hidden rounded-md border bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
                {mentioned && (
                  <span className="mr-2 shrink-0 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary select-none">
                    @{mentionLabel(mentioned).toLowerCase()}
                  </span>
                )}
                <input
                  name="blockerText"
                  value={b.text}
                  onChange={(e) => update(i, "text", e.target.value)}
                  placeholder="Describe the blockers..."
                  className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/50 min-w-0"
                />
                <div className="flex shrink-0 items-center gap-2 border-l pl-3 py-1.5 ml-2">
                  <div className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-0.5 transition-colors",
                    b.priority === "HIGH" && "bg-red-100 text-red-700",
                    b.priority === "MEDIUM" && "bg-amber-100 text-amber-700",
                    b.priority === "LOW" && "bg-sky-100 text-sky-700",
                  )}>
                    <span className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      b.priority ? "opacity-70" : "text-muted-foreground"
                    )}>
                      PRIORITY:
                    </span>
                    <select
                      name="blockerPriority"
                      value={b.priority}
                      onChange={(e) => update(i, "priority", e.target.value)}
                      className={cn(
                        "cursor-pointer bg-transparent text-xs outline-none",
                        b.priority ? "font-medium" : "text-muted-foreground"
                      )}
                    >
                      <option value="">Select Priority</option>
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Team member assignment picker */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === i ? null : i)}
                  className="flex items-center gap-1 rounded-md border px-2 py-2 text-xs text-muted-foreground hover:bg-accent h-[38px] min-w-[75px] justify-center"
                >
                  {mentioned ? (
                    <span className="text-primary truncate max-w-[65px]">{mentionLabel(mentioned)}</span>
                  ) : (
                    "@mention"
                  )}
                </button>

                {openDropdown === i && (
                  <div className="absolute right-0 bottom-full z-20 mb-1 w-52 rounded-lg border bg-card shadow-md">
                    <div className="p-1">
                      <button
                        type="button"
                        onClick={() => { update(i, "mentionedUserId", ""); setOpenDropdown(null); }}
                        className="w-full rounded-md px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent"
                      >
                        No assignment
                      </button>
                      {teamMembers.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { update(i, "mentionedUserId", m.id); setOpenDropdown(null); }}
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs hover:bg-accent"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{m.name ?? m.email}</p>
                            <p className="truncate text-muted-foreground">
                              {m.title ?? (m.role === "MANAGER" ? "Manager" : "Team Member")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {blockers.length > 1 && (
                <button type="button" onClick={() => remove(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-destructive/60 transition-colors hover:border-destructive/40 hover:text-destructive"
      >
        <Plus size={13} /> Add blocker
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
  supports: { text: string; mentionedUserId: string }[];
  teamMembers: TeamMember[];
  onChange: (s: { text: string; mentionedUserId: string }[]) => void;
}) {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const update = (i: number, field: "text" | "mentionedUserId", v: string) => {
    const n = [...supports];
    n[i] = { ...n[i], [field]: v };
    onChange(n);
  };
  const remove = (i: number) => onChange(supports.filter((_, j) => j !== i));
  const add = () => onChange([...supports, { text: "", mentionedUserId: "" }]);

  const memberById = (id: string) => teamMembers.find((m) => m.id === id);
  const mentionLabel = (m: TeamMember) => m.name?.split(" ")[0] ?? m.email.split("@")[0];

  return (
    <div className="flex flex-col gap-2">
      {supports.map((s, i) => {
        const mentioned = s.mentionedUserId ? memberById(s.mentionedUserId) : null;
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <input type="hidden" name="supportUserId" value={s.mentionedUserId} />
              <div className="flex-1 flex items-center overflow-hidden rounded-md border bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring h-[38px]">
                {mentioned && (
                  <span className="mr-2 shrink-0 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary select-none">
                    @{mentionLabel(mentioned).toLowerCase()}
                  </span>
                )}
                <input
                  name="supportText"
                  value={s.text}
                  onChange={(e) => update(i, "text", e.target.value)}
                  placeholder="Add support details..."
                  className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/50 min-w-0"
                />
              </div>

              {/* Team member picker */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === i ? null : i)}
                  className="flex items-center gap-1 rounded-md border px-2 py-2 text-xs text-muted-foreground hover:bg-accent"
                >
                  {mentioned ? (
                    <span className="text-primary">{mentionLabel(mentioned)}</span>
                  ) : (
                    "@mention"
                  )}
                </button>

                {openDropdown === i && (
                  <div className="absolute right-0 bottom-full z-20 mb-1 w-52 rounded-lg border bg-card shadow-md">
                    <div className="p-1">
                      <button
                        type="button"
                        onClick={() => { update(i, "mentionedUserId", ""); setOpenDropdown(null); }}
                        className="w-full rounded-md px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent"
                      >
                        No assignment
                      </button>
                      {teamMembers.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { update(i, "mentionedUserId", m.id); setOpenDropdown(null); }}
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs hover:bg-accent"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{m.name ?? m.email}</p>
                            <p className="truncate text-muted-foreground">
                              {m.title ?? (m.role === "MANAGER" ? "Manager" : "Team Member")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button type="button" onClick={() => remove(i)} className="mt-2 shrink-0 text-muted-foreground hover:text-destructive">
                <X size={14} />
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Plus size={13} /> Add support needed
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
      return existingToday.map((t) => ({ text: t.text, carried: false }));
    }
    if (yesterdayIncompleteTasks.length > 0) {
      return yesterdayIncompleteTasks.map((text) => ({ text, carried: true }));
    }
    return [{ text: "", carried: false }, { text: "", carried: false }];
  });

  const [blockers, setBlockers] = useState<{ text: string; priority: string; mentionedUserId: string }[]>(() => {
    if (entry?.blockers && entry.blockers.length > 0) {
      return entry.blockers.map((b) => ({ text: b.text, priority: b.priority, mentionedUserId: b.mentionedUserId ?? "" }));
    }
    if (yesterdayBlockers && yesterdayBlockers.length > 0) {
      return yesterdayBlockers.map((b) => ({ text: b.text, priority: b.priority, mentionedUserId: b.mentionedUserId ?? "" }));
    }
    return [{ text: "", priority: "", mentionedUserId: "" }];
  });
  const [supports, setSupports] = useState<{ text: string; mentionedUserId: string }[]>(() =>
    entry?.supportNeeds.map((s) => ({
      text: s.text,
      mentionedUserId: s.mentionedUser?.id ?? "",
    })) ?? [{ text: "", mentionedUserId: "" }]
  );

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
        <Section icon={<CheckCircle2 size={16} className="text-primary" />} title="What did you complete yesterday?">
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
            <p className="text-sm text-muted-foreground/60">No entries for yesterday.</p>
          )}
        </Section>

        {/* Today's tasks */}
        <Section
          icon={<ClipboardList size={16} className="text-primary" />}
          title="What will you do today?"
          required
        >
          <TaskRows tasks={tasks} onChange={setTasks} />
          {state.errors?.tasks && (
            <p className="text-xs text-destructive">{state.errors.tasks[0]}</p>
          )}
        </Section>

        {/* Blockers */}
        <Section icon={<Ban size={16} className="text-muted-foreground" />} title="Any blockers?">
          <BlockerRows blockers={blockers} teamMembers={teamMembers} onChange={setBlockers} />
        </Section>

        {/* Support needed */}
        <Section icon={<HandHelping size={16} className="text-muted-foreground" />} title="Any Support needed?">
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
              <p className="text-xs text-muted-foreground">Draft saved.</p>
            )}
            {state.message && state.message !== "saved" && (
              <p className="text-xs text-destructive">
                {state.message === "Unauthorized" ? "Session expired. Please sign in again." : state.message}
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
