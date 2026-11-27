"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  List,
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
import { CheckInCaptureModal } from "./check-in-capture-modal";
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
import { PeriodNav, periodKind } from "@/components/shared/period-nav";
import { PulsePage, PulseStickyTabs, PulseTabs } from "@/components/pulse/pulse-ui";
import { usePulseCrumbs } from "@/components/pulse/pulse-breadcrumbs";
import { useModuleViewState, useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";

type MainTab = "my-attendance" | "team-attendance" | "regularization";
const MAIN_TABS = ["my-attendance", "team-attendance", "regularization"] as const;
/**
 * Which tabs a page shows: My Attendance never shows the team tab and Team Attendance never shows
 * the personal one (each has its own sidebar item). Regularization is on both — it lists the
 * person's own requests and, for managers, the team's to approve.
 */
const TABS_FOR_VIEW = {
  my: ["my-attendance", "regularization"],
  team: ["team-attendance", "regularization"],
  all: MAIN_TABS,
} as const satisfies Record<string, readonly MainTab[]>;
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
  /** Tab this route opens on (Team Attendance and Regularization are separate sidebar links). */
  initialTab?: MainTab;
  /** "my" (My Attendance) hides the team tab, "team" (Team Attendance) hides the personal one. */
  view?: keyof typeof TABS_FOR_VIEW;
  /** Shown as a tab inside another page (the profile): no page frame, no sticky tabs, no breadcrumb. */
  embedded?: boolean;
}

