import { describe, expect, it, vi } from "vitest";
import { NAT_TASK_LIST_NAME } from "@/features/dsm/utils";
import {
  ECOMMERCE_PROJECT_TEMPLATE,
  ENTERPRISE_PROJECT_TEMPLATE,
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
  flattenSubtasks,
  flattenSubtasksTree,
  getSubtaskAtPath,
  updateSubtaskAtPath,
  deleteSubtaskAtPath,
  duplicateSubtaskAtPath,
  updateTaskOrSubtask,
  getSubtaskBreadcrumbs,
  getTemplateKind,
  isBuiltInTemplate,
  isCustomTemplatePhaseCode,
  moveTemplateSubtask,
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

describe("Digital Project templates", () => {
  const tasks = scaffoldTasksFromTemplate(ENTERPRISE_PROJECT_TEMPLATE, "E");
  const titlesIn = (code: string) => tasks.filter((t) => t.phaseCode === code).map((t) => t.title);
  const task = (title: string) => tasks.find((t) => t.title === title);

  it("has the task lists in order, ending with the NAT list", () => {
    expect(ENTERPRISE_PROJECT_TEMPLATE.phases.map((p) => p.name)).toEqual([
      "1.1 Client Onboarding",
      "1.2 Requirement Collection & Documentation",
      "2.1 UX Research & Discovery",
      "2.2 Ideation & Conceptualization",
      "3.1 UI/UX Designing",
      "3.2 Graphic Designing",
      "3.3 Content Writing",
      "4.1 Development",
      "5.1 Testing",
      "6.1 Deployment and SEO",
      "7.1 Maintenance & Support",
      "7.2 MSO On-Page & Technical SEO",
      "7.3 MSO Off-Page",
      "7.4 MSO Content Marketing",
      "7.5 MSO Main",
      "7.6 MSO Local SEO",
      "7.7 MSO Performance Marketing",
      "Not Aligned Task (NAT)",
    ]);
  });

  it("names the NAT list exactly as DSM rows and timers look it up, with no number in front", () => {
    for (const template of [ECOMMERCE_PROJECT_TEMPLATE, ENTERPRISE_PROJECT_TEMPLATE]) {
      const last = template.phases.at(-1)!;
      expect(last.name).toBe(NAT_TASK_LIST_NAME);
      expect(last.taskLists?.map((l) => l.name)).toEqual([NAT_TASK_LIST_NAME]);
    }
    expect(ECOMMERCE_PROJECT_TEMPLATE.phases.at(-1)?.code).toBe("7.9");
    expect(ENTERPRISE_PROJECT_TEMPLATE.phases.at(-1)?.code).toBe("7.8");
    // A saved edit of the template keeps the name too.
    const { template } = buildTemplateFromDraft(templateToDraft(ENTERPRISE_PROJECT_TEMPLATE), [], ENTERPRISE_PROJECT_TEMPLATE);
    expect(template?.phases.at(-1)?.name).toBe(NAT_TASK_LIST_NAME);
  });

  it("has the 48 tasks and subtasks of the agreed list", () => {
    const subtaskCount = tasks.reduce((sum, t) => sum + (t.subtaskTitles?.length ?? 0), 0);
    expect(tasks).toHaveLength(34);
    expect(subtaskCount).toBe(14);
  });

  it("has the updated tasks in each list", () => {
    expect(titlesIn("1.1")).toEqual([
      "WhatsApp Group Creation",
      "Project Workplace Setup",
      "Project Meeting with Team",
      "Project Requirement and Expectation Collection from Client",
      "Roadmap & Deliverables Document",
      "Client Zoho Project Board Creation",
    ]);
    expect(titlesIn("3.2")).toEqual(["Logo Design", "Brand Guideline Design"]);
    expect(titlesIn("3.3")).toEqual(["Website Content"]);
    expect(titlesIn("6.1")).toEqual(["Website Live"]);
    expect(titlesIn("7.1")).toEqual(["Website & Server Maintenance"]);
    expect(titlesIn("7.2")).toEqual([]);
  });

  it("puts the subtasks under the right tasks", () => {
    expect(task("V1 Keyword Research by UI/UX")?.subtaskTitles).toEqual(["Keyword Research Document Creation", "User Research"]);
    expect(task("Competitor Analysis")?.subtaskTitles).toEqual(["User Research"]);
    expect(task("Wireframe Design")?.subtaskTitles).toEqual(["Low Fidelity Wireframes", "High Fidelity Wireframes"]);
    expect(task("Website Initialisation & Setup")?.subtaskTitles).toEqual(["Server Setup", "Follow Website Initialisation SOP"]);
    expect(task("Departmental Testing")?.subtaskTitles).toHaveLength(5);
  });

  it("keeps the details of tasks that already existed", () => {
    expect(task("WhatsApp Group Creation")).toMatchObject({ priority: "High", description: expect.stringContaining("WhatsApp") });
  });

  it("differs from Ecommerce only by Monthly Product Update in 7.x", () => {
    const ecommerceNames = ECOMMERCE_PROJECT_TEMPLATE.phases.map((p) => p.name);
    expect(ecommerceNames.slice(-9)).toEqual([
      "7.1 Maintenance & Support",
      "7.2 Monthly Product Update",
      "7.3 MSO On-Page & Technical SEO",
      "7.4 MSO Off-Page",
      "7.5 MSO Content Marketing",
      "7.6 MSO Main",
      "7.7 MSO Local SEO",
      "7.8 MSO Performance Marketing",
      "Not Aligned Task (NAT)",
    ]);
    expect(ecommerceNames).toHaveLength(19);
    expect(ecommerceNames.slice(0, 10)).toEqual(ENTERPRISE_PROJECT_TEMPLATE.phases.slice(0, 10).map((p) => p.name));
    expect(
      scaffoldTasksFromTemplate(ECOMMERCE_PROJECT_TEMPLATE, "E").map((t) => [t.title, t.subtaskTitles])
    ).toEqual(tasks.map((t) => [t.title, t.subtaskTitles]));
  });

  it("can be edited and saved on the board with its subtasks intact", () => {
    const { template } = buildTemplateFromDraft(templateToDraft(ENTERPRISE_PROJECT_TEMPLATE), [], ENTERPRISE_PROJECT_TEMPLATE);
    const saved = scaffoldTasksFromTemplate({ ...template!, id: ENTERPRISE_PROJECT_TEMPLATE.id }, "E");
    expect(saved.map((t) => [t.title, t.subtaskTitles])).toEqual(tasks.map((t) => [t.title, t.subtaskTitles]));
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

describe("moveTemplateSubtask", () => {
  const lists = () => [
    {
      ...newTemplatePhase("DIGITAL", "A"),
      tasks: [
        { ...newTemplateTask("DIGITAL", "a1"), subtasks: ["s1", "s2"] },
        newTemplateTask("DIGITAL", "a2"),
      ],
    },
    { ...newTemplatePhase("DIGITAL", "B"), tasks: [{ ...newTemplateTask("DIGITAL", "b1"), subtasks: ["s3"] }] },
  ];

  it("moves a subtask to the end of a task in the same or another list", () => {
    const same = moveTemplateSubtask(lists(), { phaseIndex: 0, taskIndex: 0, subtaskPath: [0] }, { phaseIndex: 0, taskIndex: 1 });
    expect(same[0].tasks.map((t) => t.subtasks)).toEqual([["s2"], ["s1"]]);

    const other = moveTemplateSubtask(lists(), { phaseIndex: 0, taskIndex: 0, subtaskPath: [1] }, { phaseIndex: 1, taskIndex: 0 });
    expect(other[0].tasks[0].subtasks).toEqual(["s1"]);
    expect(other[1].tasks[0].subtasks).toEqual(["s3", "s2"]);
  });

  it("changes nothing for its own task or a target that doesn't exist", () => {
    const phases = lists();
    expect(moveTemplateSubtask(phases, { phaseIndex: 0, taskIndex: 0, subtaskPath: [0] }, { phaseIndex: 0, taskIndex: 0 })).toBe(phases);
    expect(moveTemplateSubtask(phases, { phaseIndex: 0, taskIndex: 0, subtaskPath: [0] }, { phaseIndex: 5, taskIndex: 0 })).toBe(phases);
    expect(moveTemplateSubtask(phases, { phaseIndex: 0, taskIndex: 0, subtaskPath: [9] }, { phaseIndex: 1, taskIndex: 0 })).toBe(phases);
  });

  const nested = () => [
    {
      ...newTemplatePhase("DIGITAL", "A"),
      tasks: [
        { ...newTemplateTask("DIGITAL", "a1"), subtasks: [{ title: "s1", subtasks: [{ title: "s1.1", subtasks: ["deep"] }, "s1.2"] }] },
        newTemplateTask("DIGITAL", "a2"),
      ],
    },
  ];

  it("moves a nested subtask with its own subtasks to another task", () => {
    const moved = moveTemplateSubtask(nested(), { phaseIndex: 0, taskIndex: 0, subtaskPath: [0, 0] }, { phaseIndex: 0, taskIndex: 1 });
    expect(moved[0].tasks[0].subtasks).toEqual([{ title: "s1", subtasks: ["s1.2"] }]);
    expect(moved[0].tasks[1].subtasks).toEqual([{ title: "s1.1", subtasks: ["deep"] }]);
  });

  it("moves a nested subtask up to sit directly under its own task", () => {
    const moved = moveTemplateSubtask(nested(), { phaseIndex: 0, taskIndex: 0, subtaskPath: [0, 1] }, { phaseIndex: 0, taskIndex: 0 });
    expect(moved[0].tasks[0].subtasks).toEqual([{ title: "s1", subtasks: [{ title: "s1.1", subtasks: ["deep"] }] }, "s1.2"]);
  });

  it("turns a subtask back into a plain name when its last child leaves", () => {
    const moved = moveTemplateSubtask(
      [{ ...newTemplatePhase("DIGITAL", "A"), tasks: [{ ...newTemplateTask("DIGITAL", "a1"), subtasks: [{ title: "s1", subtasks: ["only"] }] }, newTemplateTask("DIGITAL", "a2")] }],
      { phaseIndex: 0, taskIndex: 0, subtaskPath: [0, 0] },
      { phaseIndex: 0, taskIndex: 1 }
    );
    expect(moved[0].tasks[0].subtasks).toEqual(["s1"]);
  });
});

describe("nested template subtasks", () => {
  const seed = {
    ...newTemplateTask("DIGITAL", "Kickoff"),
    subtasks: [" Plan ", { title: " {MONTH} Review ", subtasks: [{ title: "Notes", subtasks: ["Share "] }, "  "] }, { title: "  ", subtasks: ["lost"] }],
  };
  const { template } = buildTemplateFromDraft(draft({ phases: [{ name: "Build", clientVisible: true, tasks: [seed] }] }), []);
  const saved = template!.phases[0].taskLists![0].defaultTasks[0];

  it("are saved trimmed at every depth, dropping blanks and anything under them", () => {
    expect(saved.subtasks).toEqual(["Plan", { title: "{MONTH} Review", subtasks: [{ title: "Notes", subtasks: ["Share"] }] }]);
  });

  it("survive reloading into the board and saving again", () => {
    const again = buildTemplateFromDraft(templateToDraft({ ...template!, id: "custom" }), []);
    expect(again.template).toEqual(template);
  });

  it("reach a new project's tasks with the month filled in at every depth", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 27));
    const [task] = scaffoldTasksFromTemplate({ ...template!, id: "custom" }, "EEDP-1");
    vi.useRealTimers();
    expect(task.subtaskTitles).toEqual(["Plan", "October Review"]);
    expect(task.subtaskSeeds).toEqual(["Plan", { title: "October Review", subtasks: [{ title: "Notes", subtasks: ["Share"] }] }]);
  });

  it("are numbered like a project's, depth by depth", () => {
    expect(flattenSubtasks(saved.subtasks!, "T01")).toEqual([
      { code: "T01.1", title: "Plan", depth: 0 },
      { code: "T01.2", title: "{MONTH} Review", depth: 0 },
      { code: "T01.2.1", title: "Notes", depth: 1 },
      { code: "T01.2.1.1", title: "Share", depth: 2 },
    ]);
  });

  it("leave older templates with plain subtask names as they were", () => {
    const [, month] = scaffoldTasksFromTemplate(SMM_PROJECT_TEMPLATE, "S").filter((t) => t.subtaskSeeds);
    expect(month.subtaskSeeds?.every((s) => typeof s === "string")).toBe(true);
    expect(month.subtaskSeeds).toEqual(month.subtaskTitles);
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

describe("nested template subtasks and path operations", () => {
  it("traverses nested subtasks at any depth and returns them", () => {
    const subtasks = [
      {
        title: "Setup Database",
        subtasks: [
          {
            title: "Run Migrations",
            subtasks: ["Seed admin user", "Verify indices"],
          },
          "Backup schema",
        ],
      },
      "Deploy App",
    ];

    expect(getSubtaskAtPath(subtasks, [0])).toMatchObject({ title: "Setup Database" });
    expect(getSubtaskAtPath(subtasks, [0, 0])).toMatchObject({ title: "Run Migrations" });
    expect(getSubtaskAtPath(subtasks, [0, 0, 0])).toBe("Seed admin user");
    expect(getSubtaskAtPath(subtasks, [0, 0, 1])).toBe("Verify indices");
    expect(getSubtaskAtPath(subtasks, [0, 1])).toBe("Backup schema");
    expect(getSubtaskAtPath(subtasks, [1])).toBe("Deploy App");
    expect(getSubtaskAtPath(subtasks, [99])).toBeUndefined();
  });

  it("updates a nested subtask without mutating siblings", () => {
    const initial = [
      {
        title: "Setup Database",
        subtasks: ["Run Migrations", "Backup schema"],
      },
    ];

    const updated = updateSubtaskAtPath(initial, [0, 0], (s) => ({
      title: typeof s === "string" ? s : s.title,
      description: "Migration details",
      status: "In Progress",
    }));

    const target = getSubtaskAtPath(updated, [0, 0]);
    expect(target).toMatchObject({
      title: "Run Migrations",
      description: "Migration details",
      status: "In Progress",
    });
    expect(getSubtaskAtPath(updated, [0, 1])).toBe("Backup schema");
  });

  it("deletes a nested subtask cleanly", () => {
    const initial = [
      {
        title: "Setup Database",
        subtasks: ["Run Migrations", "Backup schema"],
      },
    ];

    const updated = deleteSubtaskAtPath(initial, [0, 0]);
    expect(getSubtaskAtPath(updated, [0])).toMatchObject({
      title: "Setup Database",
      subtasks: ["Backup schema"],
    });
  });

  it("builds correct breadcrumbs for deeply nested subtasks", () => {
    const task = {
      title: "Main Task",
      duration: "1 day",
      priority: "Medium" as const,
      departmentAlias: "dev@",
      subtasks: [
        {
          title: "Subtask 1",
          subtasks: [
            {
              title: "Subtask 1.1",
              subtasks: ["Subtask 1.1.1"],
            },
          ],
        },
      ],
    };

    const breadcrumbs = getSubtaskBreadcrumbs(task, "T01", [0, 0, 0]);
    expect(breadcrumbs).toEqual([
      { code: "T01", title: "Main Task", path: [] },
      { code: "T01.1", title: "Subtask 1", path: [0] },
      { code: "T01.1.1", title: "Subtask 1.1", path: [0, 0] },
      { code: "T01.1.1.1", title: "Subtask 1.1.1", path: [0, 0, 0] },
    ]);
  });

  it("flattens subtask tree with paths and depth", () => {
    const subtasks = [
      {
        title: "Parent",
        subtasks: [
          {
            title: "Child",
            subtasks: ["Grandchild"],
          },
        ],
      },
    ];
    const tree = flattenSubtasksTree(subtasks, "T01");
    expect(tree).toEqual([
      {
        code: "T01.1",
        title: "Parent",
        depth: 0,
        path: [0],
        seed: subtasks[0],
      },
      {
        code: "T01.1.1",
        title: "Child",
        depth: 1,
        path: [0, 0],
        seed: (subtasks[0] as any).subtasks[0],
      },
      {
        code: "T01.1.1.1",
        title: "Grandchild",
        depth: 2,
        path: [0, 0, 0],
        seed: "Grandchild",
      },
    ]);
  });

  it("updates root task or nested subtask with updateTaskOrSubtask", () => {
    const task = {
      title: "Root Task",
      duration: "1 day",
      priority: "Medium" as const,
      departmentAlias: "dev@",
      subtasks: [
        {
          title: "Sub 1",
          subtasks: ["Sub 1.1"],
        },
      ],
    };

    const rootUpdated = updateTaskOrSubtask(task, undefined, { title: "Renamed Root" });
    expect(rootUpdated.title).toBe("Renamed Root");

    const subUpdated = updateTaskOrSubtask(task, [0, 0], {
      title: "Renamed Sub 1.1",
      description: "My deep description",
      status: "In Progress",
      startDate: "2026-08-01",
      dueDate: "2026-08-05",
      priority: "High",
      duration: "4 days",
    });
    expect(getSubtaskAtPath(subUpdated.subtasks!, [0, 0])).toMatchObject({
      title: "Renamed Sub 1.1",
      description: "My deep description",
      status: "In Progress",
      startDate: "2026-08-01",
      dueDate: "2026-08-05",
      priority: "High",
      duration: "4 days",
    });
  });

  it("duplicates a subtask at arbitrary path", () => {
    const subtasks = [
      {
        title: "Parent",
        subtasks: ["Child 1", "Child 2"],
      },
    ];

    const duplicated = duplicateSubtaskAtPath(subtasks, [0, 0]);
    expect(getSubtaskAtPath(duplicated, [0])).toMatchObject({
      title: "Parent",
      subtasks: ["Child 1", "Child 1 (Copy)", "Child 2"],
    });
  });

  it("preserves task information fields (startDate, dueDate, priority, duration) on delete and clean", () => {
    const subtasks = [
      {
        title: "Parent",
        startDate: "2026-08-01",
        dueDate: "2026-08-10",
        priority: "Urgent" as const,
        duration: "9 days",
        subtasks: ["Child 1", "Child 2"],
      },
    ];

    const updated = deleteSubtaskAtPath(subtasks, [0, 1]);
    const parent = getSubtaskAtPath(updated, [0]) as any;
    expect(parent.title).toBe("Parent");
    expect(parent.startDate).toBe("2026-08-01");
    expect(parent.dueDate).toBe("2026-08-10");
    expect(parent.priority).toBe("Urgent");
    expect(parent.duration).toBe("9 days");
    expect(parent.subtasks).toEqual(["Child 1"]);
  });
});

