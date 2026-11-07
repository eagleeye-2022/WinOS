"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeftToLine,
  ArrowRightLeft,
  ArrowRightToLine,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  Layers,
  ListTree,
  Loader2,
  MoreVertical,
  Plus,
  RotateCcw,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { toast } from "@/components/shared/toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChecklistChip } from "@/features/sop-checklists/components/checklist-chip";
import { cn } from "@/lib/utils";
import { useUrlState, writeSearchParam } from "@/lib/navigation/use-url-state";
import {
  ProjectTemplate,
  SOPSubtaskSeed,
  SOPTaskSeed,
  TaskStatus,
  getTaskStatusPillClasses,
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
import { TemplateTaskPage } from "./template-task-page";
import { MoveTaskToTemplateDialog, TemplateMoveMenu } from "../template-move-menu";
import { AvatarStack } from "@/components/shared/avatar-stack";
import { TaskMultiOwnerSelect, type OwnerUserOption } from "../task-multi-owner-select";
import { getAllUserOptionsAction } from "@/features/users/actions/user-actions";
import {
  BUILT_IN_PROJECT_TEMPLATES,
  TEMPLATE_STATUSES,
  TemplateDraft,
  TemplatePhaseDraft,
  deleteSubtaskAtPath,
  duplicateSubtaskAtPath,
  isBuiltInTemplate,
  moveTemplateSubtask,
  moveTemplateTask,
  newTemplateDraft,
  newTemplatePhase,
  newTemplateTask,
  removeTemplateSubtask,
  subtaskToTaskSeed,
  templateToDraft,
  updateTaskOrSubtask,
} from "../../template-utils";
import {
  addTaskToTemplateAction,
  createProjectTemplateAction,
  deleteProjectTemplateAction,
  updateProjectTemplateAction,
} from "../../actions/template-actions";

interface ProjectTemplatesViewProps {
  /** Managers' templates, plus their saved edits of the built-in ones (same id as the built-in). */
  customTemplates: ProjectTemplate[];
  onCustomTemplatesChange: (templates: ProjectTemplate[]) => void;
  /** Managers can edit everything here; everyone else browses read-only. */
  canManage: boolean;
  /** The saved templates haven't arrived yet: a board opened now would show the originals. */
  isLoading: boolean;
  loadFailed: boolean;
}

/** How long after the last edit a template is saved. */
const AUTOSAVE_DELAY_MS = 800;

const OUTLINE_BUTTON =
  "flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer";
const COLUMN_ICON_BUTTON =
  "shrink-0 p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer";
const CARD_ICON_BUTTON =
  "shrink-0 p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-foreground dark:hover:bg-slate-800 transition-all duration-150 cursor-pointer";
const MENU_ITEM =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none";

export function ProjectTemplatesView({
  customTemplates,
  onCustomTemplatesChange,
  canManage,
  isLoading,
  loadFailed,
}: ProjectTemplatesViewProps) {
  const [selectedId, setSelectedId] = useUrlState("template", "");
  // A template being created, not saved yet.
  const [newDraft, setNewDraft] = useState<TemplateDraft | null>(null);
  // Bumped to start the board over from the saved template.
  const [boardVersion, setBoardVersion] = useState(0);
  const hasUnsavedChanges = useRef(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const builtIns = BUILT_IN_PROJECT_TEMPLATES.map((b) => customTemplates.find((t) => t.id === b.id) ?? b);
  const templates = [...builtIns, ...customTemplates.filter((t) => !isBuiltInTemplate(t.id))];
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];

  const confirmLeave = async () =>
    !hasUnsavedChanges.current ||
    (await confirm({
      title: "Discard changes?",
      description: "This template has changes that couldn't be saved or haven't been created yet.",
      confirmLabel: "Discard",
    }));

  const openDraft = async (draft: TemplateDraft) => {
    if (!(await confirmLeave())) return;
    writeSearchParam("task", null); // an open task page belongs to the template it was opened in
    setNewDraft(draft);
    setBoardVersion((v) => v + 1);
  };

  const selectTemplate = async (id: string) => {
    if (!(await confirmLeave())) return;
    writeSearchParam("task", null);
    setNewDraft(null);
    setSelectedId(id);
    setBoardVersion((v) => v + 1);
  };

  const storeTemplate = (saved: ProjectTemplate) => {
    const exists = customTemplates.some((t) => t.id === saved.id);
    onCustomTemplatesChange(
      exists ? customTemplates.map((t) => (t.id === saved.id ? saved : t)) : [...customTemplates, saved]
    );
  };

  const handleCreated = (saved: ProjectTemplate) => {
    storeTemplate(saved);
    writeSearchParam("task", null);
    setNewDraft(null);
    setSelectedId(saved.id);
    setBoardVersion((v) => v + 1);
  };

  const isBuiltIn = isBuiltInTemplate(selected.id);
  // const isEditedBuiltIn = isBuiltIn && customTemplates.some((t) => t.id === selected.id);

  // Deletes a custom template, or a built-in's saved edits (which brings back the original).
  const handleRemove = async () => {
    const ok = await confirm(
      isBuiltIn
        ? {
            title: "Reset to original?",
            description: `Your edits to "${selected.name}" will be removed. Projects already created keep their task lists and tasks.`,
            confirmLabel: "Reset",
          }
        : {
            title: "Delete template?",
            description: `"${selected.name}" will be removed. Projects already created from it keep their task lists and tasks.`,
            confirmLabel: "Delete",
          }
    );
    if (!ok) return;

    try {
      const result = await deleteProjectTemplateAction(selected.id);
      if (!result.success) {
        toast.error(result.error || "Failed to update template.");
        return;
      }
      onCustomTemplatesChange(customTemplates.filter((t) => t.id !== selected.id));
      writeSearchParam("task", null);
      if (!isBuiltIn) setSelectedId("");
      setBoardVersion((v) => v + 1);
      toast.success(isBuiltIn ? "Template reset to original" : "Template deleted");
    } catch (err) {
      console.error("Failed to remove project template:", err);
      toast.error("Failed to update template.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" aria-label="Loading templates" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {loadFailed && (
        <p role="alert" className="border-b border-destructive/40 bg-destructive/10 px-6 py-2 text-xs font-medium text-destructive">
          Saved templates couldn&apos;t be loaded, so these are the originals and editing is off. Refresh to try again.
        </p>
      )}
      {/* Template picker */}
      <div className="flex flex-wrap items-center gap-2 border-b px-6 py-2.5">
        {templates.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => selectTemplate(tmpl.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
              !newDraft && selected.id === tmpl.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {tmpl.name}
          </button>
        ))}
        {newDraft && (
          <span className="rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            {newDraft.name.trim() || "New Template"}
          </span>
        )}
        {canManage && !newDraft && (
          <button
            type="button"
            onClick={() => openDraft(newTemplateDraft())}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus size={13} /> New Template
          </button>
        )}
      </div>

      <TemplateBoard
        key={`${newDraft ? "new" : selected.id}-${boardVersion}`}
        initialDraft={newDraft ?? templateToDraft(selected)}
        templateId={newDraft ? undefined : selected.id}
        canManage={canManage}
        otherTemplates={templates
          .filter((t) => newDraft || t.id !== selected.id)
          .map((t) => ({ id: t.id, name: t.name, lists: templateToDraft(t).phases.map((p) => p.name) }))}
        onDirtyChange={(dirty) => {
          hasUnsavedChanges.current = dirty;
        }}
        onCreated={handleCreated}
        onAutoSaved={storeTemplate}
        onCancelNew={() => {
          hasUnsavedChanges.current = false;
          writeSearchParam("task", null);
          setNewDraft(null);
          setBoardVersion((v) => v + 1);
        }}
        headerActions={
          canManage &&
          !newDraft && (
            <>
              {/* Duplicate and Reset to Original, hidden by request.
              <button type="button" onClick={() => openDraft(duplicateTemplateDraft(selected))} className={OUTLINE_BUTTON}>
                <Copy size={13} /> Duplicate
              </button>
              {isEditedBuiltIn && (
                <button type="button" onClick={handleRemove} className={OUTLINE_BUTTON}>
                  <RotateCcw size={13} /> Reset to Original
                </button>
              )}
              */}
              {!isBuiltIn && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
            </>
          )
        }
      />
      {ConfirmDialog}
    </div>
  );
}

type EditingTask = { phaseIndex: number; taskIndex: number; subtaskPath?: number[] };

const formatEditingTask = ({ phaseIndex, taskIndex, subtaskPath }: EditingTask) =>
  [phaseIndex, taskIndex, ...(subtaskPath && subtaskPath.length > 0 ? [subtaskPath.join("-")] : [])].join(".");

/** The open task from `?task=`; null when absent or it no longer exists in the template. */
function parseEditingTask(param: string, draft: TemplateDraft): EditingTask | null {
  if (!/^\d+\.\d+(\.\d+(-\d+)*)?$/.test(param)) return null;
  const [phase, task, sub] = param.split(".");
  const phaseIndex = Number(phase);
  const taskIndex = Number(task);
  if (!draft.phases[phaseIndex]?.tasks[taskIndex]) return null;
  return { phaseIndex, taskIndex, ...(sub ? { subtaskPath: sub.split("-").map(Number) } : {}) };
}

interface TemplateBoardProps {
  initialDraft: TemplateDraft;
  /** Omitted for a new template. */
  templateId?: string;
  canManage: boolean;
  /** The other templates (and their lists) a task can be moved to. */
  otherTemplates: { id: string; name: string; lists: string[] }[];
  onDirtyChange: (dirty: boolean) => void;
  onCreated: (template: ProjectTemplate) => void;
  onAutoSaved: (template: ProjectTemplate) => void;
  onCancelNew: () => void;
  headerActions: React.ReactNode;
}

/**
 * A template laid out like a project's board: task lists as columns, tasks as cards. An existing
 * template saves itself shortly after each edit; a new one is saved by Create Template.
 */
function TemplateBoard({
  initialDraft,
  templateId,
  canManage,
  otherTemplates,
  onDirtyChange,
  onCreated,
  onAutoSaved,
  onCancelNew,
  headerActions,
}: TemplateBoardProps) {
  // The template as opened (Undo Changes returns to it) and as last saved.
  const [openingDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [draft, setDraft] = useState(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  // The draft the last save rejected: not retried until it changes or Retry is clicked.
  const [saveFailure, setSaveFailure] = useState<{ draftJson: string; error: string } | null>(null);
  const [saveRuns, setSaveRuns] = useState(0);
  const isSaveRunning = useRef(false);
  const unsavedDraftJson = useRef<string | null>(null);
  const onAutoSavedRef = useRef(onAutoSaved);
  const [dragged, setDragged] = useState<{ phaseIndex: number; taskIndex: number } | null>(null);
  // The open task page lives in the URL (?task=<list>.<task>[.<subtask path>]), so leaving and coming
  // back (Back button, module switcher) returns to the same task, and its scroll can be restored.
  const [taskParam, setTaskParam] = useUrlState("task", "", { history: "push" });
  const editingTask = parseEditingTask(taskParam, draft);
  const setEditingTask = (
    next: EditingTask | null | ((prev: EditingTask | null) => EditingTask | null)
  ) => {
    const resolved = typeof next === "function" ? next(editingTask) : next;
    setTaskParam(resolved ? formatEditingTask(resolved) : "");
  };
  const [addingToPhase, setAddingToPhase] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [renamingPhase, setRenamingPhase] = useState<number | null>(null);
  const [listMenuPhase, setListMenuPhase] = useState<number | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<number>>(new Set());
  // Ticked cards for the bulk bar, as "list:task" positions.
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [ownerOptions, setOwnerOptions] = useState<OwnerUserOption[]>([]);

  useEffect(() => {
    getAllUserOptionsAction()
      .then((opts) => setOwnerOptions(opts.map((o) => ({ id: o.id, name: o.name, email: "" }))))
      .catch(() => {});
  }, []);

  const isNew = !templateId;
  // Used by the hidden template details strip below.
  // const isBuiltIn = !!templateId && isBuiltInTemplate(templateId);
  const draftJson = JSON.stringify(draft);
  const isDirty = draftJson !== JSON.stringify(savedDraft);
  const failure = isDirty && saveFailure?.draftJson === draftJson ? saveFailure : null;
  const autoSaves = !!templateId && canManage;
  const hasChanges = draftJson !== JSON.stringify(openingDraft);

  // Leaving is only a loss for a new template or a draft that couldn't be saved.
  useEffect(() => onDirtyChange(isNew ? isDirty : !!failure), [isNew, isDirty, failure, onDirtyChange]);

  useEffect(() => {
    if (!autoSaves || !isDirty || failure) return;
    const timer = setTimeout(async () => {
      // One save at a time; when the running one ends, saveRuns re-runs this for newer edits.
      if (isSaveRunning.current) return;
      isSaveRunning.current = true;
      setIsSaving(true);
      let error: string | null = null;
      try {
        const result = await updateProjectTemplateAction(templateId, JSON.parse(draftJson));
        if (result.success && result.template) {
          onAutoSavedRef.current(result.template);
          // Every saved change (add, edit, copy, move, delete…) confirms itself.
          toast.success("Template updated");
        } else error = result.error || "Failed to save template.";
      } catch (err) {
        console.error("Failed to save project template:", err);
        error = "Failed to save template. Check your connection.";
      }
      isSaveRunning.current = false;
      setIsSaving(false);
      if (error) setSaveFailure({ draftJson, error });
      else {
        setSaveFailure(null);
        setSavedDraft(JSON.parse(draftJson));
      }
      setSaveRuns((n) => n + 1);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autoSaves, isDirty, failure, draftJson, saveRuns, templateId]);

  useEffect(() => {
    onAutoSavedRef.current = onAutoSaved;
    unsavedDraftJson.current = autoSaves && isDirty && !failure ? draftJson : null;
  });

  // Moving to another tab or template inside the wait: save the last edit on the way out.
  useEffect(
    () => () => {
      if (!templateId || !unsavedDraftJson.current) return;
      updateProjectTemplateAction(templateId, JSON.parse(unsavedDraftJson.current))
        .then((result) => {
          if (result.success && result.template) {
            onAutoSavedRef.current(result.template);
            toast.success("Template updated");
          } else toast.error(result.error || "Your last template edit couldn't be saved.");
        })
        .catch((err) => {
          console.error("Failed to save project template:", err);
          toast.error("Your last template edit couldn't be saved.");
        });
    },
    [templateId]
  );

  // Closing or reloading the browser tab can't wait for a save, so the browser asks first.
  useEffect(() => {
    if (!canManage || !isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [canManage, isDirty]);

  const allCollapsed = draft.phases.length > 0 && draft.phases.every((_, i) => collapsedPhases.has(i));

  // Selected cards are tracked by position, so any change to how many tasks each list holds clears them.
  const taskLayout = draft.phases.map((p) => p.tasks.length).join(",");
  useEffect(() => setSelectedTasks(new Set()), [taskLayout]);

  const updatePhase = (index: number, patch: Partial<TemplatePhaseDraft>) => {
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  };

  const updateTasks = (phaseIndex: number, change: (tasks: SOPTaskSeed[]) => SOPTaskSeed[]) => {
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((p, i) => (i === phaseIndex ? { ...p, tasks: change(p.tasks) } : p)),
    }));
  };

  // Lists are tracked by position, so anything that shifts them closes the per-list UI.
  const resetListUi = () => {
    setSelectedTasks(new Set());
    setCollapsedPhases(new Set());
    setAddingToPhase(null);
    setRenamingPhase(null);
    setListMenuPhase(null);
  };

  const movePhase = (index: number, delta: number) => {
    setDraft((prev) => {
      const phases = [...prev.phases];
      const [phase] = phases.splice(index, 1);
      phases.splice(index + delta, 0, phase);
      return { ...prev, phases };
    });
    resetListUi();
  };

  const removePhase = (index: number) => {
    setDraft((prev) => ({ ...prev, phases: prev.phases.filter((_, i) => i !== index) }));
    resetListUi();
  };

  const toggleCollapsed = (index: number) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const openAddTask = (phaseIndex: number) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      next.delete(phaseIndex);
      return next;
    });
    setNewTaskTitle("");
    setAddingToPhase(phaseIndex);
  };

  const addTask = (phaseIndex: number) => {
    const title = newTaskTitle.trim();
    if (!title) return;
    updateTasks(phaseIndex, (tasks) => [...tasks, newTemplateTask(draft.kind, title)]);
    setNewTaskTitle("");
  };

  const addList = () => {
    const name = newListName.trim();
    if (!name) return;
    setDraft((prev) => ({ ...prev, phases: [...prev.phases, newTemplatePhase(prev.kind, name)] }));
    setNewListName("");
  };

  const dropTask = (e: React.DragEvent, phaseIndex: number, taskIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragged) {
      setDraft((prev) => ({ ...prev, phases: moveTemplateTask(prev.phases, dragged, { phaseIndex, taskIndex }) }));
      setSelectedTasks(new Set());
    }
    setDragged(null);
  };

  const toggleSelected = (phaseIndex: number, taskIndex: number) => {
    const key = `${phaseIndex}:${taskIndex}`;
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allTaskKeys = draft.phases.flatMap((p, pi) => p.tasks.map((_, ti) => `${pi}:${ti}`));

  const isSelectedKey = (pi: number, ti: number) => selectedTasks.has(`${pi}:${ti}`);

  const bulkStatus = (status: TaskStatus) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((p, pi) => ({
        ...p,
        tasks: p.tasks.map((t, ti) =>
          selectedTasks.has(`${pi}:${ti}`) ? { ...t, status: status === "Open" ? undefined : status } : t
        ),
      })),
    }));

  const bulkAddOwner = (name: string) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((p, pi) => ({
        ...p,
        tasks: p.tasks.map((t, ti) => {
          if (!selectedTasks.has(`${pi}:${ti}`)) return t;
          const owners = t.defaultOwners ?? [];
          return owners.some((o) => o.name === name) ? t : { ...t, defaultOwners: [...owners, { id: name, name }] };
        }),
      })),
    }));

  const bulkDelete = () => {
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((p, pi) => ({ ...p, tasks: p.tasks.filter((_, ti) => !selectedTasks.has(`${pi}:${ti}`)) })),
    }));
    setSelectedTasks(new Set());
  };

  const bulkMove = (target: number) => {
    setDraft((prev) => {
      const moved: SOPTaskSeed[] = [];
      const phases = prev.phases.map((p, pi) => ({
        ...p,
        tasks: p.tasks.filter((t, ti) => {
          if (!selectedTasks.has(`${pi}:${ti}`)) return true;
          moved.push(t);
          return false;
        }),
      }));
      phases[target] = { ...phases[target], tasks: [...phases[target].tasks, ...moved] };
      return { ...prev, phases };
    });
    setSelectedTasks(new Set());
  };

  /**
   * Moves a task to a list of another template: added there first (and saved), then removed here
   * (this board saves itself), so a failure leaves the task where it was.
   */
  const moveTaskToTemplate = async (
    phaseIndex: number,
    taskIndex: number,
    target: { id: string; name: string },
    targetList: number
  ) => {
    const moving = draft.phases[phaseIndex]?.tasks[taskIndex];
    if (!moving) return;
    try {
      const result = await addTaskToTemplateAction(target.id, moving, targetList);
      if (!result.success || !result.template) {
        toast.error(result.error || "Couldn't move the task.");
        return;
      }
      onAutoSavedRef.current(result.template);
      updateTasks(phaseIndex, (tasks) => tasks.filter((_, i) => i !== taskIndex));
      // Moved from its own page: that page has nothing left to show, so go back to the board.
      setEditingTask(null);
      toast.success(`Moved "${moving.title}" to ${target.name}`);
    } catch (err) {
      console.error("Failed to move task to another template:", err);
      toast.error("Couldn't move the task.");
    }
  };

  /**
   * Moves a subtask to a list of another template, where it becomes a top-level task (with its own
   * subtasks). Same order as moveTaskToTemplate: added there first, removed here only on success.
   */
  const moveSubtaskToTemplate = async (
    phaseIndex: number,
    taskIndex: number,
    subtaskPath: number[],
    target: { id: string; name: string },
    targetList: number
  ) => {
    const from = { phaseIndex, taskIndex, subtaskPath };
    const moving = subtaskToTaskSeed(draft.phases, from);
    if (!moving) return;
    try {
      const result = await addTaskToTemplateAction(target.id, moving, targetList);
      if (!result.success || !result.template) {
        toast.error(result.error || "Couldn't move the subtask.");
        return;
      }
      onAutoSavedRef.current(result.template);
      setDraft((prev) => ({ ...prev, phases: removeTemplateSubtask(prev.phases, from) }));
      // Moved from its own page: that subtask is gone, so show its task instead.
      setEditingTask((prev) => (prev?.subtaskPath ? { phaseIndex, taskIndex } : prev));
      toast.success(`Moved "${moving.title}" to ${target.name}`);
    } catch (err) {
      console.error("Failed to move subtask to another template:", err);
      toast.error("Couldn't move the subtask.");
    }
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const result = await createProjectTemplateAction(draft);
      if (result.success && result.template) {
        toast.success("Template created");
        onDirtyChange(false);
        onCreated(result.template);
      } else {
        toast.error(result.error || "Failed to save template.");
      }
    } catch (err) {
      console.error("Failed to save project template:", err);
      toast.error("Failed to save template.");
    } finally {
      setIsSaving(false);
    }
  };

  // const taskCount = draft.phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const task = editingTask && draft.phases[editingTask.phaseIndex]?.tasks[editingTask.taskIndex];

  const saveStatus = autoSaves && (
    <span role="status" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {failure ? (
        <>
          <span className="max-w-[320px] truncate text-destructive" title={failure.error}>
            Not saved: {failure.error}
          </span>
          <button
            type="button"
            onClick={() => setSaveFailure(null)}
            className="font-semibold text-primary hover:underline cursor-pointer"
          >
            Retry
          </button>
        </>
      ) : isDirty || isSaving ? (
        <>
          <Loader2 size={13} className="animate-spin" /> Saving…
        </>
      ) : hasChanges ? (
        <>
          <Check size={13} className="text-success" /> All changes saved
        </>
      ) : null}
    </span>
  );

  if (task && editingTask) {
    const { phaseIndex, taskIndex, subtaskPath } = editingTask;
    const firstTaskNumber = draft.phases.slice(0, phaseIndex).reduce((sum, p) => sum + p.tasks.length, 0);
    return (
      <TemplateTaskPage
        task={task}
        code={`T${String(firstTaskNumber + taskIndex + 1).padStart(2, "0")}`}
        templateName={draft.name}
        lists={draft.phases.map((p) => p.name)}
        phaseIndex={phaseIndex}
        canManage={canManage}
        subtaskPath={subtaskPath}
        onNavigateSubtask={(path) =>
          setEditingTask({
            phaseIndex,
            taskIndex,
            subtaskPath: path.length > 0 ? path : undefined,
          })
        }
        showCreate={isNew}
        isSaving={isSaving}
        saveStatus={saveStatus}
        onChange={(patch) =>
          updateTasks(phaseIndex, (tasks) =>
            tasks.map((t, i) => (i === taskIndex ? updateTaskOrSubtask(t, subtaskPath, patch) : t))
          )
        }
        sidebarCard={
          // The template board's own task card for this task (its subtasks open), so the left panel
          // works exactly like the board: status, ⋮ menu, move to list / template, owners, subtasks.
          <TemplateTaskCard
            inSidebar
            task={task}
            code={`T${String(firstTaskNumber + taskIndex + 1).padStart(2, "0")}`}
            canManage={canManage}
            isDragging={false}
            isSelected={false}
            onToggleSelect={() => {}}
            ownerOptions={ownerOptions}
            lists={draft.phases}
            otherTemplates={otherTemplates}
            onMoveToTemplate={(target, listIndex) => moveTaskToTemplate(phaseIndex, taskIndex, target, listIndex)}
            onMoveSubtaskToTemplate={(path, target, listIndex) =>
              moveSubtaskToTemplate(phaseIndex, taskIndex, path, target, listIndex)
            }
            phaseIndex={phaseIndex}
            taskIndex={taskIndex}
            onOpen={() => setEditingTask({ phaseIndex, taskIndex })}
            onOpenSubtask={(path) => setEditingTask({ phaseIndex, taskIndex, subtaskPath: path })}
            onChange={(patch) =>
              updateTasks(phaseIndex, (tasks) => tasks.map((x, i) => (i === taskIndex ? { ...x, ...patch } : x)))
            }
            onMoveSubtask={(path, target) =>
              setDraft((prev) => ({
                ...prev,
                phases: moveTemplateSubtask(prev.phases, { phaseIndex, taskIndex, subtaskPath: path }, target),
              }))
            }
            onDuplicate={() =>
              updateTasks(phaseIndex, (tasks) => [
                ...tasks.slice(0, taskIndex + 1),
                { ...tasks[taskIndex], title: `${tasks[taskIndex].title} (Copy)` },
                ...tasks.slice(taskIndex + 1),
              ])
            }
            onDelete={() => {
              updateTasks(phaseIndex, (tasks) => tasks.filter((_, i) => i !== taskIndex));
              setEditingTask(null);
            }}
            onMoveToList={(target) => {
              setDraft((prev) => ({
                ...prev,
                phases: moveTemplateTask(prev.phases, { phaseIndex, taskIndex }, { phaseIndex: target }),
              }));
              setEditingTask({ phaseIndex: target, taskIndex: draft.phases[target].tasks.length });
            }}
            onDragStart={() => {}}
            onDragEnd={() => {}}
            onDragOver={() => {}}
            onDrop={() => {}}
          />
        }
        otherTemplates={otherTemplates}
        onMoveToTemplate={(target, listIndex) => moveTaskToTemplate(phaseIndex, taskIndex, target, listIndex)}
        onMoveToList={(target) => {
          if (target === phaseIndex) return;
          setDraft((prev) => ({
            ...prev,
            phases: moveTemplateTask(prev.phases, { phaseIndex, taskIndex }, { phaseIndex: target }),
          }));
          setEditingTask({ phaseIndex: target, taskIndex: draft.phases[target].tasks.length });
        }}
        onDuplicate={() => {
          if (subtaskPath && subtaskPath.length > 0) {
            const newSubtasks = duplicateSubtaskAtPath(task.subtasks ?? [], subtaskPath);
            updateTasks(phaseIndex, (tasks) =>
              tasks.map((t, i) => (i === taskIndex ? { ...t, subtasks: newSubtasks } : t))
            );
            toast.success("Subtask duplicated");
          } else {
            updateTasks(phaseIndex, (tasks) => {
              const current = tasks[taskIndex];
              if (!current) return tasks;
              const cloned = JSON.parse(JSON.stringify(current));
              cloned.title = `${cloned.title} (Copy)`;
              return [
                ...tasks.slice(0, taskIndex + 1),
                cloned,
                ...tasks.slice(taskIndex + 1),
              ];
            });
            toast.success("Task duplicated");
          }
        }}
        onDelete={() => {
          if (subtaskPath && subtaskPath.length > 0) {
            const newSubtasks = deleteSubtaskAtPath(task.subtasks ?? [], subtaskPath);
            updateTasks(phaseIndex, (tasks) =>
              tasks.map((t, i) => (i === taskIndex ? { ...t, subtasks: newSubtasks } : t))
            );
            const parentPath = subtaskPath.slice(0, -1);
            setEditingTask({
              phaseIndex,
              taskIndex,
              subtaskPath: parentPath.length > 0 ? parentPath : undefined,
            });
          } else {
            updateTasks(phaseIndex, (tasks) => tasks.filter((_, i) => i !== taskIndex));
            setEditingTask(null);
          }
        }}
        onBack={() => {
          if (subtaskPath && subtaskPath.length > 0) {
            const parentPath = subtaskPath.slice(0, -1);
            setEditingTask({
              phaseIndex,
              taskIndex,
              subtaskPath: parentPath.length > 0 ? parentPath : undefined,
            });
          } else {
            setEditingTask(null);
          }
        }}
        onCreate={handleCreate}
      />
    );
  }

  return (
    <>
      {/* A new template still needs its name and category before it can be created. */}
      {canManage && isNew && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <input
              type="text"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Template name"
              aria-label="Template name"
              className="w-full max-w-md rounded-md bg-transparent px-1 -mx-1 py-0.5 text-sm font-bold text-foreground outline-none hover:bg-accent/60 focus:ring-1 focus:ring-primary"
            />
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Add a description"
              aria-label="Template description"
              className="w-full max-w-3xl rounded-md bg-transparent px-1 -mx-1 py-0.5 text-xs text-muted-foreground outline-none hover:bg-accent/60 focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {(["DIGITAL", "SMM"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, kind }))}
                  className={cn(
                    "rounded px-2 py-0.5 font-semibold border transition-colors cursor-pointer",
                    draft.kind === kind
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-input hover:bg-accent hover:text-foreground"
                  )}
                >
                  {kind === "SMM" ? "SMM Projects" : "Digital Projects"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onCancelNew} className={OUTLINE_BUTTON}>
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleCreate}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isSaving && <Loader2 size={13} className="animate-spin" />}
              Create Template
            </button>
          </div>
        </div>
      )}

      {/* Template details strip (name, description, category, counts, actions), hidden by request.
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {canManage && !isBuiltIn ? (
            <input
              type="text"
              autoFocus={isNew}
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Template name"
              aria-label="Template name"
              className="w-full max-w-md rounded-md bg-transparent px-1 -mx-1 py-0.5 text-sm font-bold text-foreground outline-none hover:bg-accent/60 focus:ring-1 focus:ring-primary"
            />
          ) : (
            <h3 className="text-sm font-bold text-foreground">{draft.name}</h3>
          )}
          {canManage ? (
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Add a description"
              aria-label="Template description"
              className="w-full max-w-3xl rounded-md bg-transparent px-1 -mx-1 py-0.5 text-xs text-muted-foreground outline-none hover:bg-accent/60 focus:ring-1 focus:ring-primary"
            />
          ) : (
            <p className="text-xs text-muted-foreground max-w-3xl">{draft.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {canManage && !isBuiltIn ? (
              <div className="flex items-center gap-1">
                {(["DIGITAL", "SMM"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, kind }))}
                    className={cn(
                      "rounded px-2 py-0.5 font-semibold border transition-colors cursor-pointer",
                      draft.kind === kind
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-input hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {kind === "SMM" ? "SMM Projects" : "Digital Projects"}
                  </button>
                ))}
              </div>
            ) : (
              <span>{draft.kind === "SMM" ? "SMM Projects" : "Digital Projects"}</span>
            )}
            <span>
              {draft.phases.length} task list{draft.phases.length === 1 ? "" : "s"} · {taskCount} task
              {taskCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {saveStatus}
          {headerActions}
          {autoSaves && hasChanges && (
            <button
              type="button"
              onClick={() => setDraft(openingDraft)}
              title="Go back to how this template was when you opened it"
              className={OUTLINE_BUTTON}
            >
              <RotateCcw size={13} /> Undo Changes
            </button>
          )}
          {canManage && isNew && (
            <>
              <button type="button" onClick={onCancelNew} className={OUTLINE_BUTTON}>
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleCreate}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isSaving && <Loader2 size={13} className="animate-spin" />}
                Create Template
              </button>
            </>
          )}
        </div>
      </div>
      */}

      {/* Bulk selection toolbar: shown only while cards are ticked, like the project board */}
      {canManage && selectedTasks.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-primary/30 bg-primary/10 dark:bg-primary/15 px-6 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <label className="flex items-center gap-2 cursor-pointer select-none pr-1">
            <input
              type="checkbox"
              checked={allTaskKeys.length > 0 && allTaskKeys.every((k) => selectedTasks.has(k))}
              onChange={() =>
                setSelectedTasks(allTaskKeys.every((k) => selectedTasks.has(k)) ? new Set() : new Set(allTaskKeys))
              }
              className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
              title="Select all"
            />
            <span className="text-xs font-bold text-primary whitespace-nowrap">{selectedTasks.size} selected</span>
          </label>

          <div className="h-4 w-px bg-primary/30 mx-1" />

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-primary/15 transition-colors cursor-pointer"
              >
                <ArrowRightLeft size={13} />
                <span>Move</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-52 p-2 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
            >
              <p className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b mb-1">
                Move to List
              </p>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {draft.phases.map((p, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => bulkMove(index)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs font-medium text-foreground cursor-pointer truncate"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-primary/15 transition-colors cursor-pointer"
              >
                <CheckCircle2 size={13} />
                <span>Status</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-40 p-1.5 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
            >
              {TEMPLATE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => bulkStatus(s)}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-accent text-xs font-medium text-foreground cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-primary/15 transition-colors cursor-pointer"
              >
                <UserIcon size={13} />
                <span>Add Owner</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              className="w-48 p-2 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
            >
              <p className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b mb-1">
                Assign Owner
              </p>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {ownerOptions.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => bulkAddOwner(u.name)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs font-medium text-foreground cursor-pointer truncate"
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <button
            type="button"
            onClick={bulkDelete}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setSelectedTasks(new Set())}
            className="p-1.5 rounded-full text-primary hover:bg-primary/15 transition-colors cursor-pointer"
            title="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Board toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border px-6 py-2.5 bg-card relative gap-3">
        <button
          type="button"
          onClick={() => setCollapsedPhases(allCollapsed ? new Set() : new Set(draft.phases.map((_, i) => i)))}
          className="p-2 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          title={allCollapsed ? "Expand All Lists" : "Collapse All Lists"}
          aria-label={allCollapsed ? "Expand All Lists" : "Collapse All Lists"}
        >
          {allCollapsed ? <ArrowRightToLine size={15} /> : <ArrowLeftToLine size={15} />}
        </button>
        {canManage && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {saveStatus}
            {autoSaves && hasChanges && (
              <button
                type="button"
                onClick={() => setDraft(openingDraft)}
                title="Go back to how this template was when you opened it"
                className={OUTLINE_BUTTON}
              >
                <RotateCcw size={13} /> Undo Changes
              </button>
            )}
            {headerActions}
            <button
              type="button"
              disabled={draft.phases.length === 0}
              onClick={() => openAddTask(0)}
              title={draft.phases.length === 0 ? "Create a task list first" : "Add a task to the first list"}
              className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <Plus size={16} />
              <span>Add Task</span>
            </button>
          </div>
        )}
      </div>

      {/* Board */}
      {/* data-scroll-key: a stable id so Back/Forward restores this scroll position (see NavigationStateTracker). */}
      <div
        data-scroll-key={`template-board-${templateId ?? "new"}`}
        className="dsm-columns-scrollbar flex-1 min-h-0 overflow-x-auto p-4.5 bg-slate-50/50 dark:bg-background/40"
      >
        <div data-col-scope className="flex gap-3.5 h-full items-stretch">
          {draft.phases.map((phase, phaseIndex) => {
            // Same numbering a project's tasks get when it's created from the template.
            const firstTaskNumber = draft.phases.slice(0, phaseIndex).reduce((sum, p) => sum + p.tasks.length, 0);

            if (collapsedPhases.has(phaseIndex)) {
              return (
                <div
                  key={phaseIndex}
                  className="w-12 shrink-0 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-slate-100/70 dark:bg-neutral-900/40 p-2 flex flex-col items-center h-full shadow-2xs transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(phaseIndex)}
                    className="mb-2 p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title={`Expand ${phase.name}`}
                    aria-label={`Expand ${phase.name}`}
                  >
                    <ArrowRightToLine size={14} />
                  </button>
                  <div className="flex-1 flex items-start justify-center">
                    <span
                      className="font-extrabold text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap"
                      style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
                    >
                      {phase.name}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={phaseIndex}
                // Drag its right edge to resize (TableColumnResizer), never narrower than the minimum.
                data-resizable-col
                data-col-key={`template-list-${phaseIndex}`}
                data-min-width={340}
                className="w-[360px] min-w-[340px] shrink-0 rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-slate-100/70 dark:bg-neutral-900/40 p-3.5 flex flex-col h-full overflow-hidden shadow-2xs transition-all duration-200"
              >
                {/* Column header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/60 dark:border-neutral-800">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {renamingPhase === phaseIndex ? (
                      <input
                        type="text"
                        autoFocus
                        value={phase.name}
                        onChange={(e) => updatePhase(phaseIndex, { name: e.target.value })}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => setRenamingPhase(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                        }}
                        aria-label="Task list name"
                        className="w-[240px] rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 font-extrabold text-xs uppercase tracking-wide text-foreground outline-none ring-1 ring-primary/30 focus:ring-primary transition-all"
                      />
                    ) : (
                      <span
                        onClick={() => canManage && setRenamingPhase(phaseIndex)}
                        title={canManage ? "Click to rename task list" : phase.name}
                        className={cn(
                          "rounded-md px-1 -mx-1 font-extrabold text-xs text-foreground tracking-wide truncate max-w-[240px] transition-colors",
                          canManage && "cursor-text hover:bg-slate-200/60 dark:hover:bg-neutral-800/60"
                        )}
                      >
                        {phase.name || "Untitled list"}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleCollapsed(phaseIndex)}
                      className={COLUMN_ICON_BUTTON}
                      title={`Collapse ${phase.name}`}
                      aria-label={`Collapse ${phase.name}`}
                    >
                      <ArrowLeftToLine size={14} />
                    </button>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => (addingToPhase === phaseIndex ? setAddingToPhase(null) : openAddTask(phaseIndex))}
                          className={cn(
                            "p-1 rounded transition-colors cursor-pointer",
                            addingToPhase === phaseIndex
                              ? "bg-primary text-primary-foreground"
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800"
                          )}
                          title="Add Task"
                          aria-label="Add Task"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removePhase(phaseIndex)}
                          className="p-1 text-slate-500 hover:text-destructive rounded hover:bg-destructive/10 transition-colors cursor-pointer"
                          title={`Delete ${phase.name}`}
                          aria-label={`Delete ${phase.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                        <Popover
                          open={listMenuPhase === phaseIndex}
                          onOpenChange={(open) => setListMenuPhase(open ? phaseIndex : null)}
                        >
                          <PopoverTrigger asChild>
                            <button type="button" className={COLUMN_ICON_BUTTON} title="List options" aria-label="List options">
                              <MoreVertical size={14} />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="bottom"
                            align="end"
                            className="w-44 p-1.5 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                          >
                            <button
                              type="button"
                              disabled={phaseIndex === 0}
                              onClick={() => movePhase(phaseIndex, -1)}
                              className={MENU_ITEM}
                            >
                              <ChevronLeft size={13} /> Move Left
                            </button>
                            <button
                              type="button"
                              disabled={phaseIndex === draft.phases.length - 1}
                              onClick={() => movePhase(phaseIndex, 1)}
                              className={MENU_ITEM}
                            >
                              <ChevronRight size={13} /> Move Right
                            </button>
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                  </div>
                </div>

                {/* Column body */}
                <div
                  data-scroll-key={`template-list-${templateId ?? "new"}-${phaseIndex}`}
                  className={cn(
                    "space-y-3 overflow-y-auto pr-1 flex-1 min-h-0 rounded-xl transition-colors",
                    dragged && "ring-1 ring-transparent hover:ring-primary/30"
                  )}
                  onDragOver={(e) => dragged && e.preventDefault()}
                  onDrop={(e) => dropTask(e, phaseIndex)}
                >
                  {addingToPhase === phaseIndex && (
                    <div className="rounded-xl border border-slate-700/80 bg-[#16181d] p-3 shadow-md space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                      <textarea
                        autoFocus
                        rows={3}
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            addTask(phaseIndex);
                          } else if (e.key === "Escape") {
                            setAddingToPhase(null);
                          }
                        }}
                        placeholder="Enter task name..."
                        aria-label="New task name"
                        className="w-full resize-y rounded-lg border border-neutral-700/80 bg-[#111216] p-2.5 text-xs font-medium text-white outline-none focus:ring-1 focus:ring-primary placeholder:text-neutral-500 min-h-[70px]"
                      />
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800">
                        <span className="text-xs text-neutral-400 font-mono">↵ Enter to create</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setAddingToPhase(null)}
                            className="px-2.5 py-1 rounded text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!newTaskTitle.trim()}
                            onClick={() => addTask(phaseIndex)}
                            className="px-3 py-1 rounded bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Plus size={12} />
                            <span>Add Task</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {phase.tasks.length === 0 && addingToPhase !== phaseIndex ? (
                    <div className="flex flex-col items-center justify-center p-6 border border-dashed border-slate-300/70 dark:border-neutral-800 rounded-xl text-center text-muted-foreground/60 space-y-2 h-36">
                      <span className="text-xs font-medium">No tasks in this list</span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => openAddTask(phaseIndex)}
                          className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={12} /> Add Task
                        </button>
                      )}
                    </div>
                  ) : (
                    phase.tasks.map((t, taskIndex) => (
                      <TemplateTaskCard
                        key={taskIndex}
                        task={t}
                        code={`T${String(firstTaskNumber + taskIndex + 1).padStart(2, "0")}`}
                        canManage={canManage}
                        isDragging={dragged?.phaseIndex === phaseIndex && dragged.taskIndex === taskIndex}
                        isSelected={isSelectedKey(phaseIndex, taskIndex)}
                        onToggleSelect={() => toggleSelected(phaseIndex, taskIndex)}
                        ownerOptions={ownerOptions}
                        lists={draft.phases}
                        otherTemplates={otherTemplates}
                        onMoveToTemplate={(target, listIndex) => moveTaskToTemplate(phaseIndex, taskIndex, target, listIndex)}
                        onMoveSubtaskToTemplate={(path, target, listIndex) =>
                          moveSubtaskToTemplate(phaseIndex, taskIndex, path, target, listIndex)
                        }
                        phaseIndex={phaseIndex}
                        taskIndex={taskIndex}
                        onOpen={() => setEditingTask({ phaseIndex, taskIndex })}
                        onOpenSubtask={(path) => setEditingTask({ phaseIndex, taskIndex, subtaskPath: path })}
                        onChange={(patch) =>
                          updateTasks(phaseIndex, (tasks) => tasks.map((x, i) => (i === taskIndex ? { ...x, ...patch } : x)))
                        }
                        onMoveSubtask={(subtaskPath, target) =>
                          setDraft((prev) => ({
                            ...prev,
                            phases: moveTemplateSubtask(prev.phases, { phaseIndex, taskIndex, subtaskPath }, target),
                          }))
                        }
                        onDuplicate={() =>
                          updateTasks(phaseIndex, (tasks) => [
                            ...tasks.slice(0, taskIndex + 1),
                            { ...t, title: `${t.title} (Copy)` },
                            ...tasks.slice(taskIndex + 1),
                          ])
                        }
                        onDelete={() => updateTasks(phaseIndex, (tasks) => tasks.filter((_, i) => i !== taskIndex))}
                        onMoveToList={(target) =>
                          setDraft((prev) => ({
                            ...prev,
                            phases: moveTemplateTask(prev.phases, { phaseIndex, taskIndex }, { phaseIndex: target }),
                          }))
                        }
                        onDragStart={() => setDragged({ phaseIndex, taskIndex })}
                        onDragEnd={() => setDragged(null)}
                        onDragOver={(e) => dragged && e.preventDefault()}
                        onDrop={(e) => dropTask(e, phaseIndex, taskIndex)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {canManage &&
            (!isCreatingList ? (
              <div className="w-[300px] shrink-0 rounded-2xl border-2 border-dashed border-slate-200 dark:border-neutral-800 bg-slate-50/60 dark:bg-neutral-900/30 p-3.5 flex flex-col justify-start h-full shadow-2xs hover:border-primary/50 transition-all duration-200">
                <button
                  type="button"
                  onClick={() => setIsCreatingList(true)}
                  className="w-full py-4 px-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary dark:text-sky-400 flex items-center justify-center gap-2 font-bold text-xs transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                >
                  <span>Create Task List</span>
                </button>
              </div>
            ) : (
              <div className="w-[340px] shrink-0 rounded-2xl border border-slate-300 dark:border-neutral-700 bg-card dark:bg-[#16181d] p-4 flex flex-col h-full shadow-md transition-all duration-200 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2.5 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <Layers size={14} className="text-primary" />
                    <span>Create Task List</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingList(false);
                      setNewListName("");
                    }}
                    aria-label="Close"
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Task List / Phase Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      autoFocus
                      required
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="e.g. POST LAUNCH, QA AUDIT"
                      aria-label="New task list name"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newListName.trim()) {
                          e.preventDefault();
                          addList();
                        } else if (e.key === "Escape") {
                          setIsCreatingList(false);
                        }
                      }}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingList(false);
                      setNewListName("");
                    }}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!newListName.trim()}
                    onClick={addList}
                    className="flex items-center gap-1.5 rounded-md bg-primary hover:bg-primary/90 text-white px-3.5 py-1.5 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                  >
                    <span>Create List</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Footer bar, as under the project board */}
      <div className="shrink-0 flex items-center justify-between border-t border-border px-6 py-2.5 bg-card text-xs text-muted-foreground font-semibold shadow-2xs">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-3.5 py-1 text-sky-600 dark:text-sky-400 font-bold">
          <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
          <span>TEMPLATE: {draft.name.trim() || "NEW TEMPLATE"}</span>
        </div>

        <div className="flex items-center gap-5 text-xs">
          <span>
            TOTAL LISTS: <strong className="text-foreground">{draft.phases.length}</strong>
          </span>
          <span>
            TOTAL COUNT: <strong className="text-foreground">{allTaskKeys.length} TASKS</strong>
          </span>
        </div>
      </div>
    </>
  );
}

