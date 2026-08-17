"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function getAvatarUrl(image?: string | null, id?: string, name?: string) {
  if (image && image.trim()) return image;
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(id || name || "user")}`;
}
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  TeamMemberRow,
  DepartmentOption,
  ManagerOption,
} from "@/features/users/actions/user-actions";
import {
  toggleUserLoginAction,
  deleteTeamMemberAction,
} from "@/features/users/actions/user-actions";
import { EditMemberDialog } from "./edit-member-dialog";

const ROLE_BADGE: Record<string, string> = {
  MANAGER: "bg-info/10 text-info border-transparent",
  TEAM_MEMBER: "bg-success/10 text-success border-transparent",
};

const ROLE_LABEL: Record<string, string> = {
  MANAGER: "Manager",
  TEAM_MEMBER: "Member",
};

interface TeamTableProps {
  members: TeamMemberRow[];
  departments?: DepartmentOption[];
  managers?: ManagerOption[];
  onSelectUser: (id: string) => void;
}

export function TeamTable({
  members,
  departments = [],
  managers = [],
  onSelectUser,
}: TeamTableProps) {
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMemberRow | null>(null);
  const [editTarget, setEditTarget] = useState<TeamMemberRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter !== "ALL" && m.role !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !m.isActive) return false;
      if (statusFilter === "INACTIVE" && m.isActive) return false;
      return true;
    });
  }, [members, roleFilter, statusFilter]);

  function handleToggle(member: TeamMemberRow, checked: boolean) {
    setPendingToggleId(member.id);
    startTransition(async () => {
      await toggleUserLoginAction(member.id, checked);
      setPendingToggleId(null);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      await deleteTeamMemberAction(target.id);
      setDeleteTarget(null);
    });
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Role: All</SelectItem>
              <SelectItem value="MANAGER">Manager</SelectItem>
              <SelectItem value="TEAM_MEMBER">Member</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Status: All</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <span className="text-xs text-muted-foreground font-medium">
          Showing {filtered.length} of {members.length} results
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Date of Joining</TableHead>
            <TableHead>Login (Enable/Disable)</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                No team members found.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onSelectUser(member.id)}
                    className="flex items-center gap-3 text-left hover:opacity-80"
                  >
                    <Avatar className="h-9 w-9 border shadow-2xs">
                      <AvatarImage
                        src={getAvatarUrl(member.image, member.id, member.name)}
                        alt={member.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{member.name}</span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>
                  </button>
                </TableCell>
                <TableCell>
                  <Badge className={ROLE_BADGE[member.role] ?? ""} variant="outline">
                    {ROLE_LABEL[member.role] ?? member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.department || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.dateOfJoining || "—"}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={member.isActive}
                    disabled={isPending && pendingToggleId === member.id}
                    onCheckedChange={(checked) => handleToggle(member, checked)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditTarget(member)}
                      title="Edit member"
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(member)}
                      title="Remove member"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <EditMemberDialog
        member={editTarget}
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        departments={departments}
        managers={managers}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove {deleteTarget?.name} from the team. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
