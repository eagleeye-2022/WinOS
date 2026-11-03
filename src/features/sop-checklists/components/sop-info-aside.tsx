"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProjectPill, TaskIdChip } from "@/components/shared/task-table-parts";
import { projectTaskHref } from "@/lib/project-task-href";
import { getSopUsageAction } from "../actions/usage-actions";
import type { SopTemplate, SopUsageTask } from "../types";
import { sopPlaceLabel } from "../utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Right side of an open SOP: its details, and the tasks it's picked on (ⓘ opens the task). */
export function SopInfoAside({ template }: { template: SopTemplate }) {
  const [usage, setUsage] = useState<SopUsageTask[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSopUsageAction(template.id)
      .then((rows) => {
        if (!cancelled) setUsage(rows);
      })
      .catch((err) => {
        console.error("Failed to load where this SOP is used:", err);
        if (!cancelled) setUsage([]);
      });
    return () => {
      cancelled = true;
    };
  }, [template.id]);

  const byProject = useMemo(() => {
    const groups = new Map<string, SopUsageTask[]>();
    for (const u of usage ?? []) groups.set(u.projectName, [...(groups.get(u.projectName) ?? []), u]);
    return [...groups.entries()];
  }, [usage]);

  return (
    <aside className="hidden w-80 shrink-0 space-y-5 overflow-y-auto border-l p-4 text-xs lg:block">
      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">SOP info</h3>
        <dl className="space-y-1.5">
          <Row label="Department" value={sopPlaceLabel(template.department)} />
          <Row label="List" value={template.category} />
          <Row label="Version" value={`v${template.version}`} />
          <Row label="Checklist" value={template.items.length} />
          <Row label="Required" value={template.items.filter((i) => i.isRequired).length} />
          <Row label="Created by" value={template.createdByName ?? "—"} />
          <Row label="Last updated" value={new Date(template.updatedAt).toLocaleDateString([], { dateStyle: "medium" })} />
        </dl>
      </section>

      <section className="space-y-2 border-t pt-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Picked on tasks{usage ? ` (${usage.length})` : ""}
        </h3>
        {usage === null ? (
          <Loader2 size={16} className="animate-spin text-primary" />
        ) : usage.length === 0 ? (
          <p className="text-muted-foreground">Not picked on any task yet.</p>
        ) : (
          <div className="space-y-3">
            {byProject.map(([project, tasks]) => (
              <div key={project} className="space-y-1">
                <ProjectPill name={project} />
                <ul className="space-y-1">
                  {tasks.map((u) => {
                    const href = projectTaskHref(u.projectCode, u.taskCode);
                    return (
                      <li key={u.taskId} className="rounded-md border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <TaskIdChip code={u.taskCode} title={u.taskTitle} href={href ? `${href}?tab=checklist` : null} />
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-foreground">{u.taskTitle}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {u.status} · {u.done}/{u.total} done
                          {u.pickedByName && ` · by ${u.pickedByName}`}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
