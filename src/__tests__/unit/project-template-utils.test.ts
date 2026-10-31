import { describe, expect, it } from "vitest";
import {
  ECOMMERCE_PROJECT_TEMPLATE,
  SMM_PROJECT_TEMPLATE,
  scaffoldPhasesFromTemplate,
  scaffoldTaskListsFromTemplate,
  scaffoldTasksFromTemplate,
} from "@/features/projects/data/sop-templates";
import {
  BUILT_IN_PROJECT_TEMPLATES,
  TEMPLATE_STATUSES,
  TemplateDraft,
  buildTemplateFromDraft,
  duplicateTemplateDraft,
  getTemplateKind,
  isBuiltInTemplate,
  isCustomTemplatePhaseCode,
  moveTemplateTask,
  newTemplateDraft,
  newTemplatePhase,
  newTemplateTask,
  templateToDraft,
} from "@/features/projects/template-utils";

const draft = (overrides: Partial<TemplateDraft> = {}): TemplateDraft => ({
  ...newTemplateDraft(),
  name: "Landing Page",
  phases: [
    {
      name: "Build",
      clientVisible: false,
      tasks: [
        { title: " Set up ", duration: "1 day", priority: "High", departmentAlias: "dev@", subtasks: ["One", " ", "Two "] },
        { title: "  ", duration: "1 day", priority: "Medium", departmentAlias: "dev@" },
      ],
    },
    { name: "Launch", clientVisible: true, tasks: [] },
  ],
  ...overrides,
});

describe("built-in project templates", () => {
  it("are Ecommerce, Enterprise and SMM", () => {
    expect(BUILT_IN_PROJECT_TEMPLATES.map((t) => t.name)).toEqual(["Ecommerce", "Enterprise", "SMM"]);
    expect(isBuiltInTemplate(SMM_PROJECT_TEMPLATE.id)).toBe(true);
    expect(isBuiltInTemplate("cuid123")).toBe(false);
  });

  it("belong to the right project tab", () => {
    expect(getTemplateKind(ECOMMERCE_PROJECT_TEMPLATE)).toBe("DIGITAL");
    expect(getTemplateKind(SMM_PROJECT_TEMPLATE)).toBe("SMM");
  });
});

describe("buildTemplateFromDraft", () => {
  it("numbers phases P1, P2… and drops blank rows", () => {
    const { template } = buildTemplateFromDraft(draft(), []);

    expect(template?.category).toBe("Digital Project");
    expect(template?.phases.map((p) => [p.code, p.name])).toEqual([
      ["P1", "Build"],
      ["P2", "Launch"],
    ]);
    expect(template?.phases[0].taskLists?.[0].flag).toBe("internal");
    expect(template?.phases[0].taskLists?.[0].defaultTasks).toEqual([
      expect.objectContaining({ title: "Set up", priority: "High", subtasks: ["One", "Two"] }),
    ]);
  });

  it("produces a template the project scaffolding can use, phase codes and all", () => {
    const { template } = buildTemplateFromDraft(draft(), []);
    const full = { ...template!, id: "custom" };

    const phases = scaffoldPhasesFromTemplate(full);
    expect(phases.every((p) => isCustomTemplatePhaseCode(p.code))).toBe(true);
    expect(scaffoldTaskListsFromTemplate(full).map((l) => l.phaseCode)).toEqual(["P1", "P2"]);
    expect(scaffoldTasksFromTemplate(full, "EEDP-1")).toEqual([
      expect.objectContaining({ code: "EEDP-1-T01", phaseCode: "P1", subtaskTitles: ["One", "Two"] }),
    ]);
  });

  it("marks a custom SMM template for the SMM tab", () => {
    const { template } = buildTemplateFromDraft(draft({ kind: "SMM", name: "SMM Retainer" }), []);
    expect(getTemplateKind({ ...template!, id: "custom" })).toBe("SMM");
  });

  it.each([
    ["a blank name", { name: "  " }, "name"],
    ["a built-in name", { name: "ecommerce" }, "already exists"],
    ["a name taken by another custom template", { name: "taken" }, "already exists"],
    ["a Digital name that would list projects under SMM", { name: "Social Push" }, "SMM"],
    ["no task lists", { phases: [] }, "task list"],
    ["a blank phase name", { phases: [{ name: " ", clientVisible: true, tasks: [] }] }, "name"],
    [
      "duplicate phase names",
      {
        phases: [
          { name: "Build", clientVisible: true, tasks: [] },
          { name: "build ", clientVisible: true, tasks: [] },
        ],
      },
      "different",
    ],
    ["no tasks at all", { phases: [{ name: "Build", clientVisible: true, tasks: [] }] }, "task"],
  ])("rejects %s", (_label, overrides, message) => {
    const { template, error } = buildTemplateFromDraft(draft(overrides as Partial<TemplateDraft>), ["Taken"]);
    expect(template).toBeUndefined();
    expect(error).toContain(message);
  });
});

