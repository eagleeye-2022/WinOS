"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import { UserName } from "@/components/shared/user-card";
import React, { useState, useEffect } from "react";
import {
  UserPlus,
  Mail,
  Phone,
  CalendarDays,
  List,
} from "lucide-react";
import { StatusPill } from "@/components/pulse/pulse-ui";
import { PeriodNav, periodKind } from "@/components/shared/period-nav";
import { AttendanceRecord, ActionRequiredItem, EmployeeProfile, MonthlySummary } from "../types";
import { AttendanceWeekView } from "./attendance-week-view";
import { AttendanceMonthView } from "./attendance-month-view";
import { MonthlySummaryCard } from "./monthly-summary-card";
import { ActionRequiredSection } from "./action-required-section";
import { AttendanceDetailsDrawer } from "./attendance-details-drawer";
import { getMyAttendanceData } from "../queries/attendance-queries";
import {
  MONTH_NAMES,
  dateFromKey,
  formatShortDate,
  istDateKey,
  weekKeysFor,
} from "../utils";
import { cn } from "@/lib/utils";
import { usePageViewState } from "@/lib/navigation/use-url-state";

interface EmployeeAttendanceViewProps {
  employee: EmployeeProfile;
  onApplyRegularizationOnBehalf?: () => void;
  /** The page already shows who this is (per-employee header): skip the profile card. */
  hideProfile?: boolean;
}

export function EmployeeAttendanceView({
  employee,
  onApplyRegularizationOnBehalf,
  hideProfile = false,
}: EmployeeAttendanceViewProps) {
  const today = istDateKey();
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedRecordForDrawer, setSelectedRecordForDrawer] = usePageViewState<AttendanceRecord | null>("EmployeeAttendanceView:selectedRecordForDrawer", null);
  const [isDrawerOpen, setIsDrawerOpen] = usePageViewState("EmployeeAttendanceView:isDrawerOpen", false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord>>({});
  const [actionItems, setActionItems] = useState<ActionRequiredItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>({
    month: "",
    totalWorkingDays: 0,
    presentDays: 0,
    leavesTaken: 0,
    absentDays: 0,
  });

  const selected = dateFromKey(selectedDate)!;
  const monthIndex = selected.getUTCMonth();
  const year = selected.getUTCFullYear();

  useEffect(() => {
    let cancelled = false;
    getMyAttendanceData(monthIndex, year, employee.id)
      .then((data) => {
        if (cancelled) return;
        const map: Record<string, AttendanceRecord> = {};
        data.records.forEach((r) => {
          map[r.date] = r;
        });
        setRecordsMap(map);
        setActionItems(data.actionRequired);
        setMonthlySummary(data.summary);
        setLoadError(null);
      })
      .catch((err) => {
        console.error("Failed to load employee attendance data:", err);
        if (!cancelled) setLoadError("Couldn't load this team member's attendance.");
      });
    return () => {
      cancelled = true;
    };
  }, [employee.id, monthIndex, year]);

  const weekDates = weekKeysFor(selectedDate);
  const currentWeekRecords = weekDates.map((d) => recordsMap[d]).filter(Boolean);
  const monthLabel = `${MONTH_NAMES[monthIndex]} ${year}`;
  const weekLabel = `${formatShortDate(weekDates[0])} – ${formatShortDate(weekDates[6])}`;

  const handleOpenDrawer = (record: AttendanceRecord) => {
    setSelectedRecordForDrawer(record);
    setSelectedDate(record.date);
    setIsDrawerOpen(true);
  };

  // Managers fix a member's attendance through the on-behalf form, never the self-service modals.
  const handleRegularizeDay = () => {
    setIsDrawerOpen(false);
    onApplyRegularizationOnBehalf?.();
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Profile card */}
      {!hideProfile && (
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="h-14 bg-gradient-to-r from-blue-600 to-sky-500 dark:from-blue-700 dark:to-sky-700" />
        <div className="flex flex-col gap-4 px-5 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <UserAvatar
              userId={employee.id}
              name={employee.name}
              image={employee.avatarUrl}
              className="-mt-8 h-16 w-16 shrink-0 rounded-xl border-4 border-card bg-blue-50 text-base font-bold text-blue-700 shadow-sm dark:bg-blue-500/15 dark:text-blue-300"
            >
              {employee.name.slice(0, 2).toUpperCase()}
            </UserAvatar>
            <div className="min-w-0 space-y-1 pb-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  <UserName userId={employee.id} name={employee.name} />
                </h2>
                <StatusPill tone={employee.status === "ACTIVE" ? "green" : "gray"}>
                  {employee.status === "ACTIVE" ? "Active" : "Inactive"}
                </StatusPill>
              </div>
              <div className="text-xs text-muted-foreground">
                {employee.designation} • {employee.department}
                {/* Employee ID hidden for now: • ID: {employee.employeeId} */}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {employee.email && (
              <a
                href={`mailto:${employee.email}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {employee.email}
              </a>
            )}
            {employee.phone && employee.phone !== "—" && (
              <a
                href={`tel:${employee.phone}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {employee.phone}
              </a>
            )}
            <button
              onClick={onApplyRegularizationOnBehalf}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Regularize on Behalf
            </button>
          </div>
        </div>
      </section>
      )}

      {/* Toolbar: title, view switcher & date navigation */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Attendance Log</h2>
          <p className="text-xs text-muted-foreground">{viewMode === "week" ? weekLabel : monthLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-border/70 bg-muted/50 p-0.5">
            <button
              onClick={() => setViewMode("week")}
              title="List view"
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "week" ? "bg-card text-blue-600 shadow-xs dark:text-blue-400" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
              Week
            </button>
            <button
              onClick={() => setViewMode("month")}
              title="Calendar view"
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "month" ? "bg-card text-blue-600 shadow-xs dark:text-blue-400" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Month
            </button>
          </div>

          {/* A picked date opens its week; a picked month opens the month view. */}
          <PeriodNav
            modes={["day", "month"]}
            value={viewMode === "week" ? selectedDate : selectedDate.slice(0, 7)}
            stepDays={7}
            label={viewMode === "week" ? weekLabel : undefined}
            onChange={(period) => {
              if (periodKind(period) === "month") {
                setViewMode("month");
                setSelectedDate(today.slice(0, 7) === period ? today : `${period}-01`);
              } else {
                setViewMode("week");
                setSelectedDate(period);
              }
            }}
          />

          {selectedDate !== today && (
            <button
              onClick={() => setSelectedDate(today)}
              className="h-8 rounded-lg border border-border/80 bg-background px-3 text-xs font-semibold text-foreground hover:bg-accent"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {loadError}
        </div>
      )}

      {/* View Content */}
      {viewMode === "week" ? (
        <div className="space-y-4">
          <AttendanceWeekView
            records={currentWeekRecords}
            onSelectDay={handleOpenDrawer}
            onRegularize={handleRegularizeDay}
          />

          <MonthlySummaryCard summary={monthlySummary} selectedMonth={monthLabel} />

          <ActionRequiredSection
            items={actionItems}
            onRegularize={handleRegularizeDay}
            onApplyLeave={handleRegularizeDay}
          />
        </div>
      ) : (
        <AttendanceMonthView
          records={recordsMap}
          selectedDate={selectedDate}
          onSelectDate={handleOpenDrawer}
          monthIndex={monthIndex}
          year={year}
        />
      )}

      {/* Slide-over Drawer for Attendance Details */}
      <AttendanceDetailsDrawer
        record={selectedRecordForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRegularize={handleRegularizeDay}
      />
    </div>
  );
}
