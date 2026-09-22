"use client";

import React, { useRef } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { LeaveTypeConfig } from "../types";
import { LeaveBalanceCard } from "./leave-balance-card";
import { Button } from "@/components/ui/button";

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
    <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
      {/* Header with Title and Scroll Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground tracking-tight">
            Leave Balance
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
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
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/30 scroll-smooth"
      >
        {leaveTypes.map((type) => (
          <LeaveBalanceCard
            key={type.id}
            type={type}
            isSelected={selectedTypeId === type.id}
            onClick={() => onSelectType?.(type)}
          />
        ))}
      </div>
    </div>
  );
}
