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
import { applyLeaveAction } from "../actions/leave-actions";
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
}

export function ApplyLeaveForm({
  leaveTypes,
  onSubmitLeave,
  onCancel,
  initialDate,
}: ApplyLeaveFormProps) {
  const router = useRouter();

  // Form State
  const [selectedTypeCode, setSelectedTypeCode] = useState<string>("CL");
  const [dayType, setDayType] = useState<DayType>("HALF_DAY");
  const [date, setDate] = useState<string>(initialDate || "2026-08-21");
  const [fromDate, setFromDate] = useState<string>("2026-08-21");
  const [toDate, setToDate] = useState<string>("2026-08-21");
  const [session, setSession] = useState<HalfDaySession>("FIRST_HALF");
  const [fromTime, setFromTime] = useState<string>("03:30 PM");
  const [toTime, setToTime] = useState<string>("06:00 PM");
  const [reason, setReason] = useState<string>("Personal work at home.");
  const [attachments, setAttachments] = useState<LeaveAttachment[]>([
    {
      id: "att-demo-1",
      name: "Doctor_Appointment_Proof.pdf",
      size: "245 KB",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Get selected leave type config
  const selectedType = useMemo(() => {
    return leaveTypes.find((lt) => lt.code === selectedTypeCode) || leaveTypes[0];
  }, [leaveTypes, selectedTypeCode]);

  const isEarlyLeave = selectedTypeCode === "EL";

  // Calculate duration & summary text
  const durationInfo = useMemo(() => {
    if (isEarlyLeave) {
      return {
        text: "2.5 Hours",
        days: 0.25,
        summary: `You have selected early leave from ${fromTime} to ${toTime} (2.5 Hours)`,
      };
    }
    if (dayType === "HALF_DAY") {
      const sessionLabel = session === "FIRST_HALF" ? "First Half" : "Second Half";
      return {
        text: "0.5 Day",
        days: 0.5,
        summary: `You have selected Half Day (${sessionLabel})`,
      };
    }
    if (dayType === "FULL_DAY") {
      return {
        text: "1 Day",
        days: 1,
        summary: "You have selected 1 day of leave",
      };
    }
    // Multiple Days
    return {
      text: "2 Days",
      days: 2,
      summary: "You have selected 2 days of leave",
    };
  }, [isEarlyLeave, dayType, session, fromTime, toTime]);

  // Formatted date string (e.g. 21 Aug 2026 (Fri))
  const formatDateDisplay = (dStr: string) => {
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      const day = d.getDate();
      const month = d.toLocaleDateString("en-US", { month: "short" });
      const year = d.getFullYear();
      const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
      return `${day} ${month} ${year} (${weekday})`;
    } catch {
      return dStr;
    }
  };

  // Balance calculation (Casual Leave uses -5 as in Image 5, otherwise -2)
  const availableBalance = selectedTypeCode === "CL" ? -5 : -2;
  const currentBooking = durationInfo.days;
  const balanceAfterBooking = availableBalance - currentBooking;

  // Handle Attachment upload simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newAtt: LeaveAttachment = {
        id: `att-${Date.now()}`,
        name: file.name,
        size: `${Math.round(file.size / 1024)} KB`,
      };
      setAttachments((prev) => [...prev, newAtt]);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await applyLeaveAction({
        leaveTypeCode: selectedType.code,
        durationType: isEarlyLeave ? "EARLY_LEAVE" : dayType === "HALF_DAY" ? "HALF_DAY" : "FULL_DAY",
        halfDayType: dayType === "HALF_DAY" ? (session === "FIRST_HALF" ? "FIRST_HALF" : "SECOND_HALF") : undefined,
        fromDate: date,
        toDate: date,
        fromTime: isEarlyLeave ? fromTime : undefined,
        toTime: isEarlyLeave ? toTime : undefined,
        durationDays: durationInfo.days,
        durationHours: isEarlyLeave ? 2.5 : undefined,
        reason,
        attachmentFileName: attachments.length > 0 ? attachments[0].name : undefined,
      });

      const newRequest: LeaveRequest = {
        id: `lr-${Date.now()}`,
        leaveTypeCode: selectedType.code,
        leaveTypeName: selectedType.name,
        dayType: isEarlyLeave ? "EARLY_LEAVE" : dayType,
        fromDate: date,
        toDate: date,
        fromDateDisplay: isEarlyLeave
          ? `${fromTime}\nFri`
          : `${formatDateDisplay(date).split("(")[0].trim()}\n${formatDateDisplay(date).split("(")[1]?.replace(")", "") || ""}`,
        toDateDisplay: isEarlyLeave
          ? `${toTime}\nFri`
          : `${formatDateDisplay(date).split("(")[0].trim()}\n${formatDateDisplay(date).split("(")[1]?.replace(")", "") || ""}`,
        session: dayType === "HALF_DAY" ? session : undefined,
        fromTime: isEarlyLeave ? fromTime : undefined,
        toTime: isEarlyLeave ? toTime : undefined,
        durationText: durationInfo.text,
        durationDays: durationInfo.days,
        reason,
        status: "PENDING",
        appliedOn: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      onSubmitLeave(newRequest);
      setIsSubmitting(false);
      setSubmittedSuccess(true);
      setTimeout(() => {
        if (onCancel) {
          onCancel();
        } else {
          router.push("/pulse/leave");
        }
      }, 500);
    } catch (err) {
      console.error("Failed to submit leave request:", err);
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Breadcrumb Header */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Link
            href="/pulse/leave"
            className="text-primary hover:underline hover:text-primary/80 transition-colors"
          >
            My Leave
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="text-foreground">Apply for Leave</span>
        </nav>

        <div className="pt-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Apply for Leave
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEarlyLeave
              ? "Apply for early leave."
              : dayType === "FULL_DAY"
              ? "Apply for full day leave."
              : "Apply for leave for full day or half day."}
          </p>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Leave Type Section */}
            <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                1. Leave Type
              </h3>
              <div className="space-y-1.5 max-w-md">
                <label className="text-xs font-medium text-foreground">
                  Leave type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedTypeCode}
                  onValueChange={(val) => {
                    setSelectedTypeCode(val);
                    if (val === "EL") {
                      setDayType("EARLY_LEAVE");
                    } else if (dayType === "EARLY_LEAVE") {
                      setDayType("HALF_DAY");
                    }
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
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
              </div>
            </div>

            {/* 2. Leave Dates / Sessions Section */}
            <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                {isEarlyLeave ? "2. Date & Time" : "2. Leave Dates/Sessions"}
              </h3>

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
                      <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
                        <SelectValue placeholder="Select day type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HALF_DAY">Half Day</SelectItem>
                        <SelectItem value="FULL_DAY">Full Day</SelectItem>
                        <SelectItem value="MULTIPLE_DAYS">Multiple Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {dayType === "FULL_DAY" ? (
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
                            setFromDate(e.target.value);
                            setDate(e.target.value);
                          }}
                          className="h-10 rounded-xl text-xs bg-background"
                          required
                        />
                        <div className="text-[11px] text-muted-foreground font-medium pl-1">
                          {formatDateDisplay(fromDate)}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                          To Date <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="h-10 rounded-xl text-xs bg-background"
                          required
                        />
                        <div className="text-[11px] text-muted-foreground font-medium pl-1">
                          {formatDateDisplay(toDate)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Half Day / Multi Day */
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
                            onChange={(e) => setDate(e.target.value)}
                            className="h-10 rounded-xl text-xs bg-background"
                            required
                          />
                        </div>
                        <div className="text-[11px] text-muted-foreground font-medium pl-1">
                          {formatDateDisplay(date)}
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
                                "h-10 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
                                session === "FIRST_HALF"
                                  ? "border-primary bg-primary/10 text-primary shadow-2xs ring-1 ring-primary"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                                  session === "FIRST_HALF"
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground"
                                )}
                              />
                              <span>First Half (FN)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSession("SECOND_HALF")}
                              className={cn(
                                "h-10 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
                                session === "SECOND_HALF"
                                  ? "border-primary bg-primary/10 text-primary shadow-2xs ring-1 ring-primary"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-3 h-3 rounded-full border-2 flex items-center justify-center",
                                  session === "SECOND_HALF"
                                    ? "border-primary bg-primary"
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
                      className="h-10 rounded-xl text-xs bg-background max-w-md"
                      required
                    />
                    <div className="text-[11px] text-muted-foreground font-medium pl-1">
                      {formatDateDisplay(date)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        From Time <span className="text-red-500">*</span>{" "}
                        <span className="text-muted-foreground font-normal">(When leaving)</span>
                      </label>
                      <div className="relative">
                        <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={fromTime}
                          onChange={(e) => setFromTime(e.target.value)}
                          className="h-10 pl-9 rounded-xl text-xs bg-background"
                          placeholder="03:30 PM"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        To Time <span className="text-red-500">*</span>{" "}
                        <span className="text-muted-foreground font-normal">(End of shift)</span>
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
                </div>
              )}

              {/* Blue Selection Info Banner */}
              <div className="flex items-center gap-2 p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                <Info className="w-4 h-4 shrink-0" />
                <span>{durationInfo.summary}</span>
              </div>
            </div>

            {/* 3. Reason Section */}
            <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                3. Reason
              </h3>
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
                    className="min-h-[100px] text-xs resize-none bg-background rounded-xl p-3"
                    required
                  />
                  <div className="text-[10px] text-muted-foreground text-right mt-1 font-mono">
                    {reason.length}/500
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Attachments Section */}
            <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground tracking-tight">
                  4. Attachments
                </h3>
                <Paperclip className="w-4 h-4 text-muted-foreground" />
              </div>

              {/* Attached items list */}
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
                          <div className="text-[10px] text-muted-foreground">
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
            <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                5. Leave Summary
              </h3>

              <div className="border border-border rounded-xl overflow-hidden bg-background">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-4 font-semibold">LEAVE TYPE</th>
                      {isEarlyLeave ? (
                        <>
                          <th className="py-2.5 px-4 font-semibold">DATE</th>
                          <th className="py-2.5 px-4 font-semibold">FROM TIME (LEAVING)</th>
                          <th className="py-2.5 px-4 font-semibold">TO TIME (SHIFT END)</th>
                        </>
                      ) : dayType === "FULL_DAY" ? (
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
                          : selectedType.name}
                      </td>

                      {isEarlyLeave ? (
                        <>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {formatDateDisplay(date)}
                          </td>
                          <td className="py-3 px-4 text-foreground">{fromTime}</td>
                          <td className="py-3 px-4 text-foreground">{toTime}</td>
                        </>
                      ) : dayType === "FULL_DAY" ? (
                        <>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {formatDateDisplay(fromDate)}
                          </td>
                          <td className="py-3 px-4 font-medium text-foreground">
                            {formatDateDisplay(toDate)}
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
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                            isEarlyLeave
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                          )}
                        >
                          {durationInfo.text}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-between pt-2">
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
                  disabled={isSubmitting}
                  className="h-10 px-8 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                >
                  {isSubmitting ? "Applying..." : "Apply Leave"}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Remaining Leaves & Balance Summary Widgets */}
        <div className="lg:col-span-4 space-y-6">
          {/* Remaining Leaves Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Remaining Leaves
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Casual Leave */}
              <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                <div className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] text-muted-foreground font-medium">Casual Leave</div>
                <div className="text-xs font-bold text-primary">4 Days</div>
              </div>

              {/* Sick Leave */}
              <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                <div className="p-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500">
                  <Heart className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] text-muted-foreground font-medium">Sick Leave</div>
                <div className="text-xs font-bold text-primary">3 Days</div>
              </div>

              {/* Annual Leave */}
              <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                <div className="p-1.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-500">
                  <CalendarCheck className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] text-muted-foreground font-medium">Annual Leave</div>
                <div className="text-xs font-bold text-primary">5 Days</div>
              </div>

              {/* Comp Off */}
              <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                <div className="p-1.5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-500">
                  <History className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] text-muted-foreground font-medium">Comp Off</div>
                <div className="text-xs font-bold text-primary">1 Day</div>
              </div>

              {/* Early Leave */}
              <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                <div className="p-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-500">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] text-muted-foreground font-medium">Early Leave</div>
                <div className="text-xs font-bold text-primary">2 Days</div>
              </div>

              {/* +4 More */}
              <div className="p-3 rounded-xl border bg-background flex flex-col items-center justify-center text-center space-y-1">
                <div className="text-sm font-bold text-foreground">+4</div>
                <div className="text-[11px] text-muted-foreground font-medium">More</div>
              </div>
            </div>
          </div>

          {/* Balance Summary Card */}
          <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Balance Summary –{" "}
                <span className="text-primary">
                  {isEarlyLeave ? "Early Leave" : "Half Day Leave (HD)"}
                </span>
              </h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground pb-1 border-b">
                <span>
                  As on <span className="text-primary font-semibold underline">21/08/2026</span>
                </span>
                <span className="font-medium text-foreground">Day(s)</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Available balance</span>
                <span className="font-bold text-red-500">{availableBalance}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current booking</span>
                <span className="font-bold text-foreground">{currentBooking}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t font-semibold">
                <span className="text-primary font-bold">Balance after current booking</span>
                <span className="font-bold text-red-500">{balanceAfterBooking}</span>
              </div>
            </div>

            {/* Policy notice */}
            <div className="flex items-start gap-2 p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-700 dark:text-blue-300">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Negative balance is allowed as per company policy.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