describe("template drafts", () => {
  it("duplicating Ecommerce keeps its phases and tasks and can be saved", () => {
    const copy = duplicateTemplateDraft(ECOMMERCE_PROJECT_TEMPLATE);
    expect(copy.name).toBe("Ecommerce Copy");
    expect(copy.phases).toHaveLength(ECOMMERCE_PROJECT_TEMPLATE.phases.length);

    const { template } = buildTemplateFromDraft(copy, []);
    expect(scaffoldTasksFromTemplate({ ...template!, id: "custom" }, "P").length).toBe(
      scaffoldTasksFromTemplate(ECOMMERCE_PROJECT_TEMPLATE, "P").length
    );
  });

  it("duplicating SMM keeps its monthly subtasks and stays an SMM template", () => {
    const { template } = buildTemplateFromDraft(duplicateTemplateDraft(SMM_PROJECT_TEMPLATE), []);
    expect(template?.category).toBe("SMM Project");
    expect(template?.phases[1].taskLists?.[0].defaultTasks[0].subtasks).toContain("Monthly Strategy Creation");
  });

  it("a saved template reloads into the board unchanged", () => {
    const { template } = buildTemplateFromDraft(draft(), []);
    const again = buildTemplateFromDraft(templateToDraft({ ...template!, id: "custom" }), []);
    expect(again.template).toEqual(template);
  });

  it("a new template starts with no lists, and new lists start with no cards", () => {
    expect(newTemplateDraft("SMM")).toMatchObject({ kind: "SMM", phases: [] });
    expect(newTemplatePhase("SMM", "Planning")).toMatchObject({ name: "Planning", tasks: [], departmentAlias: "smm@" });
    expect(newTemplateTask("DIGITAL", "Kickoff")).toMatchObject({ title: "Kickoff", departmentAlias: "digitalproducts@" });
  });
});

describe("template task defaults", () => {
  const withTask = (overrides: object) =>
    draft({
      phases: [
        {
          name: "Build",
          clientVisible: true,
          tasks: [{ ...newTemplateTask("DIGITAL", "Kickoff"), ...overrides }],
        },
      ],
    });
  const savedTask = (overrides: object) =>
    buildTemplateFromDraft(withTask(overrides), []).template?.phases[0].taskLists?.[0].defaultTasks[0];

  it("keeps the status, dates, owners and SOPs a new project's task starts with", () => {
    const saved = savedTask({
      status: "On Hold",
      startInDays: 1,
      dueInDays: 5,
      defaultOwners: [{ id: "u1", name: "Asha" }],
      sopChecklists: [{ id: "s1", name: "QA" }],
    });
    const tasks = scaffoldTasksFromTemplate(
      {
        id: "custom",
        name: "T",
        description: "",
        category: "Digital Project",
        phases: [
          { code: "P1", name: "Build", departmentAlias: "dev@", taskLists: [{ name: "Build", flag: "external", sequence: 1, defaultTasks: [saved!] }] },
        ],
      },
      "EEDP-1"
    );

    expect(tasks[0]).toMatchObject({
      status: "On Hold",
      defaultStartDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
      defaultDueDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
      defaultOwners: [{ id: "u1", name: "Asha" }],
      sopChecklists: [{ id: "s1", name: "QA" }],
    });
  });

  it("leaves a task with no defaults as it was: Open, unassigned, no dates", () => {
    const [task] = scaffoldTasksFromTemplate(SMM_PROJECT_TEMPLATE, "EEDP-1");
    expect(task.status).toBe("Open");
    expect(task).not.toHaveProperty("defaultStartDate");
    expect(task).not.toHaveProperty("defaultDueDate");
    expect(task).not.toHaveProperty("defaultOwners");
    expect(task).not.toHaveProperty("sopChecklists");
  });

  it("won't let a task start closed, and drops bad days", () => {
    const saved = savedTask({ status: "Done", startInDays: -2, dueInDays: 1.5 });
    expect(saved).not.toHaveProperty("status");
    expect(saved).not.toHaveProperty("startInDays");
    expect(saved).not.toHaveProperty("dueInDays");
  });

  it("drops malformed and repeated owners and SOPs", () => {
    const saved = savedTask({
      defaultOwners: [{ id: "u1", name: "Asha" }, { id: "u1", name: "Asha" }, { id: 5 }],
      sopChecklists: "nope",
    });
    expect(saved?.defaultOwners).toEqual([{ id: "u1", name: "Asha" }]);
    expect(saved).not.toHaveProperty("sopChecklists");
  });

  it("rejects a task due before it starts", () => {
    const { error } = buildTemplateFromDraft(withTask({ startInDays: 5, dueInDays: 2 }), []);
    expect(error).toContain("Kickoff");
  });

  it("only offers statuses a task can start in", () => {
    expect(TEMPLATE_STATUSES).toContain("On Hold");
    expect(TEMPLATE_STATUSES).not.toContain("Done");
  });
});

