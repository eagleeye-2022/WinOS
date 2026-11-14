"use client";

import React from "react";
import { AlertTriangle, CalendarPlus, UserCheck } from "lucide-react";
import { ActionRequiredItem } from "../types";
import { PulseCard, StatusPill } from "@/components/pulse/pulse-ui";

interface ActionRequiredSectionProps {
  items: ActionRequiredItem[];
  onRegularize: (item: ActionRequiredItem) => void;
  onApplyLeave: (item: ActionRequiredItem) => void;
}

export function ActionRequiredSection({ items, onRegularize, onApplyLeave }: ActionRequiredSectionProps) {
  if (!items || items.length === 0) return null;

  return (
    <PulseCard
      icon={<AlertTriangle className="h-4 w-4" />}
      iconTone="red"
      title={
        <span className="inline-flex items-center gap-2">
          Action Required
          <StatusPill tone="red">
            {items.length} {items.length === 1 ? "item" : "items"}
          </StatusPill>
        </span>
      }
      bodyClassName="px-0 pb-0 pt-3"
    >
      <ul className="divide-y divide-border/70 border-t border-border/70">
        {items.map((item) => {
          const [d, m] = item.formattedDate.split(" ");
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border border-l-4 border-border/70 border-l-rose-500 text-center leading-none">
                <span className="text-sm font-bold text-foreground">{d}</span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase text-muted-foreground">{m?.slice(0, 3)}</span>
              </div>
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
