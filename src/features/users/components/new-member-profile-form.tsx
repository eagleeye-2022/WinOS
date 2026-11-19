"use client";

// The member form laid out like the profile (cover, photo, the same section cards) — used to add a
// member (Pulse › Add Member, User Management › Add Member) and for "Edit Profile" on a profile.
// Saves through createMemberAction / updateMemberProfileAction, which apply the same field rules as
// editing a profile inline, then uploads the photo / documents.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, Loader2, Save, Trash2, Upload, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { usePulseCrumbs, type PulseCrumb } from "@/components/pulse/pulse-breadcrumbs";
import { PROFILE_CARD, ProfileCover, ProfileSectionCard } from "@/components/pulse/profile-ui";
import { DOCUMENT_FIELDS } from "@/features/users/constants";
import {
  parseProfileFieldValue,
  PROFILE_FIELDS,
  type ProfileField,
  type ProfileFieldConfig,
} from "@/features/users/profile-fields";
import {
  createMemberAction,
  getReportingOptionsAction,
  removeProfileDocumentAction,
  saveProfileDocumentAction,
  setProfilePhotoAction,
  updateMemberProfileAction,
} from "@/features/users/actions/profile-field-actions";

/** Same sections and order as the profile page. */
const SECTIONS: { title: string; fields: ProfileField[]; wide?: ProfileField[] }[] = [
  { title: "Basic Information", fields: ["name", "employeeId", "email", "role"] },
  {
    title: "Work Information",
    fields: ["title", "department", "location", "employmentType", "dateOfJoining", "dateOfConfirmation"],
  },
  { title: "Organization Structure", fields: ["reportingToId", "secondaryReportingToId"] },
  { title: "Personal Details", fields: ["dateOfBirth", "gender", "maritalStatus"] },
  {
    title: "Contact Details",
    fields: [
      "workMobile",
      "personalMobile",
      "personalEmail",
      "parentGuardianName",
      "parentGuardianRelationship",
      "parentGuardianMobile",
      "permanentAddress",
    ],
    wide: ["permanentAddress"],
  },
  { title: "Bank & Identity", fields: ["aadharNumber", "bankAccountNumber", "ifscCode"] },
];

const PLACEHOLDER: Partial<Record<ProfileField, string>> = {
  name: "e.g. John Doe",
  employeeId: "EED1234",
  email: "john.doe@eagleeyedigital.io",
  title: "e.g. Jr. SDE",
  personalEmail: "e.g. john@gmail.com",
  parentGuardianName: "e.g. Richard Doe",
  permanentAddress: "House, street, city, state, PIN",
};

const MB = 1024 * 1024;
const ADD_MEMBER_CRUMBS: PulseCrumb[] = [{ label: "Add Member" }];
const ALL_FIELDS = Object.keys(PROFILE_FIELDS) as ProfileField[];

export type MemberFormValues = Record<ProfileField, string>;
type ProfileDocument = { id: string; kind: string; fileName: string; fileUrl: string };

/** Empty form: mobiles start with the India code, role defaults to Team Member. */
export function emptyMemberValues(): MemberFormValues {
  const v = {} as MemberFormValues;
  for (const f of ALL_FIELDS) v[f] = PROFILE_FIELDS[f].kind === "phone" ? "+91 " : "";
  v.role = "TEAM_MEMBER";
  return v;
}

/** Compare as stored: trimmed, and a bare "+91" counts as an empty number. */
function normalized(field: ProfileField, v: string): string {
  const t = (v ?? "").trim();
  return PROFILE_FIELDS[field].kind === "phone" && t === "+91" ? "" : t;
}

