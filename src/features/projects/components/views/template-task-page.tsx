"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Folder,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { AvatarStack } from "@/components/shared/avatar-stack";
import { RichDescriptionEditor, RichDescriptionView, isEmptyDescription } from "@/components/shared/rich-description";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { ChecklistChip } from "@/features/sop-checklists/components/checklist-chip";
import { getSopPickerOptionsAction } from "@/features/sop-checklists/actions/template-actions";
import type { SopPickerOption } from "@/features/sop-checklists/types";
import { cn } from "@/lib/utils";
import { SOPTaskSeed, TaskStatus, getTaskStatusPillClasses, getTaskStatusSelectClasses } from "../../types";
// Used by the hidden month hint and Task Information below.
// import { TEMPLATE_MONTH_PLACEHOLDER } from "../../data/sop-templates";
// import { getOwnersAndTeamsAction } from "../../actions/project-actions";
// import { OwnerUserOption, TaskMultiOwnerSelect } from "../task-multi-owner-select";
import { TEMPLATE_STATUSES } from "../../template-utils";

interface TemplateTaskPageProps {
  task: SOPTaskSeed;
  code: string;
  templateName: string;
  lists: string[];
  phaseIndex: number;
  canManage: boolean;
  /** A new template isn't stored yet, so it shows Create Template; an existing one saves itself. */
  showCreate: boolean;
  isSaving: boolean;
  saveStatus: React.ReactNode;
  onChange: (patch: Partial<SOPTaskSeed>) => void;
  onMoveToList: (phaseIndex: number) => void;
  onDelete: () => void;
  onBack: () => void;
  onCreate: () => void;
}

const SECTION = "border border-border rounded-xl bg-card overflow-hidden dark:border-zinc-800 dark:bg-[#121215]";
// const FIELD_LABEL = "text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400";
// const FIELD_VALUE = "font-semibold text-foreground text-sm dark:text-zinc-100";
const SELECT_OPTION = "bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className={SECTION}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-3.5 hover:bg-accent/40 text-xs font-bold text-foreground transition-colors dark:hover:bg-zinc-800/40 dark:text-zinc-200"
      >
        <span className="flex items-center gap-2">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {title}
        </span>
      </button>
      {isOpen && <div className="border-t border-border/60 dark:border-zinc-800/60">{children}</div>}
    </div>
  );
}

/** Whole days after the project is created; empty means the task starts with no date. */
/* Hidden with Task Information.
function DaysField({
  label,
  value,
  canManage,
  onChange,
}: {
  label: string;
  value?: number;
  canManage: boolean;
  onChange: (days: number | undefined) => void;
}) {
  return (
    <div>
      <label className={FIELD_LABEL}>
        {label}
        {canManage ? (
          <span className="mt-0.5 flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={3650}
              step={1}
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value === "" ? undefined : Math.floor(Number(e.target.value)))}
              placeholder="--"
              className="w-16 rounded-md border border-input bg-transparent px-1.5 py-0.5 font-semibold text-foreground text-sm outline-none focus:ring-1 focus:ring-primary dark:text-zinc-100"
            />
            <span className="font-normal">days after project creation</span>
          </span>
        ) : (
          <span className={cn(FIELD_VALUE, "mt-0.5 block")}>
            {value === undefined ? "--" : `${value} days after project creation`}
          </span>
        )}
      </label>
    </div>
  );
}
*/

/**
 * The main task page for a task in a template: what's set here is what the task starts with in
 * every project created from the template. Edits go to the template's board, which saves them.
 */
