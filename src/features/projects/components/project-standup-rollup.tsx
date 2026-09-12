"use client";

import { useEffect, useState } from "react";
import { ClipboardList, AlertCircle, Calendar, User, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchProjectStandupRollupAction } from "@/features/dsm/actions/get-user-project-tasks";
import type { ProjectStandupRollupItem } from "@/features/dsm/queries";

export function ProjectStandupRollup({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ProjectStandupRollupItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchProjectStandupRollupAction(projectId)
      .then((res) => {
        if (mounted) {
          setItems(res || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="h-5 w-48 bg-muted animate-pulse rounded" />
        <div className="h-16 bg-muted/40 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardList size={15} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Standup & DSM Activity</h3>
            <p className="text-[11px] text-muted-foreground">Recent standup mentions & blockers for this project</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
          {items.length} Mention{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No standup tasks or blockers linked to this project in the past 7 days.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
          {items.map((item) => {
            const isBlocker = item.type === "BLOCKER";
            const formattedDate = new Date(item.date).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
            });

            return (
              <div
                key={item.id}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2.5 text-xs transition-colors",
                  isBlocker
                    ? "border-destructive/20 bg-destructive/5"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {item.user?.name ? item.user.name.charAt(0).toUpperCase() : "U"}
                    </span>
                    <span className="font-semibold text-xs">{item.user?.name || item.user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.taskCode && (
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-background border border-border">
                        [{item.taskCode}]
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar size={10} /> {formattedDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  {isBlocker ? (
                    <AlertCircle size={13} className="shrink-0 text-destructive mt-0.5" />
                  ) : (
                    <CheckCircle2
                      size={13}
                      className={cn("shrink-0 mt-0.5", item.isCompleted ? "text-success" : "text-primary")}
                    />
                  )}
                  <p className="text-xs text-foreground/90 font-normal leading-relaxed">{item.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
