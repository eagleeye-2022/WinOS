"use client";

import React, { useRef, useState } from "react";
import {
  Calendar,
  Plus,
  ExternalLink,
  Copy,
  Check,
  X,
  History,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  FileText,
  Loader2,
} from "lucide-react";
import { Project, ProjectAssignee, TeamMemberOption } from "../types";
import {
  updateProjectRoleAssigneesAction,
  updateProjectCalendarAction,
  updateProjectLinkAction,
  updateProjectNotesAction,
  updateProjectStatusAction,
  ProjectAssigneeField,
  ProjectLinkField,
  ProjectNotesField,
} from "../actions/project-actions";
import { AssigneePickerPopover, getInitials, getAvatarColor } from "./assignee-picker-popover";
import { DateRangePickerPopover } from "./date-range-picker-popover";
import { AnchoredPopover } from "./popover-portal";
import { toast } from "@/components/shared/toast";

// `field` is the server-side role key ("PROJECT_LEAD", etc.) — the corresponding property on the
// client-facing `Project` type is camelCase, so patches must go through this map, not `field` itself.
const ROLE_TO_PROJECT_KEY: Record<ProjectAssigneeField, keyof Project> = {
  PROJECT_LEAD: "projectLead",
  TECH_LEAD: "techLead",
  TECH_ASSIGNEE: "techAssignee",
  CREATIVE_ASSIGNEE: "creativeAssignee",
  CREATIVE_UIUX_LEAD: "creativeUiuxLead",
  CREATIVE_UIUX_ASSIGNEE: "creativeUiuxAssignee",
  CREATIVE_GRAPHIC_LEAD: "creativeGraphicLead",
  CREATIVE_GRAPHIC_ASSIGNEE: "creativeGraphicAssignee",
  MARKETING_LEAD: "marketingLead",
  MARKETING_SEO: "marketingSeo",
  MARKETING_CONTENT: "marketingContent",
  MARKETING_PM: "marketingPm",
};

/** Multi-assignee avatar-stack cell (Project Lead / Tech / Creative / SEO / Content / PM) —
 *  each role can hold several people at once. */
export function AssigneeCell({
  project,
  field,
  assignees,
  members,
  editable,
  onUpdated,
}: {
  project: Project;
  field: ProjectAssigneeField;
  assignees?: ProjectAssignee[];
  members: TeamMemberOption[];
  editable: boolean;
  onUpdated: (patch: Partial<Project>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = assignees || [];

  const projectKey = ROLE_TO_PROJECT_KEY[field];

  const commit = async (next: ProjectAssignee[]) => {
    setSaving(true);
    const prev = current;
    onUpdated({ [projectKey]: next.length > 0 ? next : undefined } as Partial<Project>);
    const result = await updateProjectRoleAssigneesAction(project.id, field, next.map((a) => a.id));
    setSaving(false);
    if (!result.success) {
      onUpdated({ [projectKey]: prev.length > 0 ? prev : undefined } as Partial<Project>);
      toast.error(result.error || "Failed to update assignees.");
    } else {
      toast.success("Project assignees updated");
    }
  };

  const handleToggle = (member: TeamMemberOption) => {
    const isSelected = current.some((a) => a.id === member.id);
    const next = isSelected
      ? current.filter((a) => a.id !== member.id)
      : [...current, { id: member.id, name: member.name, initials: getInitials(member.name), avatarColor: getAvatarColor(member.name) }];
    commit(next);
  };

  return (
    <div className="relative flex items-center justify-start w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={!editable}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded px-1 py-1 max-w-full transition-colors ${
          editable ? "hover:bg-accent cursor-pointer" : "cursor-default"
        } ${saving ? "opacity-50" : ""}`}
      >
        {current.length > 0 ? (
          <>
            <span className="flex items-center -space-x-1.5 shrink-0">
              {current.slice(0, 3).map((a) => (
                <span
                  key={a.id}
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-background ${
                    a.avatarColor || "bg-primary text-primary-foreground"
                  }`}
                  title={a.name}
                >
                  {a.initials}
                </span>
              ))}
              {current.length > 3 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold bg-muted text-muted-foreground ring-2 ring-background">
                  +{current.length - 3}
                </span>
              )}
            </span>
            <span className="font-medium text-foreground truncate">
              {current.length === 1 ? current[0].name : `${current.length} assigned`}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground/70 italic">
            {editable && <Plus size={12} />}
            Unassigned
          </span>
        )}
      </button>
      <AssigneePickerPopover
        members={members}
        selectedIds={current.map((a) => a.id)}
        onToggle={handleToggle}
        onClearAll={() => commit([])}
        onClose={() => setOpen(false)}
        isOpen={open}
        anchorRef={triggerRef}
      />
    </div>
  );
}