/** The project board's task card, for a task in a template: its pill sets the status the task starts in. */
function TemplateTaskCard({
  task,
  code,
  canManage,
  isDragging,
  isSelected,
  onToggleSelect,
  ownerOptions,
  lists,
  otherTemplates,
  onMoveToTemplate,
  onMoveSubtaskToTemplate,
  phaseIndex,
  taskIndex,
  onOpen,
  onOpenSubtask,
  onChange,
  onDuplicate,
  onDelete,
  onMoveToList,
  onMoveSubtask,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  inSidebar = false,
}: {
  /** On the task page's left panel: subtasks start open, and there's no bulk-select box or dragging. */
  inSidebar?: boolean;
  task: SOPTaskSeed;
  code: string;
  canManage: boolean;
  isDragging: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  ownerOptions: OwnerUserOption[];
  lists: TemplatePhaseDraft[];
  otherTemplates: { id: string; name: string; lists: string[] }[];
  onMoveToTemplate: (target: { id: string; name: string }, listIndex: number) => void;
  onMoveSubtaskToTemplate: (subtaskPath: number[], target: { id: string; name: string }, listIndex: number) => void;
  phaseIndex: number;
  taskIndex: number;
  onOpen: () => void;
  onOpenSubtask: (path: number[]) => void;
  onChange: (patch: Partial<SOPTaskSeed>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveToList: (phaseIndex: number) => void;
  onMoveSubtask: (subtaskPath: number[], target: { phaseIndex: number; taskIndex: number }) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(inSidebar);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [menu, setMenu] = useState<"more" | "move" | null>(null);
  const subtasks = task.subtasks ?? [];
  const owners = task.defaultOwners ?? [];
  const sopNames = (task.sopChecklists ?? []).map((s) => s.name).join(", ");

  return (
    <div
      onClick={onOpen}
      draggable={canManage && !inSidebar && !isRenaming && !isAddingSubtask}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.title);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "relative overflow-hidden rounded-xl border p-3.5 shadow-2xs transition-all cursor-pointer space-y-2.5 group",
        canManage && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        isSelected
          ? "border-primary/70 bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/40 shadow-md"
          : "border-slate-200/90 dark:border-neutral-800 bg-white dark:bg-card hover:border-primary/60 hover:shadow-md"
      )}
    >
      {/* Top row: select checkbox, code, status pill and actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          {!inSidebar && <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            onClick={(e) => {
              e.stopPropagation();
              if (canManage) onToggleSelect();
            }}
            disabled={!canManage}
            title={canManage ? "Select task" : "Only managers can select tasks"}
            className="h-3.5 w-3.5 rounded border-slate-300 dark:border-neutral-700 accent-primary cursor-pointer shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
          />}
          <span className="font-mono text-xs font-bold text-slate-400 dark:text-neutral-500 whitespace-nowrap">{code}</span>
        </div>
        {/* The status pill shrinks (capped); the 👁 / ⋮ / move buttons never do. */}
        <div className="flex min-w-0 items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
          <div
            className={cn(
              "relative inline-flex min-w-0 max-w-[150px] shrink items-center rounded-md pl-2 pr-1 py-0.5 text-xs font-medium text-white transition-all shadow-2xs",
              getTaskStatusPillClasses(task.status ?? "Open")
            )}
          >
            <select
              value={task.status ?? "Open"}
              disabled={!canManage}
              onChange={(e) => {
                const status = e.target.value as TaskStatus;
                onChange({ status: status === "Open" ? undefined : status });
              }}
              title={`Starts as: ${task.status ?? "Open"}`}
              aria-label="Status the task starts in"
              className="appearance-none [field-sizing:content] min-w-0 max-w-full truncate bg-transparent pr-3.5 outline-none cursor-pointer font-medium text-white transition-all disabled:cursor-default text-xs"
            >
              {TEMPLATE_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-card text-foreground">
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-white/90" />
          </div>

          <button type="button" onClick={onOpen} className={CARD_ICON_BUTTON} title="Open task" aria-label="Open task">
            <Eye size={13} />
          </button>

          {canManage && (
            <>
              <Popover open={menu === "more"} onOpenChange={(open) => setMenu(open ? "more" : null)}>
                <PopoverTrigger asChild>
                  <button type="button" className={CARD_ICON_BUTTON} title="More options" aria-label="More options">
                    <MoreVertical size={13} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="end"
                  className="w-40 p-1.5 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null);
                      setShowSubtasks(true);
                      setIsAddingSubtask(true);
                    }}
                    className={MENU_ITEM}
                  >
                    <Plus size={13} />
                    <span>Add Subtask</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null);
                      onDuplicate();
                    }}
                    className={MENU_ITEM}
                  >
                    <Copy size={13} />
                    <span>Duplicate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null);
                      onDelete();
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </PopoverContent>
              </Popover>

              <TemplateMoveMenu
                taskLabel={`${code} ${task.title}`}
                open={menu === "move"}
                onOpenChange={(open) => setMenu(open ? "move" : null)}
                trigger={
                  <button type="button" className={CARD_ICON_BUTTON} title="Move to another list or template" aria-label="Move to another list or template">
                    <ArrowRightLeft size={13} />
                  </button>
                }
                lists={lists.map((l) => l.name)}
                currentListIndex={phaseIndex}
                otherTemplates={otherTemplates}
                onMoveToList={onMoveToList}
                onMoveToTemplate={onMoveToTemplate}
              />
            </>
          )}
        </div>
      </div>

      {/* Title: click to rename */}
      {isRenaming ? (
        <input
          type="text"
          autoFocus
          defaultValue={task.title}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const title = e.currentTarget.value.trim();
            if (title) onChange({ title });
            setIsRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setIsRenaming(false);
          }}
          aria-label="Task title"
          className="w-full rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 text-xs font-bold text-slate-800 dark:text-neutral-200 outline-none ring-1 ring-primary/30 focus:ring-primary transition-all"
        />
      ) : (
        <h4
          onClick={(e) => {
            if (!canManage) return;
            e.stopPropagation();
            setIsRenaming(true);
          }}
          title={canManage ? "Click to rename" : task.title}
          className={cn(
            "rounded-md px-1 -mx-1 text-xs font-semibold leading-snug transition-colors text-slate-800 dark:text-neutral-200",
            canManage && "group-hover:text-primary hover:bg-slate-100 dark:hover:bg-neutral-800/60 cursor-text"
          )}
        >
          {task.title}
        </h4>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-neutral-800/80 text-slate-400 text-xs">
        <div className="flex items-center gap-2 text-slate-400" onClick={(e) => e.stopPropagation()}>
          <span
            title={`Duration: ${task.duration}`}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-muted-foreground dark:bg-zinc-900 dark:border-zinc-800"
          >
            <Clock size={13} aria-label={`Duration: ${task.duration}`} />
          </span>
          <ChecklistChip
            summary={sopNames ? { done: 0, total: 0, requiredOpen: 0 } : undefined}
            title={sopNames ? `SOP attached in new projects: ${sopNames}` : "No SOP set on this template task"}
          />
          {subtasks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSubtasks((v) => !v)}
              className="flex items-center gap-1 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-foreground transition-all cursor-pointer"
              title={`${subtasks.length} Subtask${subtasks.length > 1 ? "s" : ""} (Click to ${showSubtasks ? "hide" : "view"})`}
            >
              <ListTree size={13} />
              <span className="text-xs font-bold">{subtasks.length}</span>
              {showSubtasks ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Due date, left of the owner avatar */}
          {task.dueDate && task.dueDate !== "--" && (
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-muted-foreground"
              title={`Due ${task.dueDate}`}
            >
              <CalendarDays size={12} /> {task.dueDate}
            </span>
          )}
          <TemplateOwnersPopover
            owners={owners}
            ownerOptions={ownerOptions}
            canManage={canManage}
            onChangeOwners={(next) => onChange({ defaultOwners: next })}
          />
        </div>
      </div>

      {/* Subtasks, nested under the task like on the project board */}
      {(isAddingSubtask || (showSubtasks && subtasks.length > 0)) && (
        <TemplateSubtaskList
          subtasks={showSubtasks ? subtasks : []}
          parentCode={code}
          parentPath={[]}
          canManage={canManage}
          ownerOptions={ownerOptions}
          lists={lists}
          task={{ phaseIndex, taskIndex }}
          isAdding={isAddingSubtask}
          onCloseAdd={() => setIsAddingSubtask(false)}
          onOpenSubtask={onOpenSubtask}
          onChange={(next) => onChange({ subtasks: next })}
          onAdd={(title) => onChange({ subtasks: [...subtasks, title] })}
          onMove={onMoveSubtask}
          otherTemplates={otherTemplates}
          onMoveToTemplate={onMoveSubtaskToTemplate}
        />
      )}
    </div>
  );
}

