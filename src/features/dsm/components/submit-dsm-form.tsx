"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { Plus, X, ChevronRight, CheckCircle2, AlertCircle, ClipboardList, GraduationCap, Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveDsm, type SaveDsmState } from "../actions/save-dsm";
import type { EntryWithDetails, TeamMember } from "../queries";
import { MentionInput } from "@/components/shared/mention-input";
import type { CalendarEventView } from "@/features/calendar/queries";
import { formatTime } from "@/features/calendar/utils";
import { EventDialog } from "@/features/calendar/components/event-dialog";
import { SupportNeededIcon } from "@/components/icons/support-needed-icon";

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

type Task = { id: string; text: string; priority: string; carried: boolean };

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
  const add = () => onChange([...tasks, { id: crypto.randomUUID(), text: "", priority: "", carried: false }]);

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
          <div key={task.id} className="flex flex-col gap-1.5 rounded-md border bg-background p-2.5 transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold",
                task.text ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                T{i + 1}
              </span>
              <MentionInput
                key={`${task.id}-${task.text}`}
                name="taskText"
                defaultValue={task.text}
                onChange={(v) => updateField(i, "text", v)}
                placeholder="Add task details... (Type @ for people, @file: for files)"
                teamMembers={teamMembers}
              />
              {task.carried && (
                <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
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
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add task
      </button>
    </div>
  );
}

// ── Blocker rows ──────────────────────────────────────────────────────────────

