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
  HelpCircle,
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

export function LeaveBalanceCard({ type, isSelected, onClick }: LeaveBalanceCardProps) {
  const getIcon = (name: string) => {
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
  };

  const icon = React.createElement(getIcon(type.iconName || "Calendar"), { className: "w-4 h-4" });

  return (
    <div
      onClick={onClick}
      className={cn(
        "min-w-[152px] max-w-[172px] flex-1 bg-card border rounded-xl p-3.5 flex flex-col justify-between transition-all duration-200 select-none",
        onClick && "cursor-pointer hover:border-primary/50 hover:shadow-xs",
        isSelected && "ring-2 ring-primary border-primary bg-primary/5 shadow-xs"
      )}
    >
      {/* Top row with icon and title */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("p-1.5 rounded-lg shrink-0 flex items-center justify-center", type.iconBgColor)}>
          {icon}
        </div>
        <span className="text-xs font-semibold text-foreground line-clamp-1 leading-tight" title={type.name}>
          {type.name}
        </span>
      </div>

      {/* Metric values */}
      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border/40 text-center">
        <div>
          <div className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase whitespace-nowrap">
            Remaining
          </div>
          <div className="text-base font-bold text-primary">
            {type.remainingDays}
          </div>
          <div className="text-[9px] text-muted-foreground/80 -mt-0.5">
            {type.unit}
          </div>
        </div>

        <div className="border-l border-border/50">
          <div className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase whitespace-nowrap">
            Booked
          </div>
          <div className="text-base font-bold text-foreground/80">
            {type.bookedDays}
          </div>
          <div className="text-[9px] text-muted-foreground/80 -mt-0.5">
            {type.unit}
          </div>
        </div>
      </div>
    </div>
  );
}
