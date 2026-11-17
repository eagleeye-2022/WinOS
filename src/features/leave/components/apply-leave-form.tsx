"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Paperclip,
  FileText,
  Download,
  X,
  Plus,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Pill,
  Banknote,
  Laptop2,
  AlertTriangle,
  Gift,
  CalendarX,
  UserX,
  TimerReset,
  Sparkles,
  Users,
  Heart,
  CalendarCheck,
  History,
  Eye,
  ExternalLink,
  CalendarDays,
  Wallet,
} from "lucide-react";
import {
  DayType,
  HalfDaySession,
  LeaveAttachment,
  LeaveRequest,
  LeaveTypeConfig,
} from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyLeaveAction, previewLeaveDaysAction } from "../actions/leave-actions";
import { getLeaveApplicantOptionsAction, getMyLeaveTrackerDataAction } from "../queries/leave-queries";
import { errorMessage, unwrap } from "../action-result";
import { uploadAttachment } from "../upload-attachment";
import {
  EXPECTED_SHIFT_MINUTES,
  SHIFT_END,
  addDaysToKey,
  formatIstDate,
  formatIstDateTime,
  formatTime12h,
  isWeekendKey,
  istDateKey,
  parseTime12h,
  workedMinutesBetween,
} from "@/features/attendance/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ApplyLeaveFormProps {
  leaveTypes: LeaveTypeConfig[];
  onSubmitLeave: (newLeave: LeaveRequest) => void;
  onCancel?: () => void;
  initialDate?: string;
  /** Managers: open the form already applying for this team member. */
  initialForUserId?: string;
}

/** Numbered section heading inside the form card. */
function SectionTitle({ n, children }: { n?: number; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground">
      {n !== undefined && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          {n}
        </span>
      )}
      {children}
    </h3>
  );
}

/** Icon + title for the side widgets. */
function WidgetTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </h3>
  );
}

