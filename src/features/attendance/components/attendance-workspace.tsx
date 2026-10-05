"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Timer,
  CheckCircle2,
  Users,
  Loader2,
} from "lucide-react";
import {
  AttendanceRecord,
  ActionRequiredItem,
  RegularizationRequest,
  TeamMemberAttendance,
  EmployeeProfile,
  MonthlySummary,
} from "../types";
import { AttendanceWeekView } from "./attendance-week-view";
import { AttendanceMonthView } from "./attendance-month-view";
import { MonthlySummaryCard } from "./monthly-summary-card";
import { ActionRequiredSection } from "./action-required-section";
import { AttendanceDetailsDrawer } from "./attendance-details-drawer";
import { RegularizeAttendanceModal } from "./regularize-attendance-modal";
import { ApplyLeaveModal } from "./apply-leave-modal";
import { CompensatoryRequestModal } from "./compensatory-request-modal";
import { RegularizationRequestsList } from "./regularization-requests-list";
import { RegularizationRequestDetails } from "./regularization-request-details";
import { RegularizeAttendanceFormPage } from "./regularize-attendance-form-page";
import { TeamAttendanceView } from "./team-attendance-view";
import { EmployeeAttendanceView } from "./employee-attendance-view";
import { getMyAttendanceData } from "../queries/attendance-queries";
import { checkInAction, checkOutAction } from "../actions/attendance-actions";
import { cn } from "@/lib/utils";

