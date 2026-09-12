"use client";

import React, { useRef, useState } from "react";
import { Calendar, Plus, ExternalLink, Copy, Check, X, History } from "lucide-react";
import { Project, ProjectAssignee, TeamMemberOption } from "../types";
import {
  updateProjectRoleAssigneesAction,
  updateProjectCalendarAction,
  updateProjectLinkAction,
  updateProjectNotesAction,
  ProjectAssigneeField,
  ProjectLinkField,
  ProjectNotesField,
} from "../actions/project-actions";
import { AssigneePickerPopover, getInitials, getAvatarColor } from "./assignee-picker-popover";
import { DateRangePickerPopover } from "./date-range-picker-popover";

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
      alert(result.error || "Failed to update assignees.");
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

/** "Project Calendar" cell: displays the start/deadline range, opens the range picker. */
export function CalendarCell({
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

  const formatShort = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const label =
    project.startDate && project.deadline
      ? `${formatShort(project.startDate)} – ${formatShort(project.deadline)}`
      : "Set dates";

  const handleApply = async (startDate: string, deadline: string) => {
    setSaving(true);
    const prev = { startDate: project.startDate, deadline: project.deadline };
    onUpdated({ startDate, deadline });
    const result = await updateProjectCalendarAction(project.id, startDate, deadline);
    setSaving(false);
    setOpen(false);
    if (!result.success) {
      onUpdated(prev);
      alert(result.error || "Failed to update calendar.");
    }
  };

  return (
    <div className="relative flex items-center justify-start w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={!editable}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors max-w-full ${
          editable ? "hover:bg-accent cursor-pointer" : "cursor-default"
        } ${saving ? "opacity-50" : ""}`}
      >
        <Calendar size={12} className="text-muted-foreground shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      <DateRangePickerPopover
        startDate={project.startDate}
        endDate={project.deadline}
        onApply={handleApply}
        onClose={() => setOpen(false)}
        isOpen={open}
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
      alert(result.error || "Failed to update link.");
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

/** Generic editable notes cell (Tech / Creative / Marketing Notes). */
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project[field] || "");
  const value = project[field];

  const save = async () => {
    const prev = value;
    onUpdated({ [field]: draft || undefined } as Partial<Project>);
    setEditing(false);
    const result = await updateProjectNotesAction(project.id, field, draft.trim());
    if (!result.success) {
      onUpdated({ [field]: prev } as Partial<Project>);
      alert(result.error || "Failed to update notes.");
    }
  };

  if (editing) {
    return (
      <div className="flex items-start gap-1 w-56">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          rows={3}
          className="flex-1 rounded border border-input bg-background px-1.5 py-1 text-[11px] outline-none focus:ring-1 focus:ring-primary resize-none"
        />
        <div className="flex flex-col gap-1 pt-0.5">
          <button type="button" onClick={save} className="text-success hover:opacity-80">
            <Check size={13} />
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground hover:opacity-80">
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!editable}
      onClick={() => {
        setDraft(value || "");
        setEditing(true);
      }}
      title={value}
      className={`block w-full truncate text-left text-[11px] rounded px-1 py-0.5 transition-colors ${
        editable ? "hover:bg-accent cursor-pointer" : "cursor-default"
      } ${value ? "text-foreground" : "text-muted-foreground/60 italic"}`}
    >
      {value || (editable ? "Add note..." : "—")}
    </button>
  );
}

/** "View Timeline" trigger cell — opens the read-only project activity drawer. */
export function TimelineCell({ onOpen }: { project: Project; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-accent transition-colors"
    >
      <History size={12} />
      View Timeline
    </button>
  );
}
