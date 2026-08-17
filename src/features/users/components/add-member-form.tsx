"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DepartmentOption, ManagerOption } from "@/features/users/actions/user-actions";
import {
  addTeamMemberAction,
  uploadUserDocumentAction,
} from "@/features/users/actions/user-actions";

interface AddMemberFormProps {
  isOpen: boolean;
  onClose: () => void;
  departments: DepartmentOption[];
  managers: ManagerOption[];
}

const DOCUMENT_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "HIGHEST_DEGREE", label: "Highest Degree Marksheet", required: true },
  { key: "TWELFTH_MARKSHEET", label: "12th Marksheet" },
  { key: "TENTH_MARKSHEET", label: "10th Marksheet" },
  { key: "PAN_CARD", label: "PAN Card", required: true },
  { key: "AADHAR_CARD", label: "Aadhar Card", required: true },
  { key: "EXPERIENCE_LETTER", label: "Experience/Internship Letter" },
  { key: "BANK_PASSBOOK", label: "Bank Account Passbook" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
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

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  role: "TEAM_MEMBER",
  employeeId: "",
  designation: "",
  employmentType: "",
  departmentTeamId: "",
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

export function AddMemberForm({ isOpen, onClose, departments, managers }: AddMemberFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError("First name, last name and work email are required.");
      return;
    }

    startTransition(async () => {
      try {
        const { id } = await addTeamMemberAction({
          ...form,
          departmentTeamId: form.departmentTeamId || undefined,
          reportingToId: form.reportingToId || undefined,
          secondaryReportingToId: form.secondaryReportingToId || undefined,
          role: form.role as "TEAM_MEMBER" | "MANAGER",
        });

        for (const [kind, file] of Object.entries(files)) {
          if (!file) continue;
          const fd = new FormData();
          fd.set("file", file);
          await uploadUserDocumentAction(id, kind, fd);
        }

        setForm(EMPTY_FORM);
        setFiles({});
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add team member");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-xs transition-opacity duration-200">
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Add new team member</h2>
            <p className="text-xs text-muted-foreground">Fill in the details below.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-accent rounded hover:text-foreground text-muted-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm">
          <Section title="Basic Information">
            <Field label="First Name" required>
              <Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="e.g. John" />
            </Field>
            <Field label="Last Name" required>
              <Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="e.g. Doe" />
            </Field>
            <Field label="Employee ID">
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
            <Field label="Department">
              <Select value={form.departmentTeamId} onValueChange={(v) => update("departmentTeamId", v)}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.teamId} value={d.teamId}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Employment Type">
              <Select value={form.employmentType} onValueChange={(v) => update("employmentType", v)}>
                <SelectTrigger><SelectValue placeholder="Select a role (Permanent/Intern)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Permanent">Permanent</SelectItem>
                  <SelectItem value="Intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date of Joining" required>
              <Input type="date" value={form.dateOfJoining} onChange={(e) => update("dateOfJoining", e.target.value)} />
            </Field>
            <Field label="Date of Confirmation">
              <Input type="date" value={form.dateOfConfirmation} onChange={(e) => update("dateOfConfirmation", e.target.value)} />
            </Field>
          </Section>

          <Section title="Hierarchy Information">
            <Field label="Reporting To" required>
              <Select value={form.reportingToId} onValueChange={(v) => update("reportingToId", v)}>
                <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Secondary Reporting To">
              <Select value={form.secondaryReportingToId} onValueChange={(v) => update("secondaryReportingToId", v)}>
                <SelectTrigger><SelectValue placeholder="Select manager (if any)" /></SelectTrigger>
                <SelectContent>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section title="Personal Details">
            <Field label="Date of Birth">
              <Input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
            </Field>
            <Field label="Gender">
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

          <Section title="Documents">
            {DOCUMENT_FIELDS.map((doc) => (
              <Field key={doc.key} label={doc.label} required={doc.required}>
                <Input
                  type="file"
                  className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
                  onChange={(e) => setFiles((prev) => ({ ...prev, [doc.key]: e.target.files?.[0] ?? null }))}
                />
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
            <Field label="Personal Mobile Number">
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

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Add To Team
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
