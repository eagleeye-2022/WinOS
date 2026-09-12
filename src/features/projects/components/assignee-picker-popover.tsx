"use client";

import React, { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { TeamMemberOption } from "../types";
import { AnchoredPopover } from "./popover-portal";

const AVATAR_COLORS = [
  "bg-amber-500 text-white",
  "bg-emerald-500 text-white",
  "bg-sky-500 text-white",
  "bg-purple-500 text-white",
  "bg-rose-500 text-white",
  "bg-indigo-500 text-white",
  "bg-teal-500 text-white",
  "bg-orange-500 text-white",
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Only these two department tabs are surfaced as quick filters (search still reaches everyone
// regardless of department) — trimmed down from every distinct department per request.
const VISIBLE_DEPARTMENT_TABS = ["Management", "Operation"];

interface AssigneePickerPopoverProps {
  members: TeamMemberOption[];
  selectedIds: string[];
  onToggle: (member: TeamMemberOption) => void;
  onClearAll: () => void;
  onClose: () => void;
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: "left" | "right";
}

/** Multi-select team member picker popover: search + department tabs + checkmark list. Portals to
 *  `document.body` (via `AnchoredPopover`) so it isn't clipped when triggered from inside an
 *  `overflow-hidden` table cell. */
export function AssigneePickerPopover({
  members,
  selectedIds,
  onToggle,
  onClearAll,
  onClose,
  isOpen,
  anchorRef,
  align = "left",
}: AssigneePickerPopoverProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");

  const departments = useMemo(() => {
    const present = new Set(members.map((m) => m.department).filter(Boolean));
    return VISIBLE_DEPARTMENT_TABS.filter((d) => present.has(d));
  }, [members]);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesTab = activeTab === "ALL" || m.department === activeTab;
      const matchesSearch =
        search.trim() === "" ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [members, activeTab, search]);

  return (
    <AnchoredPopover anchorRef={anchorRef} isOpen={isOpen} onClose={onClose} className="w-72" align={align}>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Search size={13} className="text-muted-foreground shrink-0" />
        <input
          autoFocus
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team members..."
          className="bg-transparent outline-none flex-1 min-w-0 text-xs"
        />
      </div>

      {departments.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              activeTab === "ALL" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            All ({members.length})
          </button>
          {departments.map((dep) => (
            <button
              key={dep}
              type="button"
              onClick={() => setActiveTab(dep)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                activeTab === dep ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {dep}
            </button>
          ))}
        </div>
      )}

      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Team Members</span>
        {selectedIds.length > 0 && (
          <span className="text-[10px] font-semibold text-muted-foreground/70">{selectedIds.length} selected</span>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground italic">No matching members</div>
        ) : (
          filtered.map((m) => {
            const isSelected = selectedIds.includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => onToggle(m)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left transition-colors ${
                  isSelected ? "bg-primary/10" : "hover:bg-accent"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${getAvatarColor(
                      m.name
                    )}`}
                  >
                    {getInitials(m.name)}
                  </span>
                  <span className="min-w-0">
                    <div className={`truncate font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                      {m.name}
                    </div>
                    {m.title && <div className="truncate text-[10px] text-muted-foreground">{m.title}</div>}
                  </span>
                </div>
                {isSelected && <Check size={14} className="text-primary shrink-0" />}
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between border-t px-3 py-2 bg-muted/20">
        <button
          type="button"
          onClick={onClearAll}
          disabled={selectedIds.length === 0}
          className="text-[11px] font-semibold text-destructive hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
        >
          Remove All
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Done
        </button>
      </div>
    </AnchoredPopover>
  );
}
