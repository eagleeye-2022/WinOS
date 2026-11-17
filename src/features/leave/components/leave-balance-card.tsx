"use client";

import React from "react";
import {
  Pill,
  Banknote,
  Laptop2,
  AlertTriangle,
  Clock,
  Gift,
  CalendarX,
  UserX,
  TimerReset,
  Sparkles,
  Users,
  Heart,
  Calendar,
  CalendarDays,
  CalendarCheck,
  History,
  Thermometer,
  Plane,
  Baby,
  FileText,
  Coffee,
  Sun,
  Briefcase,
} from "lucide-react";
import { LeaveTypeConfig } from "../types";
import { cn } from "@/lib/utils";

interface LeaveBalanceCardProps {
  type: LeaveTypeConfig;
  isSelected?: boolean;
  onClick?: () => void;
}

/** The Lucide icon for a leave type's stored icon name (Calendar when unknown). */
export function leaveTypeIcon(name: string) {
  {
    switch (name) {
      case "Thermometer":
        return Thermometer;
      case "Heart":
        return Heart;
      case "Pill":
        return Pill;
      case "Plane":
        return Plane;
      case "Calendar":
        return Calendar;
      case "CalendarDays":
        return CalendarDays;
      case "Baby":
        return Baby;
      case "Users":
        return Users;
      case "Clock":
        return Clock;
      case "Gift":
        return Gift;
      case "AlertTriangle":
        return AlertTriangle;
      case "Sparkles":
        return Sparkles;
      case "FileText":
        return FileText;
      case "Laptop2":
        return Laptop2;
      case "Coffee":
        return Coffee;
      case "Sun":
        return Sun;
      case "Briefcase":
        return Briefcase;
      case "TimerReset":
        return TimerReset;
      case "Banknote":
        return Banknote;
      case "CalendarX":
        return CalendarX;
      case "UserX":
        return UserX;
      case "CalendarCheck":
        return CalendarCheck;
      case "History":
        return History;
      default:
        return Calendar;
    }
  }
}

export function LeaveBalanceCard({ type, isSelected, onClick }: LeaveBalanceCardProps) {
  const icon = React.createElement(leaveTypeIcon(type.iconName || "Calendar"), { className: "h-6 w-6" });

  return (
    <div
      onClick={onClick}
      title={onClick ? `Apply ${type.name}` : undefined}
      className={cn(
        "flex w-[220px] shrink-0 select-none flex-col rounded-xl border border-border/70 bg-card p-5 transition-all duration-200",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:hover:border-blue-500/50",
        isSelected && "border-blue-500 ring-2 ring-blue-500/30"
      )}
    >
      {/* Name */}
      <p className="line-clamp-1 text-center text-[15px] font-semibold text-foreground" title={type.name}>
        {type.name}
      </p>

      {/* Icon in a soft rounded square */}
      <div
        className={cn(
          "mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-xl",
          type.iconBgColor,
          type.iconTextColor
        )}
      >
        {icon}
      </div>

      {/* Available / Booked */}
      <div className="mt-5 space-y-3 border-t border-border/70 pt-4 text-[15px]">
        <div className="flex items-center justify-between">
          <span className="text-foreground">Available</span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              type.remainingDays < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
            )}
            title={`${type.remainingDays} ${type.unit}`}
          >
            {type.remainingDays}
          </span>
        </div>
        {!type.hideBooked && (
        <div className="flex items-center justify-between">
          <span className="text-foreground">Booked</span>
          <span className="font-semibold tabular-nums text-foreground" title={`${type.bookedDays} ${type.unit}`}>
            {type.bookedDays}
          </span>
        </div>
        )}
      </div>
    </div>
  );
}
