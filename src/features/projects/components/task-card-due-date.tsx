"use client";

import React, { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/** "DD/MM/YYYY" (how tasks store dates) or any parseable date -> "YYYY-MM-DD" for <input type="date">. */
function toInputDate(value?: string): string {
  if (!value || value === "--" || !/\d/.test(value)) return "";
  const parts = value.trim().split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
}

/**
 * The due date on a task card. Click it to pick a new date; clearing the picker removes the date.
 * `onChange` gets the date as "DD/MM/YYYY", or "--" when cleared.
 */
export function TaskCardDueDate({
  dueDate,
  canEdit,
  disabledReason,
  onChange,
}: {
  dueDate?: string;
  canEdit: boolean;
  disabledReason?: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasDate = Boolean(dueDate && dueDate !== "--");

  const openPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  };

  return (
    <span className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={openPicker}
        disabled={!canEdit}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 font-medium text-muted-foreground transition-colors",
          canEdit ? "cursor-pointer hover:bg-slate-200/70 hover:text-foreground dark:hover:bg-neutral-800" : "cursor-default"
        )}
        title={canEdit ? (hasDate ? `Due ${dueDate} — click to change` : "Set due date") : disabledReason ?? `Due ${dueDate}`}
      >
        <CalendarDays size={12} /> {hasDate ? dueDate : null}
      </button>
      <input
        ref={inputRef}
        type="date"
        tabIndex={-1}
        aria-label="Due date"
        value={toInputDate(dueDate)}
        onChange={(e) => {
          const iso = e.target.value;
          if (!iso) return onChange("--");
          const [y, m, d] = iso.split("-");
          onChange(`${d}/${m}/${y}`);
        }}
        className="pointer-events-none absolute left-0 top-full h-0 w-0 opacity-0"
      />
    </span>
  );
}
