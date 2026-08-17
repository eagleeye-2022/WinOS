"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { UserRole } from "@/types";
import type {
  TeamMemberRow,
  DepartmentOption,
  ManagerOption,
} from "@/features/users/actions/user-actions";
import {
  getUserDetailsAction,
  updateTeamMemberAction,
} from "@/features/users/actions/user-actions";

interface EditMemberDialogProps {
  member: TeamMemberRow | null;
  isOpen: boolean;
  onClose: () => void;
  departments?: DepartmentOption[];
  managers?: ManagerOption[];
}

export function EditMemberDialog({
  member,
  isOpen,
  onClose,
  departments = [],
  managers = [],
}: EditMemberDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "TEAM_MEMBER" as UserRole,
    title: "",
    departmentTeamId: "",
    dateOfJoining: "",
    reportingToId: "",
  });

  useEffect(() => {
    if (member && isOpen) {
      const timer = setTimeout(() => {
        setError(null);
        setForm({
          name: member.name || "",
          email: member.email || "",
          role: member.role || "TEAM_MEMBER",
          title: member.title || "",
          departmentTeamId: "",
          dateOfJoining: member.dateOfJoining || "",
          reportingToId: "",
        });

        setIsLoading(true);
        getUserDetailsAction(member.id)
          .then((details) => {
            if (details) {
              setForm({
                name: details.name || member.name || "",
                email: details.email || member.email || "",
                role: (details.role as UserRole) || member.role,
                title: details.title || member.title || "",
                departmentTeamId: details.departmentTeamId || "",
                dateOfJoining: details.dateOfJoining || member.dateOfJoining || "",
                reportingToId: details.reportingToId || "",
              });
            }
          })
          .finally(() => setIsLoading(false));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [member, isOpen]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;

    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await updateTeamMemberAction({
          id: member.id,
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          title: form.title.trim() || undefined,
          departmentTeamId: form.departmentTeamId || undefined,
          dateOfJoining: form.dateOfJoining || undefined,
          reportingToId: form.reportingToId || undefined,
        });

        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update member");
      }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Team Member</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Full Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Work Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="john.doe@eagleeyedigital.io"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Role *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((p) => ({ ...p, role: v as UserRole }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEAM_MEMBER">Team Member</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Designation</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Jr. SDE"
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Department</Label>
              <Select
                value={form.departmentTeamId}
                onValueChange={(v) => setForm((p) => ({ ...p, departmentTeamId: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.teamId} value={d.teamId}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Reporting Manager</Label>
                <Select
                  value={form.reportingToId}
                  onValueChange={(v) => setForm((p) => ({ ...p, reportingToId: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers
                      .filter((m) => m.id !== member?.id)
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Date of Joining</Label>
                <Input
                  type="date"
                  value={form.dateOfJoining}
                  onChange={(e) => setForm((p) => ({ ...p, dateOfJoining: e.target.value }))}
                  className="h-9"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="gap-1.5">
                {isPending && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