export function AttendanceWorkspace({
  canManage = false,
  currentUserId,
  initialTab = "my-attendance",
  view = "all",
  embedded = false,
}: AttendanceWorkspaceProps) {
  const router = useRouter();
  const initialToday = istDateKey();
  const initialDate = dateFromKey(initialToday)!;
  const shownTabs: readonly MainTab[] = TABS_FOR_VIEW[view];
  // Tab + week/month in the URL; the open sub-view / selected member / request in the Pulse
  // navigation slice — so all of it is restored when coming back to the module. A tab this page
  // doesn't show (e.g. ?tab=my-attendance on Team Attendance) falls back to the page's own tab.
  const [activeTab, setActiveTab] = useUrlState<MainTab>("tab", initialTab, {
    allowed: shownTabs,
    history: "push",
  });
  const [viewMode, setViewMode] = useUrlState<"week" | "month">("view", "week", { allowed: VIEW_MODES });
  const [currentMonthIndex, setCurrentMonthIndex] = useState(initialDate.getUTCMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getUTCFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(initialToday);
  const [todayKey, setTodayKey] = useState<string>(initialToday);
  const [punchError, setPunchError] = useState<string | null>(null);
  /** The day being checked into while the capture modal is open. */
  const [checkInRecord, setCheckInRecord] = useState<AttendanceRecord | null>(null);
  const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
  const [onBehalfEmployee, setOnBehalfEmployee] = useState<EmployeeProfile | null>(null);
  const [selectedRecordForDrawer, setSelectedRecordForDrawer] = usePageViewState<AttendanceRecord | null>("AttendanceWorkspace:selectedRecordForDrawer", null);
  const [isDrawerOpen, setIsDrawerOpen] = usePageViewState("AttendanceWorkspace:isDrawerOpen", false);

  // Sub-pages for Regularization — remembered per page (My / Team Attendance), so a team member's
  // request opened on Team Attendance never reopens under My Attendance.
  const [regularizationSubView, setRegularizationSubView] = useModuleViewState<"list" | "details" | "create">(
    `attendance:${view}:regularization-sub-view`,
    "list"
  );
  const [selectedRequest, setSelectedRequest] = useModuleViewState<RegularizationRequest | null>(
    `attendance:${view}:selected-request`,
    null
  );

  // Sub-pages for Team Attendance
  const [teamSubView, setTeamSubView] = useModuleViewState<"team-list" | "employee-view">(
    "attendance:team-sub-view",
    "team-list"
  );
  // Team members now open on their own page; this only restores an older in-page view.
  const [selectedEmployee] = useModuleViewState<EmployeeProfile | null>(
    "attendance:selected-employee",
    null
  );

  // Modals
  const [selectedActionItem, setSelectedActionItem] = usePageViewState<ActionRequiredItem | null>("AttendanceWorkspace:selectedActionItem", null);
  const [isRegularizeModalOpen, setIsRegularizeModalOpen] = usePageViewState("AttendanceWorkspace:isRegularizeModalOpen", false);
  const [isApplyLeaveModalOpen, setIsApplyLeaveModalOpen] = usePageViewState("AttendanceWorkspace:isApplyLeaveModalOpen", false);
  const [isCompOffModalOpen, setIsCompOffModalOpen] = usePageViewState("AttendanceWorkspace:isCompOffModalOpen", false);
  const [selectedCompOffRecord, setSelectedCompOffRecord] = usePageViewState<AttendanceRecord | null>("AttendanceWorkspace:selectedCompOffRecord", null);

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


  // Check-in needs a selfie and the GPS location, so it goes through the capture modal.
  const handleCheckIn = (record: AttendanceRecord) => setCheckInRecord(record);

  // Check-out also needs a selfie and the GPS location.
  const handleCheckOut = () => setIsCheckOutOpen(true);

  const handleRegularizeDay = (record: AttendanceRecord) => {
    const item: ActionRequiredItem = {
      id: `act-${record.date}`,
      date: record.date,
      formattedDate: record.formattedDate,
      dayName: record.dayOfWeek,
      // Describe what's actually missing, so the reason defaults correctly.
      issue:
        record.actionRequiredReason ||
        (record.checkInTime && !record.checkOutTime ? "Missing Check-out" : "Missing Check-in & Check-out"),
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

  // A team member opens on their own page (attendance + a link to their leave), like Zoho People.
  const handleViewTeamMember = (member: TeamMemberAttendance) => {
    router.push(`/pulse/team-attendance/${member.id}`);
  };

  // Breadcrumb steps after "Pulse › Attendance": the tab, then the member / request being viewed.
  const TAB_LABEL: Record<MainTab, string> = {
    "my-attendance": "Attendance Records",
    "team-attendance": "Team Attendance",
    regularization: "Regularization Request",
  };
  usePulseCrumbs(embedded ? null : [
    {
      label: TAB_LABEL[activeTab],
      onClick: () => {
        if (activeTab === "team-attendance") setTeamSubView("team-list");
        if (activeTab === "regularization") setRegularizationSubView("list");
        setActiveTab(activeTab);
      },
    },
    ...(activeTab === "team-attendance" && teamSubView === "employee-view" && selectedEmployee
      ? [{ label: selectedEmployee.name }]
      : []),
    ...(activeTab === "regularization" && regularizationSubView === "details" ? [{ label: "Request Details" }] : []),
    ...(activeTab === "regularization" && regularizationSubView === "create"
      ? [{ label: onBehalfEmployee ? `Regularize for ${onBehalfEmployee.name}` : "New Request" }]
      : []),
  ]);

  // Embedded: the host page already scrolls and has its own background and padding.
  const Frame = embedded ? EmbeddedFrame : PulsePage;
  const Tabs = embedded ? PulseTabs : PulseStickyTabs;

  return (
    <Frame className="select-none p-4 sm:p-6">
      <div className="max-w-[1600px] w-full mx-auto space-y-4">
        {/* Top Main Navigation Tabs — sticky (not fixed): pinned to the top while this page scrolls. */}
        <Tabs
          tabs={[
            ...(shownTabs.includes("my-attendance")
              ? [{ label: "Attendance Records", active: activeTab === "my-attendance", onClick: () => setActiveTab("my-attendance") }]
              : []),
            ...(canManage && shownTabs.includes("team-attendance")
              ? [
                  {
                    label: "Team Attendance",
                    active: activeTab === "team-attendance",
                    onClick: () => {
                      setActiveTab("team-attendance");
                      setTeamSubView("team-list");
                    },
                  },
                ]
              : []),
            {
              label: "Regularization Request",
              active: activeTab === "regularization",
              onClick: () => {
                setActiveTab("regularization");
                setRegularizationSubView("list");
              },
            },
          ]}
        />

        {/* ── 1. MY ATTENDANCE TAB ────────────────────────────────────────── */}
        {activeTab === "my-attendance" && (
          <>
            {/* Toolbar: title, view switcher & date navigation */}
            <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold text-foreground">My Attendance</h1>
                <p className="text-xs text-muted-foreground">
                  {viewMode === "week" ? weekLabel : `${MONTH_NAMES[currentMonthIndex]} ${currentYear}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-md border border-border/70 bg-muted/50 p-0.5">
                  <button
                    onClick={() => setViewMode("week")}
                    title="List view"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors",
                      viewMode === "week"
                        ? "bg-card text-blue-600 shadow-xs dark:text-blue-400"
                        : "text-muted-foreground hover:text-foreground"
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
                      viewMode === "month"
                        ? "bg-card text-blue-600 shadow-xs dark:text-blue-400"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Month
                  </button>
                </div>

                {/* A picked date opens its week; a picked month opens the month view. */}
                <PeriodNav
                  modes={["day", "month"]}
                  value={
                    viewMode === "week"
                      ? selectedDate
                      : `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}`
                  }
                  stepDays={7}
                  label={viewMode === "week" ? weekLabel : undefined}
                  // Fixed width (fits "23 Nov 2026 – 29 Nov 2026") so the toolbar doesn't jump
                  // when switching Week ↔ Month.
                  triggerClassName="w-[236px]"
                  onChange={(period) => {
                    if (periodKind(period) === "month") {
                      setViewMode("month");
                      goToDate(todayKey.slice(0, 7) === period ? todayKey : `${period}-01`);
                    } else {
                      setViewMode("week");
                      goToDate(period);
                    }
                  }}
                />

                {/* Always rendered (hidden when already on today) so its space is kept and the
                    controls never shift. */}
                <button
                  onClick={() => goToDate(todayKey)}
                  aria-hidden={selectedDate === todayKey}
                  tabIndex={selectedDate === todayKey ? -1 : undefined}
                  className={cn(
                    "h-8 rounded-lg border border-border/80 bg-background px-3 text-xs font-semibold text-foreground hover:bg-accent",
                    selectedDate === todayKey && "invisible"
                  )}
                >
                  Today
                </button>
              </div>
            </div>

            {punchError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                {punchError}
              </div>
            )}

            {/* View Content */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border/70 bg-card py-20 text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold">Loading attendance data...</span>
              </div>
            ) : viewMode === "week" ? (
              <div className="space-y-4">
                <AttendanceWeekView
                  records={currentWeekRecords}
                  onSelectDay={handleOpenDrawer}
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  onRegularize={handleRegularizeDay}
                  todayKey={todayKey}
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
                todayKey={todayKey}
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

        <CheckInCaptureModal
          isOpen={checkInRecord !== null}
          onClose={() => setCheckInRecord(null)}
          title={checkInRecord?.checkInTime ? "Check-in again" : "Check-in"}
          onConfirm={async ({ photo, location }) => {
            const res = await checkInAction({
              workMode: checkInRecord?.workMode || "OFFICE",
              source: "Web",
              photo,
              location,
            });
            if (!res.success) return res.message || "Check-in failed. Please try again.";
            setPunchError(null);
            // Checked in: straight to the standup (managers: their own one).
            if (res.redirectTo) {
              router.push(res.redirectTo);
              return null;
            }
            fetchAttendance();
            return null;
          }}
        />

        <CheckInCaptureModal
          isOpen={isCheckOutOpen}
          onClose={() => setIsCheckOutOpen(false)}
          mode="check-out"
          onConfirm={async ({ photo, location }) => {
            const res = await checkOutAction({ source: "Web", photo, location });
            if (!res.success) return res.message || "Check-out failed. Please try again.";
            setPunchError(null);
            fetchAttendance();
            return null;
          }}
        />

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
          target={
            selectedActionItem
              ? {
                  dateKey: selectedActionItem.date,
                  label: `${selectedActionItem.formattedDate} (${selectedActionItem.dayName})`,
                  issue: selectedActionItem.issue,
                  existingCheckIn: recordsMap[selectedActionItem.date]?.checkInTime,
                }
              : null
          }
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
    </Frame>
  );
}

/** Plain wrapper used instead of PulsePage when embedded (the host provides scroll + padding). */
function EmbeddedFrame({ children }: { children: React.ReactNode; className?: string }) {
  return <div className="w-full select-none">{children}</div>;
}
