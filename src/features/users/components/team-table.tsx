"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { ROUTES } from "@/constants/routes";

function getAvatarUrl(image?: string | null, _id?: string, _name?: string) {
  if (image && image.trim()) return image;
  return "/default-avatar.png";
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
import type { TeamMemberRow } from "@/features/users/actions/user-actions";
import {
  toggleUserLoginAction,
  deleteTeamMemberAction,
} from "@/features/users/actions/user-actions";

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
  onSelectUser: (id: string) => void;
}

export function TeamTable({ members, onSelectUser }: TeamTableProps) {
  const router = useRouter();
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMemberRow | null>(null);
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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Profile</TableHead>
              <TableHead className="text-center">Member</TableHead>
              <TableHead className="text-center">Role</TableHead>
              <TableHead className="text-center">Department</TableHead>
              <TableHead className="text-center">Login (Enable/Disable)</TableHead>
              <TableHead className="text-center">Actions</TableHead>
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
                  <TableCell className="text-center">
                    <button
                      type="button"
                      onClick={() => onSelectUser(member.id)}
                      className="mx-auto flex hover:opacity-80"
                    >
                      <Avatar className="h-11 w-11 border shadow-2xs">
                        <AvatarImage
                          src={getAvatarUrl(member.image, member.id, member.name)}
                          alt={member.name}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          <img src="/default-avatar.png" alt="Default Avatar" className="h-full w-full object-cover" />
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      type="button"
                      onClick={() => onSelectUser(member.id)}
                      className="mx-auto flex flex-col items-center text-center hover:opacity-80"
                    >
                      <span className="font-medium text-foreground">{member.name}</span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={ROLE_BADGE[member.role] ?? ""} variant="outline">
                      {ROLE_LABEL[member.role] ?? member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {member.department || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      className="mx-auto"
                      checked={member.isActive}
                      disabled={isPending && pendingToggleId === member.id}
                      onCheckedChange={(checked) => handleToggle(member, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="mx-auto flex w-fit items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => router.push(ROUTES.settingsUsersEdit(member.id))}
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
      </div>

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
