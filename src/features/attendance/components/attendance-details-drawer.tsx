"use client";

import React from "react";
import Image from "next/image";
import {
  X,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  User,
  Fingerprint,
  Globe,
  Smartphone,
  MapPin,
  Briefcase,
  Layers,
  CalendarDays,
  Image as ImageIcon,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  CornerDownRight,
  Award,
  CalendarPlus,
  Radio,
} from "lucide-react";
import { AttendanceRecord, ActionRequiredItem } from "../types";
import { cn } from "@/lib/utils";

interface AttendanceDetailsDrawerProps {
  record: AttendanceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onRegularize?: (record: AttendanceRecord) => void;
  onApplyLeave?: (record: AttendanceRecord) => void;
  onRequestCompOff?: (record: AttendanceRecord) => void;
}

export function AttendanceDetailsDrawer({
  record,
  isOpen,
  onClose,
  onRegularize,
  onApplyLeave,
  onRequestCompOff,
}: AttendanceDetailsDrawerProps) {
  if (!isOpen || !record) return null;

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case "Fingerprint":
        return <Fingerprint className="w-4 h-4 text-slate-500" />;
      case "Web":
        return <Globe className="w-4 h-4 text-slate-500" />;
      case "Mobile App":
        return <Smartphone className="w-4 h-4 text-slate-500" />;
      default:
        return <Globe className="w-4 h-4 text-slate-500" />;
    }
  };

  const isFullLeave = record.status === "ON_LEAVE";
  const isHalfDay = record.status === "HALF_DAY_LEAVE";
  const isEarlyLeave = record.status === "EARLY_LEAVE";
  const isWorkingNow = record.status === "WORKING_NOW";
  const isPresent = record.status === "PRESENT";
  const isActionRequired = record.status === "ACTION_REQUIRED";
  const isHoliday = record.status === "HOLIDAY";
  const isHolidayWork = isHoliday && (Boolean(record.checkInTime) || Boolean(record.checkOutTime) || record.compensatoryWork?.isHolidayWork);

  const missingType = record.actionRequiredType || (!record.checkInTime && !record.checkOutTime ? "MISSING_BOTH" : !record.checkInTime ? "MISSING_CHECKIN" : "MISSING_CHECKOUT");

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-[430px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
          {/* Top Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Attendance Details
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Selected Date Header */}
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200 font-semibold text-base">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>{record.formattedDate}</span>
            </div>

            {/* 1. Still Working Top Banner (Batch 2 Image 2) */}
            {isWorkingNow && (
              <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping absolute" />
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    Still Working
                  </h4>
                  <p className="text-xs text-blue-600/90 dark:text-blue-400 mt-0.5">
                    You are currently checked-in.
                  </p>
                </div>
              </div>
            )}

            {/* 2. Early Leave Top Banner (Batch 2 Image 3) */}
            {isEarlyLeave && (
              <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200">
                    Early Leave
                  </h4>
                  <p className="text-xs text-amber-700/90 dark:text-amber-300 mt-0.5">
                    You left early on this day.
                  </p>
                </div>
              </div>
            )}

            {/* 3. Action Required Top Banner (Batch 2 Images 1 & 4) */}
            {isActionRequired && (
              <div className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-700 dark:text-rose-300">
                    Action Required
                  </h4>
                  <p className="text-xs text-rose-600/90 dark:text-rose-400 mt-0.5">
                    Your attendance is incomplete for this day.
                  </p>
                </div>
              </div>
            )}

            {/* 4. Holiday Top Banner (Batch 2 Image 5) */}
            {isHoliday && (
              <div className="p-6 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-blue-50/80 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-2xl shadow-xs mb-3">
                  🇮🇳
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Company Holiday
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                  {record.holidayInfo?.name || "Independence Day"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {record.formattedDate}
                </p>
              </div>
            )}

            {/* 5. Present Top Banner (Batch 1 Image 5) */}
            {isPresent && (
              <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-3">
                <div className="p-1 rounded-full bg-emerald-500 text-white shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    Present
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                    You were present for this day.
                  </p>
                </div>
              </div>
            )}

            {/* 6. Half-Day Top Banner (Batch 1 Image 1) */}
            {isHalfDay && (
              <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300 shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    Half-Day Leave
                  </h4>
                  <p className="text-xs text-amber-600/90 dark:text-amber-400 mt-0.5">
                    You were on leave for the first half.
                  </p>
                </div>
              </div>
            )}

            {/* 7. On Leave Top Banner (Batch 1 Image 3) */}
            {isFullLeave && (
              <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300 shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    On Leave
                  </h4>
                  <p className="text-xs text-amber-600/90 dark:text-amber-400 mt-0.5">
                    You were on leave for this day.
                  </p>
                </div>
              </div>
            )}

            {/* ── SECTION: ISSUE (If Action Required) ────────────────────── */}
            {isActionRequired && (
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  ISSUE
                </h5>
                <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-500 flex items-center justify-center shrink-0">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      {missingType === "MISSING_BOTH"
                        ? "Missing Check-in and Check-out"
                        : missingType === "MISSING_CHECKIN"
                        ? "Missing Check-in"
                        : "Missing Check-out"}
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {missingType === "MISSING_BOTH"
                        ? "No check-in and check-out was recorded for this day."
                        : missingType === "MISSING_CHECKIN"
                        ? "No check-in was recorded for this day."
                        : "No check-out was recorded for this day."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── SECTION: Compensatory Work Header ────────────────────────── */}
            {isHolidayWork && (
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 pt-1">
                <Briefcase className="w-4 h-4 text-slate-500" />
                <span>Compensatory Work</span>
              </div>
            )}

            {/* ── SECTION: Check-in / Check-out Timeline ───────────────────── */}
            {(record.checkInTime || record.checkOutTime) && (
              <div className="space-y-4 pt-1">
                {/* Check In Block */}
                {record.checkInTime && (
                  <div className="relative pl-6 border-l-2 border-emerald-500 dark:border-emerald-600 space-y-2 py-0.5">
                    <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        CHECK-IN
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {record.checkInTime}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-500">
                          {getSourceIcon(record.checkInSource)} Attendance Source
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {record.checkInSource || "Fingerprint"}
                        </span>
                      </div>

                      <div className="flex items-start justify-between">
                        <span className="flex items-center gap-2 text-slate-500 pt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location
                        </span>
                        <div className="text-right max-w-[200px]">
                          <p className="font-semibold text-blue-600 dark:text-blue-400">
                            {record.checkInLocation?.name || "Hyderabad Office"}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {record.checkInLocation?.address || "HITEC City, Madhapur, Hyderabad – 500081"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Check Out Block */}
                {record.checkOutTime && (
                  <div className="relative pl-6 border-l-2 border-emerald-500 dark:border-emerald-600 space-y-2 py-0.5 pt-2">
                    <div className="absolute -left-[5px] top-3 w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        CHECK-OUT
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {record.checkOutTime}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-500">
                          {getSourceIcon(record.checkOutSource)} Attendance Source
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {record.checkOutSource || "Web"}
                        </span>
                      </div>

                      <div className="flex items-start justify-between">
                        <span className="flex items-center gap-2 text-slate-500 pt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location
                        </span>
                        <div className="text-right max-w-[200px]">
                          <p className="font-semibold text-blue-600 dark:text-blue-400">
                            {record.checkOutLocation?.name || "Hyderabad Office"}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {record.checkOutLocation?.address || "HITEC City, Madhapur, Hyderabad – 500081"}
                          </p>
                        </div>
                      </div>

                      {/* Captured Image if available */}
                      {record.checkOutPhoto && (
                        <div className="flex items-start justify-between pt-1">
                          <span className="flex items-center gap-2 text-slate-500 pt-1">
                            <ImageIcon className="w-3.5 h-3.5 text-slate-400" /> Captured Image
                          </span>
                          <div className="w-20 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-sm relative">
                            <img
                              src={record.checkOutPhoto}
                              alt="Captured check-out selfie"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SECTION: Still Working Active Live Card (Batch 2 Image 2) ── */}
            {isWorkingNow && (
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      STILL WORKING
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      You are currently checked-in and working.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-100 dark:border-blue-900/60">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Live Duration</span>
                  </div>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {record.workedDuration || "3h 34m"}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {record.liveSince || `Since ${record.checkInTime || "09:08 AM"}`}
                  </p>
                </div>
              </div>
            )}

            {/* ── SECTION: Early Leave (Approved) Info (Batch 2 Image 3) ──── */}
            {isEarlyLeave && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    EARLY LEAVE
                  </h5>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    (Approved)
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <FileText className="w-3.5 h-3.5 text-slate-400" /> Leave Type
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {record.earlyLeaveInfo?.leaveType || "Early Leave"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> From
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {record.earlyLeaveInfo?.from || record.checkOutTime || "04:00 PM"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> To
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {record.earlyLeaveInfo?.to || "06:30 PM"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" /> Leave Status
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {record.earlyLeaveInfo?.status || "Approved"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="flex items-center gap-2 text-slate-500">
                      <User className="w-3.5 h-3.5 text-slate-400" /> Approved By
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          {record.earlyLeaveInfo?.approvedBy?.name || "Rohit Sharma"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {record.earlyLeaveInfo?.approvedBy?.role || "HR Manager"}
                        </p>
                      </div>
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                        alt="HR Manager"
                        className="w-7 h-7 rounded-full object-cover border border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── SECTION: Leave Info Block (For Casual / Sick Leaves) ─────── */}
            {record.leaveInfo && (
              <div className="space-y-4 pt-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Leave Information
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <FileText className="w-4 h-4 text-slate-400" /> Leave Type
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {record.leaveInfo.leaveType}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Clock className="w-4 h-4 text-slate-400" /> Duration
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {record.leaveInfo.duration}
                    </span>
                  </div>

                  {record.leaveInfo.session ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Layers className="w-4 h-4 text-slate-400" /> Session
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {record.leaveInfo.session}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <CalendarDays className="w-4 h-4 text-slate-400" /> Leave Date
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {record.formattedDate}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <CheckCircle2 className="w-4 h-4 text-slate-400" /> Leave Status
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {record.leaveInfo.status}
                    </span>
                  </div>

                  {record.leaveInfo.appliedOn && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Clock className="w-4 h-4 text-slate-400" /> Applied On
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {record.leaveInfo.appliedOn}
                      </span>
                    </div>
                  )}

                  {record.leaveInfo.approvedBy && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <User className="w-4 h-4 text-slate-400" /> Approved By
                      </span>
                      <div className="flex items-center gap-2.5">
                        <div className="text-right">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                            {record.leaveInfo.approvedBy.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {record.leaveInfo.approvedBy.role}
                          </p>
                        </div>
                        {record.leaveInfo.approvedBy.avatarUrl ? (
                          <img
                            src={record.leaveInfo.approvedBy.avatarUrl}
                            alt={record.leaveInfo.approvedBy.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-600">
                            RS
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SECTION: WHAT YOU CAN DO (Batch 2 Images 1 & 4) ──────────── */}
            {isActionRequired && (
              <div className="space-y-3 pt-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  WHAT YOU CAN DO
                </h5>

                {/* Option 1: Regularize Attendance */}
                <button
                  onClick={() => onRegularize?.(record)}
                  className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-between group text-left shadow-xs hover:shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                        Regularize Attendance
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Correct or submit the missing attendance details.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Option 2: Apply Leave (shown if missing both or full day issue) */}
                {missingType === "MISSING_BOTH" && (
                  <button
                    onClick={() => onApplyLeave?.(record)}
                    className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-between group text-left shadow-xs hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline">
                          Apply Leave
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Apply for leave for this date instead.
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
            )}

            {/* ── SECTION: Compensatory Request Button (Batch 2 Image 5) ───── */}
            {isHolidayWork && (
              <div className="pt-2">
                <button
                  onClick={() => onRequestCompOff?.(record)}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Compensatory Request</span>
                </button>
              </div>
            )}

            {/* ── SECTION: WORK DETAILS ───────────────────────────────────── */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                <span className="w-2 h-2 rounded-full bg-purple-600" />
                <span>
                  {isWorkingNow || isActionRequired || isHolidayWork
                    ? "WORK DETAILS (Live)"
                    : "WORK DETAILS"}
                </span>
              </div>

              {record.workedDuration ? (
                <div className="flex items-center justify-between text-sm py-1">
                  <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Worked Duration
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {record.workedDuration}
                  </span>
                </div>
              ) : isActionRequired ? (
                <div className="flex items-center justify-between text-sm py-1">
                  <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Worked Duration
                  </span>
                  <span className="font-bold text-slate-400">-</span>
                </div>
              ) : isFullLeave ? (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-400">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      No attendance recorded
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      You were on leave for this day.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm py-1">
                  <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Worked Duration
                  </span>
                  <span className="font-bold text-slate-400">-</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
