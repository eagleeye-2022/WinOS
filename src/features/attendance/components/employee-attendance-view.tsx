"use client";

import React, { useState, useEffect } from "react";
import {
  UserPlus,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { AttendanceRecord, ActionRequiredItem, EmployeeProfile, MonthlySummary } from "../types";
import { AttendanceWeekView } from "./attendance-week-view";
import { AttendanceMonthView } from "./attendance-month-view";
import { MonthlySummaryCard } from "./monthly-summary-card";
import { ActionRequiredSection } from "./action-required-section";
import { AttendanceDetailsDrawer } from "./attendance-details-drawer";
import { RegularizeAttendanceModal } from "./regularize-attendance-modal";
import { ApplyLeaveModal } from "./apply-leave-modal";
import { CompensatoryRequestModal } from "./compensatory-request-modal";
import { getMyAttendanceData } from "../queries/attendance-queries";
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
  const [activeSubTab, setActiveSubTab] = useState<"team" | "regularization">("team");
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<string>("2026-08-12");
  const [selectedRecordForDrawer, setSelectedRecordForDrawer] = useState<AttendanceRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modals
  const [selectedActionItem, setSelectedActionItem] = useState<ActionRequiredItem | null>(null);
  const [isRegularizeModalOpen, setIsRegularizeModalOpen] = useState(false);
  const [isApplyLeaveModalOpen, setIsApplyLeaveModalOpen] = useState(false);
  const [isCompOffModalOpen, setIsCompOffModalOpen] = useState(false);
  const [selectedCompOffRecord, setSelectedCompOffRecord] = useState<AttendanceRecord | null>(null);

  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord>>({});
  const [actionItems, setActionItems] = useState<ActionRequiredItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>({
    month: "August 2026",
    totalWorkingDays: 22,
    presentDays: 20,
    leavesTaken: 1,
    absentDays: 1,
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyAttendanceData(7, 2026);
        const map: Record<string, AttendanceRecord> = {};
        data.records.forEach((r) => {
          map[r.date] = r;
        });
        setRecordsMap(map);
        setActionItems(data.actionRequired);
        setMonthlySummary(data.summary);
      } catch (err) {
        console.error("Failed to load employee attendance data:", err);
      }
    }
    load();
  }, [employee]);

  const weekDates = [
    "2026-08-12",
    "2026-08-13",
    "2026-08-14",
    "2026-08-15",
    "2026-08-16",
    "2026-08-17",
    "2026-08-18",
  ];
  const currentWeekRecords = weekDates.map((d) => recordsMap[d]).filter(Boolean);

  const handleOpenDrawer = (record: AttendanceRecord) => {
    setSelectedRecordForDrawer(record);
    setSelectedDate(record.date);
    setIsDrawerOpen(true);
  };

  const handleRegularizeDay = (record: AttendanceRecord) => {
    const item: ActionRequiredItem = {
      id: `act-${record.date}`,
      date: record.date,
      formattedDate: record.formattedDate,
      dayName: record.dayOfWeek,
      issue: record.actionRequiredReason || "Missing Check-out",
    };
    setSelectedActionItem(item);
    setIsRegularizeModalOpen(true);
  };

  const handleApplyLeaveDay = (record: AttendanceRecord) => {
    const item: ActionRequiredItem = {
      id: `act-${record.date}`,
      date: record.date,
      formattedDate: record.formattedDate,
      dayName: record.dayOfWeek,
      issue: "Apply leave for missing date",
    };
    setSelectedActionItem(item);
    setIsApplyLeaveModalOpen(true);
  };

  const handleRequestCompOff = (record: AttendanceRecord) => {
    setSelectedCompOffRecord(record);
    setIsCompOffModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Top Back & Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToTeam}
          className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Team Attendance</span>
        </button>

        <button
          onClick={onApplyRegularizationOnBehalf}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Regularize on Behalf</span>
        </button>
      </div>

      {/* Employee Profile Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={
              employee.avatarUrl ||
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
            }
            alt={employee.name}
            className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                {employee.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {employee.status}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {employee.designation} • ID: {employee.employeeId} • {employee.department}
            </div>
          </div>
        </div>

        {/* Contact Info Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`mailto:${employee.email}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span>{employee.email}</span>
          </a>
          <a
            href={`tel:${employee.phone}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-slate-500" />
            <span>{employee.phone}</span>
          </a>
        </div>
      </div>

      {/* Attendance View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Attendance Log
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Detailed attendance log and daily swipe entries for {employee.name}.
          </p>
        </div>

        {/* View Switcher & Date Nav */}
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === "week"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === "month"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              Month
            </button>
          </div>

          <button className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs">
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs">
            <span>{viewMode === "week" ? "12 Aug – 18 Aug 2026" : "August 2026"}</span>
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
          </button>

          <button className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* View Content */}
      {viewMode === "week" ? (
        <div className="space-y-6">
          <AttendanceWeekView
            records={currentWeekRecords}
            onSelectDay={handleOpenDrawer}
            onRegularize={handleRegularizeDay}
          />

          <MonthlySummaryCard
            summary={monthlySummary}
            selectedMonth="August 2026"
          />

          <ActionRequiredSection
            items={actionItems}
            onRegularize={(it) => {
              setSelectedActionItem(it);
              setIsRegularizeModalOpen(true);
            }}
            onApplyLeave={(it) => {
              setSelectedActionItem(it);
              setIsApplyLeaveModalOpen(true);
            }}
          />
        </div>
      ) : (
        <AttendanceMonthView
          records={recordsMap}
          selectedDate={selectedDate}
          onSelectDate={handleOpenDrawer}
        />
      )}

      {/* Slide-over Drawer for Attendance Details */}
      <AttendanceDetailsDrawer
        record={selectedRecordForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRegularize={handleRegularizeDay}
        onApplyLeave={handleApplyLeaveDay}
        onRequestCompOff={handleRequestCompOff}
      />

      {/* Regularize Modal */}
      <RegularizeAttendanceModal
        isOpen={isRegularizeModalOpen}
        onClose={() => setIsRegularizeModalOpen(false)}
        item={selectedActionItem}
        onSubmitSuccess={() => {
          if (selectedActionItem) {
            setActionItems((prev) =>
              prev.filter((it) => it.id !== selectedActionItem.id)
            );
          }
        }}
      />

      {/* Apply Leave Modal */}
      <ApplyLeaveModal
        isOpen={isApplyLeaveModalOpen}
        onClose={() => setIsApplyLeaveModalOpen(false)}
        item={selectedActionItem}
        onSubmitSuccess={() => {
          if (selectedActionItem) {
            setActionItems((prev) =>
              prev.filter((it) => it.id !== selectedActionItem.id)
            );
          }
        }}
      />

      {/* Compensatory Request Modal */}
      <CompensatoryRequestModal
        isOpen={isCompOffModalOpen}
        onClose={() => setIsCompOffModalOpen(false)}
        record={selectedCompOffRecord}
        onSubmitSuccess={() => {
          setIsCompOffModalOpen(false);
        }}
      />
    </div>
  );
}
