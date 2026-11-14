"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
  ChevronRight,
  Sliders,
  PieChart,
} from "lucide-react";
import { CompDurationType, CompensatoryRequest, LeaveAttachment } from "../types";
import { applyCompensatoryAction } from "../actions/leave-actions";
import { errorMessage, unwrap } from "../action-result";
import { uploadAttachment } from "../upload-attachment";
import { addDaysToKey, istDateKey, normalizeTime, workedMinutesBetween } from "@/features/attendance/utils";
import { compOffDurationError } from "../leave-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ApplyCompensatoryFormProps {
  onSubmitCompensatory?: (newComp: CompensatoryRequest) => void;
  onCancel?: () => void;
}

export function ApplyCompensatoryForm({
  onSubmitCompensatory,
  onCancel,
}: ApplyCompensatoryFormProps) {
  const router = useRouter();

  const [workDate, setWorkDate] = useState(() => addDaysToKey(istDateKey(), -1));
  const [fromTime, setFromTime] = useState("09:00 AM");
  const [toTime, setToTime] = useState("06:00 PM");
  const [durationType, setDurationType] = useState<CompDurationType>("FULL_DAY");
  const [reason, setReason] = useState("");
  const [attachments, setAttachments] = useState<LeaveAttachment[]>([]);
  /** The picked files, by attachment id — uploaded on submit. */
  const [attachmentFiles, setAttachmentFiles] = useState<Record<string, File>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const todayKey = istDateKey();

  // Calendar-date keys read as UTC, so the weekday never shifts with the browser's time zone.
  const formatDateWithWeekday = (dStr: string) => {
    const d = new Date(`${dStr}T00:00:00Z`);
    if (isNaN(d.getTime())) return dStr;
    const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()} (${weekday})`;
  };

  // Expiry: one month after the work date (same rule as the server's compOffExpiry).
  const expiryDateFormatted = useMemo(() => {
    const d = new Date(`${workDate}T00:00:00Z`);
    if (isNaN(d.getTime())) return "—";
    d.setUTCMonth(d.getUTCMonth() + 1);
    return formatDateWithWeekday(d.toISOString().slice(0, 10));
  }, [workDate]);

  // Checked as you type, with the same rules the server applies.
  const workedMinutes = useMemo(() => {
    const from = normalizeTime(fromTime);
    const to = normalizeTime(toTime);
    return from && to ? workedMinutesBetween(from, to) : null;
  }, [fromTime, toTime]);
  const dateError = !workDate
    ? "Pick the date you worked."
    : workDate > todayKey
    ? "You can't claim a comp-off for a future date."
    : null;
  const timeError =
    !normalizeTime(fromTime) || !normalizeTime(toTime)
      ? "Enter times as e.g. 09:30 AM."
      : !workedMinutes
      ? "The end time must be after the start time."
      : null;
  const durationError = workedMinutes ? compOffDurationError(durationType, workedMinutes) : null;
  const inputError = dateError ?? timeError ?? durationError;

  const durationDetails = useMemo(() => {
    switch (durationType) {
      case "FULL_DAY":
        return { label: "Full Day", badgeText: "1 Day" };
      case "HALF_DAY":
        return { label: "Half Day", badgeText: "0.5 Day" };
      case "QUARTER_DAY":
        return { label: "Quarter Day", badgeText: "0.25 Day" };
    }
  }, [durationType]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newAtt: LeaveAttachment = {
        id: `att-${Date.now()}`,
        name: file.name,
        size: `${Math.round(file.size / 1024)} KB`,
      };
      setAttachments((prev) => [...prev, newAtt]);
      setAttachmentFiles((prev) => ({ ...prev, [newAtt.id]: file }));
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (inputError) {
      setSubmitError(inputError);
      return;
    }
    if (!reason.trim()) {
      setSubmitError("A reason is required.");
      return;
    }
    setIsSubmitting(true);

    try {
      const uploaded = await Promise.all(
        attachments.filter((a) => attachmentFiles[a.id]).map((a) => uploadAttachment(attachmentFiles[a.id]))
      );
      const res = unwrap(
        await applyCompensatoryAction({
          workDate,
          fromTime,
          toTime,
          duration: durationType,
          reason: reason.trim(),
          attachments: uploaded,
        })
      );
      const hours = Math.floor(res.hoursWorked);
      const mins = Math.round((res.hoursWorked - hours) * 60);

      const [dayPart, weekdayPart] = formatDateWithWeekday(workDate).split(" (");
      const newComp: CompensatoryRequest = {
        id: res.id,
        workDate: dayPart,
        workDayOfWeek: (weekdayPart || "").replace(")", ""),
        hoursWorkedDisplay: `${fromTime} - ${toTime}\n${hours}h ${String(mins).padStart(2, "0")}m`,
        fromTime,
        toTime,
        durationType,
        durationText: durationDetails.label,
        reason,
        status: "PENDING",
        requestedOn: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        expiryDate: expiryDateFormatted,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      // The parent shows the confirmation and takes the user back to their comp-off list.
      setIsSubmitting(false);
      if (onSubmitCompensatory) {
        onSubmitCompensatory(newComp);
      } else {
        router.push("/pulse/leave?tab=compensatory");
      }
    } catch (err) {
      setSubmitError(errorMessage(err, "Failed to submit compensatory request."));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Breadcrumb Header */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Link
            href="/pulse/leave"
            className="text-primary hover:underline hover:text-foreground transition-colors"
          >
            My Leave
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="text-foreground">Compensatory Request</span>
        </nav>

        <div className="pt-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Compensatory Request
          </h1>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Work Date & Time */}
            <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                1. Work Date & Time
              </h3>

              <div className="space-y-4">
                <div className="max-w-md space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Work Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={workDate}
                    max={todayKey}
                    aria-invalid={Boolean(dateError)}
                    onChange={(e) => setWorkDate(e.target.value)}
                    className={cn("h-10 rounded-xl text-xs bg-background", dateError && "border-red-500")}
                    required
                  />
                  {dateError && <p className="text-xs text-red-600 dark:text-red-400">{dateError}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      From Time (Start) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={fromTime}
                        onChange={(e) => setFromTime(e.target.value)}
                        className="h-10 pl-9 rounded-xl text-xs bg-background"
                        placeholder="09:00 AM"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      To Time (End) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={toTime}
                        onChange={(e) => setToTime(e.target.value)}
                        className="h-10 pl-9 rounded-xl text-xs bg-background"
                        placeholder="06:00 PM"
                        required
                      />
                    </div>
                  </div>
                </div>
                {timeError ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{timeError}</p>
                ) : workedMinutes ? (
                  <p className="text-xs text-muted-foreground">
                    {Math.floor(workedMinutes / 60)}h {String(workedMinutes % 60).padStart(2, "0")}m worked
                  </p>
                ) : null}
              </div>
            </div>

            {/* 2. Duration */}
            <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                2. Duration
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Duration Type <span className="text-red-500">*</span>
                </label>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setDurationType("FULL_DAY")}
                    className={cn(
                      "h-10 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
                      durationType === "FULL_DAY"
                        ? "border-primary bg-primary/10 text-primary shadow-2xs ring-1 ring-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <span
                      className={cn(
                        "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                        durationType === "FULL_DAY"
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      )}
                    />
                    <span>Full Day</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDurationType("HALF_DAY")}
                    className={cn(
                      "h-10 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
                      durationType === "HALF_DAY"
                        ? "border-primary bg-primary/10 text-primary shadow-2xs ring-1 ring-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <span
                      className={cn(
                        "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                        durationType === "HALF_DAY"
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      )}
                    />
                    <span>Half Day</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDurationType("QUARTER_DAY")}
                    className={cn(
                      "h-10 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
                      durationType === "QUARTER_DAY"
                        ? "border-primary bg-primary/10 text-primary shadow-2xs ring-1 ring-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    <span
                      className={cn(
                        "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                        durationType === "QUARTER_DAY"
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      )}
                    />
                    <span>Quarter Day</span>
                  </button>
                </div>
                {durationError && <p className="text-xs text-red-600 dark:text-red-400 pt-1">{durationError}</p>}
              </div>
            </div>

            {/* 3. Reason */}
            <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                3. Reason
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Reason for request <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Textarea
                    value={reason}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setReason(e.target.value);
                      }
                    }}
                    placeholder="Describe the tasks completed during extra hours..."
                    className="min-h-[100px] text-xs resize-none bg-background rounded-xl p-3"
                    required
                  />
                  <div className="text-xs text-muted-foreground text-right mt-1 font-mono">
                    {reason.length}/500
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Attachments */}
            <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground tracking-tight">
                  4. Attachments
                </h3>
                <Paperclip className="w-4 h-4 text-muted-foreground" />
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-3 bg-background border rounded-xl"
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

            {/* 5. Expiry Date */}
            <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                5. Expiry Date
              </h3>

              <div className="space-y-1.5 max-w-md">
                <label className="text-xs font-medium text-foreground">
                  Expiry Date (Auto calculated) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-muted/40 border rounded-xl text-xs text-foreground font-semibold">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{expiryDateFormatted}</span>
                </div>
              </div>

              {submitError && (
                <div role="alert" className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs font-medium text-red-700 dark:text-red-300">
                  {submitError}
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => (onCancel ? onCancel() : router.push("/pulse/leave"))}
                  className="h-10 px-6 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting || Boolean(inputError)}
                  className="h-10 px-8 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                >
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Request Summary & Duration Guide */}
        <div className="lg:col-span-4 space-y-6">
          {/* Request Summary Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Request Summary
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Work Date</span>
                <span className="font-semibold text-foreground">
                  {formatDateWithWeekday(workDate)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Work Time</span>
                <span className="font-semibold text-foreground">
                  {fromTime} – {toTime}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Duration Type</span>
                <span className="font-semibold text-foreground">
                  {durationDetails.label}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-semibold text-foreground">
                  {durationDetails.badgeText}
                </span>
              </div>

              <div className="pt-2 border-t border-dashed flex items-center justify-between">
                <span className="text-muted-foreground">Expiry Date</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {expiryDateFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Duration Guide Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Duration Guide
            </h3>

            <div className="space-y-2.5">
              {/* Full Day */}
              <div className="flex items-center justify-between p-3 rounded-xl border bg-background">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-accent text-blue-500">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">Full Day</div>
                    <div className="text-xs text-muted-foreground">More than 5 hours</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  1 Day
                </span>
              </div>

              {/* Half Day */}
              <div className="flex items-center justify-between p-3 rounded-xl border bg-background">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-500">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">Half Day</div>
                    <div className="text-xs text-muted-foreground">Up to 5 hours</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 dark:bg-accent dark:text-blue-300 border border-blue-200 dark:border-zinc-700">
                  0.5 Day
                </span>
              </div>

              {/* Quarter Day */}
              <div className="flex items-center justify-between p-3 rounded-xl border bg-background">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-500">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Quarter Day (4 Hours)
                    </div>
                    <div className="text-xs text-muted-foreground">Up to 4 hours</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  0.25 Day
                </span>
              </div>
            </div>
          </div>

          {/* Note Card */}
          <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-accent border border-blue-100 dark:border-zinc-700/40 flex items-start gap-2.5 text-xs text-blue-700 dark:text-blue-300">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>You can use this compensatory leave before the expiry date.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
