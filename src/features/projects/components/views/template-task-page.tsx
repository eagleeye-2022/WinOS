"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Folder,
  ListTree,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Trash2,
  User as UserIcon,
  X,
  Calendar,
  Layers,
  Clock,
  Copy,
  CopyCheck,
  MoreHorizontal,
  UserPlus,
  Send,
  AlertCircle,
  Paperclip,
  Activity,
  MessageSquare,
  History,
} from "lucide-react";
import { AvatarStack } from "@/components/shared/avatar-stack";
import { RichDescriptionEditor, RichDescriptionView, isEmptyDescription } from "@/components/shared/rich-description";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { ChecklistChip } from "@/features/sop-checklists/components/checklist-chip";
import { TaskMultiOwnerSelect, type OwnerUserOption } from "../task-multi-owner-select";
import {
  getSopLibraryForViewerAction,
  getSopPickerOptionsAction,
} from "@/features/sop-checklists/actions/template-actions";
import { getAllUserOptionsAction } from "@/features/users/actions/user-actions";
import type { SopPickerOption, SopTemplate } from "@/features/sop-checklists/types";
import { sopPlaceLabel } from "@/features/sop-checklists/utils";
import { cn } from "@/lib/utils";
import {
  ProjectPriority,
  SOPSubtaskSeed,
  SOPTaskSeed,
  TaskItem,
  TaskStatus,
  getTaskStatusBadgeClasses,
  getTaskStatusPillClasses,
  getTaskStatusSelectClasses,
  makeSubtask,
  subtaskChildren,
  subtaskDescription,
  subtaskDueDate,
  subtaskDuration,
  subtaskOwners,
  subtaskPriority,
  subtaskSops,
  subtaskStartDate,
  subtaskStatus,
  subtaskTitle,
} from "../../types";
import {
  TEMPLATE_STATUSES,
  deleteSubtaskAtPath,
  flattenSubtasksTree,
  getSubtaskAtPath,
  updateSubtaskAtPath,
  getSubtaskBreadcrumbs,
} from "../../template-utils";
import { toast } from "@/components/shared/toast";

/** TipTap rich document view - loaded on demand in the browser. */
const SopDocView = dynamic(() => import("@/features/sop-checklists/editor/sop-doc-view"), {
  ssr: false,
  loading: () => <div className="h-32 animate-pulse rounded-md bg-muted/40" />,
});

interface TemplateTaskPageProps {
  task: SOPTaskSeed;
  code: string;
  templateName: string;
  lists: string[];
  phaseIndex: number;
  canManage: boolean;
  subtaskPath?: number[];
  onNavigateSubtask?: (path: number[]) => void;
  /** A new template isn't stored yet, so it shows Create Template; an existing one saves itself. */
  showCreate: boolean;
  isSaving: boolean;
  saveStatus: React.ReactNode;
  onChange: (patch: Partial<SOPTaskSeed>) => void;
  onMoveToList: (phaseIndex: number) => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  onBack: () => void;
  onCreate: () => void;
}

const SELECT_OPTION = "bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100";
const SIDEBAR_MIN_WIDTH = 260;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 340;

