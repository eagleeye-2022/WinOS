"use client";

import React from "react";
import {
  AlertTriangle,
  Calendar,
  UserCheck,
  CalendarPlus,
} from "lucide-react";
import { ActionRequiredItem } from "../types";

interface ActionRequiredSectionProps {
  items: ActionRequiredItem[];
  onRegularize: (item: ActionRequiredItem) => void;
  onApplyLeave: (item: ActionRequiredItem) => void;
}

export function ActionRequiredSection({
  items,
  onRegularize,
  onApplyLeave,
}: ActionRequiredSectionProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white dark:bg-card rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm overflow-hidden">
      {/* Top Banner Header */}
      <div className="p-6 bg-amber-50/40 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-extrabold tracking-wider uppercase text-zinc-900 dark:text-zinc-100">
                  ACTION REQUIRED
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200">
                  {items.length} {items.length === 1 ? "Item" : "Items"}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                You have attendance/leave issues that need your action.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              <th className="px-6 py-3.5 font-medium">Date</th>
              <th className="px-6 py-3.5 font-medium">Issue</th>
              <th className="px-6 py-3.5 font-medium text-right sm:text-left">
                Choose an action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors"
              >
                {/* Date */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">
                        {item.formattedDate}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {item.dayName}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Issue */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {item.issue}
                  </span>
                </td>

                {/* Action Buttons */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onRegularize(item)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 dark:border-zinc-700/80 bg-blue-50/50 hover:bg-blue-100/70 dark:bg-accent dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-semibold transition-all shadow-xs"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Regularize Attendance</span>
                    </button>

                    <button
                      onClick={() => onApplyLeave(item)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 dark:border-zinc-700/80 bg-white hover:bg-blue-50/50 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-blue-600 dark:text-blue-400 text-xs font-semibold transition-all shadow-xs"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      <span>Apply Leave</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