export function TemplateTaskPage({
  task,
  code,
  templateName,
  lists,
  phaseIndex,
  canManage,
  showCreate,
  isSaving,
  saveStatus,
  onChange,
  onMoveToList,
  onDelete,
  onBack,
  onCreate,
}: TemplateTaskPageProps) {
  const [title, setTitle] = useState(task.title);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(task.description ?? "");
  const [newSubtask, setNewSubtask] = useState("");
  // const [owners, setOwners] = useState<OwnerUserOption[] | null>(null);
  const [sops, setSops] = useState<SopPickerOption[] | null>(null);
  const [sopDepartment, setSopDepartment] = useState("");
  const [isExpandedView, setIsExpandedView] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    // getOwnersAndTeamsAction()
    //   .then((res) => setOwners(res.owners))
    //   .catch((err) => {
    //     console.error("Failed to load owners:", err);
    //     setOwners([]);
    //   });
    getSopPickerOptionsAction()
      .then(setSops)
      .catch((err) => {
        console.error("Failed to load SOPs:", err);
        setSops([]);
      });
  }, [canManage]);

  const subtasks = task.subtasks ?? [];
  const taskOwners = task.defaultOwners ?? [];
  const taskSops = task.sopChecklists ?? [];

  const saveDescription = () => {
    onChange({ description: isEmptyDescription(descriptionDraft) ? undefined : descriptionDraft.trim() });
    setIsEditingDescription(false);
  };

  const addSubtask = () => {
    const subtask = newSubtask.trim();
    if (!subtask) return;
    onChange({ subtasks: [...subtasks, subtask] });
    setNewSubtask("");
  };

  // const changeOwners = (names: string[]) => {
  //   const known = [...taskOwners, ...(owners ?? [])];
  //   onChange({
  //     defaultOwners: names.flatMap((name) => {
  //       const owner = known.find((o) => o.name === name);
  //       return owner ? [{ id: owner.id, name: owner.name }] : [];
  //     }),
  //   });
  // };

  const attachSop = (id: string) => {
    const sop = sops?.find((s) => s.id === id);
    if (sop) onChange({ sopChecklists: [...taskSops, { id: sop.id, name: sop.name }] });
  };

  const sopDepartments = [...new Set((sops ?? []).map((s) => s.department))].sort((a, b) => a.localeCompare(b));
  const sopOptions = (sops ?? [])
    .filter((s) => (!sopDepartment || s.department === sopDepartment) && !taskSops.some((t) => t.id === s.id))
    .map((s) => ({ value: s.id, label: `${s.name} · ${s.stepCount} steps · ${sopDepartment ? s.list : s.department}` }));

  return (
    // Covers the whole project list (tabs and header too), like the main task page does.
    <div className="absolute inset-0 z-30 flex overflow-hidden bg-background text-foreground font-sans dark:bg-[#09090b] dark:text-zinc-100">
      {!isExpandedView && (
        <aside className="hidden md:flex w-[340px] shrink-0 flex-col h-full min-h-0 select-none border-r border-border bg-card dark:border-zinc-800 dark:bg-[#0c0d10]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3 dark:border-zinc-800">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Task</span>
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              <ArrowLeft size={12} /> All Tasks
            </button>
          </div>

          <div className="dsm-columns-scrollbar flex-1 overflow-auto p-3 space-y-2">
            <div className="rounded-xl border border-primary/70 bg-primary/5 p-3.5 shadow-2xs space-y-2.5 ring-1 ring-primary/40 dark:bg-primary/10">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs font-bold text-slate-400 dark:text-neutral-500 whitespace-nowrap">{code}</span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium text-white shadow-2xs",
                    getTaskStatusPillClasses(task.status ?? "Open")
                  )}
                >
                  {task.status ?? "Open"}
                </span>
              </div>
              <h4 className="text-xs font-semibold leading-snug text-slate-800 dark:text-neutral-200">{task.title}</h4>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-neutral-800/80">
                <ChecklistChip
                  summary={taskSops.length > 0 ? { done: 0, total: 0, requiredOpen: 0 } : undefined}
                  title={
                    taskSops.length > 0
                      ? `SOP attached in new projects: ${taskSops.map((s) => s.name).join(", ")}`
                      : "No SOP set on this template task"
                  }
                />
                {taskOwners.length > 0 ? (
                  <AvatarStack people={taskOwners} />
                ) : (
                  <span
                    title="Starts unassigned"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200/80 ring-2 ring-background shadow-2xs dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700"
                  >
                    <UserIcon size={12} aria-label="Unassigned" />
                  </span>
                )}
              </div>
            </div>

            {subtasks.map((subtask, index) => (
              <div
                key={index}
                className="ml-3 rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-2xs space-y-1 dark:border-neutral-800 dark:bg-card"
              >
                <span className="block font-mono text-xs font-bold text-slate-400 dark:text-neutral-500">
                  {code}.{index + 1}
                </span>
                <span className="block text-xs font-semibold leading-snug text-slate-800 dark:text-neutral-200">
                  {subtask || "Untitled subtask"}
                </span>
              </div>
            ))}
          </div>
        </aside>
      )}

    <main className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3.5 bg-card shrink-0 dark:border-zinc-800 dark:bg-[#0c0d10]">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground dark:border-zinc-700 cursor-pointer"
              title="Back to the template"
              aria-label="Back to the template"
            >
              <ArrowLeft size={14} />
            </button>
            <span className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-bold text-foreground border border-border dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
              <CheckSquare size={12} /> Template Task
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground font-semibold dark:bg-zinc-800 dark:text-zinc-300">
              {code}
            </span>
          </div>
          {canManage ? (
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (e.target.value.trim()) onChange({ title: e.target.value });
              }}
              onBlur={() => {
                if (!title.trim()) setTitle(task.title);
              }}
              aria-label="Task title"
              className="-mx-2 w-full rounded-md border border-transparent bg-transparent px-2 py-0.5 text-lg font-bold tracking-tight text-foreground outline-none transition-colors hover:border-border hover:bg-accent/30 focus:border-primary/60 focus:ring-1 focus:ring-primary/30 dark:text-neutral-100 dark:hover:border-zinc-700"
            />
          ) : (
            <h2 className="-mx-2 truncate px-2 py-0.5 text-lg font-bold tracking-tight text-foreground dark:text-neutral-100">{task.title}</h2>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5 dark:text-neutral-400">
            <span className="flex items-center gap-1 font-medium text-foreground dark:text-zinc-300">
              <Folder size={12} className="text-muted-foreground dark:text-zinc-400" /> {templateName || "New Template"}
            </span>
            <span>|</span>
            {canManage ? (
              <select
                value={phaseIndex}
                onChange={(e) => onMoveToList(Number(e.target.value))}
                title="Task list"
                aria-label="Task list"
                className="max-w-[260px] truncate bg-transparent font-medium text-foreground outline-none cursor-pointer dark:text-zinc-300"
              >
                {lists.map((list, index) => (
                  <option key={index} value={index} className={SELECT_OPTION}>
                    {list || "Untitled list"}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-medium text-foreground dark:text-zinc-300">{lists[phaseIndex]}</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {saveStatus}
          {canManage && showCreate && (
            <button
              type="button"
              disabled={isSaving}
              onClick={onCreate}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isSaving && <Loader2 size={13} className="animate-spin" />}
              Create Template
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground hover:text-destructive transition-colors cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300"
              title="Delete Task"
              aria-label="Delete Task"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpandedView(!isExpandedView)}
            className={cn(
              "hidden md:block p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300",
              isExpandedView && "bg-primary/20 text-primary border-primary"
            )}
            title={isExpandedView ? "Restore Sidebar View" : "Full Width Maximize View"}
            aria-label={isExpandedView ? "Restore Sidebar View" : "Full Width Maximize View"}
          >
            {isExpandedView ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground hover:text-destructive transition-colors cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-rose-400"
            title="Close Task"
            aria-label="Close Task"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5 pb-20">
        <div className="space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-zinc-400">STATUS</span>
          <div className="relative inline-block">
            <select
              value={task.status ?? "Open"}
              disabled={!canManage}
              onChange={(e) => {
                const status = e.target.value as TaskStatus;
                onChange({ status: status === "Open" ? undefined : status });
              }}
              aria-label="Status the task starts in"
              className={cn(
                "appearance-none rounded-lg border bg-card px-3 py-1.5 pr-8 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary dark:bg-[#141519] dark:border-zinc-700 dark:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
                getTaskStatusSelectClasses(task.status ?? "Open")
              )}
            >
              {TEMPLATE_STATUSES.map((s) => (
                <option key={s} value={s} className={SELECT_OPTION}>
                  ● {s}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none dark:text-zinc-400"
            />
          </div>
        </div>

        <Section title="Description">
          <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground dark:text-zinc-400">
            {isEditingDescription ? (
              <div className="space-y-2 pt-2">
                <RichDescriptionEditor value={descriptionDraft} onChange={setDescriptionDraft} />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveDescription}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionDraft(task.description ?? "");
                      setIsEditingDescription(false);
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent cursor-pointer dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : !isEmptyDescription(task.description) ? (
              <div
                onClick={(e) => {
                  if (!canManage || (e.target as HTMLElement).closest("a")) return;
                  setDescriptionDraft(task.description ?? "");
                  setIsEditingDescription(true);
                }}
                title={canManage ? "Click to edit description" : undefined}
                className={cn("rounded-md pt-2 transition-colors", canManage && "cursor-text hover:bg-accent/30")}
              >
                <RichDescriptionView value={task.description ?? ""} />
              </div>
            ) : (
              <span
                onClick={() => canManage && setIsEditingDescription(true)}
                className={cn("font-mono", canManage && "cursor-text hover:text-foreground transition-colors dark:hover:text-zinc-100")}
              >
                NO DESCRIPTION AVAILABLE
              </span>
            )}
          </div>
        </Section>

        <Section title="SOPs/Checklist">
          <div className="space-y-3 p-4 text-xs">
            {canManage && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <SearchableSelect
                  value={sopDepartment}
                  onChange={setSopDepartment}
                  options={sopDepartments.map((d) => ({ value: d, label: d }))}
                  placeholder={sops === null ? "Loading…" : "All departments"}
                  searchPlaceholder="Search departments..."
                  disabled={sops === null}
                  className="flex max-w-[190px] items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary dark:border-zinc-800"
                />
                <SearchableSelect
                  value=""
                  onChange={attachSop}
                  options={sopOptions}
                  placeholder={sops === null ? "Loading…" : sopOptions.length === 0 ? "No checklists left" : "Select checklist"}
                  searchPlaceholder="Search checklists..."
                  disabled={sops === null || sopOptions.length === 0}
                  className="flex max-w-[240px] items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary dark:border-zinc-800"
                  contentClassName="w-80"
                />
              </div>
            )}

            {taskSops.length === 0 ? (
              <div className="space-y-1 rounded-lg border border-dashed p-6 text-center text-muted-foreground dark:border-zinc-800">
                <ClipboardCheck size={28} className="mx-auto opacity-40" />
                <p className="font-semibold text-foreground">No checklist on this task yet.</p>
                {canManage && <p>Select an SOP above and it&apos;s attached to this task in every new project.</p>}
              </div>
            ) : (
              <ul className="space-y-2">
                {taskSops.map((sop) => {
                  const current = sops?.find((s) => s.id === sop.id);
                  const isUnavailable = sops !== null && !current;
                  return (
                    <li key={sop.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 dark:border-zinc-800">
                      <span className="flex min-w-0 items-center gap-2">
                        <ClipboardCheck size={14} className="shrink-0 text-success" />
                        <span className="min-w-0 truncate font-semibold text-foreground">{current?.name ?? sop.name}</span>
                        {current && (
                          <span className="shrink-0 text-muted-foreground">
                            {current.department} · {current.stepCount} steps
                          </span>
                        )}
                        {canManage && isUnavailable && (
                          <span className="shrink-0 text-destructive">No longer available, so it will be skipped</span>
                        )}
                      </span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => onChange({ sopChecklists: taskSops.filter((s) => s.id !== sop.id) })}
                          title="Remove checklist"
                          aria-label={`Remove ${sop.name}`}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Section>

        {/* Task Information (Owner, Start Date, Due Date, Duration), hidden by request.
        <Section title="Task Information">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 text-xs bg-muted/30 dark:bg-[#141519]">
            <div className="col-span-2 md:col-span-4 border-b border-border/40 pb-3 mb-1 dark:border-zinc-800/60">
              {canManage && owners ? (
                <TaskMultiOwnerSelect
                  label="Owner"
                  selectedOwners={taskOwners.map((o) => o.name)}
                  onChangeOwners={changeOwners}
                  ownersList={owners}
                />
              ) : (
                <>
                  <span className={FIELD_LABEL}>Owner</span>
                  <span className={FIELD_VALUE}>
                    {taskOwners.length > 0 ? taskOwners.map((o) => o.name).join(", ") : canManage ? "Loading…" : "Unassigned"}
                  </span>
                </>
              )}
            </div>
            <DaysField
              label="Start Date"
              value={task.startInDays}
              canManage={canManage}
              onChange={(startInDays) => onChange({ startInDays })}
            />
            <DaysField
              label="Due Date"
              value={task.dueInDays}
              canManage={canManage}
              onChange={(dueInDays) => onChange({ dueInDays })}
            />
            <div>
              <label className={FIELD_LABEL}>
                Duration
                {canManage ? (
                  <input
                    type="text"
                    value={task.duration}
                    onChange={(e) => onChange({ duration: e.target.value })}
                    className="mt-0.5 block w-full max-w-[140px] bg-transparent font-semibold text-foreground outline-none text-sm dark:text-zinc-100"
                  />
                ) : (
                  <span className={cn(FIELD_VALUE, "mt-0.5 block")}>{task.duration}</span>
                )}
              </label>
            </div>
          </div>
        </Section>
        */}

        <Section title={`Subtasks (${subtasks.length})`}>
          <div className="space-y-2 p-4 text-xs">
            {subtasks.length === 0 && !canManage && <p className="italic text-muted-foreground">No subtasks.</p>}
            {subtasks.map((subtask, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-10 shrink-0 font-mono font-bold text-muted-foreground">
                  {code}.{index + 1}
                </span>
                {canManage ? (
                  <>
                    <input
                      type="text"
                      value={subtask}
                      onChange={(e) =>
                        onChange({ subtasks: subtasks.map((s, i) => (i === index ? e.target.value : s)) })
                      }
                      aria-label={`Subtask ${index + 1}`}
                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => onChange({ subtasks: subtasks.filter((_, i) => i !== index) })}
                      title="Remove subtask"
                      aria-label={`Remove subtask ${index + 1}`}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <span className="text-foreground">{subtask}</span>
                )}
              </div>
            ))}
            {canManage && (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addSubtask();
                    }}
                    placeholder="Subtask name, then Enter to add another"
                    aria-label="New subtask name"
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    disabled={!newSubtask.trim()}
                    onClick={addSubtask}
                    className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Subtask</span>
                  </button>
                </div>
                {/* Month placeholder hint, hidden by request.
                <p className="text-muted-foreground">
                  {TEMPLATE_MONTH_PLACEHOLDER} in a name becomes the month the project is created in.
                </p>
                */}
              </>
            )}
          </div>
        </Section>
      </div>
    </main>
    </div>
  );
}
