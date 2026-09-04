"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import {
  getMyProjectsAction,
  getMyProjectCalendarEventsAction,
  MyProjectCalendarItem,
} from "../actions/project-actions";
import { Project } from "../types";
import { AllProjectsTableView } from "./views/all-projects-table-view";
import { CalendarMonthView } from "@/features/calendar/components/calendar-month-view";
import type { CalendarEventView } from "@/features/calendar/queries";

export function MyProjectsDashboardWorkspace() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [calendarItems, setCalendarItems] = useState<MyProjectCalendarItem[]>([]);
  const [anchorDate] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [fetchedProjects, fetchedCalendarItems] = await Promise.all([
          getMyProjectsAction(),
          getMyProjectCalendarEventsAction(),
        ]);
        setProjects(fetchedProjects);
        setCalendarItems(fetchedCalendarItems);
      } catch (err) {
        console.error("Failed to load my-projects dashboard data:", err);
        setError("Failed to connect to database. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const projectIdByEventId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of calendarItems) map.set(item.id, item.projectId);
    return map;
  }, [calendarItems]);

  const calendarEvents: CalendarEventView[] = useMemo(
    () =>
      calendarItems.map((item) => ({
        id: item.id,
        etag: 0,
        title: `${item.projectName}: ${item.taskTitle}`,
        description: "",
        start: item.dueDate,
        end: item.dueDate,
        isAllDay: true,
        attendees: [],
      })),
    [calendarItems]
  );

  function goToProject(projectId: string) {
    router.push(`/projects/${projectId}`);
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-3 bg-background">
        <Loader2 size={28} className="animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">
          Fetching your projects...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-2 bg-background text-destructive">
        <AlertCircle size={28} />
        <p className="text-sm font-semibold">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col gap-4 overflow-y-auto bg-background p-4">
      <div className="rounded-lg border border-border overflow-hidden" style={{ minHeight: 420 }}>
        <AllProjectsTableView
          projects={projects}
          onOpenAddModal={() => {}}
          userRole="TEAM_MEMBER"
        />
      </div>

      <div className="flex flex-col rounded-lg border border-border overflow-hidden" style={{ height: 640 }}>
        <div className="border-b border-border bg-card px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">My Project Calendar</h2>
          <p className="text-xs text-muted-foreground">
            Task due dates across the projects you&apos;re a member of.
          </p>
        </div>
        <CalendarMonthView
          anchorDate={anchorDate}
          events={calendarEvents}
          onSelectEvent={(event) => {
            const projectId = projectIdByEventId.get(event.id);
            if (projectId) goToProject(projectId);
          }}
          onSelectSlot={() => {}}
        />
      </div>
    </div>
  );
}
