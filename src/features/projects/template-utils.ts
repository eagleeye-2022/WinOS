import {
  PROJECT_TASK_STATUSES,
  ProjectPriority,
  ProjectTemplate,
  SOPTaskListTemplate,
  SOPTaskSeed,
  TaskStatus,
  isTaskDone,
} from "./types";
import {
  DEFAULT_PROJECT_TEMPLATES,
  DIGITAL_PROJECT_TEMPLATES,
  SMM_PROJECT_TEMPLATE,
} from "./data/sop-templates";

/** Which Srijan project tab a template's projects belong to. */
export type TemplateKind = "DIGITAL" | "SMM";

/**
 * The originals live in code. A manager's edit is saved as a DB row with the same id, which
 * findProjectTemplate prefers; deleting that row brings the original back.
 */
export const BUILT_IN_PROJECT_TEMPLATES: ProjectTemplate[] = [...DIGITAL_PROJECT_TEMPLATES, SMM_PROJECT_TEMPLATE];

export const TEMPLATE_PRIORITIES: ProjectPriority[] = ["None", "Low", "Medium", "High", "Urgent"];

/** A new task can't start closed: closing needs a completed SOP checklist. */
export const TEMPLATE_STATUSES: TaskStatus[] = PROJECT_TASK_STATUSES.filter((s) => !isTaskDone(s));

const MAX_TEMPLATE_DAYS = 3650;

function cleanDays(days: unknown): number | undefined {
  return Number.isInteger(days) && (days as number) >= 0 && (days as number) <= MAX_TEMPLATE_DAYS
    ? (days as number)
    : undefined;
}

/** Keeps well-formed { id, name } entries, once per id. */
function cleanRefs(refs: unknown): { id: string; name: string }[] {
  if (!Array.isArray(refs)) return [];
  const byId = new Map<string, { id: string; name: string }>();
  for (const ref of refs) {
    if (typeof ref?.id === "string" && ref.id && typeof ref.name === "string") {
      byId.set(ref.id, { id: ref.id, name: ref.name });
    }
  }
  return [...byId.values()];
}

function cleanTask(task: SOPTaskSeed, departmentAlias: string): SOPTaskSeed {
  const subtasks = (task.subtasks ?? []).map((s) => s.trim()).filter(Boolean);
  const startInDays = cleanDays(task.startInDays);
  const dueInDays = cleanDays(task.dueInDays);
  const defaultOwners = cleanRefs(task.defaultOwners);
  const sopChecklists = cleanRefs(task.sopChecklists);
  return {
    ...task,
    title: task.title.trim(),
    duration: task.duration || "1 day",
    priority: TEMPLATE_PRIORITIES.includes(task.priority) ? task.priority : "Medium",
    departmentAlias: task.departmentAlias || departmentAlias,
    subtasks: subtasks.length > 0 ? subtasks : undefined,
    status: task.status && TEMPLATE_STATUSES.includes(task.status) ? task.status : undefined,
    startInDays,
    dueInDays,
    defaultOwners: defaultOwners.length > 0 ? defaultOwners : undefined,
    sopChecklists: sopChecklists.length > 0 ? sopChecklists : undefined,
  };
}

const CUSTOM_PHASE_CODE = /^P\d+$/;

/**
 * Saved templates number their phases P1, P2…, which marks the phases of every project built from
 * one. The task board shows only such a project's own columns, even after a list is added later
 * with a code like "3.1" that would otherwise bring in the default SOP columns.
 */
export function isCustomTemplatePhaseCode(code: string): boolean {
  return CUSTOM_PHASE_CODE.test(code);
}

export function isBuiltInTemplate(templateId: string): boolean {
  return BUILT_IN_PROJECT_TEMPLATES.some((t) => t.id === templateId);
}

export function getTemplateKind(template: ProjectTemplate): TemplateKind {
  return template.id === SMM_PROJECT_TEMPLATE.id || template.category === "SMM Project" ? "SMM" : "DIGITAL";
}

export interface TemplatePhaseDraft {
  name: string;
  clientVisible: boolean;
  departmentAlias?: string;
  tasks: SOPTaskSeed[];
  /** Further empty lists on the phase (e.g. "7.1.1 Done Maintenance & Support"), kept as they are. */
  extraLists?: SOPTaskListTemplate[];
}

/** What the template board edits, and what the save actions receive. */
export interface TemplateDraft {
  name: string;
  description: string;
  kind: TemplateKind;
  phases: TemplatePhaseDraft[];
}

export type ProjectTemplateInput = Pick<ProjectTemplate, "name" | "description" | "category" | "phases">;

const defaultDepartment = (kind: TemplateKind) => (kind === "SMM" ? "smm@" : "digitalproducts@");

export function newTemplateTask(kind: TemplateKind, title = ""): SOPTaskSeed {
  return { title, duration: "1 day", priority: "Medium", departmentAlias: defaultDepartment(kind) };
}

export function newTemplatePhase(kind: TemplateKind, name = ""): TemplatePhaseDraft {
  return { name, clientVisible: true, departmentAlias: defaultDepartment(kind), tasks: [] };
}

export function newTemplateDraft(kind: TemplateKind = "DIGITAL"): TemplateDraft {
  return { name: "", description: "", kind, phases: [] };
}

