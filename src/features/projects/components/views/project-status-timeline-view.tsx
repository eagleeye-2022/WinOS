"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  PlusCircle,
  Sparkles,
  History,
  ShieldCheck,
  Loader2,
  Filter,
} from "lucide-react";
import { ProjectTimelineEvent } from "../../types";
import { getProjectTimelineAction } from "../../actions/project-actions";

interface ProjectStatusTimelineViewProps {
  projectId: string;
  projectName?: string;
}

export function ProjectStatusTimelineView({ projectId, projectName }: ProjectStatusTimelineViewProps) {
  const [events, setEvents] = useState<ProjectTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("ALL");

  useEffect(() => {
    async function loadTimeline() {
      setIsLoading(true);
      try {
        const fetchedEvents = await getProjectTimelineAction(projectId);
        setEvents(fetchedEvents);
      } catch (err) {
        console.error("Failed to load project status timeline:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTimeline();
  }, [projectId]);

  const getBadgeIcon = (type: ProjectTimelineEvent["type"]) => {
    switch (type) {
      case "CREATED":
        return <PlusCircle size={16} className="text-emerald-500" />;
      case "UPDATED":
        return <History size={16} className="text-blue-500" />;
      case "STATUS_CHANGE":
        return <ShieldCheck size={16} className="text-purple-500" />;
      case "PHASE_COMPLETED":
        return <CheckCircle2 size={16} className="text-teal-500" />;
      case "TASK_ADDED":
        return <Sparkles size={16} className="text-indigo-500" />;
      case "DOCUMENT_UPLOADED":
        return <FileText size={16} className="text-amber-500" />;
      default:
        return <Clock size={16} className="text-muted-foreground" />;
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filterType === "ALL") return true;
    return ev.type === filterType;
  });

  return (
    <div className="flex flex-col h-full bg-background text-foreground p-6 space-y-6 overflow-y-auto font-sans text-xs">
      {/* Timeline Header */}
      <div className="flex items-center justify-between border-b pb-4 border-border">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <History size={18} className="text-primary" />
            Project Audit & Status Timeline
          </h2>
          {/* <p className="text-muted-foreground text-xs mt-0.5">
            Real-time audit log tracking when {projectName || projectId} was created, who created it, status updates, phase completions, and task activity.
          </p> */}
        </div>

        {/* Event Type Filter */}
        <div className="flex items-center gap-2 border rounded-lg bg-card p-1">
          <Filter size={14} className="text-muted-foreground ml-1.5" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-transparent font-semibold text-xs text-foreground outline-none cursor-pointer pr-2"
          >
            <option value="ALL" className="bg-card text-foreground">All Events</option>
            <option value="CREATED" className="bg-card text-foreground">Creation Events</option>
            <option value="UPDATED" className="bg-card text-foreground">Updates & Edits</option>
            <option value="PHASE_COMPLETED" className="bg-card text-foreground">Phase Completions</option>
            <option value="TASK_ADDED" className="bg-card text-foreground">Task Creations</option>
            <option value="DOCUMENT_UPLOADED" className="bg-card text-foreground">Document Uploads</option>
          </select>
        </div>
      </div>

      {/* Timeline Stream */}
      {isLoading ? (
        <div className="p-12 flex items-center justify-center space-y-2">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground space-y-2">
          <Clock size={36} className="mx-auto opacity-40" />
          <p className="font-semibold text-foreground">No status timeline events recorded.</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {filteredEvents.map((ev) => {
            const dateObj = new Date(ev.timestamp);
            const formattedDate = dateObj.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
            const formattedTime = dateObj.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={ev.id} className="relative group">
                {/* Timeline Dot Icon */}
                <div className="absolute -left-6 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border shadow-xs group-hover:scale-110 transition-transform">
                  {getBadgeIcon(ev.type)}
                </div>

                {/* Event Card */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-1.5 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{ev.title}</span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {ev.type.replace("_", " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-mono">
                      <Calendar size={12} />
                      <span>{formattedDate}</span>
                      <span>&bull;</span>
                      <Clock size={12} />
                      <span>{formattedTime}</span>
                    </div>
                  </div>

                  <p className="text-muted-foreground text-xs">{ev.description}</p>

                  <div className="flex items-center gap-2 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold ${ev.actorAvatarColor || "bg-primary text-primary-foreground"}`}>
                      {ev.actorName[0]?.toUpperCase()}
                    </div>
                    <span>By <strong className="text-foreground">{ev.actorName}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
