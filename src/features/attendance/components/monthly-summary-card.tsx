"use client";

import React from "react";
import { BarChart3, Briefcase, CalendarCheck, CalendarX2, CircleCheck } from "lucide-react";
import { MonthlySummary } from "../types";
import { PulseCard, TONE_SOFT, type PulseTone } from "@/components/pulse/pulse-ui";
import { cn } from "@/lib/utils";

interface MonthlySummaryCardProps {
  summary: MonthlySummary;
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
}

export function MonthlySummaryCard({ summary, selectedMonth }: MonthlySummaryCardProps) {
  const stats: { label: string; value: number; tone: PulseTone; icon: React.ReactNode }[] = [
    { label: "Working Days", value: summary.totalWorkingDays, tone: "blue", icon: <Briefcase className="h-4 w-4" /> },
    { label: "Present", value: summary.presentDays, tone: "green", icon: <CircleCheck className="h-4 w-4" /> },
    { label: "Leaves Taken", value: summary.leavesTaken, tone: "amber", icon: <CalendarCheck className="h-4 w-4" /> },
    { label: "Absent", value: summary.absentDays, tone: "red", icon: <CalendarX2 className="h-4 w-4" /> },
  ];

  return (
    <PulseCard
      icon={<BarChart3 className="h-4 w-4" />}
      title="Monthly Summary"
      subtitle={summary.month || selectedMonth}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-md border border-border/70 px-4 py-3">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", TONE_SOFT[s.tone])}>
              {s.icon}
            </span>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </PulseCard>
  );
}