describe("editing a built-in template", () => {
  it("keeps its name and category whatever the draft says", () => {
    const edited = { ...templateToDraft(ECOMMERCE_PROJECT_TEMPLATE), name: "Renamed", kind: "SMM" as const };
    const { template } = buildTemplateFromDraft(edited, [], ECOMMERCE_PROJECT_TEMPLATE);
    expect(template?.name).toBe("Ecommerce");
    expect(template?.category).toBe(ECOMMERCE_PROJECT_TEMPLATE.category);
  });

  it("an unchanged SMM is still an SMM template with the same tasks", () => {
    const { template } = buildTemplateFromDraft(templateToDraft(SMM_PROJECT_TEMPLATE), [], SMM_PROJECT_TEMPLATE);
    const saved = { ...template!, id: SMM_PROJECT_TEMPLATE.id };
    expect(getTemplateKind(saved)).toBe("SMM");
    expect(scaffoldTasksFromTemplate(saved, "X").map((t) => t.title)).toEqual(
      scaffoldTasksFromTemplate(SMM_PROJECT_TEMPLATE, "X").map((t) => t.title)
    );
  });

  it("keeps the empty 7.1.1 Done list and all the task lists of Ecommerce", () => {
    const { template } = buildTemplateFromDraft(templateToDraft(ECOMMERCE_PROJECT_TEMPLATE), [], ECOMMERCE_PROJECT_TEMPLATE);
    const names = (t: { phases: { taskLists?: { name: string }[] }[] }) =>
      t.phases.flatMap((p) => (p.taskLists ?? []).map((l) => l.name));
    expect(names(template!)).toEqual(names(ECOMMERCE_PROJECT_TEMPLATE));
    expect(names(template!)).toContain("7.1.1 Done Maintenance & Support");
  });
});

describe("moveTemplateTask", () => {
  const task = (title: string) => newTemplateTask("DIGITAL", title);
  const lists = () => [
    { ...newTemplatePhase("DIGITAL", "A"), tasks: [task("a1"), task("a2"), task("a3")] },
    { ...newTemplatePhase("DIGITAL", "B"), tasks: [task("b1")] },
  ];
  const titles = (phases: ReturnType<typeof lists>) => phases.map((p) => p.tasks.map((t) => t.title));

  it("moves a card down within its list", () => {
    expect(titles(moveTemplateTask(lists(), { phaseIndex: 0, taskIndex: 0 }, { phaseIndex: 0, taskIndex: 2 }))).toEqual([
      ["a2", "a1", "a3"],
      ["b1"],
    ]);
  });

  it("moves a card up within its list", () => {
    expect(titles(moveTemplateTask(lists(), { phaseIndex: 0, taskIndex: 2 }, { phaseIndex: 0, taskIndex: 0 }))).toEqual([
      ["a3", "a1", "a2"],
      ["b1"],
    ]);
  });

  it("moves a card before a card in another list, or to the end of it", () => {
    expect(titles(moveTemplateTask(lists(), { phaseIndex: 0, taskIndex: 1 }, { phaseIndex: 1, taskIndex: 0 }))).toEqual([
      ["a1", "a3"],
      ["a2", "b1"],
    ]);
    expect(titles(moveTemplateTask(lists(), { phaseIndex: 0, taskIndex: 1 }, { phaseIndex: 1 }))).toEqual([
      ["a1", "a3"],
      ["b1", "a2"],
    ]);
  });
});
