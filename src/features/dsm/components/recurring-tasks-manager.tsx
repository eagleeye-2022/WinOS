"use client";

import { useState, useTransition } from "react";
import { Repeat, Plus, Trash2, Pause, Play, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { DsmRecurrencePicker } from "./dsm-recurrence-picker";
import {
  describeRule,
  parseRule,
  formatRecurrenceBadge,
  type RecurrenceRule,
} from "../recurring-utils";
import {
  createRecurringTaskAction,
  toggleRecurringTaskAction,
  deleteRecurringTaskAction,
} from "../actions/recurring-tasks";
import type { RecurringTaskItem, CascadingProjectOption } from "../queries";
import { ProjectTaskSelectors } from "./project-task-selectors";

type RecurringTasksManagerProps = {
  items: RecurringTaskItem[];
  todayDateStr: string;
  cascadingProjects?: CascadingProjectOption[];
  onProjectsChange?: (update: (prev: CascadingProjectOption[]) => CascadingProjectOption[]) => void;
  onItemsChange?: (items: RecurringTaskItem[]) => void;
  targetUserId?: string;
};

export function RecurringTasksManager({
  items: initialItems,
  todayDateStr,
  cascadingProjects = [],
  onProjectsChange,
  onItemsChange,
  targetUserId,
}: RecurringTasksManagerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RecurringTaskItem[]>(initialItems);
  const [isPending, startTransition] = useTransition();

  // New recurring task form state
  const [text, setText] = useState("");
  const [priority, setPriority] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskListCode, setTaskListCode] = useState("");
  const [projectTaskId, setProjectTaskId] = useState("");
  const [rule, setRule] = useState<RecurrenceRule | null>({
    freq: "WEEKLY",
    interval: 1,
    byDay: ["MO", "TU", "WE", "TH", "FR"],
  });

  const anchorDate = new Date(todayDateStr + "T00:00:00.000Z");
  const activeCount = items.filter((i) => i.isActive).length;

  const syncItems = (next: RecurringTaskItem[]) => {
    setItems(next);
    onItemsChange?.(next);
  };

  const handleCreate = () => {
    if (!text.trim()) {
      toast.error("Enter a task description");
      return;
    }
    if (!rule) {
      toast.error("Select a recurrence schedule");
      return;
    }
    startTransition(async () => {
      const res = await createRecurringTaskAction({
        text: text.trim(),
        priority: priority || null,
        projectId: projectId || null,
        projectTaskId: projectTaskId || null,
        rule,
        startDateStr: todayDateStr,
        targetUserId,
      });
      if (!res.success || !res.id) {
        toast.error(res.message ?? "Failed to create recurring task");
        return;
      }
      const proj = cascadingProjects.find((p) => p.id === projectId);
      const newItem: RecurringTaskItem = {
        id: res.id,
        userId: targetUserId ?? "",
        text: text.trim(),
        priority: priority || null,
        projectId: projectId || null,
        projectTaskId: projectTaskId || null,
        recurrenceRule: JSON.stringify(rule),
        startDate: anchorDate,
        endDate: null,
        isActive: true,
        order: items.length,
        project: proj ? { id: proj.id, name: proj.name } : null,
      };
      syncItems([...items, newItem]);
      setText("");
      setPriority("");
      setProjectId("");
      setTaskListCode("");
      setProjectTaskId("");
      toast.success("Recurring task added");
    });
  };

  const handleToggle = (item: RecurringTaskItem) => {
    startTransition(async () => {
      const nextActive = !item.isActive;
      const res = await toggleRecurringTaskAction(item.id, nextActive);
      if (!res.success) {
        toast.error(res.message ?? "Failed to update");
        return;
      }
      syncItems(items.map((i) => (i.id === item.id ? { ...i, isActive: nextActive } : i)));
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteRecurringTaskAction(id);
      if (!res.success) {
        toast.error(res.message ?? "Failed to delete");
        return;
      }
      syncItems(items.filter((i) => i.id !== id));
      toast.success("Recurring task removed");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Manage recurring standup tasks"
        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary cursor-pointer"
      >
        <Repeat size={13} />
        <span>Recurring</span>
        {activeCount > 0 && (
          <span className="rounded bg-primary/10 px-1.5 text-xs font-bold tabular-nums text-primary">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2">
                <Repeat size={17} className="text-primary" />
                <div>
                  <h2 className="text-sm font-semibold">Recurring Standup Tasks</h2>
                  <p className="text-xs text-muted-foreground">
                    Automatically added to your daily DSM when scheduled.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Add new recurring task */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Add Recurring Task
                </p>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g., Check production error logs & alerts"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
                {cascadingProjects.length > 0 && onProjectsChange && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ProjectTaskSelectors
                      projects={cascadingProjects}
                      projectsLoading={false}
                      projectId={projectId}
                      taskListCode={taskListCode}
                      taskId={projectTaskId}
                      subtaskId=""
                      onProjectChange={(v) => {
                        setProjectId(v);
                        setTaskListCode("");
                        setProjectTaskId("");
                      }}
                      onTaskListChange={(v) => setTaskListCode(v)}
                      onTaskChange={(t) => {
                        setProjectTaskId(t?.id || "");
                        if (t?.phaseCode) setTaskListCode(t.phaseCode);
                      }}
                      onSubtaskChange={() => {}}
                      onProjectsChange={onProjectsChange}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DsmRecurrencePicker value={rule} onChange={setRule} start={anchorDate} />
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium outline-none"
                    >
                      <option value="">No priority</option>
                      <option value="P1">P1</option>
                      <option value="P2">P2</option>
                      <option value="P3">P3</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isPending || !text.trim() || !rule}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Add Recurring
                  </button>
                </div>
              </div>

              {/* Existing recurring tasks */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Configured ({items.length})
                </p>
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                    No recurring tasks yet. Add one above or click the Repeat icon on any task in your DSM.
                  </p>
                ) : (
                  items.map((item) => {
                    const parsed = parseRule(item.recurrenceRule);
                    const badge = parsed ? formatRecurrenceBadge(parsed, new Date(item.startDate)) : "Custom";
                    const fullDesc = parsed ? describeRule(parsed, new Date(item.startDate)) : "Custom schedule";
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5",
                          !item.isActive && "opacity-60 bg-muted/20"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{item.text}</span>
                            <span
                              title={fullDesc}
                              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                            >
                              <Repeat size={10} />
                              {badge}
                            </span>
                            {item.priority && (
                              <span className="rounded border px-1.5 py-0.5 text-[11px] font-semibold">
                                {item.priority}
                              </span>
                            )}
                            {!item.isActive && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                Paused
                              </span>
                            )}
                          </div>
                          {(item.project?.name || item.projectTask?.code) && (
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">
                              {[item.project?.name, item.projectTask?.code ? `[${item.projectTask.code}] ${item.projectTask.title}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggle(item)}
                            disabled={isPending}
                            title={item.isActive ? "Pause recurring task" : "Resume recurring task"}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            {item.isActive ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={isPending}
                            title="Delete recurring task"
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