/** A template as an editable draft: a phase's task lists holding tasks are merged into one column. */
export function templateToDraft(template: ProjectTemplate): TemplateDraft {
  return {
    name: template.name,
    description: template.description,
    kind: getTemplateKind(template),
    phases: template.phases.map((phase) => {
      const [firstList, ...otherLists] = phase.taskLists ?? [];
      const extraLists = otherLists.filter((tl) => !tl.defaultTasks?.length);
      return {
        name: phase.name,
        clientVisible: (firstList?.flag ?? "external") === "external",
        departmentAlias: phase.departmentAlias,
        tasks: [...(phase.tasks ?? []), ...(phase.taskLists ?? []).flatMap((tl) => tl.defaultTasks ?? [])],
        ...(extraLists.length > 0 ? { extraLists } : {}),
      };
    }),
  };
}

export function duplicateTemplateDraft(template: ProjectTemplate): TemplateDraft {
  return { ...templateToDraft(template), name: `${template.name} Copy` };
}

/** Moves a card, before the card at `to.taskIndex`, or to the end of the list when it's omitted. */
export function moveTemplateTask(
  phases: TemplatePhaseDraft[],
  from: { phaseIndex: number; taskIndex: number },
  to: { phaseIndex: number; taskIndex?: number }
): TemplatePhaseDraft[] {
  const task = phases[from.phaseIndex]?.tasks[from.taskIndex];
  if (!task) return phases;

  const lists = phases.map((p) => [...p.tasks]);
  lists[from.phaseIndex].splice(from.taskIndex, 1);

  const target = lists[to.phaseIndex];
  let insertAt = to.taskIndex ?? target.length;
  // Removing the card shifted everything after it in the same list.
  if (to.taskIndex !== undefined && to.phaseIndex === from.phaseIndex && from.taskIndex < to.taskIndex) insertAt--;
  target.splice(insertAt, 0, task);

  return phases.map((p, i) => ({ ...p, tasks: lists[i] }));
}

/**
 * Validates a draft and turns it into what gets stored. `otherCustomNames` are the other custom
 * templates' names. Names must stay unique: Ecommerce / Enterprise projects are matched to their
 * template by name when switching between the two, so a custom "Ecommerce" would be mistaken for it.
 * Pass `builtIn` when saving an edit of a built-in template, which keeps its name and category.
 */
export function buildTemplateFromDraft(
  draft: TemplateDraft,
  otherCustomNames: string[],
  builtIn?: ProjectTemplate
): { template: ProjectTemplateInput; error?: undefined } | { template?: undefined; error: string } {
  const name = builtIn ? builtIn.name : (draft.name || "").trim();
  if (!builtIn) {
    if (!name) return { error: "Enter a template name." };

    const taken = [...DEFAULT_PROJECT_TEMPLATES, SMM_PROJECT_TEMPLATE].map((t) => t.name).concat(otherCustomNames);
    if (taken.some((t) => t.toLowerCase() === name.toLowerCase())) {
      return { error: `A template named "${name}" already exists.` };
    }

    // A project is listed under SMM when its template name mentions SMM / social.
    if (draft.kind !== "SMM" && /smm|social/i.test(name)) {
      return { error: 'A Digital template\'s name can\'t include "SMM" or "social": its projects would be listed under SMM.' };
    }
  }

  const phases = draft.phases ?? [];
  if (phases.length === 0) return { error: "Add at least one task list." };

  const phaseNames = phases.map((p) => (p.name || "").trim());
  if (phaseNames.some((n) => !n)) return { error: "Every task list needs a name." };
  if (new Set(phaseNames.map((n) => n.toLowerCase())).size !== phaseNames.length) {
    return { error: "Task list names must be different from each other." };
  }

  const kind = builtIn ? getTemplateKind(builtIn) : draft.kind;
  const fallbackDepartment = defaultDepartment(kind);
  const built = phases.map((phase, index) => {
    const departmentAlias = phase.departmentAlias || fallbackDepartment;
    const tasks: SOPTaskSeed[] = (phase.tasks ?? [])
      .filter((t) => (t.title || "").trim())
      .map((t) => cleanTask(t, departmentAlias));
    return {
      code: `P${index + 1}`,
      name: phaseNames[index],
      departmentAlias,
      taskLists: [
        {
          name: phaseNames[index],
          flag: phase.clientVisible ? ("external" as const) : ("internal" as const),
          sequence: index + 1,
          defaultTasks: tasks,
        },
        ...(phase.extraLists ?? []),
      ],
    };
  });

  // A project with no tasks gets the default 17-phase template added the first time it is opened.
  if (!built.some((p) => p.taskLists[0].defaultTasks.length > 0)) {
    return { error: "Add at least one task." };
  }

  const backwards = built
    .flatMap((p) => p.taskLists[0].defaultTasks)
    .find((t) => t.startInDays !== undefined && t.dueInDays !== undefined && t.dueInDays < t.startInDays);
  if (backwards) return { error: `"${backwards.title}" is due before it starts.` };

  return {
    template: {
      name,
      description: (draft.description || "").trim(),
      category: builtIn ? builtIn.category : kind === "SMM" ? "SMM Project" : "Digital Project",
      // Unset defaults are undefined here; stored JSON leaves them out.
      phases: JSON.parse(JSON.stringify(built)),
    },
  };
}
