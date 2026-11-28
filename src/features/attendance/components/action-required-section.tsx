"use client";

import React from "react";
import { AlertTriangle, CalendarPlus, ChevronDown, UserCheck } from "lucide-react";
import { ActionRequiredItem } from "../types";
import { DateTile, PulseCard } from "@/components/pulse/pulse-ui";
import { usePageViewState } from "@/lib/navigation/use-url-state";
import { cn } from "@/lib/utils";

interface ActionRequiredSectionProps {
  items: ActionRequiredItem[];
  onRegularize: (item: ActionRequiredItem) => void;
  onApplyLeave: (item: ActionRequiredItem) => void;
}

/** Items shown before "Show more". */
const PREVIEW_COUNT = 5;

export function ActionRequiredSection({ items, onRegularize, onApplyLeave }: ActionRequiredSectionProps) {
  const [showAll, setShowAll] = usePageViewState("ActionRequiredSection:showAll", false);
  if (!items || items.length === 0) return null;

  // Latest first; only the latest few until expanded.
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const hasMore = sorted.length > PREVIEW_COUNT;
  const visible = showAll ? sorted : sorted.slice(0, PREVIEW_COUNT);

  return (
    <PulseCard
      icon={<AlertTriangle className="h-4 w-4" />}
      iconTone="red"
      title="Action Required"
      action={
        hasMore ? (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            aria-expanded={showAll}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            {showAll ? "Show less" : `Show more (${sorted.length - PREVIEW_COUNT})`}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
          </button>
        ) : undefined
      }
      bodyClassName="px-0 pb-0 pt-3"
    >
      <ul className="divide-y divide-border/70 border-t border-border/70">
        {visible.map((item) => {
          const [d, m] = item.formattedDate.split(" ");
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <DateTile day={d} month={m} tone="red" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">{item.issue}</p>
                <p className="text-xs text-muted-foreground">
                  {item.formattedDate} · {item.dayName}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onRegularize(item)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Regularize
                </button>
                <button
                  type="button"
                  onClick={() => onApplyLeave(item)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Apply Leave
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </PulseCard>
  );
}
