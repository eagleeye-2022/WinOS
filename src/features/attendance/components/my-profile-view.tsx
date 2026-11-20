"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import React, { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Smartphone,
  Briefcase,
  Network,
  MapPin,
  Clock,
  FileText,
  Check,
  Camera,
  Upload,
  Trash2,
  LogOut,
  Pencil,
  Loader2,
} from "lucide-react";
import { getMemberProfileData, getMyProfileData } from "../queries/attendance-queries";
import { getMyCheckInStatusAction, type MyCheckInStatus } from "../actions/attendance-actions";
import { canManageAttendance, formatDayDate } from "../utils";
import { calculateAge } from "@/lib/fmt";
import { DOCUMENT_FIELDS } from "@/features/users/constants";
import {
  canEditProfileField,
  PROFILE_FIELDS,
  type ProfileField,
  type ProfileFieldConfig,
} from "@/features/users/profile-fields";
import {
  getReportingOptionsAction,
  removeProfileDocumentAction,
  saveProfileDocumentAction,
  setProfilePhotoAction,
  updateProfileFieldAction,
} from "@/features/users/actions/profile-field-actions";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { emptyMemberValues, MemberProfileForm } from "@/features/users/components/new-member-profile-form";
import { SaturdayOffPicker } from "@/features/users/components/saturday-off-picker";
import { decodeSaturdaysOff, describeSaturdaysOff, encodeSaturdaysOff } from "@/features/users/work-week";
import { PROFILE_CARD, PROFILE_COVER_BUTTON, ProfileCover, ProfileSectionCard } from "@/components/pulse/profile-ui";
import { toast } from "@/components/shared/toast";
import { logoutAction } from "@/features/auth/actions/logout";
import { ROUTES } from "@/constants/routes";
import { PulseTabs, StatusPill, type PulseTone } from "@/components/pulse/pulse-ui";
import { usePulseCrumbs, type PulseCrumb } from "@/components/pulse/pulse-breadcrumbs";
import { AttendanceWorkspace } from "./attendance-workspace";
import { EmployeeAttendanceWorkspace } from "./employee-attendance-workspace";
import { LeaveWorkspace } from "@/features/leave/components/leave-workspace";
import { EmployeeLeaveWorkspace } from "@/features/leave/components/employee-leave-workspace";

/** The fields this page shows (the member query's shape; "my profile" returns a superset). */
type Profile = NonNullable<Awaited<ReturnType<typeof getMemberProfileData>>>;
type Person = NonNullable<Profile["reportingTo"]>;

/** Tabs under the header. Each opens in place (?section=…), reusing the Attendance / Leave screens. */
const SECTIONS = ["profile", "attendance", "leave"] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABEL: Record<Section, string> = { profile: "Profile", attendance: "Attendance", leave: "Leave" };

export type ProfileViewProps =
  /** The signed-in user's own profile (/pulse/profile). */
  | { mode: "self"; canManage: boolean; currentUserId?: string }
  /** A manager looking at someone they manage (/pulse/profile/[userId]). */
  /** Only managers reach it (page guard + query check), and they can edit it. */
  | { mode: "member"; userId: string };

/** Shown for a field that hasn't been filled in — never a made-up value. */
const NOT_SET = "Not set";

/** Display names for the stored ProfileRole values (EMPLOYEE is shown as "Member"). */
const PROFILE_ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "Member",
  MANAGER: "Manager",
  CONTRACTOR: "Contractor",
  CLIENT: "Client",
  GUEST: "Guest",
  DEVELOPER: "Developer",
  SUPPORT: "Support",
  ADMIN: "Admin",
};

function initialsOf(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function istTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
}

/** Today's attendance in a pill + one line, from the same status the top-bar check-in uses. */
function todayStatus(s: MyCheckInStatus | null): { pill: string; tone: PulseTone; line: string } | null {
  if (!s) return null;
  const mode = s.workMode === "REMOTE" ? "Remote" : "Office";
  if (s.isLive) {
    return { pill: `${mode} In`, tone: "green", line: s.liveSince ? `Working since ${istTime(s.liveSince)}` : "Checked in" };
  }
  if (s.checkedOut) return { pill: "Checked Out", tone: "gray", line: "Checked out for today" };
  if (!s.isWorkday) return { pill: "Off Today", tone: "gray", line: "Not a working day" };
  return { pill: "Not Checked In", tone: "amber", line: "Not checked in yet today" };
}

