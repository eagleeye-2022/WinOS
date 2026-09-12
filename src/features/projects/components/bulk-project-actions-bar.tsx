"use client";

import React, { useRef, useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { TeamMemberOption } from "../types";
import { ProjectAssigneeField } from "../actions/project-actions";
import { AssigneePickerPopover } from "./assignee-picker-popover";

const ROLE_OPTIONS: { value: ProjectAssigneeField; label: string }[] = [
  { value: "PROJECT_LEAD", label: "Project Lead / SPOC" },
  { value: "TECH_LEAD", label: "Tech – Lead" },
  { value: "TECH_ASSIGNEE", label: "Tech – Assignee" },
  { value: "CREATIVE_UIUX_LEAD", label: "Creative – UI/UX Lead" },
  { value: "CREATIVE_UIUX_ASSIGNEE", label: "Creative – UI/UX Assignee" },
  { value: "CREATIVE_GRAPHIC_LEAD", label: "Creative – Graphic Lead" },
  { value: "CREATIVE_GRAPHIC_ASSIGNEE", label: "Creative – Graphic Assignee" },
  { value: "MARKETING_LEAD", label: "Marketing – Lead" },
  { value: "MARKETING_SEO", label: "Marketing – SEO Assignee" },
  { value: "MARKETING_CONTENT", label: "Marketing – Content Assignee" },
];

interface BulkProjectActionsBarProps {
  selectedCount: number;
  members: TeamMemberOption[];
  onApplyAssignees: (role: ProjectAssigneeField, memberIds: string[]) => Promise<void>;
  onApplyDateShift: (deltaDays: number) => Promise<void>;
  onClear: () => void;
}

/** Toolbar shown when one or more project rows are checked — lets a manager mass-assign a role
 *  or shift every selected project's Start/Deadline by the same number of days in one action
 *  (e.g. a client's kickoff moves and it needs to cascade across several linked projects). */
export function BulkProjectActionsBar({
  selectedCount,
  members,
  onApplyAssignees,
  onApplyDateShift,
  onClear,
}: BulkProjectActionsBarProps) {
  const [role, setRole] = useState<ProjectAssigneeField>("TECH_ASSIGNEE");
  const [pendingMemberIds, setPendingMemberIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [deltaDays, setDeltaDays] = useState("");
  const [applyingAssignees, setApplyingAssignees] = useState(false);
  const [applyingShift, setApplyingShift] = useState(false);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);

  const pendingMembers = members.filter((m) => pendingMemberIds.includes(m.id));

  const handleToggleMember = (member: TeamMemberOption) => {
    setPendingMemberIds((prev) =>
      prev.includes(member.id) ? prev.filter((id) => id !== member.id) : [...prev, member.id]
    );
  };

  const handleApplyAssignees = async () => {
    setApplyingAssignees(true);
    await onApplyAssignees(role, pendingMemberIds);
    setApplyingAssignees(false);
    setPendingMemberIds([]);
    setShowPicker(false);
  };

  const handleApplyShift = async () => {
    const parsed = parseInt(deltaDays, 10);
    if (!Number.isFinite(parsed) || parsed === 0) return;
    setApplyingShift(true);
    await onApplyDateShift(parsed);
    setApplyingShift(false);
    setDeltaDays("");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-primary/5 px-6 py-2.5 text-xs animate-in fade-in duration-150">
      <span className="font-bold text-foreground">{selectedCount} selected</span>
      <button
        type="button"
        onClick={onClear}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={12} /> Clear
      </button>

      <div className="h-4 w-px bg-border" />

      {/* Bulk role assignment */}
      <div className="flex items-center gap-1.5">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ProjectAssigneeField)}
          className="rounded border border-input bg-background px-2 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <div className="relative">
          <button
            ref={pickerTriggerRef}
            type="button"
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent transition-colors"
          >
            {pendingMembers.length > 0
              ? `${pendingMembers.length} member${pendingMembers.length > 1 ? "s" : ""}`
              : "Choose members"}
            <ChevronDown size={12} />
          </button>
          <AssigneePickerPopover
            members={members}
            selectedIds={pendingMemberIds}
            onToggle={handleToggleMember}
            onClearAll={() => setPendingMemberIds([])}
            onClose={() => setShowPicker(false)}
            isOpen={showPicker}
            anchorRef={pickerTriggerRef}
          />
        </div>

        <button
          type="button"
          disabled={applyingAssignees}
          onClick={handleApplyAssignees}
          className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {applyingAssignees ? "Applying..." : `Apply to ${selectedCount}`}
        </button>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Bulk date shift */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Shift dates by</span>
        <input
          type="number"
          value={deltaDays}
          onChange={(e) => setDeltaDays(e.target.value)}
          placeholder="e.g. 7 or -3"
          className="w-20 rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-muted-foreground">days</span>
        <button
          type="button"
          disabled={applyingShift || !deltaDays.trim()}
          onClick={handleApplyShift}
          className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {applyingShift ? "Applying..." : "Apply"}
        </button>
      </div>
    </div>
  );
}
