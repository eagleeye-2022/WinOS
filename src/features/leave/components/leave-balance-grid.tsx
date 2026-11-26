"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { LeaveTypeConfig } from "../types";
import { LeaveBalanceCard } from "./leave-balance-card";
import { Button } from "@/components/ui/button";
import { compareLeaveTypes } from "../leave-rules";

interface LeaveBalanceGridProps {
  leaveTypes: LeaveTypeConfig[];
  selectedTypeId?: string;
  onSelectType?: (type: LeaveTypeConfig) => void;
}

export function LeaveBalanceGrid({
  leaveTypes,
  selectedTypeId,
  onSelectType,
}: LeaveBalanceGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Fixed order: Paid → Sick → Compensatory → Floating → Unpaid → others.
  const sortedTypes = useMemo(() => [...leaveTypes].sort(compareLeaveTypes), [leaveTypes]);
  // Scroll arrows only when the cards don't all fit.
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      setOverflows(false);
      return;
    }
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [leaveTypes.length]);

  const handleScroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 350;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {/* Header with Title and Scroll Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Leave Balance</h3>
          </div>
        </div>

        <div className={overflows ? "flex items-center gap-1.5" : "hidden"}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => handleScroll("left")}
            className="h-7 w-7 rounded-lg border-border/80 text-muted-foreground hover:text-foreground"
            title="Scroll Left"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => handleScroll("right")}
            className="h-7 w-7 rounded-lg border-border/80 text-muted-foreground hover:text-foreground"
            title="Scroll Right"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      {leaveTypes.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No leave balances found in the database.
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30 scroll-smooth"
        >
          {sortedTypes.map((type) => (
            <LeaveBalanceCard
              key={type.id}
              type={type}
              isSelected={selectedTypeId === type.id}
              onClick={() => onSelectType?.(type)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