/** "EED51 - " prefix + bold name, or just the name when there's no member ID. */
function IdName({ employeeId, name }: { employeeId: string | null; name: string }) {
  return (
    <>
      {employeeId && <span className="text-muted-foreground">{employeeId} - </span>}
      <span className="font-semibold">{name}</span>
    </>
  );
}

/** At-a-glance item that edits in place like the detail sections (same rules, same save). */
function EditableInfoItem({ icon, ...detail }: { icon: React.ReactNode } & React.ComponentProps<typeof EditableDetail>) {
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/80 text-muted-foreground">
        {icon}
      </span>
      <dl className="min-w-0 flex-1">
        <EditableDetail {...detail} />
      </dl>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/80 text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className={value ? "truncate text-sm font-medium text-foreground" : "text-sm italic text-muted-foreground"}>
          {value || NOT_SET}
        </p>
      </div>
    </div>
  );
}

/** Label-over-value grid used by the detail sections. */
function DetailGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

function Detail({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "min-w-0 sm:col-span-2 lg:col-span-3" : "min-w-0"}>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={value ? "mt-0.5 break-words text-sm font-medium text-foreground" : "mt-0.5 text-sm italic text-muted-foreground"}>
        {value || NOT_SET}
      </dd>
    </div>
  );
}

// ── Uploads (photo + documents) ─────────────────────────────────────────────

const MB = 1024 * 1024;
const PHOTO_MAX = 5 * MB;
const DOCUMENT_MAX = 10 * MB;
const DOCUMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx";

/** Sends a file to the app's upload route (signed-in only) and returns where it was stored. */
async function uploadFile(file: File): Promise<{ fileUrl: string; fileName: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { fileUrl?: string; fileName?: string; error?: string };
  if (!res.ok || !data.fileUrl) throw new Error(data.error || "Upload failed. Try again.");
  return { fileUrl: data.fileUrl, fileName: data.fileName || file.name };
}

type ProfileDocument = { id: string; kind: string; fileName: string; fileUrl: string };