function parseDateOnly(dStr?: string): Date | null {
  if (!dStr) return null;
  if (dStr.includes("-")) {
    const parts = dStr.split("T")[0].split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? null : d;
}

function getQuarterInfo(startDate?: string, deadline?: string) {
  if (!startDate || !deadline) return null;
  const s = parseDateOnly(startDate);
  const e = parseDateOnly(deadline);
  if (!s || !e) return null;

  const sYear = s.getFullYear();
  const eYear = e.getFullYear();
  if (sYear !== eYear) return null;

  const sMonth = s.getMonth();
  const sDate = s.getDate();
  const eMonth = e.getMonth();
  const eDate = e.getDate();

  if (sMonth === 0 && sDate === 1 && eMonth === 2 && eDate === 31) {
    return { quarter: 1, year: sYear, label: `Q1 ${sYear}`, code: "Q1" };
  }
  if (sMonth === 3 && sDate === 1 && eMonth === 5 && eDate === 30) {
    return { quarter: 2, year: sYear, label: `Q2 ${sYear}`, code: "Q2" };
  }
  if (sMonth === 6 && sDate === 1 && eMonth === 8 && eDate === 30) {
    return { quarter: 3, year: sYear, label: `Q3 ${sYear}`, code: "Q3" };
  }
  if (sMonth === 9 && sDate === 1 && eMonth === 11 && eDate === 31) {
    return { quarter: 4, year: sYear, label: `Q4 ${sYear}`, code: "Q4" };
  }
  return null;
}

const QUARTERS_CONFIG = [
  { q: 1 as const, name: "Quarter 1", code: "Q1", rangeText: "Jan 1 – Mar 31", startMonth: 0, endMonth: 2, endDay: 31 },
  { q: 2 as const, name: "Quarter 2", code: "Q2", rangeText: "Apr 1 – Jun 30", startMonth: 3, endMonth: 5, endDay: 30 },
  { q: 3 as const, name: "Quarter 3", code: "Q3", rangeText: "Jul 1 – Sep 30", startMonth: 6, endMonth: 8, endDay: 30 },
  { q: 4 as const, name: "Quarter 4", code: "Q4", rangeText: "Oct 1 – Dec 31", startMonth: 9, endMonth: 11, endDay: 31 },
];

/** "Project Calendar" cell: displays the quarter / date range, opens a quarter dropdown or custom range picker. */
export function CalendarCell({
  project,
  editable,
  onUpdated,
}: {
  project: Project;
  editable: boolean;
  onUpdated: (patch: Partial<Project>) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const s = parseDateOnly(project.startDate);
    return s ? s.getFullYear() : currentYear;
  });

  const formatShort = (iso?: string) => {
    if (!iso) return null;
    const d = parseDateOnly(iso);
    if (!d || isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const quarterInfo = getQuarterInfo(project.startDate, project.deadline);

  const handleApply = async (startDate: string, deadline: string) => {
    setSaving(true);
    const prev = { startDate: project.startDate, deadline: project.deadline };
    onUpdated({ startDate, deadline });
    const result = await updateProjectCalendarAction(project.id, startDate, deadline);
    setSaving(false);
    setDropdownOpen(false);
    setCustomPickerOpen(false);
    if (!result.success) {
      onUpdated(prev);
      toast.error(result.error || "Failed to update calendar.");
    } else {
      toast.success("Project calendar updated");
    }
  };

  const handleClear = async () => {
    setSaving(true);
    const prev = { startDate: project.startDate, deadline: project.deadline };
    onUpdated({ startDate: "", deadline: "" });
    const result = await updateProjectCalendarAction(project.id, "", "");
    setSaving(false);
    setDropdownOpen(false);
    if (!result.success) {
      onUpdated(prev);
      toast.error(result.error || "Failed to clear dates.");
    } else {
      toast.success("Project dates cleared");
    }
  };

  const handleSelectQuarter = (qConfig: typeof QUARTERS_CONFIG[number], year: number) => {
    const startDate = `${year}-${String(qConfig.startMonth + 1).padStart(2, "0")}-01`;
    const deadline = `${year}-${String(qConfig.endMonth + 1).padStart(2, "0")}-${String(qConfig.endDay).padStart(2, "0")}`;
    handleApply(startDate, deadline);
  };

  const handleSelectPreset = (preset: "THIS_MONTH" | "NEXT_MONTH" | "FULL_YEAR") => {
    let s: Date, e: Date;
    if (preset === "THIS_MONTH") {
      s = new Date(currentYear, now.getMonth(), 1);
      e = new Date(currentYear, now.getMonth() + 1, 0);
    } else if (preset === "NEXT_MONTH") {
      s = new Date(currentYear, now.getMonth() + 1, 1);
      e = new Date(currentYear, now.getMonth() + 2, 0);
    } else {
      s = new Date(selectedYear, 0, 1);
      e = new Date(selectedYear, 11, 31);
    }
    const toISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    handleApply(toISO(s), toISO(e));
  };

  return (
    <div className="relative flex items-center justify-start w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={!editable}
        onClick={() => setDropdownOpen((v) => !v)}
        className={`flex items-center justify-between gap-1.5 rounded border border-input/60 bg-background/80 px-2 py-1 text-[11px] font-medium transition-all max-w-full ${
          editable ? "hover:bg-accent/80 hover:border-primary/40 cursor-pointer" : "cursor-default"
        } ${saving ? "opacity-50" : ""}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <Calendar size={12} className="text-primary shrink-0" />
          {quarterInfo ? (
            <div className="flex items-center gap-1 min-w-0 truncate">
              <span className="rounded bg-primary/10 text-primary px-1.5 py-0.2 text-[10px] font-bold shrink-0">
                {quarterInfo.label}
              </span>
              <span className="truncate text-muted-foreground text-[10px]">
                {formatShort(project.startDate)?.split(",")[0]} – {formatShort(project.deadline)}
              </span>
            </div>
          ) : project.startDate && project.deadline ? (
            <span className="truncate text-foreground">
              {formatShort(project.startDate)} – {formatShort(project.deadline)}
            </span>
          ) : (
            <span className="text-muted-foreground/70 italic">Select Quarter</span>
          )}
        </div>
        {editable && <ChevronDown size={11} className="text-muted-foreground shrink-0 opacity-70" />}
      </button>

      {/* Quarter Dropdown Menu */}
      <AnchoredPopover
        anchorRef={triggerRef}
        isOpen={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        className="w-64 p-2"
      >
        <div className="space-y-2">
          {/* Popover Header with Year Navigation */}
          <div className="flex items-center justify-between px-1 pb-1.5 border-b">
            <span className="font-bold text-[11px] text-foreground">Select Quarter</span>
            <div className="flex items-center gap-1 bg-muted/60 rounded px-1 py-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedYear((y) => y - 1);
                }}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Previous Year"
              >
                <ChevronLeft size={12} />
              </button>
              <span className="text-[11px] font-bold text-foreground px-1">{selectedYear}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedYear((y) => y + 1);
                }}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Next Year"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Quarter Options (Q1, Q2, Q3, Q4) */}
          <div className="space-y-1">
            {QUARTERS_CONFIG.map((q) => {
              const isCurrentProjectQuarter =
                quarterInfo?.quarter === q.q && quarterInfo?.year === selectedYear;
              const isCurrentCalendarQuarter =
                selectedYear === currentYear && currentQuarter === q.q;

              return (
                <button
                  key={q.q}
                  type="button"
                  onClick={() => handleSelectQuarter(q, selectedYear)}
                  className={`flex w-full items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors ${
                    isCurrentProjectQuarter
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`flex h-5 w-7 items-center justify-center rounded text-[10px] font-bold ${
                        isCurrentProjectQuarter
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {q.code}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{q.name}</span>
                        {isCurrentCalendarQuarter && (
                          <span className="rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 text-[9px] font-bold leading-tight">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {q.rangeText}, {selectedYear}
                      </span>
                    </div>
                  </div>
                  {isCurrentProjectQuarter && <Check size={13} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Quick Presets */}
          <div className="pt-1.5 border-t">
            <div className="text-[10px] font-semibold text-muted-foreground px-1 mb-1 uppercase tracking-wider">
              Quick Presets
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => handleSelectPreset("THIS_MONTH")}
                className="px-1.5 py-1 text-center text-[10px] font-medium rounded border hover:bg-accent transition-colors truncate"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset("NEXT_MONTH")}
                className="px-1.5 py-1 text-center text-[10px] font-medium rounded border hover:bg-accent transition-colors truncate"
              >
                Next Month
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset("FULL_YEAR")}
                className="px-1.5 py-1 text-center text-[10px] font-medium rounded border hover:bg-accent transition-colors truncate"
              >
                Full {selectedYear}
              </button>
            </div>
          </div>

          {/* Custom Date Range & Clear Options */}
          <div className="pt-1.5 border-t space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                setCustomPickerOpen(true);
              }}
              className="flex w-full items-center gap-2 px-2 py-1 rounded text-xs font-medium text-foreground hover:bg-accent hover:text-primary transition-colors"
            >
              <CalendarRange size={13} className="text-muted-foreground" />
              <span>Custom Date Range...</span>
            </button>

            {(project.startDate || project.deadline) && (
              <button
                type="button"
                onClick={handleClear}
                className="flex w-full items-center gap-2 px-2 py-1 rounded text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X size={13} />
                <span>Clear Dates</span>
              </button>
            )}
          </div>
        </div>
      </AnchoredPopover>

      {/* Full Date Range Picker Popover for custom date selection */}
      <DateRangePickerPopover
        startDate={project.startDate}
        endDate={project.deadline}
        onApply={handleApply}
        onClose={() => setCustomPickerOpen(false)}
        isOpen={customPickerOpen}
        anchorRef={triggerRef}
      />
    </div>
  );
}

const LINK_DEFS: { field: ProjectLinkField; label: string }[] = [
  { field: "driveLink", label: "Drive" },
  { field: "webLink", label: "Web" },
  { field: "designLink", label: "Design" },
];

/** "Asset Link" cell: three chips (Drive/Web/Design), each openable or editable inline. */
export function LinksCell({
  project,
  editable,
  onUpdated,
}: {
  project: Project;
  editable: boolean;
  onUpdated: (patch: Partial<Project>) => void;
}) {
  const [editingField, setEditingField] = useState<ProjectLinkField | null>(null);
  const [draft, setDraft] = useState("");
  const [copiedField, setCopiedField] = useState<ProjectLinkField | null>(null);

  const startEdit = (field: ProjectLinkField, current?: string) => {
    setEditingField(field);
    setDraft(current || "");
  };

  const save = async (field: ProjectLinkField) => {
    const prev = project[field];
    onUpdated({ [field]: draft || undefined } as Partial<Project>);
    setEditingField(null);
    const result = await updateProjectLinkAction(project.id, field, draft.trim());
    if (!result.success) {
      onUpdated({ [field]: prev } as Partial<Project>);
      toast.error(result.error || "Failed to update link.");
    } else {
      toast.success("Project link updated");
    }
  };

  if (editingField) {
    return (
      <div className="flex items-center justify-start gap-1 w-full">
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save(editingField);
            if (e.key === "Escape") setEditingField(null);
          }}
          placeholder="https://..."
          className="w-40 rounded border border-input bg-background px-1.5 py-0.5 text-[11px] outline-none focus:ring-1 focus:ring-primary"
        />
        <button type="button" onClick={() => save(editingField)} className="text-success hover:opacity-80">
          <Check size={13} />
        </button>
        <button type="button" onClick={() => setEditingField(null)} className="text-muted-foreground hover:opacity-80">
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-start gap-1.5 flex-nowrap overflow-x-auto w-full min-w-0">
      {LINK_DEFS.map(({ field, label }) => {
        const url = project[field];
        return (
          <span
            key={field}
            className="group inline-flex shrink-0 items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-[11px]"
          >
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onDoubleClick={(e) => {
                  if (!editable) return;
                  e.preventDefault();
                  startEdit(field, url);
                }}
                title={editable ? "Click to open · double-click to edit" : undefined}
                className="text-foreground hover:text-primary hover:underline"
              >
                {label}
              </a>
            ) : (
              <span
                onClick={() => editable && startEdit(field, url)}
                className={editable ? "text-muted-foreground/60 hover:text-foreground cursor-pointer" : "text-muted-foreground/60"}
                title={editable ? "Click to add link" : undefined}
              >
                {label}
              </span>
            )}
            {editable && url && (
              <span className="hidden group-hover:inline-flex items-center gap-0.5">
                <button
                  type="button"
                  title="Copy link"
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    setCopiedField(field);
                    setTimeout(() => setCopiedField(null), 1500);
                  }}
                  className="text-muted-foreground hover:text-primary"
                >
                  {copiedField === field ? <Check size={11} className="text-success" /> : <Copy size={11} />}
                </button>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                  <ExternalLink size={11} />
                </a>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

const NOTES_FIELD_TITLES: Record<ProjectNotesField, string> = {
  description: "Project iNotes",
  techNotes: "Tech Notes",
  creativeNotes: "Creative Notes",
  marketingNotes: "Marketing Notes",
};

/** Project iNotes / generic notes cell — clicking opens a full popup modal to view, edit, and save notes. */
export function NotesCell({
  project,
  field,
  editable,
  onUpdated,
}: {
  project: Project;
  field: ProjectNotesField;
  editable: boolean;
  onUpdated: (patch: Partial<Project>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(project[field] || "");
  const [saving, setSaving] = useState(false);
  const value = project[field] || "";
  const title = NOTES_FIELD_TITLES[field] || "Project Notes";

  const handleOpen = () => {
    setDraft(value);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (saving) return;
    setIsOpen(false);
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (trimmed === value) {
      setIsOpen(false);
      return;
    }
    setSaving(true);
    const prev = value;
    onUpdated({ [field]: trimmed || undefined } as Partial<Project>);
    const result = await updateProjectNotesAction(project.id, field, trimmed);
    setSaving(false);
    if (!result.success) {
      onUpdated({ [field]: prev } as Partial<Project>);
      toast.error(result.error || "Failed to update notes.");
    } else {
      toast.success(`${title} saved`);
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title={value || (editable ? "Click to add notes" : "No notes")}
        className={`group flex items-center gap-1.5 w-full truncate text-left text-[11px] rounded px-1.5 py-1 transition-colors ${
          editable ? "hover:bg-accent cursor-pointer" : "cursor-pointer hover:bg-accent/60"
        } ${value ? "text-foreground font-medium" : "text-muted-foreground/60 italic"}`}
      >
        <FileText size={12} className={`shrink-0 ${value ? "text-primary" : "text-muted-foreground/40"}`} />
        <span className="truncate flex-1">
          {value || (editable ? "Add note..." : "—")}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={handleClose}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-lg rounded-xl border bg-card p-5 shadow-2xl space-y-4 z-10 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-primary" />
                  <h3 className="text-sm font-bold text-foreground">{title}</h3>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {project.id ? `${project.id} — ` : ""}{project.name}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleClose}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content / Editor */}
            <div className="space-y-2">
              {editable ? (
                <>
                  <textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSave();
                      } else if (e.key === "Escape") {
                        handleClose();
                      }
                    }}
                    rows={8}
                    placeholder={`Enter ${title.toLowerCase()} for this project...`}
                    className="w-full rounded-lg border border-input bg-background p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all resize-y min-h-[140px]"
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl+Enter</kbd> to save</span>
                    <span>{draft.length} characters</span>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border bg-muted/20 p-4 min-h-[120px] max-h-[300px] overflow-y-auto">
                  {value ? (
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {value}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No notes available for this project.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <button
                type="button"
                disabled={saving}
                onClick={handleClose}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {editable ? "Cancel" : "Close"}
              </button>
              {editable && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={13} />
                      <span>Save Notes</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "COMPLETED"] as const;

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-300 text-green-950",
  INACTIVE: "bg-muted-foreground/70 text-white",
  COMPLETED: "bg-info text-white",
};

/** Full-cell colored Status box — click opens a dropdown to change it. Manager-only (`editable`
 *  mirrors the same manager gate as the other assignment fields on this table). */
export function StatusCell({
  project,
  editable,
  onUpdated,
}: {
  project: Project;
  editable: boolean;
  onUpdated: (patch: Partial<Project>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const status = (project.status || "").toUpperCase();

  const handleSelect = async (next: string) => {
    if (next === status) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setSaving(true);
    const prev = project.status;
    onUpdated({ status: next as Project["status"] });
    const result = await updateProjectStatusAction(project.id, next);
    setSaving(false);
    if (!result.success) {
      onUpdated({ status: prev });
      toast.error(result.error || "Failed to update status.");
    } else {
      toast.success(`Project status changed to ${next}`);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={!editable}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-full min-h-9 w-full items-center justify-center text-[11px] font-bold uppercase tracking-wide transition-opacity ${
          STATUS_STYLES[status] || "bg-secondary text-secondary-foreground"
        } ${editable ? "cursor-pointer hover:opacity-90" : "cursor-default"} ${saving ? "opacity-50" : ""}`}
      >
        {project.status}
      </button>
      <AnchoredPopover anchorRef={triggerRef} isOpen={open} onClose={() => setOpen(false)} className="w-36 py-1">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => handleSelect(opt)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-medium hover:bg-accent ${
              opt === status ? "text-primary font-bold" : "text-foreground"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[opt]?.split(" ")[0] || "bg-secondary"}`} />
            {opt.charAt(0) + opt.slice(1).toLowerCase()}
          </button>
        ))}
      </AnchoredPopover>
    </>
  );
}

/** "View Timeline" trigger cell — opens the read-only project activity drawer. */
export function TimelineCell({ onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="View Timeline"
      className="inline-flex items-center justify-center rounded-md border p-1.5 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-accent transition-colors"
    >
      <History size={13} />
    </button>
  );
}