async function uploadFile(file: File): Promise<{ fileUrl: string; fileName: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { fileUrl?: string; fileName?: string; error?: string };
  if (!res.ok || !data.fileUrl) throw new Error(data.error || "Upload failed.");
  return { fileUrl: data.fileUrl, fileName: data.fileName || file.name };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

const inputCls =
  "mt-1 h-9 w-full rounded-md border border-border/80 bg-background px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground";

export type MemberProfileFormProps =
  | {
      mode: "create";
      /** Opened from Pulse (→ the new member's Pulse profile) or User Management (→ their profile there). */
      from: "pulse" | "settings";
    }
  | {
      mode: "edit";
      userId: string;
      initial: MemberFormValues;
      image: string | null;
      documents: ProfileDocument[];
      /** Which fields this viewer may change (others show read-only). */
      canEditField: (field: ProfileField) => boolean;
      canChangePhoto: boolean;
      canEditDocuments: boolean;
      onCancel: () => void;
      /** After a successful save — the profile reloads and leaves edit mode. */
      onSaved: () => void;
    };

/** Add Member page (kept as its own export for the two Add Member routes). */
export function NewMemberProfileForm({ from }: { from: "pulse" | "settings" }) {
  return <MemberProfileForm mode="create" from={from} />;
}

export function MemberProfileForm(props: MemberProfileFormProps) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  // Add Member adds its own breadcrumb step; in edit mode the profile page owns the trail.
  usePulseCrumbs(isEdit ? null : ADD_MEMBER_CRUMBS);

  const initial = useMemo(() => (props.mode === "edit" ? props.initial : emptyMemberValues()), [props]);
  const [values, setValues] = useState<MemberFormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  /** New files per document slot; `removedDocs` are existing ones to delete on save. */
  const [docFiles, setDocFiles] = useState<Record<string, File>>({});
  const [removedDocs, setRemovedDocs] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<false | "member" | "files">(false);
  const [people, setPeople] = useState<{ managers: { id: string; name: string }[]; everyone: { id: string; name: string }[] } | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const canEditField = (f: ProfileField) => (props.mode === "edit" ? props.canEditField(f) : true);
  const canChangePhoto = props.mode === "edit" ? props.canChangePhoto : true;
  const canEditDocuments = props.mode === "edit" ? props.canEditDocuments : true;
  const existingDocs = props.mode === "edit" ? props.documents : [];
  const existingImage = props.mode === "edit" && !photoRemoved ? props.image : null;
  const needsPeople = canEditField("reportingToId") || canEditField("secondaryReportingToId");

  useEffect(() => {
    if (!needsPeople) return;
    getReportingOptionsAction()
      .then(setPeople)
      .catch(() => setPeople({ managers: [], everyone: [] }));
  }, [needsPeople]);

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const set = (field: ProfileField, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  /** Fields to send: everything when adding; only changed, editable ones when editing. */
  const fieldsToSend = (): ProfileField[] =>
    isEdit ? ALL_FIELDS.filter((f) => canEditField(f) && normalized(f, values[f]) !== normalized(f, initial[f])) : ALL_FIELDS;

  /** Uploads the photo / documents for `userId`; returns the labels that failed. */
  const saveFiles = async (userId: string): Promise<string[]> => {
    const failed: string[] = [];
    if (photo) {
      try {
        const { fileUrl } = await uploadFile(photo);
        const r = await setProfilePhotoAction(userId, fileUrl);
        if (!r.ok) failed.push("photo");
      } catch {
        failed.push("photo");
      }
    } else if (photoRemoved) {
      const r = await setProfilePhotoAction(userId, null).catch(() => null);
      if (!r?.ok) failed.push("photo");
    }
    for (const doc of DOCUMENT_FIELDS) {
      const file = docFiles[doc.key];
      try {
        if (file) {
          const up = await uploadFile(file);
          const r = await saveProfileDocumentAction(userId, doc.key, up.fileName, up.fileUrl);
          if (!r.ok) failed.push(doc.label);
        } else if (removedDocs.has(doc.key)) {
          const r = await removeProfileDocumentAction(userId, doc.key);
          if (!r.ok) failed.push(doc.label);
        }
      } catch {
        failed.push(doc.label);
      }
    }
    return failed;
  };

  const hasFileChanges = Boolean(photo) || photoRemoved || Object.keys(docFiles).length > 0 || removedDocs.size > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const send = fieldsToSend();

    // Same checks the server runs, so most mistakes show before anything is sent.
    const found: Partial<Record<ProfileField, string>> = {};
    for (const f of send) {
      const r = parseProfileFieldValue(f, values[f]);
      if ("error" in r) found[f] = r.error;
    }
    setErrors(found);
    const first = Object.keys(found)[0] as ProfileField | undefined;
    if (first) {
      toast.error(`Please fix: ${Object.keys(found).map((f) => PROFILE_FIELDS[f as ProfileField].label).join(", ")}.`);
      document.getElementById(`field-${first}`)?.focus();
      return;
    }

    if (props.mode === "edit" && send.length === 0 && !hasFileChanges) {
      toast.info("No changes to save.");
      props.onCancel();
      return;
    }

    setSaving("member");
    const payload = Object.fromEntries(send.map((f) => [f, values[f]]));
    const res =
      props.mode === "edit"
        ? send.length
          ? await updateMemberProfileAction(props.userId, payload).catch(() => null)
          : ({ ok: true } as const)
        : await createMemberAction(payload).catch(() => null);
    if (!res) {
      setSaving(false);
      return toast.error("Couldn't save. Check your connection and try again.");
    }
    if (!res.ok) {
      setSaving(false);
      setErrors(res.fieldErrors ?? {});
      return toast.error(res.error);
    }

    // Details are saved; photo / documents are extras — a failed upload doesn't undo them.
    const userId = props.mode === "edit" ? props.userId : (res as { id: string }).id;
    setSaving("files");
    const failed = hasFileChanges ? await saveFiles(userId) : [];

    if (props.mode === "edit") {
      if (failed.length) toast.error(`Saved, but these didn't update: ${failed.join(", ")}.`);
      else toast.success("Profile updated");
      setSaving(false);
      props.onSaved();
      router.refresh(); // other avatars / names on the page pick up the change
      return;
    }
    if (failed.length) toast.error(`Member added, but these didn't upload: ${failed.join(", ")}. Add them from the profile.`);
    else toast.success(`${values.name.trim()} has been added to the team.`);
    router.push(props.from === "pulse" ? ROUTES.pulseMemberProfile(userId) : ROUTES.settingsUsersEdit(userId));
    router.refresh();
  };

  const cancel = () => {
    if (props.mode === "edit") props.onCancel();
    else router.push(props.from === "pulse" ? ROUTES.pulseHome : ROUTES.settingsUsers);
  };

  const renderField = (field: ProfileField, wide?: boolean) => {
    const cfg = PROFILE_FIELDS[field] as ProfileFieldConfig;
    const error = errors[field];
    const editable = canEditField(field);
    const common = {
      id: `field-${field}`,
      disabled: Boolean(saving) || !editable,
      title: editable ? undefined : "Only a manager can change this",
      "aria-invalid": Boolean(error),
      className: cn(inputCls, error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20"),
    };

    let control: React.ReactNode;
    if (cfg.kind === "select" || cfg.kind === "user") {
      const options =
        cfg.kind === "user"
          ? (field === "reportingToId" ? people?.managers : people?.everyone)
              ?.filter((p) => !isEdit || p.id !== (props as { userId?: string }).userId)
              .map((p) => ({ value: p.id, label: p.name })) ?? []
          : (cfg.options ?? []).map((o) => ({ value: o, label: cfg.optionLabels?.[o] ?? o }));
      // Read-only "user" fields have no list loaded — still show who is set.
      const current = values[field];
      const missingCurrent = current && !options.some((o) => o.value === current);
      control = (
        <select {...common} value={current} onChange={(e) => set(field, e.target.value)}>
          {field === "reportingToId" ? (
            <option value="">Top of Hierarchy (No Manager)</option>
          ) : field === "secondaryReportingToId" ? (
            <option value="">None</option>
          ) : (
            <option value="">{cfg.required ? "Select…" : "Not set"}</option>
          )}
          {missingCurrent && <option value={current}>{props.mode === "edit" ? "Current selection" : "Loading…"}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    } else {
      control = (
        <input
          {...common}
          type={cfg.kind === "date" ? "date" : cfg.kind === "email" ? "email" : cfg.kind === "phone" ? "tel" : "text"}
          value={values[field]}
          placeholder={PLACEHOLDER[field] ?? (cfg.kind === "phone" ? "+91 9876543210" : undefined)}
          max={field === "dateOfBirth" ? new Date().toISOString().slice(0, 10) : undefined}
          onChange={(e) => set(field, e.target.value)}
        />
      );
    }

    return (
      <div key={field} className={wide ? "min-w-0 sm:col-span-2 lg:col-span-3" : "min-w-0"}>
        <label htmlFor={`field-${field}`} className="text-[13px] text-muted-foreground">
          {cfg.label}
          {cfg.required && editable && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
        {control}
        {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    );
  };

  const name = values.name.trim();
  const shownPhoto = photoPreview ?? existingImage;

  return (
    <form onSubmit={submit} noValidate className="mx-auto flex w-full max-w-[1400px] select-none flex-col gap-4">
      {/* Header: same cover + photo as the profile, filling in as you type */}
      <section className={`overflow-hidden ${PROFILE_CARD}`}>
        <ProfileCover />
        <div className="flex flex-col gap-4 px-6 pb-5 sm:flex-row sm:items-end">
          <div className="group relative -mt-14 w-fit shrink-0 sm:-mt-20">
            <span className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border-4 border-card bg-blue-50 text-3xl font-bold text-blue-700 shadow-md sm:h-36 sm:w-36 dark:bg-blue-500/15 dark:text-blue-300">
              {shownPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownPhoto} alt={name || "Member photo"} className="absolute inset-0 h-full w-full object-cover" />
              ) : name ? (
                initialsOf(name)
              ) : (
                <UserPlus className="h-10 w-10 opacity-60" />
              )}
            </span>
            {canChangePhoto && (
              <>
                <button
                  type="button"
                  disabled={Boolean(saving)}
                  onClick={() => photoInput.current?.click()}
                  className="absolute inset-1 flex flex-col items-center justify-center gap-1 rounded-lg bg-black/55 text-xs font-semibold text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Camera className="h-5 w-5" />
                  {shownPhoto ? "Change photo" : "Add photo"}
                </button>
                {shownPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      if (isEdit) setPhotoRemoved(true);
                    }}
                    aria-label="Remove photo"
                    title="Remove photo"
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (!file.type.startsWith("image/")) return toast.error("Choose an image file (JPG, PNG, WebP…).");
                    if (file.size > 5 * MB) return toast.error("The photo must be 5 MB or smaller.");
                    setPhoto(file);
                    setPhotoRemoved(false);
                  }}
                />
              </>
            )}
          </div>
          <div className="min-w-0 space-y-1 pb-1">
            <h1 className="truncate text-lg text-foreground">
              {values.employeeId.trim() && <span className="text-muted-foreground">{values.employeeId.trim()} - </span>}
              <span className="font-semibold">{name || "New Team Member"}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit ? "Editing profile — change what you need, then Save Changes." : values.title.trim() || "Fill in the details below to add them to the team."}
            </p>
          </div>
        </div>
      </section>

      {SECTIONS.map((s) => (
        <ProfileSectionCard key={s.title} title={s.title}>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.fields.map((f) => renderField(f, s.wide?.includes(f)))}
          </div>
        </ProfileSectionCard>
      ))}

      <ProfileSectionCard title="Documents">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DOCUMENT_FIELDS.map((d) => {
            const file = docFiles[d.key];
            const existing = removedDocs.has(d.key) ? undefined : existingDocs.find((x) => x.kind === d.key);
            const hasSomething = Boolean(file || existing);
            return (
              <div
                key={d.key}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5",
                  saving && "pointer-events-none opacity-60"
                )}
              >
                <FileText className={hasSomething ? "h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" : "h-5 w-5 shrink-0 text-muted-foreground/60"} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">{d.label}</span>
                  <span className={hasSomething ? "block truncate text-xs text-muted-foreground" : "block text-xs italic text-muted-foreground"}>
                    {file ? `${file.name} (new)` : existing ? existing.fileName : isEdit ? "Not uploaded" : "Optional"}
                  </span>
                </span>
                {existing && !file && (
                  <a href={existing.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                    View
                  </a>
                )}
                {canEditDocuments && (
                  <>
                    <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                      <Upload className="h-3.5 w-3.5" />
                      {hasSomething ? "Replace" : "Choose"}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          if (f.size > 10 * MB) return toast.error("Documents must be 10 MB or smaller.");
                          setDocFiles((prev) => ({ ...prev, [d.key]: f }));
                        }}
                      />
                    </label>
                    {hasSomething && (
                      <button
                        type="button"
                        onClick={() => {
                          setDocFiles((prev) => {
                            const next = { ...prev };
                            delete next[d.key];
                            return next;
                          });
                          if (existingDocs.some((x) => x.kind === d.key)) setRemovedDocs((prev) => new Set(prev).add(d.key));
                        }}
                        aria-label={`Remove ${d.label}`}
                        className="shrink-0 text-muted-foreground transition-colors hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {canEditDocuments
            ? `PDF, Word or image files, up to 10 MB each. They ${isEdit ? "save" : "upload"} when you ${isEdit ? "save changes" : "add the member"}.`
            : "Only a manager can upload or remove documents."}
        </p>
      </ProfileSectionCard>

      {/* Pinned actions. The page scroller is padded p-4 / sm:p-6 and sticky stops at that padding,
          so pull the bar into it (negative bottom + margin) to sit flush on the bottom edge. */}
      <div className="sticky -bottom-4 z-20 -mx-4 -mb-4 flex items-center justify-end gap-2 border-t border-border/70 bg-card px-4 py-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6">
        <button
          type="button"
          disabled={Boolean(saving)}
          onClick={cancel}
          className="h-9 rounded-md border border-border/80 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={Boolean(saving)}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {saving === "files" ? "Uploading files…" : saving ? "Saving…" : isEdit ? "Save Changes" : "Add Member"}
        </button>
      </div>
    </form>
  );
}
