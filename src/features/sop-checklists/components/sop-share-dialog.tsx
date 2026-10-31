"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { toast } from "@/components/shared/toast";
import { getSopShareUsersAction, setSopShareAction } from "../actions/share-actions";
import { SOP_DEPARTMENTS, type SopShare, type SopShareTarget, type SopShareUserOption } from "../types";

/** Share one list or SOP card with people and/or whole departments (managers). */
export function SopShareDialog({
  target,
  title,
  shares,
  onClose,
  onSaved,
}: {
  target: SopShareTarget;
  title: string;
  /** All shares; this dialog starts from the ones of `target`. */
  shares: SopShare[];
  onClose: () => void;
  onSaved: (shares: SopShare[]) => void;
}) {
  const own = shares.filter((s) =>
    target.kind === "sop"
      ? s.templateId === target.templateId
      : !s.templateId && s.department === target.department && s.listName === target.list
  );
  const [users, setUsers] = useState<SopShareUserOption[] | null>(null);
  const [userIds, setUserIds] = useState(() => new Set(own.flatMap((s) => (s.targetUserId ? [s.targetUserId] : []))));
  const [departments, setDepartments] = useState(
    () => new Set(own.flatMap((s) => (s.targetDepartment ? [s.targetDepartment] : [])))
  );
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getSopShareUsersAction()
      .then(setUsers)
      .catch((err) => {
        console.error("Failed to load users:", err);
        setUsers([]);
      });
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users ?? []).filter((u) => !q || u.name.toLowerCase().includes(q));
  }, [users, search]);

  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const save = async () => {
    setIsSaving(true);
    try {
      const res = await setSopShareAction(target, { userIds: [...userIds], departments: [...departments] });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(userIds.size + departments.size > 0 ? "Sharing updated" : "No longer shared");
      onSaved(res.shares);
    } catch (err) {
      console.error("Failed to share:", err);
      toast.error("Failed to update sharing");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="truncate pr-6 text-sm" title={title}>
            Share “{title}”
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div>
            <p className="mb-1.5 font-semibold">Departments</p>
            <div className="flex flex-wrap gap-1.5">
              {SOP_DEPARTMENTS.map((dep) => (
                <label
                  key={dep}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 font-medium hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={departments.has(dep)}
                    onChange={() => setDepartments((prev) => toggle(prev, dep))}
                  />
                  {dep}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-semibold">People ({userIds.size})</p>
            <div className="relative mb-1.5">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people"
                className="w-full rounded-md border bg-background py-1.5 pl-8 pr-2 outline-none focus:border-primary"
              />
            </div>
            <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
              {users === null ? (
                <li className="flex justify-center p-4">
                  <Loader2 size={16} className="animate-spin text-primary" />
                </li>
              ) : shown.length === 0 ? (
                <li className="p-4 text-center text-muted-foreground">No people match.</li>
              ) : (
                shown.map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-accent/50">
                      <input type="checkbox" checked={userIds.has(u.id)} onChange={() => setUserIds((prev) => toggle(prev, u.id))} />
                      <UserAvatar
                        userId={u.id}
                        name={u.name}
                        className="h-6 w-6 bg-primary/15 text-[10px] font-bold text-primary"
                      >
                        {u.name.slice(0, 1).toUpperCase()}
                      </UserAvatar>
                      <span className="min-w-0 flex-1 truncate font-medium">{u.name}</span>
                      {u.department && <span className="shrink-0 text-[11px] text-muted-foreground">{u.department}</span>}
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent">
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={save}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 font-bold text-primary-foreground disabled:opacity-60"
            >
              {isSaving && <Loader2 size={12} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
