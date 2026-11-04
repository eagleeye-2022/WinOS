"use client";

import { useState } from "react";
import { Search, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type InternalUser = { id: string; name: string | null; email: string };

type Props = {
  users: InternalUser[];
  currentUserId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function ParticipantPicker({ users, currentUserId, selectedIds, onChange }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  // The organizer is listed first, then all selected participants, followed by remaining users.
  const ordered = [...users].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    const aSel = selectedIds.includes(a.id);
    const bSel = selectedIds.includes(b.id);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return (a.name || a.email).localeCompare(b.name || b.email);
  });

  const filtered = ordered.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  }

  return (
    <div className="rounded-lg border border-input bg-background overflow-hidden flex flex-col">
      {/* Search Input Bar */}
      <div className="relative border-b border-border px-3 py-2 flex items-center gap-2 bg-muted/20">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search participants by name or email..."
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Filtered Participant List */}
      <div className="max-h-40 overflow-y-auto divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="px-3 py-2.5 text-xs text-muted-foreground italic">
            {searchQuery ? "No participants match your search." : "No other users to invite."}
          </p>
        ) : (
          filtered.map((u) => {
            const isSelected = selectedIds.includes(u.id);
            return (
              <label
                key={u.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between px-3 py-2 text-xs transition-colors select-none",
                  isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/50",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    value={u.id}
                    checked={isSelected}
                    onChange={() => toggle(u.id)}
                    className="rounded border-input text-primary focus:ring-primary accent-primary shrink-0 cursor-pointer"
                  />
                  <span className={cn("truncate", isSelected ? "font-bold text-primary" : "font-semibold text-foreground")}>
                    {u.name ?? u.email.split("@")[0]}
                    {u.id === currentUserId ? " (You)" : ""}
                  </span>
                  <span className="text-muted-foreground text-xs truncate">
                    ({u.email})
                  </span>
                </div>
                {isSelected && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded-full bg-primary/10">
                    <Check size={10} />
                    Selected
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
