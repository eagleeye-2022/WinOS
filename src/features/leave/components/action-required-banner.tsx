"use client";

import React from "react";
import { AlertCircle, Calendar, UserCheck, Info } from "lucide-react";
import { ActionRequiredItem } from "../types";
import { Button } from "@/components/ui/button";

interface ActionRequiredBannerProps {
  items: ActionRequiredItem[];
  onRegularize: (item: ActionRequiredItem) => void;
  onApplyLeave: (item: ActionRequiredItem) => void;
}

export function ActionRequiredBanner({
  items,
  onRegularize,
  onApplyLeave,
}: ActionRequiredBannerProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/40 p-5 space-y-4 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-wide text-amber-950 dark:text-amber-300 uppercase">
              Action Required
            </h4>
            <p className="text-xs text-amber-800/90 dark:text-amber-400/90 mt-0.5">
              We couldn't find a record for the following date(s). Please choose how you'd like to update it.
            </p>
          </div>
        </div>

        <div className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          {items.length} Items
        </div>
      </div>

      {/* Table of items */}
      <div className="bg-background/80 dark:bg-background/50 border border-amber-200/60 dark:border-amber-900/40 rounded-xl overflow-hidden shadow-2xs">
        <div className="grid grid-cols-12 px-4 py-2.5 bg-amber-100/50 dark:bg-amber-950/40 border-b border-amber-200/50 dark:border-amber-900/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-3">Date</div>
          <div className="col-span-5">Issue</div>
          <div className="col-span-4 text-right pr-2">Choose an action</div>
        </div>

        <div className="divide-y divide-border/60">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-12 px-4 py-3 items-center hover:bg-muted/40 transition-colors text-xs"
            >
              {/* Date */}
              <div className="col-span-3 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">{item.date}</div>
                  <div className="text-[11px] text-muted-foreground">{item.dayOfWeek}</div>
                </div>
              </div>

              {/* Issue */}
              <div className="col-span-5 text-muted-foreground font-medium">
                {item.issue}
              </div>

              {/* Actions */}
              <div className="col-span-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRegularize(item)}
                  className="h-8 px-3 text-xs font-medium text-primary hover:text-primary hover:bg-primary/5 border-primary/30"
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Regularize
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onApplyLeave(item)}
                  className="h-8 px-3 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-blue-300 dark:border-blue-800"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  Apply Leave
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-center gap-2 text-xs text-amber-900/80 dark:text-amber-400/90 pt-1">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>If you worked on these dates, regularize your attendance. If you were absent, apply for leave.</span>
      </div>
    </div>
  );
}
