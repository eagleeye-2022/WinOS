"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  /** Shown on the trigger when nothing is selected, and as the "clear" row at the top of the list. */
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** Classes for the trigger button — pass the same text/size classes the old <select> used. */
  className?: string;
};

/**
 * Drop-in replacement for the native project/task/subtask <select>s: same value/onChange shape,
 * plus a search box that filters the list (case-insensitive, matches anywhere in the label, so
 * "[EC2-T3311] DSM" is found by either the code or the title).
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Search...",
  disabled,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // Row 0 is always the placeholder ("clear selection") row; options follow from index 1.
  const rows: SearchableSelectOption[] = React.useMemo(
    () => [{ value: "", label: placeholder }, ...filtered],
    [placeholder, filtered]
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      const idx = options.findIndex((o) => o.value === value);
      setActiveIndex(idx >= 0 ? idx + 1 : 0);
    }
  };

  const choose = (v: string) => {
    if (v !== value) onChange(v);
    setOpen(false);
  };

  React.useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // don't submit the surrounding form
      const row = rows[activeIndex];
      if (row) choose(row.value);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          title={selected?.label}
          className={cn(
            "inline-flex min-w-0 cursor-pointer items-center gap-1 text-left outline-none disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-0"
        onOpenAutoFocus={(e) => {
          // Focus the search box rather than the first focusable row.
          e.preventDefault();
          (e.currentTarget as HTMLElement).querySelector("input")?.focus();
        }}
      >
        <div className="flex items-center gap-2 border-b px-2.5 py-2">
          <Search size={13} className="shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(e.target.value.trim() ? 1 : 0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto p-1">
          {rows.map((row, i) => {
            const isPlaceholder = i === 0;
            const isSelected = row.value === value;
            return (
              <li
                key={isPlaceholder ? "__placeholder" : row.value}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(row.value)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs",
                  i === activeIndex ? "bg-muted text-foreground" : "text-foreground",
                  isPlaceholder && "text-muted-foreground"
                )}
              >
                <Check size={12} className={cn("shrink-0", isSelected ? "text-primary" : "invisible")} />
                <span className="truncate" title={row.label}>
                  {row.label}
                </span>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-2 py-3 text-center text-xs text-muted-foreground">No matches found</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