export function ApplyLeaveForm({
  leaveTypes: myLeaveTypes,
  onSubmitLeave,
  onCancel,
  initialDate,
  initialForUserId,
}: ApplyLeaveFormProps) {
  const router = useRouter();

  // Managers can apply for a team member: the leave types and balances are then that person's.
  const [applicantOptions, setApplicantOptions] = useState<{ id: string; name: string }[]>([]);
  const [forUserId, setForUserId] = useState(initialForUserId ?? "");
  const [otherTypes, setOtherTypes] = useState<LeaveTypeConfig[] | null>(null);
  useEffect(() => {
    getLeaveApplicantOptionsAction()
      .then(setApplicantOptions)
      .catch(() => setApplicantOptions([]));
  }, []);
  useEffect(() => {
    if (!forUserId) return;
    let cancelled = false;
    getMyLeaveTrackerDataAction(undefined, forUserId)
      .then((data) => {
        if (cancelled) return;
        setOtherTypes(
          data.balances.map((b) => ({
            id: b.id,
            code: b.code as LeaveTypeConfig["code"],
            name: b.name,
            remainingDays: b.remainingDays,
            bookedDays: b.bookedDays,
            unit: b.unit,
            iconName: b.iconName,
            iconBgColor: b.iconBgColor,
            iconTextColor: b.iconTextColor,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setOtherTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [forUserId]);
  const applicantName = applicantOptions.find((o) => o.id === forUserId)?.name;
  const leaveTypes = forUserId ? otherTypes ?? [] : myLeaveTypes;

  // The team works in IST — a UTC date would show yesterday before 05:30 AM. Leave is only taken on
  // working days, so a weekend opens on the following Monday (holidays are flagged by the preview).
  const todayStr = istDateKey();
  const defaultDate = useMemo(() => {
    let k = todayStr;
    while (isWeekendKey(k)) k = addDaysToKey(k, 1);
    return k;
  }, [todayStr]);

  // Form State
  // Empty until picked: the list can still be loading when the form mounts, and `selectedType`
  // falls back to the first leave type.
  const [selectedTypeCode, setSelectedTypeCode] = useState<string>("");
  // Full-day leave is always a From – To range (From = To for a single day), so it opens on that.
  const [dayType, setDayType] = useState<DayType>("MULTIPLE_DAYS");
  const [date, setDate] = useState<string>(initialDate || defaultDate);
  const [fromDate, setFromDate] = useState<string>(initialDate || defaultDate);
  const [toDate, setToDate] = useState<string>(initialDate || defaultDate);
  const [formError, setFormError] = useState<string | null>(null);
  const [session, setSession] = useState<HalfDaySession>("FIRST_HALF");
  // Early leave defaults to the last two hours of the configured shift.
  const [fromTime, setFromTime] = useState<string>(() => formatTime12h((parseTime12h(SHIFT_END) ?? 1110) - 120));
  const [toTime, setToTime] = useState<string>(SHIFT_END);
  const [reason, setReason] = useState<string>("");
  const [attachments, setAttachments] = useState<LeaveAttachment[]>([]);
  /** The picked files, by attachment id — uploaded on submit. */
  const [attachmentFiles, setAttachmentFiles] = useState<Record<string, File>>({});
  const [previewAttachment, setPreviewAttachment] = useState<LeaveAttachment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Get selected leave type config
  const selectedType = useMemo(() => {
    return leaveTypes.find((lt) => lt.code === selectedTypeCode) || leaveTypes[0];
  }, [leaveTypes, selectedTypeCode]);

  const selectedCode = selectedType?.code;
  const isEarlyLeave = selectedCode === "EL";

  // Formatted date string (e.g. 21 Aug 2026 (Fri)). Keys are calendar dates, so read them as UTC —
  // `new Date("2026-11-06")` is UTC midnight and would show the previous day west of UTC.
  const formatDateDisplay = (dStr: string) => {
    const d = new Date(`${dStr}T00:00:00Z`);
    if (isNaN(d.getTime())) return dStr;
    const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()} (${weekday})`;
  };

  const rangeFrom = dayType === "MULTIPLE_DAYS" ? fromDate : date;
  const rangeTo = dayType === "MULTIPLE_DAYS" ? toDate : date;
  const rangeError =
    !isEarlyLeave && dayType === "MULTIPLE_DAYS" && fromDate && toDate && toDate < fromDate
      ? "The To date can't be before the From date."
      : null;

  // What the server will actually charge (weekends / holidays skipped, sandwich policy applied).
  const [preview, setPreview] = useState<
    | { state: "idle" | "loading" }
    | { state: "ok"; days: number; workingDays: number; sandwichedDays: number; holidayNames: string[] }
    | { state: "error"; message: string }
  >({ state: "idle" });
  useEffect(() => {
    if (isEarlyLeave || !selectedCode || rangeError || !rangeFrom || !rangeTo) {
      setPreview({ state: "idle" });
      return;
    }
    let cancelled = false;
    setPreview({ state: "loading" });
    const t = setTimeout(() => {
      previewLeaveDaysAction({
        leaveTypeCode: selectedCode,
        durationType: dayType === "HALF_DAY" ? "HALF_DAY" : "FULL_DAY",
        fromDate: rangeFrom,
        toDate: rangeTo,
        forUserId: forUserId || undefined,
      })
        .then((res) => {
          if (cancelled) return;
          setPreview(res.success ? { state: "ok", ...res } : { state: "error", message: res.message });
        })
        .catch(() => !cancelled && setPreview({ state: "idle" }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isEarlyLeave, selectedCode, dayType, rangeFrom, rangeTo, rangeError, forUserId]);

  // Calculate duration & summary text
  const durationInfo = useMemo(() => {
    if (isEarlyLeave) {
      // Hours from the chosen times; days as a share of the configured shift length.
      const minutes = workedMinutesBetween(fromTime, toTime) ?? 0;
      const hours = Math.round((minutes / 60) * 100) / 100;
      const days = EXPECTED_SHIFT_MINUTES > 0 ? Math.round((minutes / EXPECTED_SHIFT_MINUTES) * 100) / 100 : 0;
      const label = minutes > 0 ? `${hours} Hour${hours === 1 ? "" : "s"}` : "—";
      return {
        text: label,
        days,
        hours,
        summary:
          minutes > 0
            ? `You have selected early leave from ${fromTime} to ${toTime} (${label})`
            : "Pick a leaving time before the end time",
      };
    }
    if (rangeError) return { text: "—", days: 0, summary: rangeError };
    if (preview.state === "error") return { text: "—", days: 0, summary: preview.message };
    if (preview.state !== "ok") return { text: "…", days: 0, summary: "Counting leave days…" };

    const days = preview.days;
    const text = `${days} Day${days === 1 ? "" : "s"}`;
    if (dayType === "HALF_DAY") {
      const sessionLabel = session === "FIRST_HALF" ? "First Half" : "Second Half";
      return { text, days, summary: `You have selected Half Day (${sessionLabel}) on ${formatDateDisplay(date)}` };
    }
    const parts = [`${preview.workingDays} working day${preview.workingDays === 1 ? "" : "s"}`];
    if (preview.sandwichedDays > 0) {
      parts.push(`${preview.sandwichedDays} weekend/holiday day${preview.sandwichedDays === 1 ? "" : "s"} in between (sandwich policy)`);
    }
    const holidays = preview.holidayNames.length ? ` Holidays skipped: ${preview.holidayNames.join(", ")}.` : "";
    const range =
      rangeFrom === rangeTo
        ? `on ${formatDateDisplay(rangeFrom)}`
        : `from ${formatDateDisplay(rangeFrom)} to ${formatDateDisplay(rangeTo)}`;
    return {
      text,
      days,
      summary: `${text} of leave ${range}${parts.length > 1 || preview.workingDays !== days ? ` — ${parts.join(" + ")}` : ""}.${holidays}`,
    };
  }, [isEarlyLeave, dayType, session, date, fromTime, toTime, rangeFrom, rangeTo, rangeError, preview]);

  // Real balance calculation from DB leave type
  const availableBalance = selectedType?.remainingDays ?? 0;
  const currentBooking = durationInfo.days;
  const balanceAfterBooking = availableBalance - currentBooking;

  // Keeps the picked file for preview; it's uploaded on submit.
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const blobUrl = URL.createObjectURL(file);
      const newAtt: LeaveAttachment = {
        id: `att-${Date.now()}`,
        name: file.name,
        size: `${Math.round(file.size / 1024)} KB`,
        url: blobUrl,
        type: file.type || "application/octet-stream",
      };
      setAttachments((prev) => [...prev, newAtt]);
      setAttachmentFiles((prev) => ({ ...prev, [newAtt.id]: file }));
      e.target.value = "";
    }
  };

  const handleDownload = (att: LeaveAttachment) => {
    if (!att.url) return;
    const link = document.createElement("a");
    link.href = att.url;
    link.download = att.name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedType) return;
    if (rangeError) {
      setFormError(rangeError);
      return;
    }
    if (!isEarlyLeave && preview.state === "error") {
      setFormError(preview.message);
      return;
    }
    if (isEarlyLeave && !(durationInfo.days > 0)) {
      setFormError("The leaving time must be before the end time.");
      return;
    }
    if (!reason.trim()) {
      setFormError("A reason is required.");
      return;
    }
    setIsSubmitting(true);

    const actualFromDate = dayType === "MULTIPLE_DAYS" ? fromDate : date;
    const actualToDate = dayType === "MULTIPLE_DAYS" ? toDate : date;

    try {
      const uploaded = await Promise.all(
        attachments.filter((a) => attachmentFiles[a.id]).map((a) => uploadAttachment(attachmentFiles[a.id]))
      );
      const res = unwrap(await applyLeaveAction({
        leaveTypeCode: selectedType.code,
        durationType: isEarlyLeave
          ? "EARLY_LEAVE"
          : dayType === "HALF_DAY"
          ? "HALF_DAY"
          : dayType === "MULTIPLE_DAYS"
          ? "FULL_DAY"
          : "FULL_DAY",
        halfDayType: dayType === "HALF_DAY" ? (session === "FIRST_HALF" ? "FIRST_HALF" : "SECOND_HALF") : undefined,
        fromDate: actualFromDate,
        toDate: actualToDate,
        fromTime: isEarlyLeave ? fromTime : undefined,
        toTime: isEarlyLeave ? toTime : undefined,
        durationDays: durationInfo.days,
        durationHours: isEarlyLeave ? durationInfo.hours : undefined,
        reason: reason.trim(),
        attachments: uploaded,
        forUserId: forUserId || undefined,
      }));
      if (res.isLossOfPay) {
        alert(`Leave applied. ${res.lopDays} day(s) exceed ${applicantName ? `${applicantName}'s` : "your"} balance and will be loss of pay.`);
      }

      const newRequest: LeaveRequest = {
        id: res.requestId,
        leaveTypeCode: selectedType.code,
        leaveTypeName: `${selectedType.name} (${selectedType.code})`,
        dayType: isEarlyLeave ? "EARLY_LEAVE" : dayType,
        fromDate: actualFromDate,
        toDate: actualToDate,
        fromDateDisplay: isEarlyLeave
          ? `${fromTime}`
          : formatDateDisplay(actualFromDate),
        toDateDisplay: isEarlyLeave
          ? `${toTime}`
          : formatDateDisplay(actualToDate),
        session: dayType === "HALF_DAY" ? session : undefined,
        fromTime: isEarlyLeave ? fromTime : undefined,
        toTime: isEarlyLeave ? toTime : undefined,
        durationText: res.durationDays === durationInfo.days ? durationInfo.text : `${res.durationDays} Day(s)`,
        durationDays: res.durationDays,
        reason,
        status: "PENDING",
        leaveTypeIcon: selectedType.iconName || "Calendar",
        leaveTypeColor: selectedType.iconBgColor,
        appliedOn: formatIstDate(),
        appliedOnDateTime: formatIstDateTime(),
        attachments: attachments.length > 0 ? attachments : undefined,
        approvalFlow: [
          {
            id: "step-1",
            title: "Requested",
            actorName: "Applicant",
            actorRole: "Applicant",
            dateStr: formatIstDateTime(),
            status: "COMPLETED",
          },
          {
            id: "step-2",
            title: "Manager Approval",
            actorName: "Reporting Manager",
            actorRole: "Reporting Manager",
            status: "PENDING",
          },
        ],
      };

      setIsSubmitting(false);
      setSubmittedSuccess(true);
      onSubmitLeave(newRequest);
    } catch (err) {
      setFormError(errorMessage(err, "Failed to submit leave request."));
      setIsSubmitting(false);
    }
  };

  const getIcon = (name: string) => {
    switch (name) {
      case "Pill":
        return Pill;
      case "Banknote":
        return Banknote;
      case "Laptop2":
        return Laptop2;
      case "AlertTriangle":
        return AlertTriangle;
      case "Clock":
        return Clock;
      case "Gift":
        return Gift;
      case "CalendarX":
        return CalendarX;
      case "UserX":
        return UserX;
      case "TimerReset":
        return TimerReset;
      case "Sparkles":
        return Sparkles;
      case "Users":
        return Users;
      case "Heart":
        return Heart;
      case "Calendar":
        return Calendar;
      case "CalendarCheck":
        return CalendarCheck;
      case "History":
        return History;
      default:
        return HelpCircle;
    }
  };

  return (
    <div className="w-full space-y-4 pb-12">
      {/* Breadcrumb Header */}
      <div className="rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-1 px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">Apply for Leave</h1>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* Left Column: Form */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {/* Managers only: whose leave this is */}
            {applicantOptions.length > 0 && (
              <div className="space-y-3 px-6 py-5">
                <SectionTitle>Applying for</SectionTitle>
                <div className="space-y-1.5 max-w-md">
                  <Select
                    value={forUserId || "__self"}
                    onValueChange={(val) => {
                      setForUserId(val === "__self" ? "" : val);
                      setOtherTypes(null);
                      setSelectedTypeCode("");
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-md text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="__self" className="text-xs">
                        Myself
                      </SelectItem>
                      {applicantOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id} className="text-xs">
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {forUserId && (
                    <p className="text-xs text-muted-foreground">
                      {otherTypes === null
                        ? `Loading ${applicantName ?? "their"} leave balances…`
                        : `Uses ${applicantName ?? "their"} leave types and balances. They'll be notified.`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 1. Leave Type Section */}
            <div className="space-y-3 px-6 py-5">
              <SectionTitle n={1}>Leave Type</SectionTitle>
              <div className="space-y-1.5 max-w-md">
                <label className="text-xs font-medium text-foreground">
                  Leave type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedType?.code ?? ""}
                  onValueChange={(val) => {
                    setSelectedTypeCode(val);
                    if (val === "EL") {
                      setDayType("EARLY_LEAVE");
                    } else if (dayType === "EARLY_LEAVE") {
                      setDayType("MULTIPLE_DAYS");
                    }
                  }}
                >
                  <SelectTrigger className="h-10 rounded-md text-xs bg-background">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {leaveTypes.map((lt) => {
                      const Icon = getIcon(lt.iconName || "Calendar");
                      return (
                        <SelectItem key={lt.code} value={lt.code} className="text-xs">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("w-3.5 h-3.5", lt.iconTextColor)} />
                            <span>{lt.shortName || lt.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {leaveTypes.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No leave types are available to you. Ask your manager to set them up under Leave Policy.
                  </p>
                )}
              </div>
            </div>

            {/* 2. Leave Dates / Sessions Section */}
            <div className="space-y-4 px-6 py-5">
              <SectionTitle n={2}>{isEarlyLeave ? "Date & Time" : "Leave Dates/Sessions"}</SectionTitle>

              {!isEarlyLeave ? (
                /* Standard Leave Date & Session Options */
                <div className="space-y-4">
                  <div className="max-w-md space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Day type <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={dayType}
                      onValueChange={(val) => setDayType(val as DayType)}
                    >
                      <SelectTrigger className="h-10 rounded-md text-xs bg-background">
                        <SelectValue placeholder="Select day type" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Full Day = a From – To range (same date for one day); both are sent as FULL_DAY. */}
                        <SelectItem value="MULTIPLE_DAYS">Full Day (From – To)</SelectItem>
                        <SelectItem value="HALF_DAY">Half Day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {dayType === "MULTIPLE_DAYS" ? (
                    /* Full Day: From Date & To Date */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                          From Date <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="date"
                          value={fromDate}
                          onChange={(e) => {
                            const next = e.target.value;
                            setFromDate(next);
                            setDate(next);
                            // Keep the range valid: a later start moves the end with it.
                            if (next && toDate && toDate < next) setToDate(next);
                          }}
                          className="h-10 rounded-md text-xs bg-background"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                          To Date <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="date"
                          value={toDate}
                          min={fromDate || undefined}
                          aria-invalid={Boolean(rangeError)}
                          onChange={(e) => setToDate(e.target.value)}
                          className={cn("h-10 rounded-md text-xs bg-background", rangeError && "border-red-500")}
                          required
                        />
                        {rangeError && <p className="text-xs text-red-600 dark:text-red-400">{rangeError}</p>}
                      </div>
                    </div>
                  ) : (
                    /* Full Day / Half Day: Single Date Picker */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                      {/* Date Picker */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                          Date <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={date}
                            onChange={(e) => {
                              setDate(e.target.value);
                              setFromDate(e.target.value);
                              setToDate(e.target.value);
                            }}
                            className="h-10 rounded-md text-xs bg-background"
                            required
                          />
                        </div>
                      </div>

                      {/* Session Selector (If Half Day) */}
                      {dayType === "HALF_DAY" && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">
                            Leave Session <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setSession("FIRST_HALF")}
                              className={cn(
                                "h-10 px-3 rounded-md border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
                                session === "FIRST_HALF"
                                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500 dark:bg-blue-500/15 dark:text-blue-300"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                                  session === "FIRST_HALF"
                                    ? "border-blue-600 bg-blue-600"
                                    : "border-muted-foreground"
                                )}
                              />
                              <span>First Half (FN)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSession("SECOND_HALF")}
                              className={cn(
                                "h-10 px-3 rounded-md border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
                                session === "SECOND_HALF"
                                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500 dark:bg-blue-500/15 dark:text-blue-300"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                                  session === "SECOND_HALF"
                                    ? "border-blue-600 bg-blue-600"
                                    : "border-muted-foreground"
                                )}
                              />
                              <span>Second Half (AN)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Early Leave Options (Date & From/To Time) */
                <div className="space-y-4">
                  <div className="max-w-md space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-10 rounded-md text-xs bg-background max-w-md"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        From Time <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={fromTime}
                          onChange={(e) => setFromTime(e.target.value)}
                          className="h-10 pl-9 rounded-md text-xs bg-background"
                          placeholder="03:30 PM"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        To Time <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={toTime}
                          onChange={(e) => setToTime(e.target.value)}
                          className="h-10 pl-9 rounded-md text-xs bg-background"
                          placeholder="06:00 PM"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Selection info banner — red when the dates can't be taken as leave */}
              <div
                className={cn(
                  "flex items-center gap-2 p-3 border rounded-md text-xs",
                  rangeError || preview.state === "error"
                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300"
                    : "bg-blue-50/80 dark:bg-accent border-blue-100 dark:border-zinc-700/40 text-blue-700 dark:text-blue-300"
                )}
              >
                <Info className="w-4 h-4 shrink-0" />
                <span>{durationInfo.summary}</span>
              </div>
            </div>

            {/* 3. Reason Section */}
            <div className="space-y-3 px-6 py-5">
              <SectionTitle n={3}>Reason</SectionTitle>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Reason for leave <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Textarea
                    value={reason}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setReason(e.target.value);
                      }
                    }}
                    placeholder="Provide a clear explanation for taking leave..."
                    className="min-h-[100px] text-xs resize-none bg-background rounded-md p-3"
                    required
                  />
                  <div className="text-xs text-muted-foreground text-right mt-1 font-mono">
                    {reason.length}/500
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Attachments Section */}
            <div className="space-y-3 px-6 py-5">
              <div className="flex items-center gap-2">
                <SectionTitle n={4}>Attachments</SectionTitle>
                <Paperclip className="w-4 h-4 text-muted-foreground" />
              </div>

              {/* Attached items list */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-3 bg-background border rounded-md"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                            {att.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {att.size}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setPreviewAttachment(att)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10"
                          title="View Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(att)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-500"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add attachment trigger */}
              <div>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer py-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add another attachment</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>

            {/* 5. Leave Summary Section */}
            <div className="space-y-4 px-6 py-5">
              <SectionTitle n={5}>Leave Summary</SectionTitle>

              <div className="overflow-x-auto rounded-md border border-border/70 bg-background">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="py-2.5 px-4 font-semibold">LEAVE TYPE</th>
                      {isEarlyLeave ? (
                        <>
                          <th className="py-2.5 px-4 font-semibold">DATE</th>
                          <th className="py-2.5 px-4 font-semibold">FROM TIME (LEAVING)</th>
                          <th className="py-2.5 px-4 font-semibold">TO TIME (SHIFT END)</th>
                        </>
                      ) : dayType !== "HALF_DAY" ? (
                        <>
                          <th className="py-2.5 px-4 font-semibold">FROM</th>
                          <th className="py-2.5 px-4 font-semibold">TO</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2.5 px-4 font-semibold">DATE</th>
                          <th className="py-2.5 px-4 font-semibold">SESSION</th>
                        </>
                      )}
                      <th className="py-2.5 px-4 font-semibold text-center">DURATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-3 px-4 font-medium text-primary">
                        {isEarlyLeave
                          ? "Early Leave (EL)"
                          : dayType === "HALF_DAY"
                          ? "Half Day Leave (HD)"
                          : selectedType?.name ?? "—"}
                      </td>

                      {isEarlyLeave ? (
                        <>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {formatDateDisplay(date)}
                          </td>
                          <td className="py-3 px-4 text-foreground">{fromTime}</td>
                          <td className="py-3 px-4 text-foreground">{toTime}</td>
                        </>
                      ) : dayType !== "HALF_DAY" ? (
                        <>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {formatDateDisplay(rangeFrom)}
                          </td>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {formatDateDisplay(rangeTo)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {formatDateDisplay(date)}
                          </td>
                          <td className="py-3 px-4 text-primary font-medium">
                            {session === "FIRST_HALF" ? "First Half (FN)" : "Second Half (AN)"}
                          </td>
                        </>
                      )}

                      <td className="py-3 px-4 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                            isEarlyLeave
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-accent dark:text-blue-300"
                          )}
                        >
                          {durationInfo.text}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {formError && (
                <div role="alert" className="flex items-center gap-2 px-4 py-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs font-medium text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="-mx-6 -mb-5 mt-2 flex items-center justify-between border-t border-border/70 bg-muted/30 px-6 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => (onCancel ? onCancel() : router.push("/pulse/leave"))}
                  className="h-9 rounded-md px-5 text-xs font-semibold"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !selectedType ||
                    Boolean(rangeError) ||
                    (!isEarlyLeave && (preview.state === "loading" || preview.state === "error"))
                  }
                  className="h-9 rounded-md bg-blue-600 px-6 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  {isSubmitting ? "Applying..." : "Apply Leave"}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Remaining Leaves & Balance Summary Widgets */}
        <div className="space-y-4 lg:col-span-4">
          {/* Remaining Leaves Card */}
          <div className="space-y-4 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <WidgetTitle icon={<CalendarDays className="h-4 w-4" />}>Remaining Leaves</WidgetTitle>

            {/* The employee's real balance for each leave type they can apply for; click one to pick it. */}
            {leaveTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No leave types are set up for you yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {leaveTypes.map((lt) => {
                  const Icon = getIcon(lt.iconName || "Calendar");
                  const isSelected = lt.code === selectedType?.code;
                  return (
                    <button
                      key={lt.code}
                      type="button"
                      onClick={() => setSelectedTypeCode(lt.code)}
                      title={`Apply for ${lt.name}`}
                      className={cn(
                        "flex cursor-pointer flex-col items-center justify-center space-y-1 rounded-md border border-border/70 bg-background p-3 text-center transition-colors hover:border-blue-300 dark:hover:border-blue-500/50",
                        isSelected && "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/40 dark:bg-blue-500/10"
                      )}
                    >
                      <div className={cn("p-1.5 rounded-full", lt.iconBgColor, lt.iconTextColor)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">{lt.shortName || lt.name}</div>
                      <div className={cn("text-xs font-bold", lt.remainingDays < 0 ? "text-red-500" : "text-primary")}>
                        {lt.remainingDays} {/hour/i.test(lt.unit) ? "Hours" : Math.abs(lt.remainingDays) === 1 ? "Day" : "Days"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Balance Summary Card */}
          <div className="space-y-4 rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
            <div>
              <WidgetTitle icon={<Wallet className="h-4 w-4" />}>
                Balance Summary – <span className="text-blue-600 dark:text-blue-400">{selectedType?.name ?? "—"}</span>
              </WidgetTitle>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground pb-1 border-b">
                <span>
                  As on{" "}
                  <span className="text-primary font-semibold underline">
                    {istDateKey().split("-").reverse().join("/")}
                  </span>
                </span>
                <span className="font-medium text-foreground">Day(s)</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Available balance</span>
                <span className={cn("font-bold", availableBalance < 0 ? "text-red-500" : "text-foreground")}>
                  {availableBalance}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current booking</span>
                <span className="font-bold text-foreground">{currentBooking}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t font-semibold">
                <span className="text-primary font-bold">Balance after current booking</span>
                <span className={cn("font-bold", balanceAfterBooking < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400")}>
                  {balanceAfterBooking}
                </span>
              </div>
            </div>

            {/* Only when this booking goes past the balance; the leave type's policy decides what happens. */}
            {balanceAfterBooking < 0 && (
              <div className="flex items-start gap-2 p-3 bg-blue-50/80 dark:bg-accent border border-blue-100 dark:border-zinc-700/40 rounded-md text-xs text-blue-700 dark:text-blue-300">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  This is more than your available balance. The extra is handled by this leave type&apos;s policy
                  (for example, marked as loss of pay).
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border/80 w-full max-w-2xl rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2.5 truncate pr-2">
                <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <h3 className="text-sm font-bold text-foreground truncate max-w-md">
                    {previewAttachment.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {previewAttachment.size} • {previewAttachment.type || "Document"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {previewAttachment.url && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(previewAttachment.url, "_blank")}
                    className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-border"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Open</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(previewAttachment)}
                  className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-border"
                  title="Download Document"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewAttachment(null)}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center min-h-[300px] bg-muted/10">
              {previewAttachment.url &&
              (previewAttachment.type?.startsWith("image/") ||
                /\.(png|jpe?g|webp|gif|svg)$/i.test(previewAttachment.name)) ? (
                <div className="w-full flex items-center justify-center">
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.name}
                    className="max-h-[55vh] max-w-full object-contain rounded-lg border shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  />
                </div>
              ) : previewAttachment.url &&
                (previewAttachment.type?.includes("pdf") ||
                  /\.pdf$/i.test(previewAttachment.name)) ? (
                <div className="w-full h-[55vh] rounded-lg border overflow-hidden bg-background">
                  <iframe
                    src={previewAttachment.url}
                    className="w-full h-full border-0"
                    title={previewAttachment.name}
                  />
                </div>
              ) : (
                <div className="text-center space-y-3 py-8 max-w-sm">
                  <div className="w-16 h-16 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-[0_1px_2px_rgba(15,23,42,0.04)] border border-primary/20">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-foreground">
                      {previewAttachment.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Document attached and ready for submission.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleDownload(previewAttachment)}
                      className="rounded-md text-xs gap-1.5 bg-primary text-primary-foreground"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Document
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
