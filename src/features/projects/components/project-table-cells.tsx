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

/** Day-of-month buckets shown as radio options in the calendar cell dropdown. */
const DAY_BUCKETS = [
  { label: "1 - 10", startDay: 1, endDay: 10 },
  { label: "11 - 20", startDay: 11, endDay: 20 },
  { label: "21 - 31", startDay: 21, endDay: 31 },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** "Project Calendar" cell: displays the date range, opens a day-of-month bucket picker or custom range picker. */
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

  const monthYear = now.getFullYear();
  const monthIndex = now.getMonth();
  const lastDayOfMonth = new Date(monthYear, monthIndex + 1, 0).getDate();

  const buckets = DAY_BUCKETS.map((b) => {
    const endDay = Math.min(b.endDay, lastDayOfMonth);
    const startDate = `${monthYear}-${pad2(monthIndex + 1)}-${pad2(b.startDay)}`;
    const deadline = `${monthYear}-${pad2(monthIndex + 1)}-${pad2(endDay)}`;
    return { ...b, endDay, startDate, deadline };
  });

  const handleSelectBucket = (bucket: (typeof buckets)[number]) => {
    handleApply(bucket.startDate, bucket.deadline);
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
          {project.startDate && project.deadline ? (
            <span className="truncate text-foreground">
              {parseDateOnly(project.startDate)?.getDate()} - {parseDateOnly(project.deadline)?.getDate()}
            </span>
          ) : (
            <span className="text-muted-foreground/70 italic">Select Range</span>
          )}
        </div>
        {editable && <ChevronDown size={11} className="text-muted-foreground shrink-0 opacity-70" />}
      </button>

      {/* Day-range Dropdown Menu */}
      <AnchoredPopover
        anchorRef={triggerRef}
        isOpen={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        className="w-64 rounded-2xl p-3"
      >
        <div className="space-y-3">
          {/* Day-of-month Range Options */}
          <div className="space-y-2">
            {buckets.map((bucket) => {
              const isSelected = project.startDate === bucket.startDate && project.deadline === bucket.deadline;
              return (
                <button
                  key={bucket.label}
                  type="button"
                  onClick={() => handleSelectBucket(bucket)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-primary/10" : "hover:bg-accent"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected ? "border-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </span>
                  <span className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-foreground/90"}`}>
                    {bucket.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Add Custom CTA temporarily disabled
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              setCustomPickerOpen(true);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <CalendarRange size={14} />
            Add Custom
          </button>
          */}

          {(project.startDate || project.deadline) && (
            <button
              type="button"
              onClick={handleClear}
              className="flex w-full items-center justify-center gap-1.5 rounded text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
            >
              <X size={12} />
              Clear Dates
            </button>
          )}
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