type MainTab = "my-attendance" | "team-attendance" | "regularization";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function AttendanceWorkspace() {
  const [activeTab, setActiveTab] = useState<MainTab>("my-attendance");
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentMonthIndex, setCurrentMonthIndex] = useState(7); // August
  const [currentYear, setCurrentYear] = useState(2026);
  const [selectedDate, setSelectedDate] = useState<string>("2026-08-12");
  const [selectedRecordForDrawer, setSelectedRecordForDrawer] = useState<AttendanceRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Sub-pages for Regularization
  const [regularizationSubView, setRegularizationSubView] = useState<"list" | "details" | "create">("list");
  const [selectedRequest, setSelectedRequest] = useState<RegularizationRequest | null>(null);

  // Sub-pages for Team Attendance
  const [teamSubView, setTeamSubView] = useState<"team-list" | "employee-view">("team-list");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);

  // Modals
  const [selectedActionItem, setSelectedActionItem] = useState<ActionRequiredItem | null>(null);
  const [isRegularizeModalOpen, setIsRegularizeModalOpen] = useState(false);
  const [isApplyLeaveModalOpen, setIsApplyLeaveModalOpen] = useState(false);
  const [isCompOffModalOpen, setIsCompOffModalOpen] = useState(false);
  const [selectedCompOffRecord, setSelectedCompOffRecord] = useState<AttendanceRecord | null>(null);

  // Data states
  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord>>({});
  const [actionItems, setActionItems] = useState<ActionRequiredItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>({
    month: "August 2026",
    totalWorkingDays: 22,
    presentDays: 20,
    leavesTaken: 1,
    absentDays: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchAttendance = () => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const data = await getMyAttendanceData(currentMonthIndex, currentYear);
        const map: Record<string, AttendanceRecord> = {};
        data.records.forEach((r) => {
          map[r.date] = r;
        });
        setRecordsMap(map);
        setActionItems(data.actionRequired);
        setMonthlySummary(data.summary);
      } catch (err) {
        console.error("Failed to load attendance records:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    fetchAttendance();
  }, [currentMonthIndex, currentYear]);

  // Week records (e.g. 12 Aug - 18 Aug 2026 or current active week)
  const weekDates = [
    `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}-12`,
    `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}-13`,
    `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}-14`,
    `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}-15`,
    `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}-16`,
    `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}-17`,
    `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}-18`,
  ];
  const currentWeekRecords = weekDates.map((d) => recordsMap[d]).filter(Boolean);

  const handleOpenDrawer = (record: AttendanceRecord) => {
    setSelectedRecordForDrawer(record);
    setSelectedDate(record.date);
    setIsDrawerOpen(true);
  };

  const handleCheckIn = async (record: AttendanceRecord) => {
    try {
      await checkInAction({
        workMode: record.workMode || "OFFICE",
        source: "Web",
        locationName: record.checkInLocation?.name || "Corporate Office HQ",
        address: record.checkInLocation?.address || "Building 4, Cyber City, Gurgaon",
      });
      fetchAttendance();
    } catch (err) {
      console.error("Check-in error:", err);
    }
  };

  const handleCheckOut = async (record: AttendanceRecord) => {
    try {
      await checkOutAction({
        source: "Web",
        locationName: record.checkOutLocation?.name || "Corporate Office HQ",
        address: record.checkOutLocation?.address || "Building 4, Cyber City, Gurgaon",
      });
      fetchAttendance();
    } catch (err) {
      console.error("Check-out error:", err);
    }
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

  const handleViewTeamMember = (member: TeamMemberAttendance) => {
    setSelectedEmployee({
      id: member.id,
      employeeId: member.employeeId,
      name: member.name,
      avatarUrl: member.avatarUrl,
      status: "ACTIVE",
      designation: member.designation,
      department: member.department,
      email: `${member.name.toLowerCase().replace(" ", ".")}@winos.com`,
      phone: "+91 98765 43210",
    });
    setTeamSubView("employee-view");
  };

  const handlePrevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonthIndex((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonthIndex((prev) => prev + 1);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-background/50 p-6 select-none">
      <div className="max-w-[1600px] w-full mx-auto space-y-6">
        {/* Top Main Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-8">
          <button
            onClick={() => setActiveTab("my-attendance")}
            className={cn(
              "pb-3 text-sm font-bold border-b-2 transition-colors relative",
              activeTab === "my-attendance"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            )}
          >
            Attendance Records
          </button>

          <button
            onClick={() => {
              setActiveTab("team-attendance");
              setTeamSubView("team-list");
            }}
            className={cn(
              "pb-3 text-sm font-semibold border-b-2 transition-colors relative",
              activeTab === "team-attendance"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            )}
          >
            Team Attendance
          </button>

          <button
            onClick={() => {
              setActiveTab("regularization");
              setRegularizationSubView("list");
            }}
            className={cn(
              "pb-3 text-sm font-semibold border-b-2 transition-colors relative",
              activeTab === "regularization"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            )}
          >
            Regularization Request
          </button>
        </div>

        {/* ── 1. MY ATTENDANCE TAB ────────────────────────────────────────── */}
        {activeTab === "my-attendance" && (
          <>
            {/* Header Row: Title & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  My Attendance
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Track your daily attendance and work hours
                </p>
              </div>

              {/* View Switcher & Date Navigation */}
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

                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs">
                  <span>
                    {viewMode === "week"
                      ? `12 Aug – 18 Aug ${currentYear}`
                      : `${MONTH_NAMES[currentMonthIndex]} ${currentYear}`}
                  </span>
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                </button>

                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* View Content */}
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-xs font-semibold">Loading attendance data...</span>
              </div>
            ) : viewMode === "week" ? (
              <div className="space-y-6">
                <AttendanceWeekView
                  records={currentWeekRecords}
                  onSelectDay={handleOpenDrawer}
                  onCheckOut={handleCheckOut}
                  onRegularize={handleRegularizeDay}
                />

                <MonthlySummaryCard
                  summary={monthlySummary}
                  selectedMonth={`${MONTH_NAMES[currentMonthIndex]} ${currentYear}`}
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
          </>
        )}

        {/* ── 2. TEAM ATTENDANCE TAB ────────────────────────────────────────── */}
        {activeTab === "team-attendance" && (
          <>
            {teamSubView === "team-list" ? (
              <TeamAttendanceView onViewEmployee={handleViewTeamMember} />
            ) : selectedEmployee ? (
              <EmployeeAttendanceView
                employee={selectedEmployee}
                onApplyRegularizationOnBehalf={() => {
                  setActiveTab("regularization");
                  setRegularizationSubView("create");
                }}
                onBackToTeam={() => setTeamSubView("team-list")}
              />
            ) : null}
          </>
        )}

        {/* ── 3. REGULARIZATION REQUEST TAB ─────────────────────────────────── */}
        {activeTab === "regularization" && (
          <>
            {regularizationSubView === "list" && (
              <RegularizationRequestsList
                onNewRequest={() => setRegularizationSubView("create")}
                onViewRequest={(req) => {
                  setSelectedRequest(req);
                  setRegularizationSubView("details");
                }}
              />
            )}

            {regularizationSubView === "details" && selectedRequest && (
              <RegularizationRequestDetails
                request={selectedRequest}
                onBack={() => setRegularizationSubView("list")}
                onCancelRequest={() => setRegularizationSubView("list")}
                onStatusUpdated={() => {
                  fetchAttendance();
                  setRegularizationSubView("list");
                }}
              />
            )}

            {regularizationSubView === "create" && (
              <RegularizeAttendanceFormPage
                onBack={() => setRegularizationSubView("list")}
                onSubmitSuccess={() => {
                  fetchAttendance();
                  setRegularizationSubView("list");
                }}
              />
            )}
          </>
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
            fetchAttendance();
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
            fetchAttendance();
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
            fetchAttendance();
            setIsCompOffModalOpen(false);
          }}
        />
      </div>
    </div>
  );
}
