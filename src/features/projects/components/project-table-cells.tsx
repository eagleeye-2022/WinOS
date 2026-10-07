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
  Globe,
  Pencil,
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
        className={`flex items-center justify-between gap-1.5 rounded border border-input/60 bg-background/80 px-2 py-1 text-[11px] font-medium transition-all w-full ${
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

// Google Drive authentic brand icon
function GoogleDriveIcon({ className = "w-3.5 h-3.5 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" fill="none" aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA" />
      <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.45z" fill="#00AC47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H60l5.7 9.85z" fill="#EA4335" />
      <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.95 0H34.35c-1.55 0-3.1.4-4.45 1.2z" fill="#00832D" />
      <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.45 1.2h50.9c1.55 0 3.1-.4 4.45-1.2z" fill="#2684FC" />
      <path d="M73.4 26.5 60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00" />
    </svg>
  );
}

// Figma authentic brand icon
function FigmaIcon({ className = "w-3.5 h-3.5 shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 38 57" fill="none" aria-hidden="true">
      <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE" />
      <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83" />
      <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262" />
      <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E" />
      <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF" />
    </svg>
  );
}

// Web / Globe icon
function WebIcon({ className = "w-3.5 h-3.5 shrink-0 text-sky-500" }: { className?: string }) {
  return <Globe className={className} size={13} />;
}

const LINK_DEFS: {
  field: ProjectLinkField;
  label: string;
  icon: (cls?: string) => React.ReactNode;
  placeholder: string;
}[] = [
  {
    field: "driveLink",
    label: "Drive",
    icon: (cls) => <GoogleDriveIcon className={cls} />,
    placeholder: "https://drive.google.com/...",
  },
  {
    field: "webLink",
    label: "Web",
    icon: (cls) => <WebIcon className={cls ? `${cls} text-sky-500` : "w-3.5 h-3.5 shrink-0 text-sky-500"} />,
    placeholder: "https://example.com/...",
  },
  {
    field: "designLink",
    label: "Figma",
    icon: (cls) => <FigmaIcon className={cls} />,
    placeholder: "https://www.figma.com/...",
  },
];

/** "Asset Link" cell: three chips (Drive/Web/Figma), each with its brand icon, openable or editable inline. */
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
    const activeDef = LINK_DEFS.find((d) => d.field === editingField);
    return (
      <div className="flex items-center justify-start gap-1 w-full min-w-0">
        <div className="relative flex items-center flex-1 min-w-0">
          <span
            className="absolute left-1.5 flex items-center pointer-events-none shrink-0"
            title={activeDef?.label}
          >
            {activeDef?.icon("w-3.5 h-3.5 shrink-0")}
          </span>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save(editingField);
              if (e.key === "Escape") setEditingField(null);
            }}
            placeholder={activeDef?.placeholder || "https://..."}
            className="w-full min-w-[130px] pl-6 pr-1.5 py-0.5 rounded border border-input bg-background text-[11px] outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>
        <button
          type="button"
          onClick={() => save(editingField)}
          className="p-1 text-success hover:bg-success/10 rounded transition-colors shrink-0 cursor-pointer"
          title="Save (Enter)"
        >
          <Check size={12} />
        </button>
        <button
          type="button"
          onClick={() => setEditingField(null)}
          className="p-1 text-muted-foreground hover:bg-muted rounded transition-colors shrink-0 cursor-pointer"
          title="Cancel (Esc)"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-start gap-1.5 flex-nowrap w-full min-w-0 py-0.5">
      {LINK_DEFS.map(({ field, label, icon }) => {
        const url = project[field];
        return (
          <div key={field} className="relative group inline-flex items-center shrink-0">
            {url ? (
              <div className="inline-flex items-center">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onDoubleClick={(e) => {
                    if (!editable) return;
                    e.preventDefault();
                    startEdit(field, url);
                  }}
                  title={
                    editable
                      ? `${label}: Click to open · double-click to edit`
                      : `${label}: Click to open`
                  }
                  className="flex h-6 w-6 items-center justify-center rounded border border-border/80 bg-muted/40 hover:bg-accent hover:border-primary/50 transition-colors cursor-pointer"
                >
                  {icon("w-3.5 h-3.5 shrink-0")}
                </a>
                {editable && (
                  <span className="hidden group-hover:inline-flex items-center gap-0.5 ml-0.5">
                    <button
                      type="button"
                      title={`Edit ${label} link`}
                      onClick={() => startEdit(field, url)}
                      className="text-muted-foreground hover:text-primary p-0.5 rounded hover:bg-accent cursor-pointer"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      type="button"
                      title={`Copy ${label} link`}
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        setCopiedField(field);
                        setTimeout(() => setCopiedField(null), 1500);
                      }}
                      className="text-muted-foreground hover:text-primary p-0.5 rounded hover:bg-accent cursor-pointer"
                    >
                      {copiedField === field ? <Check size={10} className="text-success" /> : <Copy size={10} />}
                    </button>
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => editable && startEdit(field, url)}
                disabled={!editable}
                title={editable ? `Click to add ${label} link` : `No ${label} link`}
                className={`flex h-6 w-6 items-center justify-center rounded border border-dashed border-border/60 bg-muted/15 transition-all ${
                  editable
                    ? "hover:bg-muted/40 hover:border-foreground/40 opacity-40 hover:opacity-100 cursor-pointer"
                    : "opacity-25 cursor-default"
                }`}
              >
                {icon("w-3.5 h-3.5 shrink-0")}
              </button>
            )}
          </div>
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