// Date formatting and computation helpers matching single-task-workspace-view.tsx
function parseDateForInput(dateStr?: string): string {
  if (!dateStr || dateStr === "--" || dateStr.startsWith("-") || !/\d/.test(dateStr)) return "";
  const trimmed = dateStr.trim();
  const slashParts = trimmed.split(/[/.-]/);
  if (slashParts.length === 3) {
    if (slashParts[0].length === 4) {
      return `${slashParts[0]}-${slashParts[1].padStart(2, "0")}-${slashParts[2].padStart(2, "0")}`;
    }
    if (slashParts[2].length === 4) {
      return `${slashParts[2]}-${slashParts[1].padStart(2, "0")}-${slashParts[0].padStart(2, "0")}`;
    }
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return "";
}

function formatInputToDisplayDate(isoDate: string): string {
  if (!isoDate) return "--";
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

function formatSafeDisplayDate(dateStr?: string): string {
  if (!dateStr || dateStr === "--" || dateStr.includes("asdf") || !/\d/.test(dateStr)) {
    return "--";
  }
  const iso = parseDateForInput(dateStr);
  if (!iso) return "--";
  return formatInputToDisplayDate(iso);
}

function computeDuration(startDateStr?: string, dueDateStr?: string, fallbackDuration?: string): string {
  const startIso = parseDateForInput(startDateStr);
  const dueIso = parseDateForInput(dueDateStr);
  if (startIso && dueIso) {
    const s = new Date(startIso);
    const d = new Date(dueIso);
    const diff = d.getTime() - s.getTime();
    if (!isNaN(diff)) {
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
      if (days > 1) return `${days} days`;
      if (days === 1) return "1 day";
      if (days <= 0) return "0 days";
    }
  }
  if (
    fallbackDuration &&
    fallbackDuration !== "2 days/hrs" &&
    !fallbackDuration.includes("asdf") &&
    /\d/.test(fallbackDuration)
  ) {
    return fallbackDuration;
  }
  return "--";
}

/**
 * Slide-out drawer for adding a subtask, exact same style and fields as normal project's AddSubtaskDrawer.
 */
function AddTemplateSubtaskDrawer({
  isOpen,
  onClose,
  parentTaskCode,
  nextSubtaskNumber,
  onAddSubtask,
}: {
  isOpen: boolean;
  onClose: () => void;
  parentTaskCode: string;
  nextSubtaskNumber: number;
  onAddSubtask: (subtask: {
    title: string;
    status: TaskStatus;
    startDate?: string;
    dueDate?: string;
    description?: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>("Open");
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddSubtask({
      title: title.trim(),
      status,
      startDate: startDate ? formatInputToDisplayDate(startDate) : undefined,
      dueDate: dueDate ? formatInputToDisplayDate(dueDate) : undefined,
      description: isEmptyDescription(description) ? undefined : description.trim(),
    });
    onClose();
    setTitle("");
    setDescription("");
    setStartDate("");
    setDueDate("");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200">
      <div className="relative flex h-full w-full max-w-xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300 font-sans border-l border-border dark:border-neutral-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground dark:text-neutral-100">Add Subtask</h2>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
              {parentTaskCode}.{nextSubtaskNumber}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Subtask Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement header navigation"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className={cn(
                "rounded-lg border bg-card px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary",
                getTaskStatusSelectClasses(status)
              )}
            >
              {TEMPLATE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  ● {s}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Description
            </label>
            <RichDescriptionEditor value={description} onChange={setDescription} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create Subtask
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Renders an attached SOP Checklist in default preview manner mirroring the
 * normal project task checklist card: expandable header with step count, progress bar,
 * TipTap document preview, and step list with badges.
 */
function TemplateChecklistCard({
  sopRef,
  sopDetail,
  pickerOption,
  canManage,
  onDetach,
}: {
  sopRef: { id: string; name: string };
  sopDetail?: SopTemplate;
  pickerOption?: SopPickerOption;
  canManage: boolean;
  onDetach: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const name = sopDetail?.name ?? pickerOption?.name ?? sopRef.name;
  const department = sopDetail?.department ?? pickerOption?.department;
  const totalSteps = sopDetail?.items?.length ?? pickerOption?.stepCount ?? 0;

  return (
    <div className="rounded-lg border bg-card dark:border-zinc-800 dark:bg-[#121215]">
      {/* Header: Chevron · Name · Department · Progress bar · Detach */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/60 text-primary hover:bg-primary/10 cursor-pointer"
          title={isOpen ? "Collapse preview" : "Expand preview"}
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-foreground">{name}</h4>
            {sopDetail && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground dark:bg-zinc-800">
                SOP v{sopDetail.version}
              </span>
            )}
            {department && (
              <span className="text-[11px] text-muted-foreground">· {sopPlaceLabel(department)}</span>
            )}
          </div>
        </div>

        {/* Progress bar preview: 0 / total steps */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground" title="0% done (preview)">
          <span className="w-4 text-right tabular-nums">0</span>
          <div className="h-2.5 w-24 overflow-hidden rounded-sm border border-muted-foreground/40 sm:w-32 bg-muted/40">
            <div className="h-full bg-primary transition-all" style={{ width: "0%" }} />
          </div>
          <span className="w-5 tabular-nums">{totalSteps}</span>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={onDetach}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
            title="Remove checklist from template"
            aria-label={`Remove ${name}`}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Body: TipTap Rich Document & Steps List */}
      {isOpen && (
        <div className="space-y-3 border-t px-4 pb-4 pt-3 dark:border-zinc-800">
          {sopDetail?.content ? (
            <div className="rounded-md bg-background/50 p-2.5 border border-border/60 dark:border-zinc-800/80">
              <SopDocView content={sopDetail.content} checkedById={new Map()} onToggle={() => false} />
            </div>
          ) : !sopDetail ? (
            <div className="h-24 animate-pulse rounded-md bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
              Loading SOP checklist preview...
            </div>
          ) : null}

          {sopDetail?.items && sopDetail.items.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Checklist Steps ({sopDetail.items.length})
              </p>
              <ul className="space-y-1">
                {sopDetail.items.map((item, index) => (
                  <li
                    key={item.id || index}
                    className="flex items-center gap-2.5 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-foreground dark:border-zinc-800/70"
                  >
                    <input
                      type="checkbox"
                      disabled
                      aria-label={item.text}
                      className="h-3.5 w-3.5 rounded border-input opacity-60 cursor-not-allowed"
                    />
                    <span className="flex-1 font-medium">{item.text}</span>
                    {item.isRequired && (
                      <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-500">
                        Required
                      </span>
                    )}
                    {item.requiresEvidence && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                        Needs proof
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The task page sidebar's card: the project board's card (code, status, 👁, title, clock, SOP chip,
 * subtask count, due date, owners) with its subtasks, at any depth, always expanded underneath on the
 * board's tree line. The open task / subtask is highlighted.
 */
function TemplateSidebarCard({
  code,
  title,
  status,
  sops,
  owners,
  dueDate,
  isSubtask,
  isSelected,
  onOpen,
  childSeeds,
  subtaskPath,
  parentPath,
  onNavigateSubtask,
}: {
  code: string;
  title: string;
  status: TaskStatus;
  sops: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  dueDate?: string;
  isSubtask: boolean;
  isSelected: boolean;
  onOpen: () => void;
  childSeeds: SOPSubtaskSeed[];
  subtaskPath: number[];
  parentPath: number[];
  onNavigateSubtask?: (path: number[]) => void;
}) {
  const footerBtn =
    "flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-slate-400 hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer dark:bg-[#121316] dark:border-white/10";

  return (
    <div className="space-y-2">
      <div
        onClick={onOpen}
        aria-current={isSelected ? "page" : undefined}
        className={cn(
          // Same width at every depth: deeper levels move right and the panel scrolls sideways.
          "relative w-[272px] overflow-hidden rounded-xl border p-3.5 shadow-2xs transition-all cursor-pointer space-y-2.5 group",
          "bg-white dark:bg-[#111214]",
          isSelected
            ? "border-primary/70 ring-1 ring-primary/40 shadow-md"
            : "border-slate-200/90 dark:border-neutral-800 hover:border-primary/60 hover:shadow-md"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs font-bold text-slate-400 dark:text-neutral-500 whitespace-nowrap">{code}</span>
          <div className="flex min-w-0 items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
            <span
              title={`Starts as: ${status}`}
              className={cn(
                "inline-flex min-w-0 max-w-[150px] shrink items-center truncate rounded-md px-2 py-0.5 text-xs font-medium text-white shadow-2xs",
                getTaskStatusPillClasses(status)
              )}
            >
              {status}
            </span>
            {!isSubtask && (
              <button
                type="button"
                onClick={onOpen}
                className="shrink-0 p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-foreground dark:hover:bg-neutral-800 transition-all duration-150 cursor-pointer"
                title="Open task"
              >
                <Eye size={13} />
              </button>
            )}
          </div>
        </div>

        <h4 className="rounded-md px-1 -mx-1 text-xs font-semibold leading-snug transition-colors group-hover:text-primary text-slate-800 dark:text-neutral-200">
          {title || "Untitled subtask"}
        </h4>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-neutral-800/80 text-slate-400 text-xs">
          <div className="flex items-center gap-2 text-slate-400" onClick={(e) => e.stopPropagation()}>
            <span
              title="Time is logged once it's a task in a project"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-muted-foreground dark:bg-zinc-900 dark:border-zinc-800"
            >
              <Clock size={13} aria-hidden="true" />
            </span>
            <ChecklistChip
              summary={sops.length > 0 ? { done: 0, total: 0, requiredOpen: 0 } : undefined}
              title={sops.length > 0 ? `SOP attached in new projects: ${sops.map((s) => s.name).join(", ")}` : "No SOP set"}
            />
            {isSubtask && (
              <button type="button" onClick={onOpen} className={footerBtn} title="Open subtask">
                <Eye size={13} />
              </button>
            )}
            {childSeeds.length > 0 && (
              <span
                className="flex items-center gap-1 p-1 text-slate-400"
                title={`${childSeeds.length} Subtask${childSeeds.length > 1 ? "s" : ""} (shown below)`}
              >
                <ListTree size={13} />
                <span className="text-xs font-bold">{childSeeds.length}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {dueDate && dueDate !== "--" && (
              <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-muted-foreground" title={`Due ${dueDate}`}>
                <CalendarDays size={12} /> {dueDate}
              </span>
            )}
            <span
              className="flex shrink-0 items-center rounded-full"
              title={owners.length > 0 ? `Owners: ${owners.map((o) => o.name).join(", ")}` : "Starts unassigned"}
            >
              {owners.length === 0 ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200/80 ring-2 ring-background shadow-2xs dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700">
                  <UserIcon size={12} className="text-slate-400 dark:text-neutral-500" />
                </span>
              ) : (
                <AvatarStack people={owners} />
              )}
            </span>
          </div>
        </div>
      </div>

      {childSeeds.length > 0 && (
        <div className={cn("relative ml-2.5 space-y-2 border-l-2 border-cyan-400/70 dark:border-cyan-500/50 pl-3", !isSubtask && "mt-1")}>
          {childSeeds.map((child, index) => {
            const path = [...parentPath, index];
            return (
              <div key={index} className="relative">
                <span className="absolute -left-3 top-4 w-3 border-t-2 border-cyan-400/70 dark:border-cyan-500/50" />
                <TemplateSidebarCard
                  code={`${code}.${index + 1}`}
                  title={subtaskTitle(child)}
                  status={subtaskStatus(child) ?? "Open"}
                  sops={subtaskSops(child)}
                  owners={subtaskOwners(child)}
                  dueDate={subtaskDueDate(child)}
                  isSubtask
                  isSelected={subtaskPath.length === path.length && subtaskPath.every((v, i) => v === path[i])}
                  onOpen={() => onNavigateSubtask?.(path)}
                  childSeeds={subtaskChildren(child)}
                  subtaskPath={subtaskPath}
                  parentPath={path}
                  onNavigateSubtask={onNavigateSubtask}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The main template task & subtask page: renders both root tasks and nested subtasks at any depth.
 * Provides exact same UI, colors, sections (Task Information, SOPs/Checklists, Subtasks Table, Comments),
 * header buttons, resizable hierarchy sidebar, and breadcrumbs as the normal project task page.
 */
export function TemplateTaskPage({
  task,
  code,
  templateName,
  lists,
  phaseIndex,
  canManage,
  subtaskPath = [],
  onNavigateSubtask,
  showCreate,
  isSaving,
  saveStatus,
  onChange,
  onMoveToList,
  onDuplicate,
  onDelete,
  onBack,
  onCreate,
}: TemplateTaskPageProps) {
  // Resolve active subtask (if viewing a subtask at subtaskPath)
  const activeSubtask =
    subtaskPath.length > 0 ? getSubtaskAtPath(task.subtasks ?? [], subtaskPath) : undefined;
  const isSubtaskActive = Boolean(activeSubtask && subtaskPath.length > 0);

  const currentTitle = isSubtaskActive ? subtaskTitle(activeSubtask!) : task.title;
  const currentDesc = isSubtaskActive ? subtaskDescription(activeSubtask!) : task.description;
  const currentStatus = isSubtaskActive ? (subtaskStatus(activeSubtask!) ?? "Open") : (task.status ?? "Open");
  const currentSops = isSubtaskActive ? subtaskSops(activeSubtask!) : (task.sopChecklists ?? []);
  const currentOwners = isSubtaskActive ? subtaskOwners(activeSubtask!) : (task.defaultOwners ?? []);
  const currentStartDate = isSubtaskActive ? (subtaskStartDate(activeSubtask!) ?? "") : (task.startDate ?? "");
  const currentDueDate = isSubtaskActive ? (subtaskDueDate(activeSubtask!) ?? "") : (task.dueDate ?? "");
  const currentPriority = isSubtaskActive ? (subtaskPriority(activeSubtask!) ?? "None") : (task.priority ?? "None");
  const currentDuration = isSubtaskActive ? (subtaskDuration(activeSubtask!) ?? "") : (task.duration ?? "");
  const currentChildren = isSubtaskActive ? subtaskChildren(activeSubtask!) : (task.subtasks ?? []);
  const currentCode = isSubtaskActive ? `${code}.${subtaskPath.map((i) => i + 1).join(".")}` : code;

  // Local state
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isExpandedView, setIsExpandedView] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(currentDesc ?? "");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(true);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [taskInfoOpen, setTaskInfoOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "SUBTASKS" | "COMMENTS" | "LOG_HOURS" | "DOCUMENTS" | "STATUS_TIMELINE" | "STANDUP_ACTIVITY"
  >("COMMENTS");

  // Subtask quick add & drawer
  const [newSubtask, setNewSubtask] = useState("");
  // Subtask rows whose own subtasks are folded away in the table.
  const [collapsedSubtasks, setCollapsedSubtasks] = useState<Set<string>>(new Set());
  const [isAddSubtaskOpen, setIsAddSubtaskOpen] = useState(false);

  // Menus
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Comments feed state
  const [commentText, setCommentText] = useState("");
  const [commentsList, setCommentsList] = useState<Array<{ id: string; author: string; text: string; time: string }>>([]);

  // SOP state
  const [sops, setSops] = useState<SopPickerOption[] | null>(null);
  const [sopLibrary, setSopLibrary] = useState<Map<string, SopTemplate>>(new Map());
  const [sopDepartment, setSopDepartment] = useState("");

  // User options for owners picker
  const [ownersOptions, setOwnersOptions] = useState<OwnerUserOption[]>([]);

  // Sync title and description when active subtask changes
  useEffect(() => {
    setTitle(currentTitle);
    setDescriptionDraft(currentDesc ?? "");
    setIsEditingDescription(false);
    setIsEditingTitle(false);
    setNewSubtask("");
    setIsMoreMenuOpen(false);
    setIsAssignModalOpen(false);
  }, [subtaskPath.join("."), currentTitle, currentDesc]);

  // Load team users for TaskMultiOwnerSelect
  useEffect(() => {
    getAllUserOptionsAction()
      .then((opts) => setOwnersOptions(opts.map((o) => ({ id: o.id, name: o.name, email: "" }))))
      .catch(() => {});
  }, []);

  // Load SOP picker options and full SOP viewer library
  useEffect(() => {
    if (!canManage) return;
    let isCancelled = false;

    getSopPickerOptionsAction()
      .then((res) => {
        if (!isCancelled) setSops(res);
      })
      .catch((err) => {
        console.error("Failed to load SOPs:", err);
        if (!isCancelled) setSops([]);
      });

    getSopLibraryForViewerAction()
      .then((templates) => {
        if (!isCancelled) {
          const map = new Map<string, SopTemplate>();
          for (const t of templates) {
            map.set(t.id, t);
          }
          setSopLibrary(map);
        }
      })
      .catch((err) => {
        console.error("Failed to load SOP viewer library:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [canManage]);

  const breadcrumbs = useMemo(
    () => getSubtaskBreadcrumbs(task, code, subtaskPath),
    [task, code, subtaskPath]
  );
  const rootOwners = task.defaultOwners ?? [];

  // Sidebar resize handler matching single-task-workspace-view.tsx
  const startSidebarResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let latest = startWidth;
    const onMove = (ev: PointerEvent) => {
      latest = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth + ev.clientX - startX));
      setSidebarWidth(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleSaveTitle = () => {
    if (title.trim()) {
      onChange({ title: title.trim() });
    } else {
      setTitle(currentTitle);
    }
    setIsEditingTitle(false);
  };

  const handleSaveDescription = () => {
    onChange({ description: isEmptyDescription(descriptionDraft) ? undefined : descriptionDraft.trim() });
    setIsEditingDescription(false);
  };

  const handleAddQuickSubtask = () => {
    const trimmed = newSubtask.trim();
    if (!trimmed) return;
    onChange({ subtasks: [...currentChildren, trimmed] });
    setNewSubtask("");
  };

  const handleAddDrawerSubtask = (newSub: {
    title: string;
    status: TaskStatus;
    startDate?: string;
    dueDate?: string;
    description?: string;
  }) => {
    const subtaskSeed = makeSubtask(newSub.title, [], {
      status: newSub.status,
      startDate: newSub.startDate,
      dueDate: newSub.dueDate,
      description: newSub.description,
    });
    onChange({ subtasks: [...currentChildren, subtaskSeed] });
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
      id: `c-${Date.now()}`,
      author: "You",
      text: commentText.trim(),
      time: "Just now",
    };
    setCommentsList((prev) => [newComment, ...prev]);
    setCommentText("");
    toast.success("Comment saved");
  };

  const attachSop = (id: string) => {
    const sop = sops?.find((s) => s.id === id);
    if (sop && !currentSops.some((s) => s.id === id)) {
      onChange({ sopChecklists: [...currentSops, { id: sop.id, name: sop.name }] });
    }
  };

  const detachSop = (id: string) => {
    onChange({ sopChecklists: currentSops.filter((s) => s.id !== id) });
  };

  const sopDepartments = [...new Set((sops ?? []).map((s) => s.department))].sort((a, b) => a.localeCompare(b));
  const sopOptions = (sops ?? [])
    .filter((s) => (!sopDepartment || s.department === sopDepartment) && !currentSops.some((t) => t.id === s.id))
    .map((s) => ({
      value: s.id,
      label: `${s.name} · ${s.stepCount} steps · ${sopDepartment ? s.list : s.department}`,
    }));

  // Every subtask under the open one, at any depth, minus those folded away under a collapsed row.
  const subtaskRows = flattenSubtasksTree(currentChildren, currentCode, subtaskPath)
    .filter((item) => ![...collapsedSubtasks].some((c) => item.code.startsWith(`${c}.`)))
    .map((item) => ({ item, hasChildren: subtaskChildren(item.seed).length > 0 }));

  const primaryOwnerName = currentOwners.length > 0 ? currentOwners.map((o) => o.name).join(", ") : "Unassigned";

  return (
    <div className="absolute inset-0 z-30 flex overflow-hidden bg-background text-foreground font-sans dark:bg-[#09090b] dark:text-zinc-100 min-h-0">
      {/* ── Left Sidebar Task List & Hierarchy Column ───────────────────────── */}
      {!isExpandedView && (
        <aside
          style={{ width: sidebarWidth }}
          className="relative hidden md:flex shrink-0 flex-col h-full min-h-0 select-none border-r border-border bg-card dark:border-zinc-800 dark:bg-[#0c0d10]"
        >
          {/* Drag handle on right edge */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize task panel"
            title="Drag to resize · double-click to reset"
            onPointerDown={startSidebarResize}
            onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
            className="group/resize absolute -right-1.5 top-0 z-20 flex h-full w-3 cursor-col-resize justify-center"
          >
            <span className="h-full w-0.5 bg-transparent transition-colors group-hover/resize:bg-primary/70 group-active/resize:bg-primary" />
          </div>

          {/* Header */}
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
          {/* Open task's card with all its subtasks (any depth) on the board's tree line */}
          <div className="dsm-columns-scrollbar flex-1 overflow-auto p-3">
            <div className="w-max min-w-full">
              <TemplateSidebarCard
                code={code}
                title={task.title}
                status={task.status ?? "Open"}
                sops={task.sopChecklists ?? []}
                owners={rootOwners}
                dueDate={task.dueDate}
                isSubtask={false}
                isSelected={!isSubtaskActive}
                onOpen={() => onNavigateSubtask?.([])}
                childSeeds={task.subtasks ?? []}
                subtaskPath={subtaskPath}
                parentPath={[]}
                onNavigateSubtask={onNavigateSubtask}
              />
            </div>
          </div>
        </aside>
      )}

      {/* ── Main Right Task Workspace Area ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col bg-background text-foreground overflow-hidden min-h-0 min-w-0 dark:bg-[#09090b] dark:text-zinc-100">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3.5 bg-card shrink-0 dark:border-zinc-800 dark:bg-[#0c0d10]">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (isSubtaskActive) {
                    onNavigateSubtask?.(subtaskPath.slice(0, -1));
                  } else {
                    onBack();
                  }
                }}
                className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground dark:border-zinc-700 cursor-pointer"
                title={isSubtaskActive ? "Back to parent task" : "Back to template"}
                aria-label="Back"
              >
                <ArrowLeft size={14} />
              </button>

              <span className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-bold text-foreground border border-border dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
                <CheckSquare size={12} /> {isSubtaskActive ? "Subtask" : "Task"}
              </span>

              <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground font-semibold dark:bg-zinc-800 dark:text-zinc-300">
                {currentCode}
              </span>

              {/* Breadcrumbs for deep subtasks */}
              {isSubtaskActive && (
                <div className="flex items-center gap-1 text-xs">
                  {breadcrumbs.map((crumb, idx) => {
                    const isCurrentCrumb = idx === breadcrumbs.length - 1;
                    return (
                      <React.Fragment key={crumb.code}>
                        {idx > 0 && <ChevronRight size={12} className="text-muted-foreground shrink-0" />}
                        {isCurrentCrumb ? (
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted dark:bg-zinc-800 text-muted-foreground">
                              {crumb.code}
                            </span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onNavigateSubtask?.(crumb.path)}
                            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer font-medium hover:underline"
                          >
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted/60 dark:bg-zinc-800/60">
                              {crumb.code}
                            </span>
                            <span className="truncate max-w-[120px]">{crumb.title || "Untitled"}</span>
                          </button>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Editable Title */}
            {isEditingTitle ? (
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") {
                    setTitle(currentTitle);
                    setIsEditingTitle(false);
                  }
                }}
                className="-mx-2 w-full rounded-md border border-primary/60 bg-transparent px-2 py-0.5 text-lg font-bold tracking-tight text-foreground outline-none ring-1 ring-primary/30 focus:ring-primary dark:text-neutral-100"
              />
            ) : (
              <h2
                onClick={() => canManage && setIsEditingTitle(true)}
                title={canManage ? "Click to edit title" : undefined}
                className={cn(
                  "-mx-2 truncate rounded-md border border-transparent px-2 py-0.5 text-lg font-bold tracking-tight text-foreground transition-colors dark:text-neutral-100",
                  canManage && "cursor-text hover:border-border hover:bg-accent/30 dark:hover:border-zinc-700"
                )}
              >
                {currentTitle}
              </h2>
            )}

            {/* Metadata line */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-0.5 dark:text-neutral-400">
              <span title="Template task default owner">
                Owner:{" "}
                <span className={primaryOwnerName !== "Unassigned" ? "font-medium text-foreground dark:text-zinc-300" : "italic"}>
                  {primaryOwnerName}
                </span>
              </span>
              <span>|</span>
              <button
                type="button"
                onClick={onBack}
                title="Go to template"
                className="flex items-center gap-1 text-foreground font-medium dark:text-zinc-300 hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer"
              >
                <Folder size={12} className="text-muted-foreground dark:text-zinc-400" /> {templateName || "Template"}
              </button>
              <span>|</span>
              {canManage && !isSubtaskActive ? (
                <select
                  value={phaseIndex}
                  onChange={(e) => onMoveToList(Number(e.target.value))}
                  title="Move to another task list"
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
                <span className="font-medium text-foreground dark:text-zinc-300">
                  {lists[phaseIndex]}
                  {isSubtaskActive && ` · Subtask of ${task.title}`}
                </span>
              )}
            </div>
          </div>

          {/* Right Header Action Icons matching single-task-workspace-view.tsx */}
          <div className="flex items-center gap-2 relative shrink-0">
            {saveStatus}
            {canManage && showCreate && !isSubtaskActive && (
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

            {/* Effort Log Button (quick jump to Log Hours tab) */}
            <button
              type="button"
              onClick={() => setActiveTab("LOG_HOURS")}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Effort Log</span>
            </button>

            {/* More Actions Menu (...) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(!isMoreMenuOpen);
                  setIsAssignModalOpen(false);
                }}
                className={cn(
                  "p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300",
                  isMoreMenuOpen && "ring-2 ring-primary bg-accent"
                )}
                title="More Actions"
              >
                <MoreHorizontal size={16} />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl z-50 animate-in fade-in-0 zoom-in-95 font-sans dark:border-zinc-800 dark:bg-[#121215]">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Task link copied to clipboard");
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer dark:text-zinc-200"
                  >
                    <Copy size={14} className="text-primary" />
                    <span>Copy Task Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDuplicate?.();
                      setIsMoreMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer dark:text-zinc-200"
                  >
                    <CopyCheck size={14} className="text-sky-500" />
                    <span>Duplicate Task</span>
                  </button>
                  <div className="my-1 border-t border-border dark:border-zinc-800" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onDelete();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Delete Task</span>
                  </button>
                </div>
              )}
            </div>

            {/* Assign User (UserPlus) Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(!isAssignModalOpen);
                  setIsMoreMenuOpen(false);
                }}
                className={cn(
                  "p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300",
                  isAssignModalOpen && "ring-2 ring-primary bg-accent"
                )}
                title="Assign User"
              >
                <UserPlus size={16} />
              </button>

              {isAssignModalOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-popover text-popover-foreground p-3 shadow-xl z-50 animate-in fade-in-0 zoom-in-95 font-sans dark:border-zinc-800 dark:bg-[#121215]">
                  <TaskMultiOwnerSelect
                    label="Assign Default Members"
                    selectedOwners={currentOwners.map((o) => o.name)}
                    disabled={!canManage}
                    onChangeOwners={(newOwners) => {
                      if (!canManage) return;
                      const clean = newOwners.filter((o) => o && o.trim().toLowerCase() !== "unassigned");
                      onChange({ defaultOwners: clean.map((name) => ({ id: name, name })) });
                      toast.success("Default owners updated");
                    }}
                    ownersList={ownersOptions}
                  />
                </div>
              )}
            </div>

            {/* Expand View (Maximize2 / Minimize2) */}
            <button
              type="button"
              onClick={() => setIsExpandedView(!isExpandedView)}
              className={cn(
                "hidden md:block p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground transition-colors cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300",
                isExpandedView && "bg-primary/20 text-primary border-primary"
              )}
              title={isExpandedView ? "Restore Sidebar View" : "Full Width Maximize View"}
            >
              {isExpandedView ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close (X) */}
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground hover:text-destructive transition-colors ml-1 cursor-pointer dark:border-zinc-800 dark:bg-[#141519] dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-rose-400"
              title="Close Task Detail"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Workspace Body Content Scroll Area */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5 pb-20">
          {/* Status Field */}
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-zinc-400">
              STATUS
            </span>
            <div className="relative inline-block">
              <select
                value={currentStatus}
                onChange={(e) => {
                  const status = e.target.value as TaskStatus;
                  onChange({ status: status === "Open" ? undefined : status });
                }}
                disabled={!canManage}
                className={cn(
                  "appearance-none rounded-lg border bg-card px-3 py-1.5 pr-8 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary dark:bg-[#141519] dark:border-zinc-700 dark:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60",
                  getTaskStatusSelectClasses(currentStatus)
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

          {/* Description Collapsible Section */}
          <div className="border border-border rounded-xl bg-card overflow-hidden dark:border-zinc-800 dark:bg-[#121215]">
            <button
              type="button"
              onClick={() => setDescriptionOpen(!descriptionOpen)}
              className="flex w-full items-center justify-between p-3.5 hover:bg-accent/40 text-xs font-bold text-foreground transition-colors dark:hover:bg-zinc-800/40 dark:text-zinc-200"
            >
              <span className="flex items-center gap-2">
                {descriptionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Description
              </span>
            </button>
            {descriptionOpen && (
              <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground border-t border-border/60 dark:text-zinc-400 dark:border-zinc-800/60">
                {isEditingDescription ? (
                  <div className="space-y-2 pt-2">
                    <RichDescriptionEditor value={descriptionDraft} onChange={setDescriptionDraft} />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveDescription}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDescriptionDraft(currentDesc ?? "");
                          setIsEditingDescription(false);
                        }}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent cursor-pointer dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : !isEmptyDescription(currentDesc) ? (
                  <div
                    onClick={(e) => {
                      if (!canManage || (e.target as HTMLElement).closest("a")) return;
                      setDescriptionDraft(currentDesc ?? "");
                      setIsEditingDescription(true);
                    }}
                    title={canManage ? "Click to edit description" : undefined}
                    className={cn(
                      "cursor-text rounded-md pt-2 transition-colors hover:bg-accent/30",
                      canManage && "cursor-text"
                    )}
                  >
                    <RichDescriptionView value={currentDesc ?? ""} />
                  </div>
                ) : (
                  <span
                    onClick={() => canManage && setIsEditingDescription(true)}
                    className={cn(
                      "cursor-text hover:text-foreground transition-colors font-mono dark:hover:text-zinc-100 block pt-1",
                      canManage && "cursor-pointer"
                    )}
                  >
                    NO DESCRIPTION AVAILABLE
                  </span>
                )}
              </div>
            )}
          </div>

          {/* SOPs/Checklist Collapsible Section with Default Preview */}
          <div className="border border-border rounded-xl bg-card overflow-hidden dark:border-zinc-800 dark:bg-[#121215]">
            <button
              type="button"
              onClick={() => setChecklistOpen(!checklistOpen)}
              className="flex w-full items-center justify-between p-3.5 hover:bg-accent/40 text-xs font-bold text-foreground transition-colors dark:hover:bg-zinc-800/40 dark:text-zinc-200"
            >
              <span className="flex items-center gap-2">
                {checklistOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                SOPs/Checklist {currentSops.length > 0 && `(${currentSops.length})`}
              </span>
            </button>
            {checklistOpen && (
              <div className="border-t border-border/60 p-4 space-y-3 text-xs dark:border-zinc-800/60">
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

                {currentSops.length === 0 ? (
                  <div className="space-y-1 rounded-lg border border-dashed p-6 text-center text-muted-foreground dark:border-zinc-800">
                    <ClipboardCheck size={28} className="mx-auto opacity-40" />
                    <p className="font-semibold text-foreground">No checklist on this {isSubtaskActive ? "subtask" : "task"} yet.</p>
                    {canManage && (
                      <p>
                        Select an SOP above to attach it. It will open in default preview mode here and be scaffolded into all new projects.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentSops.map((sop) => (
                      <TemplateChecklistCard
                        key={sop.id}
                        sopRef={sop}
                        sopDetail={sopLibrary.get(sop.id)}
                        pickerOption={sops?.find((s) => s.id === sop.id)}
                        canManage={canManage}
                        onDetach={() => detachSop(sop.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Task Information Collapsible Section (Identical to single-task-workspace-view.tsx) */}
          <div className="border border-border rounded-xl bg-card dark:border-zinc-800 dark:bg-[#121215]">
            <button
              type="button"
              onClick={() => setTaskInfoOpen(!taskInfoOpen)}
              className="flex w-full items-center justify-between p-3.5 hover:bg-accent/40 text-xs font-bold text-foreground transition-colors dark:hover:bg-zinc-800/40 dark:text-zinc-200"
            >
              <span className="flex items-center gap-2">
                {taskInfoOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Task Information
              </span>
            </button>
            {taskInfoOpen && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 text-xs border-t border-border/60 bg-muted/30 dark:border-zinc-800/60 dark:bg-[#141519]">
                <div className="col-span-2 md:col-span-4 border-b border-border/40 pb-3 mb-1 dark:border-zinc-800/60">
                  <TaskMultiOwnerSelect
                    label="Default Owners"
                    selectedOwners={currentOwners.map((o) => o.name)}
                    onChangeOwners={(newOwners) => {
                      if (!canManage) return;
                      const clean = newOwners.filter((o) => o && o.trim().toLowerCase() !== "unassigned");
                      onChange({ defaultOwners: clean.map((name) => ({ id: name, name })) });
                      toast.success("Default owners updated");
                    }}
                    ownersList={ownersOptions}
                    disabled={!canManage}
                  />
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400">Start Date</span>
                  {canManage ? (
                    <input
                      type="date"
                      value={parseDateForInput(currentStartDate)}
                      onChange={(e) => {
                        const newIso = e.target.value;
                        const newDisplay = newIso ? formatInputToDisplayDate(newIso) : "--";
                        onChange({
                          startDate: newDisplay,
                          duration: computeDuration(newDisplay, currentDueDate, currentDuration),
                        });
                      }}
                      className="w-auto max-w-[140px] bg-transparent font-semibold text-foreground outline-none text-sm cursor-pointer dark:text-zinc-100 dark:[color-scheme:dark]"
                    />
                  ) : (
                    <span className="font-semibold text-foreground text-sm dark:text-zinc-100">
                      {formatSafeDisplayDate(currentStartDate)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400">Due Date</span>
                  {canManage ? (
                    <input
                      type="date"
                      value={parseDateForInput(currentDueDate)}
                      onChange={(e) => {
                        const newIso = e.target.value;
                        const newDisplay = newIso ? formatInputToDisplayDate(newIso) : "--";
                        onChange({
                          dueDate: newDisplay,
                          duration: computeDuration(currentStartDate, newDisplay, currentDuration),
                        });
                      }}
                      className="w-auto max-w-[140px] bg-transparent font-semibold text-foreground outline-none text-sm cursor-pointer dark:text-zinc-100 dark:[color-scheme:dark]"
                    />
                  ) : (
                    <span className="font-semibold text-foreground text-sm dark:text-zinc-100">
                      {formatSafeDisplayDate(currentDueDate)}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400">Priority</span>
                  {canManage ? (
                    <select
                      value={currentPriority || "None"}
                      onChange={(e) => onChange({ priority: e.target.value as ProjectPriority })}
                      className="w-auto max-w-fit pr-1 bg-transparent font-semibold text-foreground outline-none cursor-pointer dark:text-zinc-100 text-sm"
                    >
                      <option value="None" className={SELECT_OPTION}>None</option>
                      <option value="Low" className={SELECT_OPTION}>Low</option>
                      <option value="Medium" className={SELECT_OPTION}>Medium</option>
                      <option value="High" className={SELECT_OPTION}>High</option>
                      <option value="Urgent" className={SELECT_OPTION}>Urgent</option>
                    </select>
                  ) : (
                    <span className="font-semibold text-foreground text-sm dark:text-zinc-100">{currentPriority || "None"}</span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400">Duration</span>
                  <span className="font-semibold text-foreground text-sm dark:text-zinc-100">
                    {computeDuration(currentStartDate, currentDueDate, currentDuration)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs font-medium mb-1 dark:text-zinc-400">Total Logged Hours</span>
                  <span className="font-bold text-foreground font-mono text-sm dark:text-zinc-100">0.00 h</span>
                </div>
              </div>
            )}
          </div>

          {/* Tabs Bar & Content Section */}
          <div className="border border-border rounded-xl bg-card overflow-hidden dark:border-zinc-800 dark:bg-[#121215]">
            {/* Tabs Header Scrollbar */}
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs font-semibold dark:border-zinc-800">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {[
                  { key: "COMMENTS", label: "Comments" },
                  { key: "SUBTASKS", label: "Subtasks" },
                  { key: "LOG_HOURS", label: "Log Hours (0.00)" },
                  { key: "DOCUMENTS", label: "Documents" },
                  { key: "STATUS_TIMELINE", label: "Status Timeline" },
                  { key: "STANDUP_ACTIVITY", label: "Standup Activity" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer",
                      activeTab === tab.key
                        ? "bg-primary/10 text-primary font-bold border border-primary/20 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/50"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "LOG_HOURS" && (
                <button
                  type="button"
                  onClick={() => toast.info("Effort logs will be tracked once a project is created from this template.")}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors cursor-pointer shrink-0 ml-auto"
                >
                  <Plus size={14} />
                  <span>Add Effort Log</span>
                </button>
              )}
            </div>

            {/* Tab Body Content */}
            <div className="p-4 space-y-4">
              {/* SUBTASKS TAB */}
              {activeTab === "SUBTASKS" && (
                <div className="space-y-4 text-xs font-sans">
                  {/* Top Bar with Add Subtask button */}
                  <div className="flex items-center justify-between pb-2 border-b border-border dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setIsAddSubtaskOpen(true)}
                      className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add Subtask</span>
                    </button>
                  </div>

                  {/* Table View matching single-task-workspace-view.tsx */}
                  <div className="overflow-x-auto rounded-lg border border-border bg-card dark:border-zinc-800 dark:bg-[#121215]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold dark:border-zinc-800 dark:bg-[#18181b] dark:text-zinc-400">
                          <th className="py-2.5 px-3 border-r border-border w-24 dark:border-zinc-800">ID</th>
                          <th className="py-2.5 px-4 border-r border-border min-w-[240px] dark:border-zinc-800">Task Name</th>
                          <th className="py-2.5 px-3 border-r border-border w-32 dark:border-zinc-800">
                            <span className="inline-flex items-center gap-1">
                              <CheckSquare size={12} /> Status
                            </span>
                          </th>
                          <th className="py-2.5 px-3 border-r border-border w-32 dark:border-zinc-800">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} /> Start Date
                            </span>
                          </th>
                          <th className="py-2.5 px-3 border-r border-border w-32 dark:border-zinc-800">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} /> Due Date
                            </span>
                          </th>
                          <th className="py-2.5 px-2 text-center w-10">
                            <Layers size={13} />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 dark:divide-zinc-800/60">
                        {subtaskRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-muted-foreground italic dark:text-zinc-400">
                              No subtasks added yet. Click &quot;Add Subtask&quot; below to create one.
                            </td>
                          </tr>
                        ) : (
                          subtaskRows.map(({ item, hasChildren }) => {
                            // Where this row sits under the open task / subtask.
                            const relPath = item.path.slice(subtaskPath.length);
                            const stStatus = subtaskStatus(item.seed) ?? "Open";
                            return (
                              <tr
                                key={item.code}
                                onClick={() => onNavigateSubtask?.(item.path)}
                                className="hover:bg-accent/30 transition-colors group cursor-pointer dark:hover:bg-zinc-800/30"
                                title="Open this subtask"
                              >
                                <td className="py-2 px-3 border-r border-border font-mono text-xs text-muted-foreground font-semibold dark:border-zinc-800 dark:text-zinc-400">
                                  {item.code}
                                </td>
                                <td className="py-2 px-4 border-r border-border font-medium text-foreground dark:border-zinc-800 dark:text-zinc-200">
                                  <div className="flex items-center gap-2" style={{ paddingLeft: (relPath.length - 1) * 22 }}>
                                    {hasChildren ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCollapsedSubtasks((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(item.code)) next.delete(item.code);
                                            else next.add(item.code);
                                            return next;
                                          });
                                        }}
                                        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-muted-foreground/50 text-muted-foreground hover:border-foreground hover:text-foreground"
                                        title={collapsedSubtasks.has(item.code) ? "Show its subtasks" : "Hide its subtasks"}
                                      >
                                        {collapsedSubtasks.has(item.code) ? <Plus size={9} strokeWidth={3} /> : <Minus size={9} strokeWidth={3} />}
                                      </button>
                                    ) : (
                                      <span className="w-3.5 shrink-0" />
                                    )}
                                    <span className="hover:underline">{item.title}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-3 border-r border-border dark:border-zinc-800">
                                  <select
                                    value={stStatus}
                                    disabled={!canManage}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const nextStatus = e.target.value as TaskStatus;
                                      onChange({
                                        subtasks: updateSubtaskAtPath(currentChildren, relPath, (s) =>
                                          makeSubtask(subtaskTitle(s), subtaskChildren(s), {
                                            description: subtaskDescription(s),
                                            status: nextStatus === "Open" ? undefined : nextStatus,
                                            sopChecklists: subtaskSops(s),
                                            defaultOwners: subtaskOwners(s),
                                            startDate: subtaskStartDate(s),
                                            dueDate: subtaskDueDate(s),
                                            priority: subtaskPriority(s),
                                            duration: subtaskDuration(s),
                                          })
                                        ),
                                      });
                                    }}
                                    className={cn(
                                      "rounded px-2 py-0.5 text-xs font-semibold outline-none cursor-pointer border transition-colors",
                                      getTaskStatusBadgeClasses(stStatus)
                                    )}
                                  >
                                    {TEMPLATE_STATUSES.map((s) => (
                                      <option key={s} value={s} className="bg-card text-foreground dark:bg-zinc-900 dark:text-zinc-100">
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2 px-3 border-r border-border text-muted-foreground dark:border-zinc-800 dark:text-zinc-400">
                                  {subtaskStartDate(item.seed) || "--"}
                                </td>
                                <td className="py-2 px-3 border-r border-border text-muted-foreground dark:border-zinc-800 dark:text-zinc-400">
                                  {subtaskDueDate(item.seed) || "--"}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  {canManage && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onChange({ subtasks: deleteSubtaskAtPath(currentChildren, relPath) });
                                      }}
                                      className="text-muted-foreground hover:text-destructive p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                      title="Delete subtask"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}

                        {/* Inline Add Row */}
                        {canManage && (
                          <tr className="bg-muted/20 dark:bg-[#141519]/60">
                            <td className="py-2.5 px-3 border-r border-border text-muted-foreground font-mono text-xs dark:border-zinc-800 dark:text-zinc-400">
                              {currentCode}.{currentChildren.length + 1}
                            </td>
                            <td colSpan={5} className="py-2 px-4">
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  handleAddQuickSubtask();
                                }}
                                className="flex items-center gap-3 w-full"
                              >
                                <input
                                  type="text"
                                  value={newSubtask}
                                  onChange={(e) => setNewSubtask(e.target.value)}
                                  placeholder="Add Subtask"
                                  aria-label="New subtask name"
                                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none font-medium dark:text-zinc-100 dark:placeholder-zinc-500"
                                />

                                {newSubtask.trim() && (
                                  <button
                                    type="submit"
                                    className="rounded bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 cursor-pointer"
                                  >
                                    Add
                                  </button>
                                )}
                              </form>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* COMMENTS TAB */}
              {activeTab === "COMMENTS" && (
                <div className="space-y-4">
                  <div className="space-y-3 rounded-xl border border-border bg-card p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-[#141519]">
                    <textarea
                      rows={3}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment or note on this template task..."
                      className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none resize-y font-sans dark:text-zinc-100 dark:placeholder-zinc-500"
                    />
                    <div className="flex items-center justify-end pt-2.5 border-t border-border/60 dark:border-zinc-800/60">
                      <button
                        type="button"
                        onClick={handleAddComment}
                        disabled={!commentText.trim()}
                        className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Send size={13} />
                        <span>Save Comment</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {commentsList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground italic dark:text-zinc-400">
                        No comments yet. Write a comment above to document this task.
                      </div>
                    ) : (
                      commentsList.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-border/80 bg-card p-3.5 space-y-1 text-xs shadow-2xs dark:border-zinc-800/80 dark:bg-[#141519]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground dark:text-zinc-200">{c.author}</span>
                            <span className="text-xs text-muted-foreground dark:text-zinc-400">{c.time}</span>
                          </div>
                          <p className="text-foreground/90 leading-relaxed dark:text-zinc-300">{c.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* LOG HOURS TAB */}
              {activeTab === "LOG_HOURS" && (
                <div className="space-y-3 py-6 text-center text-xs text-muted-foreground dark:text-zinc-400">
                  <Clock size={28} className="mx-auto opacity-40 text-primary" />
                  <p className="font-semibold text-foreground">Effort Logs Preview</p>
                  <p className="max-w-md mx-auto">
                    Tasks created from this template will log effort hours against project &apos;{templateName}&apos;.
                    Live timers and timesheets will automatically link here.
                  </p>
                </div>
              )}

              {/* DOCUMENTS TAB */}
              {activeTab === "DOCUMENTS" && (
                <div className="space-y-3 py-6 text-center text-xs text-muted-foreground dark:text-zinc-400">
                  <Paperclip size={28} className="mx-auto opacity-40 text-primary" />
                  <p className="font-semibold text-foreground">Task Documents</p>
                  <p className="max-w-md mx-auto">
                    Attach reference briefs, design specs, or brand assets to this template task.
                  </p>
                </div>
              )}

              {/* STATUS TIMELINE TAB */}
              {activeTab === "STATUS_TIMELINE" && (
                <div className="space-y-3 py-6 text-center text-xs text-muted-foreground dark:text-zinc-400">
                  <History size={28} className="mx-auto opacity-40 text-primary" />
                  <p className="font-semibold text-foreground">Status Timeline</p>
                  <p className="max-w-md mx-auto">
                    Audit trail of task state changes will be recorded here once a project is instantiated.
                  </p>
                </div>
              )}

              {/* STANDUP ACTIVITY TAB */}
              {activeTab === "STANDUP_ACTIVITY" && (
                <div className="space-y-3 py-6 text-center text-xs text-muted-foreground dark:text-zinc-400">
                  <Activity size={28} className="mx-auto opacity-40 text-primary" />
                  <p className="font-semibold text-foreground">Standup Activity</p>
                  <p className="max-w-md mx-auto">
                    DSM and daily progress mentions of this task will roll up here in live projects.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add Subtask Drawer */}
      <AddTemplateSubtaskDrawer
        isOpen={isAddSubtaskOpen}
        onClose={() => setIsAddSubtaskOpen(false)}
        parentTaskCode={currentCode}
        nextSubtaskNumber={currentChildren.length + 1}
        onAddSubtask={handleAddDrawerSubtask}
      />
    </div>
  );
}
