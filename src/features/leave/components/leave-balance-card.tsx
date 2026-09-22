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
  CalendarCheck,
  History,
  HelpCircle,
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

  const Icon = getIcon(type.iconName);

  return (
    <div
      onClick={onClick}
      className={cn(
        "min-w-[150px] max-w-[170px] flex-1 bg-card border rounded-xl p-3.5 flex flex-col justify-between transition-all duration-200 select-none",
        onClick && "cursor-pointer hover:border-primary/50 hover:shadow-xs",
        isSelected && "ring-2 ring-primary border-primary bg-primary/5 shadow-xs"
      )}
    >
      {/* Top row with icon and title */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("p-1.5 rounded-lg shrink-0 flex items-center justify-center", type.iconBgColor)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold text-foreground line-clamp-1 leading-tight" title={type.name}>
          {type.name}
        </span>
      </div>

      {/* Metric values */}
      <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border/40 text-center">
        <div>
          <div className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
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
          <div className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
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
