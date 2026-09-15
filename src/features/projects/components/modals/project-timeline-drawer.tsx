"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Clock,
  CheckCircle2,
  FileText,
  User,
  PlusCircle,
  History,
  ShieldCheck,
  Loader2,
  Search,
} from "lucide-react";
import { ProjectTimelineEvent } from "../../types";
import { getProjectTimelineAction } from "../../actions/project-actions";

interface ProjectTimelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projectCode?: string;
  projectName?: string;
}

const EVENT_DOT_COLOR: Record<ProjectTimelineEvent["type"], string> = {
  CREATED: "bg-emerald-500",
  UPDATED: "bg-blue-500",
  STATUS_CHANGE: "bg-purple-500",
  TASK_ADDED: "bg-indigo-500",
  PHASE_COMPLETED: "bg-teal-500",
  USER_ASSIGNED: "bg-cyan-500",
  DOCUMENT_UPLOADED: "bg-amber-500",
  ACTIVITY: "bg-blue-500",
};

function getEventIcon(type: ProjectTimelineEvent["type"]) {
  switch (type) {
    case "CREATED":
      return <PlusCircle size={13} className="text-white" />;
    case "USER_ASSIGNED":
      return <User size={13} className="text-white" />;
    case "STATUS_CHANGE":
      return <ShieldCheck size={13} className="text-white" />;
    case "PHASE_COMPLETED":
      return <CheckCircle2 size={13} className="text-white" />;
    case "TASK_ADDED":
      return <History size={13} className="text-white" />;
    case "DOCUMENT_UPLOADED":
      return <FileText size={13} className="text-white" />;
    default:
      return <Clock size={13} className="text-white" />;
  }
}

function formatTimelineValue(val?: string | null, maxLen = 45): string {
  if (!val) return "";
  const singleLine = val.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.slice(0, maxLen) + "…";
}

export function ProjectTimelineDrawer({
  isOpen,
  onClose,
  projectId,
  projectCode,
  projectName,
}: ProjectTimelineDrawerProps) {
  const [events, setEvents] = useState<ProjectTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen || !projectId) return;
    let cancelled = false;

    async function loadTimeline() {
      setIsLoading(true);
      try {
        const res = await getProjectTimelineAction(projectId as string);
        if (!cancelled) setEvents(res);
      } catch (err) {
        console.error("Failed to load project timeline:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId]);

  useEffect(() => {
    if (!isOpen) return;
    return () => setSearch("");
  }, [isOpen]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (ev) =>
        ev.title.toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q) ||
        ev.actorName.toLowerCase().includes(q) ||
        (ev.oldValue && ev.oldValue.toLowerCase().includes(q)) ||
        (ev.newValue && ev.newValue.toLowerCase().includes(q))
    );
  }, [events, search]);

  if (!isOpen || !projectId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end transition-opacity animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-md bg-background border-l shadow-2xl h-full flex flex-col z-10 transition-transform duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Project Activity</h3>
            {(projectCode || projectName) && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {projectCode ? `${projectCode} - ` : ""}
                {projectName || ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2 border-b">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, change, value..."
              className="w-full rounded-md border bg-muted/30 pl-8 pr-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 size={26} className="animate-spin text-primary" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground space-y-2">
              <Clock size={32} className="mx-auto opacity-40" />
              <p className="font-semibold text-foreground text-xs">
                {events.length === 0 ? "No activity recorded yet." : "No activity matches your search."}
              </p>
            </div>
          ) : (
            <div className="relative pl-5 space-y-5 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border">
              {filteredEvents.map((ev) => {
                const dateObj = new Date(ev.timestamp);
                const formattedDate = dateObj.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                const formattedTime = dateObj.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });

                return (
                  <div key={ev.id} className="relative">
                    <div
                      className={`absolute -left-5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background ${
                        EVENT_DOT_COLOR[ev.type] || "bg-blue-500"
                      }`}
                    >
                      {getEventIcon(ev.type)}
                    </div>

                    <div className="space-y-1">
                      {/* Date & Time header */}
                      <p className="text-[10px] text-muted-foreground font-medium">
                        {formattedDate} · {formattedTime}
                      </p>

                      {/* Change Title */}
                      <p className="text-xs font-semibold text-foreground leading-snug">
                        {ev.title}
                      </p>

                      {/* Value Diff (Previous value → New value) */}
                      {ev.oldValue && ev.newValue ? (
                        <div className="mt-1 flex items-center flex-wrap gap-1.5 text-xs">
                          <span
                            className="inline-block max-w-[160px] truncate rounded px-1.5 py-0.5 bg-muted text-muted-foreground font-mono line-through text-[11px] align-middle"
                            title={ev.oldValue}
                          >
                            {formatTimelineValue(ev.oldValue, 40)}
                          </span>
                          <span className="text-muted-foreground font-bold text-xs shrink-0">→</span>
                          <span
                            className="inline-block max-w-[160px] truncate rounded px-1.5 py-0.5 bg-primary/10 text-primary font-mono font-semibold text-[11px] align-middle"
                            title={ev.newValue}
                          >
                            {formatTimelineValue(ev.newValue, 40)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-3 break-words" title={ev.description}>
                          {ev.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
