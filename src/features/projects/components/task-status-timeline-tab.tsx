"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  Calendar,
  History,
  Loader2,
  User,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { ProjectTimelineEvent } from "../types";
import { getTaskTimelineAction } from "../actions/project-actions";

interface TaskStatusTimelineTabProps {
  taskId: string;
}

export function TaskStatusTimelineTab({ taskId }: TaskStatusTimelineTabProps) {
  const [events, setEvents] = useState<ProjectTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTimeline() {
      setIsLoading(true);
      try {
        const fetchedEvents = await getTaskTimelineAction(taskId);
        setEvents(fetchedEvents);
      } catch (err) {
        console.error("Failed to load task status timeline:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTimeline();
  }, [taskId]);

  const formatTimelineHeaderTime = (isoString: string) => {
    const d = new Date(isoString);
    const now = new Date();

    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;

    const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    return `${dateStr}, ${timeStr}`;
  };

  const getBadgeIcon = (type: ProjectTimelineEvent["type"]) => {
    switch (type) {
      case "CREATED":
        return <PlusCircle size={15} className="text-emerald-500" />;
      case "UPDATED":
        return <History size={15} className="text-blue-500" />;
      case "STATUS_CHANGE":
        return <ShieldCheck size={15} className="text-purple-500" />;
      case "TASK_ADDED":
        return <Sparkles size={15} className="text-indigo-500" />;
      case "DOCUMENT_UPLOADED":
        return <FileText size={15} className="text-amber-500" />;
      default:
        return <Clock size={15} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="flex items-center justify-between pb-2 border-b border-border dark:border-neutral-800">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 dark:text-neutral-100">
          <History size={16} className="text-primary" />
          Task Activity & Status Timeline
        </h3>
        <span className="text-[11px] font-mono text-muted-foreground">
          Latest activity first &bull; Saved in Database
        </span>
      </div>

      {isLoading ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : events.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground space-y-1">
          <Clock size={32} className="mx-auto opacity-40" />
          <p className="font-semibold text-foreground">No timeline activity logged for this task.</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/70 dark:before:bg-neutral-800">
          {events.map((ev) => (
            <div key={ev.id} className="relative group">
              {/* Dot Icon */}
              <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-card border border-border shadow-2xs group-hover:scale-110 transition-transform dark:border-neutral-800 dark:bg-[#16181d]">
                {getBadgeIcon(ev.type)}
              </div>

              {/* Event Content */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-1 hover:border-primary/40 transition-colors dark:border-neutral-800 dark:bg-[#16181d]">
                {/* Header Time */}
                <div className="text-[11px] font-mono font-bold text-muted-foreground dark:text-neutral-400">
                  {formatTimelineHeaderTime(ev.timestamp)}
                </div>

                {/* Main Activity Text */}
                <div className="font-bold text-foreground text-xs dark:text-neutral-100">
                  {ev.title}
                </div>

                {/* Additional Description if distinct */}
                {ev.description && !ev.title.includes(ev.description) && (
                  <p className="text-[11px] text-muted-foreground dark:text-neutral-400">
                    {ev.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