/** The owner avatar(s) on a card; click to pick who the task starts with, as on the project board. */
function TemplateOwnersPopover({
  owners,
  ownerOptions,
  canManage,
  onChangeOwners,
}: {
  owners: { id: string; name: string }[];
  ownerOptions: OwnerUserOption[];
  canManage: boolean;
  onChangeOwners: (owners: { id: string; name: string }[]) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex shrink-0 items-center rounded-full hover:scale-105 transition-transform cursor-pointer"
          title={`Owners: ${owners.length > 0 ? owners.map((o) => o.name).join(", ") : "Unassigned"}${
            canManage ? " (Click to assign owners)" : ""
          }`}
        >
          {owners.length === 0 ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200/80 ring-2 ring-background shadow-2xs dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700">
              <UserIcon size={12} className="text-slate-400 dark:text-neutral-500" aria-label="Unassigned" />
            </span>
          ) : (
            <AvatarStack people={owners} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-64 p-2.5 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <TaskMultiOwnerSelect
          selectedOwners={owners.map((o) => o.name)}
          disabled={!canManage}
          onChangeOwners={(next) =>
            onChangeOwners(
              next.filter((n) => n && n.trim().toLowerCase() !== "unassigned").map((name) => ({ id: name, name }))
            )
          }
          ownersList={ownerOptions}
          listLabel="Project Users"
        />
      </PopoverContent>
    </Popover>
  );
}

/** A task's or subtask's subtasks, on the project board's connector line, with their quick add. */
function TemplateSubtaskList({
  subtasks,
  parentCode,
  parentPath,
  canManage,
  ownerOptions,
  lists,
  task,
  isAdding,
  onCloseAdd,
  onOpenSubtask,
  onChange,
  onAdd,
  onMove,
  otherTemplates,
  onMoveToTemplate,
}: {
  otherTemplates: { id: string; name: string; lists: string[] }[];
  onMoveToTemplate: (subtaskPath: number[], target: { id: string; name: string }, listIndex: number) => void;
  subtasks: SOPSubtaskSeed[];
  parentCode: string;
  parentPath: number[];
  canManage: boolean;
  ownerOptions: OwnerUserOption[];
  lists: TemplatePhaseDraft[];
  task: { phaseIndex: number; taskIndex: number };
  isAdding: boolean;
  onCloseAdd: () => void;
  onOpenSubtask: (path: number[]) => void;
  onChange: (subtasks: SOPSubtaskSeed[]) => void;
  onAdd: (title: string) => void;
  onMove: (subtaskPath: number[], target: { phaseIndex: number; taskIndex: number }) => void;
}) {
  const [newTitle, setNewTitle] = useState("");

  const add = () => {
    const title = newTitle.trim();
    if (!title) return;
    onAdd(title);
    setNewTitle("");
  };

  return (
    <div
      className="relative ml-2.5 mt-1 space-y-2 border-l-2 border-cyan-400/70 dark:border-cyan-500/50 pl-3"
      onClick={(e) => e.stopPropagation()}
    >
      {subtasks.map((subtask, index) => (
        <div key={index} className="relative">
          <span className="absolute -left-3 top-4 w-3 border-t-2 border-cyan-400/70 dark:border-cyan-500/50" />
          <TemplateSubtaskCard
            subtask={subtask}
            code={`${parentCode}.${index + 1}`}
            path={[...parentPath, index]}
            canManage={canManage}
            ownerOptions={ownerOptions}
            lists={lists}
            task={task}
            onOpenSubtask={onOpenSubtask}
            onChange={(updated) => onChange(subtasks.map((s, i) => (i === index ? updated : s)))}
            onDuplicate={() => onChange([...subtasks.slice(0, index + 1), subtask, ...subtasks.slice(index + 1)])}
            onDelete={() => onChange(subtasks.filter((_, i) => i !== index))}
            onMove={onMove}
            otherTemplates={otherTemplates}
            onMoveToTemplate={onMoveToTemplate}
          />
        </div>
      ))}
      {isAdding && (
        <input
          type="text"
          autoFocus
          value={newTitle}
          draggable={false}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
            if (e.key === "Escape") onCloseAdd();
          }}
          onBlur={() => {
            add();
            onCloseAdd();
          }}
          placeholder="Subtask name, then Enter to add another"
          aria-label="New subtask name"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
        />
      )}
    </div>
  );
}