/** One document slot: view what's there; managers can upload, replace or remove. */
function DocumentSlot({
  label,
  doc,
  busy,
  canEdit,
  onUpload,
  onRemove,
}: {
  label: string;
  doc?: ProfileDocument;
  busy: boolean;
  canEdit: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const linkCls = "text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400";
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5">
      {busy ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
      ) : (
        <FileText className={doc ? "h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" : "h-5 w-5 shrink-0 text-muted-foreground/60"} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{label}</p>
        {busy ? (
          <p className="text-xs text-muted-foreground">Uploading…</p>
        ) : doc ? (
          <p className="truncate text-xs text-muted-foreground" title={doc.fileName}>{doc.fileName}</p>
        ) : (
          <p className="text-xs italic text-muted-foreground">Not uploaded</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        {doc && (
          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
            View
          </a>
        )}
        {canEdit && (
          <>
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={`inline-flex items-center gap-1 ${linkCls}`}>
              <Upload className="h-3.5 w-3.5" />
              {doc ? "Replace" : "Upload"}
            </button>
            {doc && (
              <button
                type="button"
                disabled={busy}
                onClick={onRemove}
                title={`Remove ${label}`}
                className="text-muted-foreground transition-colors hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // allow picking the same file again
                if (file) onUpload(file);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** YYYY-MM-DD for <input type="date">, from a stored date. */
function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/**
 * A detail that can be edited in place: click the value, change it, and it saves on Enter / leaving
 * the field (dropdowns save as soon as you pick). Esc cancels. Read-only when `onSave` is missing.
 */
type Choice = { value: string; label: string };

function EditableDetail({
  field,
  label,
  raw,
  display,
  renderDisplay,
  choices,
  emptyChoiceLabel,
  wide,
  onSave,
}: {
  field: ProfileField;
  label: string;
  /** The stored value as the input expects it ("" when empty; dates as YYYY-MM-DD). */
  raw: string;
  /** How it reads when not editing (formatted dates, labels…). Defaults to `raw`. */
  display?: string | null;
  /** Rich read view (e.g. a person card) instead of plain text. */
  renderDisplay?: React.ReactNode;
  /** Options for "user" fields (loaded people); select fields use their configured options. */
  choices?: Choice[];
  /** Label of the empty option where clearing is allowed (default "Not set"). */
  emptyChoiceLabel?: string;
  wide?: boolean;
  /** Returns an error message, or null when saved. */
  onSave?: (field: ProfileField, raw: string) => Promise<string | null>;
}) {
  const cfg = PROFILE_FIELDS[field] as ProfileFieldConfig;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(raw);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const isChoice = cfg.kind === "select" || cfg.kind === "user";
  const options: Choice[] =
    cfg.kind === "user"
      ? choices ?? []
      : (cfg.options ?? []).map((o) => ({ value: o, label: cfg.optionLabels?.[o] ?? o }));
  const shown =
    display !== undefined
      ? display
      : cfg.kind === "saturdays"
      ? describeSaturdaysOff(decodeSaturdaysOff(raw))
      : (cfg.optionLabels?.[raw] ?? raw);

  // Fade the "Saved" tick after a moment.
  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(t);
  }, [state]);

  const start = () => {
    if (!onSave || state === "saving") return;
    // Mobile numbers start with the India code, like the member form.
    setDraft(raw || (cfg.kind === "phone" ? "+91 " : ""));
    setError(null);
    setEditing(true);
  };

  const commit = async (value: string) => {
    if (!onSave) return;
    if (value.trim() === raw.trim() || (cfg.kind === "phone" && !raw && value.trim() === "+91")) {
      setEditing(false);
      setError(null);
      return;
    }
    setState("saving");
    const err = await onSave(field, value);
    if (err) {
      setError(err);
      setState("idle");
      return; // Stay in edit mode so the value can be fixed.
    }
    setError(null);
    setEditing(false);
    setState("saved");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit(draft);
    } else if (e.key === "Escape") {
      setEditing(false);
      setError(null);
    }
  };

  const inputCls =
    "mt-0.5 h-8 w-full rounded-md border border-blue-500 bg-background px-2 text-sm text-foreground outline-none ring-2 ring-blue-500/20 disabled:opacity-60";

  return (
    <div className={wide ? "min-w-0 sm:col-span-2 lg:col-span-3" : "min-w-0"}>
      <dt className="flex items-center gap-2 text-[13px] text-muted-foreground">
        {label}
        {state === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
        {state === "saved" && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
      </dt>
      <dd>
        {editing ? (
          cfg.kind === "saturdays" ? (
            // Several toggles, so it saves with a button rather than on the first change.
            <div className="mt-1 rounded-md border border-blue-500 p-2 ring-2 ring-blue-500/20">
              <SaturdayOffPicker
                value={draft}
                onChange={setDraft}
                disabled={state === "saving"}
                selectClassName="h-8 w-full rounded-md border border-border/80 bg-background px-2 text-sm text-foreground outline-none disabled:opacity-60"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={state === "saving"}
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                  className="h-7 rounded-md border border-border/80 px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={state === "saving"}
                  onClick={() => void commit(draft)}
                  className="h-7 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </div>
          ) : isChoice ? (
            <select
              autoFocus
              value={draft}
              disabled={state === "saving" || (cfg.kind === "user" && !choices)}
              onChange={(e) => {
                setDraft(e.target.value);
                void commit(e.target.value);
              }}
              onBlur={() => state !== "saving" && !error && setEditing(false)}
              onKeyDown={onKeyDown}
              className={inputCls}
            >
              {cfg.kind === "user" && !choices && <option value={draft}>Loading…</option>}
              {!cfg.required && <option value="">{emptyChoiceLabel ?? NOT_SET}</option>}
              {cfg.required && !draft && <option value="">Select…</option>}
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              autoFocus
              type={cfg.kind === "date" ? "date" : cfg.kind === "email" ? "email" : cfg.kind === "phone" ? "tel" : "text"}
              value={draft}
              disabled={state === "saving"}
              max={field === "dateOfBirth" ? new Date().toISOString().slice(0, 10) : undefined}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit(draft)}
              onKeyDown={onKeyDown}
              className={inputCls}
            />
          )
        ) : onSave ? (
          <button
            type="button"
            onClick={start}
            title={`Edit ${label}`}
            className="group -mx-1.5 mt-0.5 flex w-[calc(100%+0.75rem)] items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-accent"
          >
            {renderDisplay ?? (
              <span className={shown ? "min-w-0 flex-1 break-words text-sm font-medium text-foreground" : "min-w-0 flex-1 text-sm italic text-muted-foreground"}>
                {shown || NOT_SET}
              </span>
            )}
            <Pencil className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ) : (
          renderDisplay ?? (
            <p className={shown ? "mt-0.5 break-words text-sm font-medium text-foreground" : "mt-0.5 text-sm italic text-muted-foreground"}>
              {shown || NOT_SET}
            </p>
          )
        )}
        {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </dd>
    </div>
  );
}

/** Card with a "Title ———" heading (shared with the Add Member page). */
const SectionCard = ProfileSectionCard;

/** Photo + "ID - Name" + designation for a reporting manager (the label sits above it). */
function PersonCard({ person, emptyLabel }: { person: Person | null; emptyLabel: string }) {
  if (!person) return <span className="mt-0.5 block text-sm italic text-muted-foreground">{emptyLabel}</span>;
  const name = person.name || person.email;
  return (
    <span className="mt-1 flex min-w-0 items-center gap-3">
      <UserAvatar
        userId={person.id}
        name={person.name}
        email={person.email}
        image={person.image}
        className="h-11 w-11 rounded-lg bg-blue-50 text-sm font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
      >
        {initialsOf(name)}
      </UserAvatar>
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground">
          <IdName employeeId={person.employeeId} name={name} />
        </span>
        {person.title && <span className="block truncate text-xs text-muted-foreground">{person.title}</span>}
      </span>
    </span>
  );
}

const coverButton = PROFILE_COVER_BUTTON;

export function ProfileView(props: ProfileViewProps) {
  const isSelf = props.mode === "self";
  const memberId = props.mode === "member" ? props.userId : null;
  const pathname = usePathname() ?? ROUTES.pulseProfile;
  const searchParams = useSearchParams();
  const sectionParam = searchParams?.get("section");
  /** "Edit Profile" opens the profile-style form in place (?edit=1) instead of leaving the page. */
  const editing = searchParams?.get("edit") === "1";
  const section: Section = (SECTIONS as readonly string[]).includes(sectionParam ?? "") ? (sectionParam as Section) : "profile";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkIn, setCheckIn] = useState<MyCheckInStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        if (memberId) {
          const p = await getMemberProfileData(memberId);
          setProfile(p);
          if (!p) setLoadError("There's no team member with this ID.");
        } else {
          const [p, status] = await Promise.all([
            getMyProfileData(),
            // The status pill is a nice-to-have — never block the profile on it.
            getMyCheckInStatusAction().catch(() => null),
          ]);
          setProfile(p);
          setCheckIn(status);
          if (!p) setLoadError("Couldn't load your profile. Refresh to try again.");
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
        setLoadError(memberId ? "You don't have access to this team member's profile." : "Couldn't load your profile. Refresh to try again.");
      } finally {
        setIsLoading(false);
      }
    });
  }, [memberId]);

  /** Quiet re-read after a change that the page can't patch locally (e.g. a new reporting manager's card). */
  const refreshProfile = async () => {
    try {
      const p = memberId ? await getMemberProfileData(memberId) : await getMyProfileData();
      if (p) setProfile(p);
    } catch {
      // Keep what's on screen; the save itself already succeeded.
    }
  };

  // People to pick as reporting managers — only loaded for managers, who are the only ones who can change them.
  const viewerManages = props.mode === "member" || (profile ? canManageAttendance(profile) : false);
  const [reportingOptions, setReportingOptions] = useState<{ managers: Choice[]; everyone: Choice[] } | null>(null);
  useEffect(() => {
    if (!viewerManages || reportingOptions) return;
    const toChoices = (list: { id: string; name: string }[]) => list.map((u) => ({ value: u.id, label: u.name }));
    getReportingOptionsAction()
      .then((o) => setReportingOptions({ managers: toChoices(o.managers), everyone: toChoices(o.everyone) }))
      .catch(() => setReportingOptions({ managers: [], everyone: [] }));
  }, [viewerManages, reportingOptions]);

  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const [photoBusy, setPhotoBusy] = useState(false);
  /** Document slot (kind) currently uploading / removing. */
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const displayName = profile ? profile.name || profile.email : "Team Member";
  // Trail after the route's own steps: "Pulse › My Profile › Attendance" or "Pulse › Name › Leave".
  usePulseCrumbs(
    useMemo<PulseCrumb[]>(
      () => [
        ...(isSelf ? [] : [{ label: displayName, href: pathname }]),
        ...(editing ? [{ label: "Edit Profile" }] : section === "profile" ? [] : [{ label: SECTION_LABEL[section] }]),
      ],
      [isSelf, displayName, pathname, section, editing]
    )
  );

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-center gap-3 rounded-lg border border-border/70 bg-card py-20 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-semibold">Loading profile...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-[1400px] rounded-lg border border-border/70 bg-card py-20 text-center text-xs text-muted-foreground">
        {loadError}
      </div>
    );
  }

  const status = isSelf ? todayStatus(checkIn) : null;
  const manager = profile.reportingTo;
  const joined = profile.dateOfJoining ? formatDayDate(profile.dateOfJoining) : null;
  const age = calculateAge(profile.dateOfBirth);

  // Inline editing: members change their own personal / contact details; MANAGER-role users change
  // everything shown here (the server re-checks every save — see updateProfileFieldAction).
  // Someone else's profile only opens for managers (page guard + query check), so they can edit it.
  const viewerIsManager = isSelf ? canManageAttendance(profile) : true;
  const viewerId = isSelf ? profile.id : "";
  const saveField = async (field: ProfileField, raw: string): Promise<string | null> => {
    const res = await updateProfileFieldAction(profile.id, field, raw).catch(() => null);
    if (!res) return "Couldn't save. Check your connection and try again.";
    if (!res.ok) return res.error;
    const kind = PROFILE_FIELDS[field].kind;
    const value =
      res.value !== null && kind === "date"
        ? new Date(res.value)
        : kind === "saturdays"
        ? decodeSaturdaysOff(res.value ?? "")
        : res.value;
    setProfile((p) => (p ? { ...p, [field]: value } : p));
    // A new reporting manager needs their name / photo / ID for the card.
    if (PROFILE_FIELDS[field].kind === "user") await refreshProfile();
    return null;
  };
  /** Props for an editable detail: its stored value, plus onSave when this viewer may change it. */
  const edit = (field: ProfileField) => {
    const v = (profile as Record<string, unknown>)[field];
    return {
      field,
      label: PROFILE_FIELDS[field].label,
      raw: v instanceof Date ? toDateInput(v) : Array.isArray(v) ? encodeSaturdaysOff(v) : typeof v === "string" ? v : "",
      onSave: canEditProfileField(field, { id: viewerId, isManager: viewerIsManager }, profile.id) ? saveField : undefined,
    };
  };
  const fmtDate = (d: Date | string | null) => (d ? formatDayDate(d) : null);

  // Photo: your own, or anyone's for managers. Documents: managers only (as in the member form).
  // The server re-checks both (setProfilePhotoAction / saveProfileDocumentAction).
  const canChangePhoto = isSelf || viewerIsManager;
  const canEditDocuments = viewerIsManager;

  const changePhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file (JPG, PNG, WebP…).");
    if (file.size > PHOTO_MAX) return toast.error("The photo must be 5 MB or smaller.");
    setPhotoBusy(true);
    try {
      const { fileUrl } = await uploadFile(file);
      const res = await setProfilePhotoAction(profile.id, fileUrl);
      if (!res.ok) return toast.error(res.error);
      setProfile((p) => (p ? { ...p, image: res.image } : p));
      toast.success("Photo updated");
      router.refresh(); // other avatars (top bar, lists) pick up the new photo
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload the photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!(await confirm({ title: "Remove photo?", description: "The profile will show initials instead.", confirmLabel: "Remove" }))) return;
    setPhotoBusy(true);
    try {
      const res = await setProfilePhotoAction(profile.id, null);
      if (!res.ok) return toast.error(res.error);
      setProfile((p) => (p ? { ...p, image: null } : p));
      toast.success("Photo removed");
      router.refresh();
    } catch {
      toast.error("Couldn't remove the photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const uploadDocument = async (kind: string, file: File) => {
    if (file.size > DOCUMENT_MAX) return toast.error("Documents must be 10 MB or smaller.");
    setDocBusy(kind);
    try {
      const uploaded = await uploadFile(file);
      const res = await saveProfileDocumentAction(profile.id, kind, uploaded.fileName, uploaded.fileUrl);
      if (!res.ok) return toast.error(res.error);
      setProfile((p) => (p ? { ...p, documents: [...p.documents.filter((d) => d.kind !== kind), res.document] } : p));
      toast.success("Document uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload the document.");
    } finally {
      setDocBusy(null);
    }
  };

  const removeDocument = async (kind: string, label: string) => {
    if (!(await confirm({ title: `Remove ${label}?`, description: "The uploaded file will be removed from this profile.", confirmLabel: "Remove" }))) return;
    setDocBusy(kind);
    try {
      const res = await removeProfileDocumentAction(profile.id, kind);
      if (!res.ok) return toast.error(res.error);
      setProfile((p) => (p ? { ...p, documents: p.documents.filter((d) => d.kind !== kind) } : p));
      toast.success("Document removed");
    } catch {
      toast.error("Couldn't remove the document.");
    } finally {
      setDocBusy(null);
    }
  };
  // Own profile: anyone may edit themselves. Someone else's: only roles the edit page lets in.
  // You can always edit your own profile; someone else's only opens for their managers.
  const canEdit = true;
  const sectionHref = (s: Section) => (s === "profile" ? pathname : `${pathname}?section=${s}`);

  if (editing) {
    // The same profile-style form as Add Member, filled in; each field is editable only if this
    // viewer may change it (the server re-checks on save).
    const initialValues = emptyMemberValues();
    for (const f of Object.keys(PROFILE_FIELDS) as ProfileField[]) {
      const v = (profile as Record<string, unknown>)[f];
      if (v instanceof Date) initialValues[f] = toDateInput(v);
      else if (Array.isArray(v)) initialValues[f] = encodeSaturdaysOff(v);
      else if (typeof v === "string" && v) initialValues[f] = v;
    }
    return (
      <>
        <MemberProfileForm
          mode="edit"
          key={profile.id}
          userId={profile.id}
          initial={initialValues}
          image={profile.image}
          documents={profile.canSeeSensitive ? profile.documents : []}
          canEditField={(f) => canEditProfileField(f, { id: viewerId, isManager: viewerIsManager }, profile.id)}
          canChangePhoto={canChangePhoto}
          canEditDocuments={canEditDocuments}
          onCancel={() => router.push(pathname)}
          onSaved={() => {
            void refreshProfile();
            router.push(pathname);
          }}
        />
        {ConfirmDialog}
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1400px] select-none flex-col gap-4">
      {/* Header: cover, overlapping photo, ID · name · status, reporting manager, tabs */}
      <section className={`overflow-hidden ${PROFILE_CARD}`}>
        <ProfileCover>
          <div className="absolute right-4 top-4 flex gap-2">
            {canEdit && (
              // Opens the profile-style edit form right here (not User Management).
              <Link href={`${pathname}?edit=1`} className={coverButton}>
                <Pencil className="h-3.5 w-3.5" />
                Edit Profile
              </Link>
            )}
            {isSelf && (
              <button type="button" onClick={() => logoutAction()} className={`${coverButton} hover:bg-rose-600/80`}>
                <LogOut className="h-3.5 w-3.5" />
                Log Out
              </button>
            )}
          </div>
        </ProfileCover>

        <div className="flex flex-col gap-4 px-6 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
            {/* Photo — hover (or tap) to change it, when allowed. */}
            <div className="group relative -mt-14 w-fit shrink-0 sm:-mt-20">
              <UserAvatar
                key={profile.image ?? "none"}
                name={profile.name}
                image={profile.image}
                className="h-28 w-28 rounded-xl border-4 border-card bg-blue-50 text-3xl font-bold text-blue-700 shadow-md sm:h-36 sm:w-36 dark:bg-blue-500/15 dark:text-blue-300"
              >
                {initialsOf(displayName)}
              </UserAvatar>

              {photoBusy && (
                <span className="absolute inset-1 flex items-center justify-center rounded-lg bg-black/55">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </span>
              )}

              {canChangePhoto && !photoBusy && (
                <>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    title={profile.image ? "Change photo" : "Add photo"}
                    className="absolute inset-1 flex flex-col items-center justify-center gap-1 rounded-lg bg-black/55 text-xs font-semibold text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Camera className="h-5 w-5" />
                    {profile.image ? "Change photo" : "Add photo"}
                  </button>
                  {profile.image && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      title="Remove photo"
                      aria-label="Remove photo"
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void changePhoto(file);
                    }}
                  />
                </>
              )}
            </div>
            <div className="min-w-0 space-y-1 pb-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="truncate text-lg text-foreground">
                  <IdName employeeId={profile.employeeId} name={displayName} />
                </h1>
                {status && <StatusPill tone={status.tone}>{status.pill}</StatusPill>}
                {!profile.isActive && <StatusPill tone="gray">Inactive</StatusPill>}
              </div>
              {status && <p className="text-sm text-muted-foreground">{status.line}</p>}
              <p className={profile.title ? "text-sm text-muted-foreground" : "text-sm italic text-muted-foreground"}>
                {profile.title || "No designation set"}
              </p>
            </div>
          </div>

          {manager && (
            <div className="flex items-center gap-3 sm:pb-1 sm:text-right">
              <div className="order-2 min-w-0 sm:order-1">
                <p className="text-[13px] text-muted-foreground">Reporting Manager</p>
                <p className="truncate text-sm text-foreground">
                  <IdName employeeId={manager.employeeId} name={manager.name || manager.email} />
                </p>
              </div>
              <UserAvatar
                userId={manager.id}
                name={manager.name}
                email={manager.email}
                image={manager.image}
                className="order-1 h-12 w-12 rounded-lg bg-violet-50 text-sm font-bold text-violet-700 sm:order-2 dark:bg-violet-500/15 dark:text-violet-300"
              >
                {initialsOf(manager.name || manager.email)}
              </UserAvatar>
            </div>
          )}
        </div>

        <PulseTabs
          className="rounded-none border-0 border-t px-4 shadow-none"
          tabs={SECTIONS.map((s) => ({
            label: s === "profile" && isSelf ? "My Profile" : SECTION_LABEL[s],
            href: sectionHref(s),
            active: section === s,
          }))}
        />
      </section>

      {section === "profile" && (
        <>
          {/* Key details at a glance */}
          <section className="rounded-lg border border-border/70 bg-card px-6 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <EditableInfoItem icon={<MapPin className="h-5 w-5" />} {...edit("location")} />
              <EditableInfoItem icon={<Network className="h-5 w-5" />} {...edit("department")} />
              <EditableInfoItem icon={<Briefcase className="h-5 w-5" />} {...edit("employmentType")} />
              {/* Fixed: the whole team works on IST. */}
              <InfoItem icon={<Clock className="h-5 w-5" />} label="Time zone" value="India Standard Time (GMT+05:30)" />
              <EditableInfoItem icon={<Mail className="h-5 w-5" />} {...edit("email")} label="Email address" />
              <EditableInfoItem icon={<Smartphone className="h-5 w-5" />} {...edit("personalMobile")} />
            </div>
          </section>

          {/* Full details — the same sections as User Management's member form. */}
          <SectionCard title="Basic Information">
            <DetailGrid>
              <EditableDetail {...edit("employeeId")} />
              <EditableDetail {...edit("name")} />
              <EditableDetail {...edit("email")} />
              <EditableDetail {...edit("role")} />
              <Detail label="Profile Role" value={profile.profileRole ? PROFILE_ROLE_LABEL[profile.profileRole] ?? profile.profileRole : null} />
              <Detail label="Status" value={profile.isActive ? "Active" : "Inactive"} />
            </DetailGrid>
          </SectionCard>

          <SectionCard title="Work Information">
            <DetailGrid>
              <EditableDetail {...edit("title")} />
              <EditableDetail {...edit("department")} />
              <EditableDetail {...edit("location")} />
              <EditableDetail {...edit("saturdaysOff")} />
              <EditableDetail {...edit("employmentType")} />
              <EditableDetail {...edit("dateOfJoining")} display={joined} />
              <EditableDetail {...edit("dateOfConfirmation")} display={fmtDate(profile.dateOfConfirmation)} />
            </DetailGrid>
          </SectionCard>

          <SectionCard title="Organization Structure">
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Managers pick from the people list; the person can't report to themselves. */}
              <EditableDetail
                {...edit("reportingToId")}
                choices={reportingOptions?.managers.filter((c) => c.value !== profile.id)}
                emptyChoiceLabel="Top of Hierarchy (No Manager)"
                renderDisplay={<PersonCard person={profile.reportingTo} emptyLabel="Top of Hierarchy (No Manager)" />}
              />
              <EditableDetail
                {...edit("secondaryReportingToId")}
                choices={reportingOptions?.everyone.filter((c) => c.value !== profile.id)}
                emptyChoiceLabel="None"
                renderDisplay={<PersonCard person={profile.secondaryReportingTo} emptyLabel={NOT_SET} />}
              />
            </dl>
          </SectionCard>

          <SectionCard title="Personal Details">
            <DetailGrid>
              <EditableDetail {...edit("dateOfBirth")} display={fmtDate(profile.dateOfBirth)} />
              <Detail label="Age" value={age !== null ? `${age} years` : null} />
              <EditableDetail {...edit("gender")} />
              <EditableDetail {...edit("maritalStatus")} />
            </DetailGrid>
          </SectionCard>

          <SectionCard title="Contact Details">
            <DetailGrid>
              <EditableDetail {...edit("workMobile")} />
              <EditableDetail {...edit("personalMobile")} />
              <EditableDetail {...edit("personalEmail")} />
              <EditableDetail {...edit("parentGuardianName")} />
              <EditableDetail {...edit("parentGuardianRelationship")} />
              <EditableDetail {...edit("parentGuardianMobile")} />
              <EditableDetail {...edit("permanentAddress")} wide />
            </DetailGrid>
          </SectionCard>

          {/* Aadhaar, bank and uploaded documents: for the member and their managers. */}
          {profile.canSeeSensitive && (
            <>
              <SectionCard title="Bank & Identity">
                <DetailGrid>
                  <EditableDetail {...edit("aadharNumber")} />
                  <EditableDetail {...edit("bankAccountNumber")} />
                  <EditableDetail {...edit("ifscCode")} />
                </DetailGrid>
              </SectionCard>

              <SectionCard title="Documents">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {DOCUMENT_FIELDS.map((d) => (
                    <DocumentSlot
                      key={d.key}
                      label={d.label}
                      doc={profile.documents.find((x) => x.kind === d.key)}
                      busy={docBusy === d.key}
                      canEdit={canEditDocuments && (docBusy === null || docBusy === d.key)}
                      onUpload={(file) => void uploadDocument(d.key, file)}
                      onRemove={() => void removeDocument(d.key, d.label)}
                    />
                  ))}
                </div>
                {canEditDocuments && (
                  <p className="mt-3 text-xs text-muted-foreground">PDF, Word or image files, up to 10 MB each. Uploading replaces the file in that slot.</p>
                )}
              </SectionCard>
            </>
          )}
        </>
      )}

      {/* The same screens as Pulse › Attendance / Leave, opened in place with their own inner tabs. */}
      {section === "attendance" &&
        (props.mode === "self" ? (
          <AttendanceWorkspace embedded view="my" canManage={props.canManage} currentUserId={props.currentUserId} />
        ) : (
          <EmployeeAttendanceWorkspace embedded key={props.userId} userId={props.userId} />
        ))}

      {section === "leave" &&
        (props.mode === "self" ? (
          <LeaveWorkspace embedded initialTab="overview" />
        ) : (
          <EmployeeLeaveWorkspace embedded key={props.userId} userId={props.userId} />
        ))}

      {ConfirmDialog}
    </div>
  );
}