function BlockerRows({
  blockers,
  teamMembers,
  onChange,
  onScheduleMeeting,
}: {
  blockers: { id: string; text: string; priority: string; mentionedUserIds: string[] }[];
  teamMembers: TeamMember[];
  onChange: (b: { id: string; text: string; priority: string; mentionedUserIds: string[] }[]) => void;
  onScheduleMeeting?: (title: string, participantIds: string[]) => void;
}) {
  const updateField = (i: number, field: "text" | "priority", v: string) => {
    const n = [...blockers];
    n[i] = { ...n[i], [field]: v };
    onChange(n);
  };
  const updateMentions = (i: number, text: string, mentionedUserIds: string[]) => {
    const n = [...blockers];
    n[i] = { ...n[i], text, mentionedUserIds };
    onChange(n);
  };
  const remove = (i: number) => onChange(blockers.filter((_, j) => j !== i));
  const add = () => onChange([...blockers, { id: crypto.randomUUID(), text: "", priority: "", mentionedUserIds: [] }]);

  const memberById = (id: string) => teamMembers.find((m) => m.id === id);

  return (
    <div className="flex flex-col gap-2">
      {blockers.map((b, i) => {
        const initialMentions = b.mentionedUserIds.map(memberById).filter(Boolean) as TeamMember[];
        return (
          <div key={b.id} className="flex items-start gap-2">
            {/* Emit comma-separated user IDs in a single hidden input to preserve row-index alignment */}
            <input type="hidden" name="blockerUserId" value={b.mentionedUserIds.join(",")} />

            {/* Main input card */}
            <div className="flex-1 rounded-md border bg-background transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
              <div className="px-3 py-2">
                <MentionInput
                  key={`${b.id}-${b.text}`}
                  name="blockerText"
                  defaultValue={b.text}
                  defaultMentions={initialMentions}
                  onChange={(text, mentionedUserIds) => updateMentions(i, text, mentionedUserIds)}
                  placeholder="Describe the blocker... (@ to mention people)"
                  teamMembers={teamMembers}
                  className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent text-sm"
                />
              </div>

              {/* Bottom: priority picker & schedule meeting action */}
              <div className="flex items-center justify-between border-t px-3 py-1.5 bg-muted/20">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Priority:
                  </span>
                  <select
                    name="blockerPriority"
                    value={b.priority}
                    onChange={(e) => updateField(i, "priority", e.target.value)}
                    className={cn(
                      "cursor-pointer bg-transparent text-xs outline-none rounded px-1",
                      b.priority === "HIGH" && "font-semibold text-destructive",
                      b.priority === "MEDIUM" && "font-semibold text-warning",
                      b.priority === "LOW" && "font-semibold text-info",
                      !b.priority && "text-muted-foreground"
                    )}
                  >
                    <option value="">Select priority</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                {onScheduleMeeting && (
                  <button
                    type="button"
                    onClick={() => {
                      const titleText = b.text.trim() ? `Blocker Sync: ${b.text.trim()}` : "Blocker Resolution Meeting";
                      onScheduleMeeting(titleText, b.mentionedUserIds);
                    }}
                    className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground px-2.5 py-1 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <CalendarIcon size={12} className="text-muted-foreground" />
                    Schedule Meeting
                  </button>
                )}
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
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-destructive/60 transition-colors hover:border-destructive/40 hover:text-destructive dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add Blocker
      </button>
    </div>
  );
}

// ── Support rows ──────────────────────────────────────────────────────────────

function SupportRows({
  supports,
  teamMembers,
  onChange,
  onScheduleMeeting,
}: {
  supports: { id: string; text: string; mentionedUserIds: string[] }[];
  teamMembers: TeamMember[];
  onChange: (s: { id: string; text: string; mentionedUserIds: string[] }[]) => void;
  onScheduleMeeting?: (title: string, participantIds: string[]) => void;
}) {
  const updateMentions = (i: number, text: string, mentionedUserIds: string[]) => {
    const n = [...supports];
    n[i] = { ...n[i], text, mentionedUserIds };
    onChange(n);
  };
  const remove = (i: number) => onChange(supports.filter((_, j) => j !== i));
  const add = () => onChange([...supports, { id: crypto.randomUUID(), text: "", mentionedUserIds: [] }]);

  const memberById = (id: string) => teamMembers.find((m) => m.id === id);

  return (
    <div className="flex flex-col gap-2">
      {supports.map((s, i) => {
        const initialMentions = s.mentionedUserIds.map(memberById).filter(Boolean) as TeamMember[];
        return (
          <div key={s.id} className="flex items-start gap-2">
            {/* Emit comma-separated user IDs in a single hidden input to preserve row-index alignment */}
            <input type="hidden" name="supportUserId" value={s.mentionedUserIds.join(",")} />

            {/* Main input card */}
            <div className="flex-1 rounded-md border bg-background transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring min-h-[38px]">
              <div className="px-3 py-2">
                <MentionInput
                  key={`${s.id}-${s.text}`}
                  name="supportText"
                  defaultValue={s.text}
                  defaultMentions={initialMentions}
                  onChange={(text, mentionedUserIds) => updateMentions(i, text, mentionedUserIds)}
                  placeholder="Add support details... (@ to mention people)"
                  teamMembers={teamMembers}
                  className="border-0 bg-transparent px-0 py-0 focus:ring-0 focus:border-transparent text-sm"
                />
              </div>

              {/* Bottom: Schedule Meeting Action */}
              <div className="flex items-center justify-between border-t px-3 py-1.5 bg-muted/20">
                <span className="text-[11px] text-muted-foreground font-medium">
                  {s.mentionedUserIds.length > 0 ? `${s.mentionedUserIds.length} tagged for meeting` : "Tag people (@) to invite"}
                </span>
                {onScheduleMeeting && (
                  <button
                    type="button"
                    onClick={() => {
                      const titleText = s.text.trim() ? `Support Needed: ${s.text.trim()}` : "Support Needed Meeting";
                      onScheduleMeeting(titleText, s.mentionedUserIds);
                    }}
                    className="flex items-center gap-1.5 text-[11px] font-semibold rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground px-2.5 py-1 transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <CalendarIcon size={12} className="text-muted-foreground" />
                    Schedule Meeting
                  </button>
                )}
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
        className="flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary dark:text-[#3B82F6] dark:hover:text-[#2563EB] dark:border-[#3B82F6]/40"
      >
        <Plus size={13} className="dark:text-[#93C5FD]" /> Add Support Needed
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
  todayCalendarEvents?: CalendarEventView[];
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
  todayCalendarEvents,
  onCancel,
}: SubmitDsmFormProps) {
  const [state, action, pending] = useActionState(saveDsm, initialState);
  const isEditMode = entry?.status === "SUBMITTED" || entry?.status === "PENDING_REVIEW";

  const isLoadedRef = useRef(false);
  const draftKey = `winos_dsm_draft_${todayDateStr}`;

  // Read saved draft synchronously on initial render
  const savedDraft = typeof window !== "undefined" && !isEditMode ? (() => {
    try {
      const saved = localStorage.getItem(draftKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })() : null;

  const [tasks, setTasks] = useState<Task[]>(() => {
    if (savedDraft?.tasks?.length) return savedDraft.tasks;
    const existingToday = entry?.tasks.filter((t) => t.kind === "TODAY") ?? [];
    if (existingToday.length > 0) {
      return existingToday.map((t) => ({ id: crypto.randomUUID(), text: t.text, priority: t.priority ?? "", carried: false }));
    }
    if (yesterdayIncompleteTasks.length > 0) {
      return yesterdayIncompleteTasks.map((text) => ({ id: crypto.randomUUID(), text, priority: "", carried: true }));
    }
    return [{ id: crypto.randomUUID(), text: "", priority: "", carried: false }, { id: crypto.randomUUID(), text: "", priority: "", carried: false }];
  });

  const [blockers, setBlockers] = useState<{ id: string; text: string; priority: string; mentionedUserIds: string[] }[]>(() => {
    if (savedDraft?.blockers?.length) return savedDraft.blockers;
    if (entry?.blockers && entry.blockers.length > 0) {
      return entry.blockers.map((b) => ({
        id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
        text: b.text,
        priority: b.priority,
        mentionedUserIds: b.mentionedUserId ? [b.mentionedUserId] : [],
      }));
    }
    return [{ id: crypto.randomUUID(), text: "", priority: "", mentionedUserIds: [] }];
  });

  const [supports, setSupports] = useState<{ id: string; text: string; mentionedUserIds: string[] }[]>(() => {
    if (savedDraft?.supports?.length) return savedDraft.supports;
    return entry?.supportNeeds.map((s) => ({
      id: crypto.randomUUID(),
      text: s.text,
      mentionedUserIds: s.mentionedUserIds
        ? s.mentionedUserIds.split(",").filter(Boolean)
        : s.mentionedUser?.id
          ? [s.mentionedUser.id]
          : [],
    })) ?? [{ id: crypto.randomUUID(), text: "", mentionedUserIds: [] }];
  });

  const [learningText, setLearningText] = useState(savedDraft?.learningText ?? entry?.learningText ?? "");
  const [scheduleModal, setScheduleModal] = useState<{ title: string; participantIds: string[] } | null>(null);

  useEffect(() => {
    isLoadedRef.current = true;
  }, []);

  // Auto-save form draft to localStorage on every change
  useEffect(() => {
    if (!isLoadedRef.current || isEditMode) return;
    const draftData = {
      tasks,
      blockers,
      supports,
      learningText,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch {
      // Ignore storage error
    }
  }, [draftKey, isEditMode, tasks, blockers, supports, learningText]);

  // Clear draft upon successful save or submission
  useEffect(() => {
    if (state.message === "saved" || state.message === "submitted") {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // Ignore
      }
    }
  }, [state.message, draftKey]);

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
        <Section icon={<CheckCircle2 size={16} className="text-primary dark:text-[#3B82F6]" />} title="What Did You Complete Yesterday?">
          {yesterdayTasks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {yesterdayTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <CheckCircle2 size={18} className="shrink-0 text-primary dark:text-[#3B82F6]" />
                  <span>{task}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/60">No Entries for Yesterday.</p>
          )}
        </Section>

        {/* Today's Scheduled Zoho Calendar Meetings Widget */}
        {/* {todayCalendarEvents && todayCalendarEvents.length > 0 && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <CalendarIcon size={16} className="text-primary" />
                <span>Today&apos;s Scheduled Calendar Meetings ({todayCalendarEvents.length})</span>
              </div>
              <span className="text-[11px] font-semibold text-primary/80 bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                Zoho Calendar Integration
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {todayCalendarEvents.map((ev) => {
                const timeStr = `${formatTime(ev.start)} - ${formatTime(ev.end)}`;
                return (
                  <div key={ev.id} className="flex flex-col justify-between rounded-lg border border-border bg-card p-3 shadow-2xs space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                        <span className="truncate max-w-[180px]">{ev.title}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                          <Clock size={10} /> {timeStr}
                        </span>
                      </div>
                      {ev.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{ev.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                      <button
                        type="button"
                        onClick={() => {
                          setTasks((prev) => [
                            ...prev.filter((t) => t.text.trim()),
                            { text: `Meeting: ${ev.title} (${timeStr})`, priority: "P1", carried: false },
                          ]);
                        }}
                        className="flex-1 rounded-md bg-primary/10 border border-primary/30 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-all text-center cursor-pointer"
                      >
                        + Add to Tasks
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSupports((prev) => [
                            ...prev.filter((s) => s.text.trim()),
                            { text: `Data/Input needed for meeting: ${ev.title} (${timeStr})`, mentionedUserIds: [] },
                          ]);
                        }}
                        className="flex-1 rounded-md bg-secondary border border-border py-1 text-[11px] font-semibold text-foreground hover:bg-accent transition-all text-center cursor-pointer"
                      >
                        + Add to Data Needed
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )} */}

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
          title="What Will You Learn Today( WhyFi )?"
          required
        >
          <textarea
            name="learningText"
            rows={3}
            value={learningText}
            onChange={(e) => setLearningText(e.target.value)}
            placeholder="What New Skill, Topic, or Concept Are You Planning to Learn Today?"
            className={cn(inputCls, "resize-none")}
            required
          />
          {state.errors?.learningText && (
            <p className="text-xs text-destructive">{state.errors.learningText[0]}</p>
          )}
        </Section>

        {/* Blockers */}
        <Section icon={<AlertCircle size={16} className="text-muted-foreground" />} title="Blockers (Dependencies)?">
          <BlockerRows
            blockers={blockers}
            teamMembers={teamMembers}
            onChange={setBlockers}
          // onScheduleMeeting={(title, participantIds) => setScheduleModal({ title, participantIds })}
          />
        </Section>

        {/* Support needed */}
        <Section icon={<SupportNeededIcon size={16} className="text-muted-foreground" />} title="Support Needed (Meeting)?">
          <SupportRows
            supports={supports}
            teamMembers={teamMembers}
            onChange={setSupports}
            onScheduleMeeting={(title, participantIds) => setScheduleModal({ title, participantIds })}
          />
        </Section>

        {/* Footer */}
        <div className={cn("flex items-center border-t pt-4", isEditMode ? "justify-end" : "justify-between")}>
          {!isEditMode && (
            <button
              name="action"
              value="draft"
              type="submit"
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground px-5 py-2 text-sm font-semibold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              {pending && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
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
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] dark:text-[#F8FAFC]"
            >
              {pending && <Loader2 size={16} className="animate-spin" />}
              {pending ? "Saving…" : isEditMode ? "Save Changes" : "Submit DSM"}
              {!pending && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </form>

      {/* Direct Meeting Scheduler Modal */}
      {scheduleModal && (
        <EventDialog
          mode="create"
          defaultTitle={scheduleModal.title}
          defaultParticipantIds={scheduleModal.participantIds}
          internalUsers={teamMembers.map((m) => ({ id: m.id, name: m.name ?? null, email: m.email }))}
          currentUserId=""
          onClose={() => setScheduleModal(null)}
        />
      )}
    </div>
  );
}
