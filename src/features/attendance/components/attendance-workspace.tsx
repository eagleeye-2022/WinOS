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
import {
  MONTH_NAMES,
  addDaysToKey,
  dateFromKey,
  formatShortDate,
  istDateKey,
  weekKeysFor,
} from "../utils";
import { cn } from "@/lib/utils";
import { useModuleViewState, useUrlState } from "@/lib/navigation/use-url-state";

type MainTab = "my-attendance" | "team-attendance" | "regularization";
const MAIN_TABS = ["my-attendance", "team-attendance", "regularization"] as const;
const VIEW_MODES = ["week", "month"] as const;

const EMPTY_SUMMARY: MonthlySummary = {
  month: "",
  totalWorkingDays: 0,
  presentDays: 0,
  leavesTaken: 0,
  absentDays: 0,
};

interface AttendanceWorkspaceProps {
  /** Managers see Team Attendance and can review / regularize on behalf. */
  canManage?: boolean;
  currentUserId?: string;
}

export function AttendanceWorkspace({ canManage = false, currentUserId }: AttendanceWorkspaceProps) {
  const initialToday = istDateKey();
  const initialDate = dateFromKey(initialToday)!;
  // Tab + week/month in the URL; the open sub-view / selected member / request in the Pulse
  // navigation slice — so all of it is restored when coming back to the module.
  const [activeTab, setActiveTab] = useUrlState<MainTab>("tab", "my-attendance", {
    allowed: MAIN_TABS,
    history: "push",
  });
  const [viewMode, setViewMode] = useUrlState<"week" | "month">("view", "week", { allowed: VIEW_MODES });
  const [currentMonthIndex, setCurrentMonthIndex] = useState(initialDate.getUTCMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getUTCFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(initialToday);
  const [todayKey, setTodayKey] = useState<string>(initialToday);
  const [isPunching, setIsPunching] = useState(false);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [onBehalfEmployee, setOnBehalfEmployee] = useState<EmployeeProfile | null>(null);
  const [selectedRecordForDrawer, setSelectedRecordForDrawer] = useState<AttendanceRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Sub-pages for Regularization
  const [regularizationSubView, setRegularizationSubView] = useModuleViewState<"list" | "details" | "create">(
    "attendance:regularization-sub-view",
    "list"
  );
  const [selectedRequest, setSelectedRequest] = useModuleViewState<RegularizationRequest | null>(
    "attendance:selected-request",
    null
  );

  // Sub-pages for Team Attendance
  const [teamSubView, setTeamSubView] = useModuleViewState<"team-list" | "employee-view">(
    "attendance:team-sub-view",
    "team-list"
  );
  const [selectedEmployee, setSelectedEmployee] = useModuleViewState<EmployeeProfile | null>(
    "attendance:selected-employee",
    null
  );

  // Modals
  const [selectedActionItem, setSelectedActionItem] = useState<ActionRequiredItem | null>(null);
  const [isRegularizeModalOpen, setIsRegularizeModalOpen] = useState(false);
  const [isApplyLeaveModalOpen, setIsApplyLeaveModalOpen] = useState(false);
  const [isCompOffModalOpen, setIsCompOffModalOpen] = useState(false);
  const [selectedCompOffRecord, setSelectedCompOffRecord] = useState<AttendanceRecord | null>(null);

  // Data states
  const [recordsMap, setRecordsMap] = useState<Record<string, AttendanceRecord>>({});
  const [actionItems, setActionItems] = useState<ActionRequiredItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>(EMPTY_SUMMARY);
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
        setTodayKey(data.todayKey);
      } catch (err) {
        console.error("Failed to load attendance records:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  useEffect(() => {
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthIndex, currentYear]);

  useEffect(() => {
    if (!canManage && activeTab === "team-attendance") setActiveTab("my-attendance");
  }, [canManage, activeTab, setActiveTab]);

  // The week containing the selected date. The month payload is padded to whole weeks,
  // so edge weeks render fully.
  const weekDates = weekKeysFor(selectedDate);
  const currentWeekRecords = weekDates.map((d) => recordsMap[d]).filter(Boolean);
  const weekLabel =
    weekDates.length === 7 ? `${formatShortDate(weekDates[0])} – ${formatShortDate(weekDates[6])}` : "";

  /** Moves the selected date and keeps the loaded month in sync with it. */
  const goToDate = (key: string) => {
    const d = dateFromKey(key);
    if (!d) return;
    setSelectedDate(key);
    setCurrentMonthIndex(d.getUTCMonth());
    setCurrentYear(d.getUTCFullYear());
  };

  const handleOpenDrawer = (record: AttendanceRecord) => {
    setSelectedRecordForDrawer(record);
    setSelectedDate(record.date);
    setIsDrawerOpen(true);
  };

  const punch = async (run: () => Promise<{ success: boolean; message?: string }>) => {
    setIsPunching(true);
    setPunchError(null);
    try {
      const res = await run();
      if (!res.success) setPunchError(res.message || "Something went wrong. Please try again.");
      fetchAttendance();
    } catch (err) {
      console.error("Attendance punch error:", err);
      setPunchError("Something went wrong. Please try again.");
    } finally {
      setIsPunching(false);
    }
  };

  const handleCheckIn = (record: AttendanceRecord) =>
    punch(() => checkInAction({ workMode: record.workMode || "OFFICE", source: "Web" }));

  const handleCheckOut = () => punch(() => checkOutAction({ source: "Web" }));

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
      email: member.email || "",
      phone: "—",
    });
    setTeamSubView("employee-view");
  };

  const shiftMonth = (delta: number) => {
    const target = new Date(Date.UTC(currentYear, currentMonthIndex + delta, 1));
    const sameMonthAsToday = todayKey.slice(0, 7) === target.toISOString().slice(0, 7);
    goToDate(sameMonthAsToday ? todayKey : target.toISOString().slice(0, 10));
  };

  const handlePrev = () => (viewMode === "week" ? goToDate(addDaysToKey(selectedDate, -7)) : shiftMonth(-1));
  const handleNext = () => (viewMode === "week" ? goToDate(addDaysToKey(selectedDate, 7)) : shiftMonth(1));

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

          {canManage && (
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
          )}

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
                  onClick={handlePrev}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => goToDate(todayKey)}
                  title="Go to today"
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-xs"
                >
                  <span>
                    {viewMode === "week" ? weekLabel : `${MONTH_NAMES[currentMonthIndex]} ${currentYear}`}
                  </span>
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                </button>

                <button
                  onClick={handleNext}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-xs transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {punchError && (
              <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-700 dark:text-rose-300">
                {punchError}
              </div>
            )}

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
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  onRegularize={handleRegularizeDay}
                  todayKey={todayKey}
                  isPunching={isPunching}
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
                monthIndex={currentMonthIndex}
                year={currentYear}
              />
            )}
          </>
        )}

        {/* ── 2. TEAM ATTENDANCE TAB ────────────────────────────────────────── */}
        {activeTab === "team-attendance" && canManage && (
          <>
            {teamSubView === "team-list" ? (
              <TeamAttendanceView onViewEmployee={handleViewTeamMember} />
            ) : selectedEmployee ? (
              <EmployeeAttendanceView
                employee={selectedEmployee}
                onApplyRegularizationOnBehalf={() => {
                  setOnBehalfEmployee(selectedEmployee);
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
                onNewRequest={() => {
                  setOnBehalfEmployee(null);
                  setRegularizationSubView("create");
                }}
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
                canReview={canManage}
                currentUserId={currentUserId}
                onCancelRequest={() => {
                  fetchAttendance();
                  setRegularizationSubView("list");
                }}
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
                  setOnBehalfEmployee(null);
                  setRegularizationSubView("list");
                }}
                initialDate={addDaysToKey(todayKey, -1)}
                maxDate={todayKey}
                onBehalfOf={onBehalfEmployee}
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
