"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Camera, Upload, Check, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateAge } from "@/lib/fmt";
import { DEPARTMENTS, LOCATIONS } from "@/features/users/constants";
import { ROUTES } from "@/constants/routes";
import type { ManagerOption, MemberDetails } from "@/features/users/actions/user-actions";
import {
  addTeamMemberAction,
  updateTeamMemberAction,
  updateUserImageAction,
  saveUserDocumentRecordAction,
} from "@/features/users/actions/user-actions";

// Sentinel for "no reporting manager" (top of the org hierarchy, e.g. the
// CEO) — Radix Select can't use an empty string as an item value, and we
// want the field to force an explicit choice rather than silently defaulting.
const NO_MANAGER_VALUE = "__NONE__";

interface MemberFormProps {
  mode: "create" | "edit";
  userId?: string;
  initialData?: MemberDetails;
  managers: ManagerOption[];
  allUsers?: ManagerOption[];
}

const DOCUMENT_FIELDS: { key: string; label: string }[] = [
  { key: "HIGHEST_DEGREE", label: "Highest Degree Marksheet" },
  { key: "TWELFTH_MARKSHEET", label: "12th Marksheet" },
  { key: "TENTH_MARKSHEET", label: "10th Marksheet" },
  { key: "PAN_CARD", label: "PAN Card" },
  { key: "AADHAR_CARD", label: "Aadhar Card" },
  { key: "EXPERIENCE_LETTER", label: "Experience/Internship Letter" },
  { key: "BANK_PASSBOOK", label: "Bank Account Passbook" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function emptyForm() {
  return {
    firstName: "",
    lastName: "",
    email: "",
    role: "TEAM_MEMBER",
    employeeId: "",
    designation: "",
    employmentType: "",
    department: "",
    location: "",
    dateOfJoining: "",
    dateOfConfirmation: "",
    reportingToId: "",
    secondaryReportingToId: "",
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    workMobile: "",
    personalMobile: "",
    parentGuardianName: "",
    parentGuardianMobile: "",
    permanentAddress: "",
    personalEmail: "",
    aadharNumber: "",
    bankAccountNumber: "",
    ifscCode: "",
  };
}

function formFromDetails(details: MemberDetails) {
  return {
    firstName: details.firstName,
    lastName: details.lastName,
    email: details.email,
    role: details.role,
    employeeId: details.employeeId,
    designation: details.designation || "",
    employmentType: details.employmentType || "",
    department: details.department,
    location: details.location,
    dateOfJoining: details.dateOfJoining || "",
    dateOfConfirmation: details.dateOfConfirmation || "",
    reportingToId: details.reportingToId || NO_MANAGER_VALUE,
    secondaryReportingToId: details.secondaryReportingToId || "",
    dateOfBirth: details.dateOfBirth,
    gender: details.gender,
    maritalStatus: details.maritalStatus || "",
    workMobile: details.workMobile || "",
    personalMobile: details.personalMobile,
    parentGuardianName: details.parentGuardianName || "",
    parentGuardianMobile: details.parentGuardianMobile || "",
    permanentAddress: details.permanentAddress || "",
    personalEmail: details.personalEmail || "",
    aadharNumber: details.aadharNumber || "",
    bankAccountNumber: details.bankAccountNumber || "",
    ifscCode: details.ifscCode || "",
  };
}

export function MemberForm({ mode, userId, initialData, managers, allUsers }: MemberFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialData ? formFromDetails(initialData) : emptyForm());
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image || null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadSuccess, setImageUploadSuccess] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdMemberName, setCreatedMemberName] = useState("");

  function update<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const age = useMemo(() => calculateAge(form.dateOfBirth || null), [form.dateOfBirth]);

  const missingRequired = useMemo(() => {
    const missing: string[] = [];
    if (!form.firstName.trim()) missing.push("First Name");
    if (!form.lastName.trim()) missing.push("Last Name");
    if (!form.email.trim()) missing.push("Work Email");
    if (!form.employeeId.trim()) missing.push("Employee ID");
    if (!form.designation.trim()) missing.push("Designation");
    if (!form.department) missing.push("Department");
    if (!form.reportingToId) missing.push("Reporting Manager");
    if (!form.gender) missing.push("Gender");
    if (!form.dateOfBirth) missing.push("Date of Birth");
    if (!form.personalMobile.trim()) missing.push("Personal Mobile Number");
    if (!form.location) missing.push("Location");
    return missing;
  }, [form]);

  const isValid = missingRequired.length === 0;

  function handleImageChange(file: File | null) {
    setImageFile(file);
    setImageUploadSuccess(false);
    setImageUploadError(null);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(initialData?.image || null);
    }
  }

  async function handleUploadPhotoDirectly() {
    setImageUploadSuccess(false);
    setImageUploadError(null);

    if (!imageFile) {
      document.getElementById("profile-image-input")?.click();
      return;
    }

    setIsUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", imageFile);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: fd,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload image to server");
      }

      const data = await response.json();
      const uploadedUrl = data.fileUrl;

      if (!uploadedUrl) {
        throw new Error("Invalid response from upload server");
      }

      if (mode === "edit" && userId) {
        await updateUserImageAction(userId, uploadedUrl);
      }

      setImagePreview(uploadedUrl);
      setImageFile(null);
      setImageUploadSuccess(true);
      router.refresh();
    } catch (err) {
      console.error("Image upload error:", err);
      setImageUploadError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setIsUploadingImage(false);
    }
  }

  function handleRemovePhoto() {
    setImageFile(null);
    setImagePreview(null);
    setImageUploadSuccess(false);
    setImageUploadError(null);
    const input = document.getElementById("profile-image-input") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const todayStr = new Date().toISOString().split("T")[0];
    if (form.dateOfBirth && form.dateOfBirth > todayStr) {
      setError("Date of Birth cannot be greater than the current date.");
      return;
    }

    if (!isValid) {
      setError(`Please fill in all required fields: ${missingRequired.join(", ")}.`);
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          ...form,
          role: form.role as "TEAM_MEMBER" | "MANAGER",
          reportingToId: form.reportingToId === NO_MANAGER_VALUE ? "" : form.reportingToId,
        };
        let targetId: string;
        if (mode === "create") {
          targetId = (await addTeamMemberAction(payload)).id;
        } else {
          targetId = userId!;
          await updateTeamMemberAction({ ...payload, id: targetId });
        }

        if (imageFile) {
          const fd = new FormData();
          fd.append("file", imageFile);
          const response = await fetch("/api/uploads", {
            method: "POST",
            body: fd,
          });
          if (response.ok) {
            const data = await response.json();
            if (data.fileUrl) {
              await updateUserImageAction(targetId, data.fileUrl);
            }
          }
        } else if (imagePreview && imagePreview !== initialData?.image) {
          await updateUserImageAction(targetId, imagePreview);
        }

        for (const [kind, file] of Object.entries(files)) {
          if (!file) continue;
          const fd = new FormData();
          fd.append("file", file);
          const response = await fetch("/api/uploads", {
            method: "POST",
            body: fd,
          });
          if (response.ok) {
            const data = await response.json();
            if (data.fileUrl) {
              await saveUserDocumentRecordAction(targetId, kind, data.fileName || file.name, data.fileUrl);
            }
          }
        }

        if (mode === "create") {
          setCreatedMemberName(`${form.firstName} ${form.lastName}`.trim());
          setShowSuccessModal(true);
        } else {
          router.push(ROUTES.settingsUsers);
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save team member");
      }
    });
  }

  return (
    <div className="p-6 w-full pb-8">
      <div className="sticky top-0 z-20 -mx-6 mb-6 flex items-center justify-between gap-3 bg-background/95 px-6 py-2.5 backdrop-blur-xs border-b">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-muted-foreground shadow-2xs"
          onClick={() => router.push(ROUTES.settingsUsers)}
        >
          <ArrowLeft size={16} />
          Back to Settings
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-sm rounded-lg border bg-card p-6">
        <div className="flex items-center gap-5 border-b pb-6">
          <Avatar className="h-28 w-28 border shadow-2xs">
            <AvatarImage src={imagePreview || "/default-avatar.png"} alt="Profile" className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              <img src="/default-avatar.png" alt="Default Avatar" className="h-full w-full object-cover" />
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="profile-image-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
              />

              <Label
                htmlFor="profile-image-input"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors shadow-2xs"
              >
                <Camera size={14} />
                Select Photo
              </Label>

              <Button
                type="button"
                size="sm"
                variant={imageFile ? "default" : "outline"}
                disabled={isUploadingImage}
                onClick={handleUploadPhotoDirectly}
                className="h-8 text-xs gap-1.5 shadow-2xs"
              >
                {isUploadingImage ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Upload Photo
                  </>
                )}
              </Button>

              {(imageFile || imagePreview) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRemovePhoto}
                  className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1"
                >
                  <Trash2 size={13} />
                  Remove
                </Button>
              )}
            </div>

            {/* <p className="text-[11px] text-muted-foreground">
              Select a PNG or JPG photo, then click <span className="font-semibold text-foreground">Upload Photo</span> to upload profile image.
            </p> */}

            {imageUploadSuccess && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check size={14} />
                {mode === "edit"
                  ? "Photo uploaded and saved successfully!"
                  : "Photo selected! It will be saved when you click 'Add To Team'."}
              </p>
            )}

            {imageUploadError && (
              <p className="text-xs font-medium text-destructive">
                {imageUploadError}
              </p>
            )}

            {/* {imageFile && !imageUploadSuccess && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Photo selected: <span className="underline">{imageFile.name}</span>. Click "Upload Photo" to upload now.
              </p>
            )} */}
          </div>
        </div>

        <Section title="Basic Information">
          <Field label="First Name" required>
            <Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="e.g. John" />
          </Field>
          <Field label="Last Name" required>
            <Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="e.g. Doe" />
          </Field>
          <Field label="Employee ID" required>
            <Input value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} placeholder="EED1234" />
          </Field>
          <Field label="Work Email" required>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="john.doe@eagleeyedigital.io" />
          </Field>
          <Field label="Role" required>
            <Select value={form.role} onValueChange={(v) => update("role", v)}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TEAM_MEMBER">Team Member</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Work Information">
          <Field label="Designation" required>
            <Input value={form.designation} onChange={(e) => update("designation", e.target.value)} placeholder="e.g. Jr. SDE" />
          </Field>
          <Field label="Department" required>
            <Select value={form.department} onValueChange={(v) => update("department", v)}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Location" required>
            <Select value={form.location} onValueChange={(v) => update("location", v)}>
              <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Employment Type">
            <Select value={form.employmentType} onValueChange={(v) => update("employmentType", v)}>
              <SelectTrigger><SelectValue placeholder="Select (Permanent/Trainee)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Permanent">Permanent</SelectItem>
                <SelectItem value="Trainee">Trainee</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date of Joining">
            <Input type="date" value={form.dateOfJoining} onChange={(e) => update("dateOfJoining", e.target.value)} />
          </Field>
          <Field label="Date of Confirmation">
            <Input type="date" value={form.dateOfConfirmation} onChange={(e) => update("dateOfConfirmation", e.target.value)} />
          </Field>
        </Section>

        <Section title="Hierarchy Information">
          <Field label="Reporting Manager (Organization Tree)" required>
            <Select value={form.reportingToId} onValueChange={(v) => update("reportingToId", v)}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MANAGER_VALUE}>Top of Hierarchy (No Manager)</SelectItem>
                {managers.filter((m) => m.id !== userId).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Secondary Reporting To">
            <Select value={form.secondaryReportingToId} onValueChange={(v) => update("secondaryReportingToId", v)}>
              <SelectTrigger><SelectValue placeholder="Select manager/member (if any)" /></SelectTrigger>
              <SelectContent>
                {(allUsers || managers).filter((m) => m.id !== userId).map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Personal Details">
          <Field label="Date of Birth" required>
            <Input
              type="date"
              max={new Date().toISOString().split("T")[0]}
              value={form.dateOfBirth}
              onChange={(e) => {
                const val = e.target.value;
                const todayStr = new Date().toISOString().split("T")[0];
                if (val && val > todayStr) {
                  setError("Date of Birth cannot be greater than the current date.");
                } else {
                  setError(null);
                }
                update("dateOfBirth", val);
              }}
            />
          </Field>
          <Field label="Age">
            <Input value={age !== null ? String(age) : ""} readOnly disabled placeholder="Calculated from Date of Birth" />
          </Field>
          <Field label="Gender" required>
            <Select value={form.gender} onValueChange={(v) => update("gender", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Marital Status">
            <Select value={form.maritalStatus} onValueChange={(v) => update("maritalStatus", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Single">Single</SelectItem>
                <SelectItem value="Married">Married</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Documents (optional)">
          {DOCUMENT_FIELDS.map((doc) => (
            <Field key={doc.key} label={doc.label}>
              <Input
                type="file"
                className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
                onChange={(e) => setFiles((prev) => ({ ...prev, [doc.key]: e.target.files?.[0] ?? null }))}
              />
              {mode === "edit" && initialData?.documents.some((d) => d.kind === doc.key) && (
                <a
                  href={initialData.documents.find((d) => d.kind === doc.key)?.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary hover:underline"
                >
                  View current file
                </a>
              )}
            </Field>
          ))}
          <Field label="Aadhar Number">
            <Input value={form.aadharNumber} onChange={(e) => update("aadharNumber", e.target.value)} placeholder="9876543210" />
          </Field>
          <Field label="Bank Account Number">
            <Input value={form.bankAccountNumber} onChange={(e) => update("bankAccountNumber", e.target.value)} placeholder="9876543210" />
          </Field>
          <Field label="IFSC Code">
            <Input value={form.ifscCode} onChange={(e) => update("ifscCode", e.target.value)} placeholder="9876543210" />
          </Field>
        </Section>

        <Section title="Contact Details">
          <Field label="Work Mobile Number">
            <Input value={form.workMobile} onChange={(e) => update("workMobile", e.target.value)} placeholder="9876543210" />
          </Field>
          <Field label="Personal Mobile Number" required>
            <Input value={form.personalMobile} onChange={(e) => update("personalMobile", e.target.value)} placeholder="9876543210" />
          </Field>
          <Field label="Parent/Guardian Name">
            <Input value={form.parentGuardianName} onChange={(e) => update("parentGuardianName", e.target.value)} placeholder="e.g. Doe" />
          </Field>
          <Field label="Parent/Guardian Mobile Number">
            <Input value={form.parentGuardianMobile} onChange={(e) => update("parentGuardianMobile", e.target.value)} placeholder="9876543210" />
          </Field>
          <Field label="Permanent Address">
            <Input value={form.permanentAddress} onChange={(e) => update("permanentAddress", e.target.value)} placeholder="e.g. Doe" />
          </Field>
          <Field label="Personal E-mail address">
            <Input type="email" value={form.personalEmail} onChange={(e) => update("personalEmail", e.target.value)} placeholder="e.g. Doe" />
          </Field>
        </Section>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>
        )}

        {/* {!error && !isValid && (
          <p className="text-xs text-muted-foreground">
            Still missing: <span className="font-medium text-foreground">{missingRequired.join(", ")}</span>
          </p>
        )} */}

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => router.push(ROUTES.settingsUsers)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="gap-1.5">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {mode === "create" ? "Add To Team" : "Save Changes"}
          </Button>
        </div>
      </form>

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Member Created Successfully!</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{createdMemberName || "Team member"}</span> has been added to your organization.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push(ROUTES.settingsUsers);
                  router.refresh();
                }}
                className="w-full font-semibold"
              >
                Go to Team Management
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowSuccessModal(false);
                  setForm(emptyForm());
                  setFiles({});
                  setImageFile(null);
                  setImagePreview(null);
                  setImageUploadSuccess(false);
                  setImageUploadError(null);
                  setError(null);
                  router.refresh();
                }}
                className="w-full text-xs"
              >
                Add Another Member
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
