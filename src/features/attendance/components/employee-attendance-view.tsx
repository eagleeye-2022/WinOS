"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import React, { useState, useEffect } from "react";
import {
  UserPlus,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AttendanceRecord, ActionRequiredItem, EmployeeProfile, MonthlySummary } from "../types";
import { AttendanceWeekView } from "./attendance-week-view";
import { AttendanceMonthView } from "./attendance-month-view";
import { MonthlySummaryCard } from "./monthly-summary-card";
import { ActionRequiredSection } from "./action-required-section";
import { AttendanceDetailsDrawer } from "./attendance-details-drawer";
import { getMyAttendanceData } from "../queries/attendance-queries";
import {
  MONTH_NAMES,
  addDaysToKey,
  dateFromKey,
  formatShortDate,
  istDateKey,
  weekKeysFor,
} from "../utils";
import { cn } from "@/lib/utils";

interface EmployeeAttendanceViewProps {
  employee: EmployeeProfile;
  onApplyRegularizationOnBehalf?: () => void;
  onBackToTeam?: () => void;
}

export function EmployeeAttendanceView({
  employee,
  onApplyRegularizationOnBehalf,
  onBackToTeam,
}: EmployeeAttendanceViewProps) {
  const today = istDateKey();
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedRecordForDrawer, setSelectedRecordForDrawer] = useState<AttendanceRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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
        if (!cancelled) setLoadError("Couldn't load this employee's attendance.");
      });
    return () => {
      cancelled = true;
    };
  }, [employee.id, monthIndex, year]);

  const weekDates = weekKeysFor(selectedDate);
  const currentWeekRecords = weekDates.map((d) => recordsMap[d]).filter(Boolean);
  const monthLabel = `${MONTH_NAMES[monthIndex]} ${year}`;
  const weekLabel = `${formatShortDate(weekDates[0])} – ${formatShortDate(weekDates[6])}`;

  const shift = (direction: 1 | -1) => {
    if (viewMode === "week") {
      setSelectedDate(addDaysToKey(selectedDate, 7 * direction));
    } else {
      setSelectedDate(new Date(Date.UTC(year, monthIndex + direction, 1)).toISOString().slice(0, 10));
    }
  };

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
    <div className="flex flex-col gap-6 w-full">
      {/* Top Back & Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToTeam}
          className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Team Attendance</span>
        </button>

        <button
          onClick={onApplyRegularizationOnBehalf}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Regularize on Behalf</span>
        </button>
      </div>

      {/* Employee Profile Banner */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <UserAvatar
            userId={employee.id}
            name={employee.name}
            image={employee.avatarUrl}
            className="w-14 h-14 bg-primary/10 text-primary dark:text-blue-300 border border-input text-base font-bold"
          >
            {employee.name.slice(0, 2).toUpperCase()}
          </UserAvatar>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-foreground">
                {employee.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {employee.status}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {employee.designation} • ID: {employee.employeeId} • {employee.department}
            </div>
          </div>
        </div>

        {/* Contact Info Pills */}
        <div className="flex flex-wrap items-center gap-3">
          {employee.email && (
            <a
              href={`mailto:${employee.email}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-input bg-muted/40 text-xs font-semibold text-foreground hover:bg-zinc-100 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{employee.email}</span>
            </a>
          )}
          {employee.phone && employee.phone !== "—" && (
            <a
              href={`tel:${employee.phone}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-input bg-muted/40 text-xs font-semibold text-foreground hover:bg-zinc-100 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{employee.phone}</span>
            </a>
          )}
        </div>
      </div>

      {/* Attendance View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            Attendance Log
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Detailed attendance log and daily swipe entries for {employee.name}.
          </p>
        </div>

        {/* View Switcher & Date Nav */}
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-muted border border-input/60">
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === "week"
                  ? "bg-card text-primary shadow-xs"
                  : "text-muted-foreground hover:text-zinc-900"
              )}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === "month"
                  ? "bg-card text-primary shadow-xs"
                  : "text-muted-foreground hover:text-zinc-900"
              )}
            >
              Month
            </button>
          </div>

          <button
            onClick={() => shift(-1)}
            className="p-2 rounded-xl border border-input bg-background text-muted-foreground hover:bg-accent shadow-xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedDate(today)}
            title="Go to today"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-input bg-background text-xs font-bold text-foreground shadow-xs"
          >
            <span>{viewMode === "week" ? weekLabel : monthLabel}</span>
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          <button
            onClick={() => shift(1)}
            className="p-2 rounded-xl border border-input bg-background text-muted-foreground hover:bg-accent shadow-xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-700 dark:text-rose-300">
          {loadError}
        </div>
      )}

      {/* View Content */}
      {viewMode === "week" ? (
        <div className="space-y-6">
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