/**
 * The project board's subtask card, for a subtask in a template. A template subtask is just a name
 * and its own subtasks, so its pill is fixed at Open and it has no page: opening it opens its task.
 */
function TemplateSubtaskCard({
  subtask,
  code,
  path,
  canManage,
  ownerOptions,
  lists,
  task,
  onOpenSubtask,
  onChange,
  onDuplicate,
  onDelete,
  onMove,
  otherTemplates,
  onMoveToTemplate,
}: {
  otherTemplates: { id: string; name: string; lists: string[] }[];
  onMoveToTemplate: (subtaskPath: number[], target: { id: string; name: string }, listIndex: number) => void;
  subtask: SOPSubtaskSeed;
  code: string;
  path: number[];
  canManage: boolean;
  ownerOptions: OwnerUserOption[];
  lists: TemplatePhaseDraft[];
  task: { phaseIndex: number; taskIndex: number };
  onOpenSubtask: (path: number[]) => void;
  onChange: (subtask: SOPSubtaskSeed) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (subtaskPath: number[], target: { phaseIndex: number; taskIndex: number }) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [menu, setMenu] = useState<"more" | "move" | null>(null);
  const [showChildren, setShowChildren] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const title = subtaskTitle(subtask);
  const children = subtaskChildren(subtask);
  const status = subtaskStatus(subtask) ?? "Open";
  const sops = subtaskSops(subtask);
  const owners = subtaskOwners(subtask);
  const dueDate = subtaskDueDate(subtask);
  const extra = {
    description: subtaskDescription(subtask),
    status: subtaskStatus(subtask),
    sopChecklists: sops,
    defaultOwners: owners,
    startDate: subtaskStartDate(subtask),
    dueDate,
    priority: subtaskPriority(subtask),
    duration: subtaskDuration(subtask),
  };

  const onRename = (renamed: string) => onChange(makeSubtask(renamed, children, extra));
  const onStatus = (next: TaskStatus) => onChange(makeSubtask(title, children, { ...extra, status: next === "Open" ? undefined : next }));
  const onOwners = (next: { id: string; name: string }[]) => onChange(makeSubtask(title, children, { ...extra, defaultOwners: next }));
  // A nested subtask can move up to be directly under its own task; a direct one is already there.
  const isCurrentTask = (phaseIndex: number, taskIndex: number) =>
    path.length === 1 && phaseIndex === task.phaseIndex && taskIndex === task.taskIndex;

  return (
    <div
      onClick={() => onOpenSubtask(path)}
      className="relative overflow-hidden rounded-xl border p-3.5 shadow-2xs transition-all space-y-2.5 group/subtask cursor-pointer border-slate-200/90 dark:border-neutral-800 bg-white dark:bg-card hover:border-primary/60 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs font-bold text-slate-400 dark:text-neutral-500 whitespace-nowrap">{code}</span>
        <div className="flex min-w-0 items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
          <div
            className={cn(
              "relative inline-flex min-w-0 max-w-[150px] shrink items-center rounded-md pl-2 pr-1 py-0.5 text-xs font-medium text-white transition-all shadow-2xs",
              getTaskStatusPillClasses(status)
            )}
          >
            <select
              value={status}
              disabled={!canManage}
              onChange={(e) => onStatus(e.target.value as TaskStatus)}
              title={`Starts as: ${status}`}
              aria-label="Status the subtask starts in"
              className="appearance-none [field-sizing:content] min-w-0 max-w-full truncate bg-transparent pr-3.5 outline-none cursor-pointer font-medium text-white transition-all disabled:cursor-default text-xs"
            >
              {TEMPLATE_STATUSES.map((s) => (
                <option key={s} value={s} className="bg-card text-foreground">
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-white/90" />
          </div>
          {canManage && (
            <Popover open={menu === "more"} onOpenChange={(open) => setMenu(open ? "more" : null)}>
              <PopoverTrigger asChild>
                <button type="button" className={CARD_ICON_BUTTON} title="More options" aria-label="More options">
                  <MoreVertical size={13} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="end"
                className="w-40 p-1.5 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenu(null);
                    setShowChildren(true);
                    setIsAddingChild(true);
                  }}
                  className={MENU_ITEM}
                >
                  <Plus size={13} />
                  <span>Add Subtask</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(null);
                    onDuplicate();
                  }}
                  className={MENU_ITEM}
                >
                  <Copy size={13} />
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(null);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {isRenaming ? (
        <input
          type="text"
          autoFocus
          defaultValue={title}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const renamed = e.currentTarget.value.trim();
            if (renamed) onRename(renamed);
            setIsRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setIsRenaming(false);
          }}
          aria-label="Subtask title"
          className="w-full rounded-md border border-primary/50 bg-transparent px-1 -mx-1 py-0.5 text-xs font-bold text-slate-800 dark:text-neutral-200 outline-none ring-1 ring-primary/30 focus:ring-primary transition-all"
        />
      ) : (
        <h4
          onClick={(e) => {
            if (!canManage) return;
            e.stopPropagation();
            setIsRenaming(true);
          }}
          title={canManage ? "Click to rename" : title}
          className={cn(
            "rounded-md px-1 -mx-1 text-xs font-semibold leading-snug transition-colors text-slate-800 dark:text-neutral-200",
            canManage && "group-hover/subtask:text-primary hover:bg-slate-100 dark:hover:bg-neutral-800/60 cursor-text"
          )}
        >
          {title}
        </h4>
      )}

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
            title={
              sops.length > 0
                ? `SOP attached in new projects: ${sops.map((s) => s.name).join(", ")}`
                : "Subtasks start without an SOP"
            }
          />
          <button
            type="button"
            onClick={() => onOpenSubtask(path)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-slate-400 hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer dark:bg-[#121316] dark:border-white/10"
            title="Open subtask page"
            aria-label="Open subtask page"
          >
            <Eye size={13} />
          </button>
          {canManage && (
            <Popover open={menu === "move"} onOpenChange={(open) => setMenu(open ? "move" : null)}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-muted/60 text-slate-400 hover:text-foreground hover:bg-muted transition-all duration-150 cursor-pointer dark:bg-[#121316] dark:border-white/10"
                  title="Move to another task"
                  aria-label="Move to another task"
                >
                  <ArrowRightLeft size={13} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="start"
                className="w-64 p-2 text-xs z-50 bg-popover text-popover-foreground shadow-lg border border-border"
              >
                <p className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b mb-1">
                  Move to Task
                </p>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {lists.map(
                    (list, listIndex) =>
                      list.tasks.length > 0 && (
                        <div key={listIndex} className="space-y-0.5">
                          <p className="truncate px-2 pt-1 text-xs font-semibold text-muted-foreground">{list.name}</p>
                          {list.tasks.map((target, targetIndex) => {
                            const isParent = isCurrentTask(listIndex, targetIndex);
                            return (
                              <button
                                key={targetIndex}
                                type="button"
                                onClick={() => {
                                  setMenu(null);
                                  if (!isParent) onMove(path, { phaseIndex: listIndex, taskIndex: targetIndex });
                                }}
                                className={cn(
                                  "w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-xs font-medium flex items-center justify-between cursor-pointer",
                                  isParent ? "bg-primary/10 text-primary font-bold" : "text-foreground"
                                )}
                              >
                                <span className="truncate">{target.title}</span>
                                {isParent && <Check size={12} className="shrink-0 text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                      )
                  )}
                </div>
                {otherTemplates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(null);
                      setIsMoveDialogOpen(true);
                    }}
                    className="mt-1.5 flex w-full cursor-pointer items-center gap-2 rounded-md border-t px-2 pb-2 pt-2.5 text-left text-xs font-semibold text-foreground hover:bg-accent"
                  >
                    <ArrowRightLeft size={13} className="shrink-0 text-primary" />
                    <span>Move to Another Template…</span>
                  </button>
                )}
              </PopoverContent>
            </Popover>
          )}
          {isMoveDialogOpen && (
            <MoveTaskToTemplateDialog
              taskLabel={`${code} ${title}`}
              otherTemplates={otherTemplates}
              onMove={(target, listIndex) => onMoveToTemplate(path, target, listIndex)}
              onClose={() => setIsMoveDialogOpen(false)}
            />
          )}
          {children.length > 0 && (
            <button
              type="button"
              onClick={() => setShowChildren((v) => !v)}
              className="flex items-center gap-1 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-foreground transition-all cursor-pointer"
              title={`${children.length} Subtask${children.length > 1 ? "s" : ""} (Click to ${showChildren ? "hide" : "view"})`}
            >
              <ListTree size={13} />
              <span className="text-xs font-bold">{children.length}</span>
              {showChildren ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {dueDate && dueDate !== "--" && (
            <span
              className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-muted-foreground"
              title={`Due ${dueDate}`}
            >
              <CalendarDays size={12} /> {dueDate}
            </span>
          )}
          <TemplateOwnersPopover owners={owners} ownerOptions={ownerOptions} canManage={canManage} onChangeOwners={onOwners} />
        </div>
      </div>

      {(isAddingChild || (showChildren && children.length > 0)) && (
        <TemplateSubtaskList
          subtasks={showChildren ? children : []}
          parentCode={code}
          parentPath={path}
          canManage={canManage}
          ownerOptions={ownerOptions}
          lists={lists}
          task={task}
          isAdding={isAddingChild}
          onCloseAdd={() => setIsAddingChild(false)}
          onOpenSubtask={onOpenSubtask}
          onChange={(next) => onChange(makeSubtask(title, next, extra))}
          onAdd={(childTitle) => onChange(makeSubtask(title, [...children, childTitle], extra))}
          onMove={onMove}
          otherTemplates={otherTemplates}
          onMoveToTemplate={onMoveToTemplate}
        />
      )}
    </div>
  );
}

