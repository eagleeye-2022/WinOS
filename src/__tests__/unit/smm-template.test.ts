import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SMM_PROJECT_TEMPLATE,
  scaffoldPhasesFromTemplate,
  scaffoldTasksFromTemplate,
} from "@/features/projects/data/sop-templates";

afterEach(() => {
  vi.useRealTimers();
});

describe("SMM project template", () => {
  it("has the six SMM lists in order", () => {
    expect(scaffoldPhasesFromTemplate(SMM_PROJECT_TEMPLATE).map((p) => p.name)).toEqual([
      "1.1 Project Setup & Deliverables",
      "2.1 Monthly Content Planning",
      "3.1 Content Shoot & Asset Collection",
      "4.1 Content Production",
      "5.1 Scheduling & Publishing",
      "6.1 Reporting & Analysis",
    ]);
  });

  it("names the monthly task after the month the project is created in, with its steps as subtasks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 27)); // October
    const tasks = scaffoldTasksFromTemplate(SMM_PROJECT_TEMPLATE, "SMM1");

    expect(tasks.filter((t) => t.phaseCode === "1.1").map((t) => t.title)).toEqual([
      "WhatsApp Group Creation",
      "Scope & Deliverables Setup",
      "Project Meeting",
      "Account & Access Setup",
    ]);
    expect(tasks.filter((t) => t.phaseCode === "1.1").every((t) => !t.subtaskTitles)).toBe(true);

    const planning = tasks.find((t) => t.phaseCode === "2.1");
    expect(planning?.title).toBe("October Month");
    expect(planning?.subtaskTitles).toEqual([
      "Monthly Strategy Creation",
      "Content Calendar Creation",
      "Content Brief Preparation",
      "Calendar Review & Approval",
    ]);
    expect(tasks.find((t) => t.phaseCode === "4.1")?.subtaskTitles).toEqual([
      "Post 01 Design",
      "Post 02 Design",
      "Post 03 Design",
    ]);
    expect(tasks.find((t) => t.phaseCode === "5.1")?.subtaskTitles?.[0]).toBe("Post 01 Publishing");
    expect(tasks.find((t) => t.phaseCode === "6.1")?.subtaskTitles).toHaveLength(4);
    expect(tasks.map((t) => t.code)).toEqual(Array.from({ length: 9 }, (_, i) => `SMM1-T${String(i + 1).padStart(2, "0")}`));
  });
});
