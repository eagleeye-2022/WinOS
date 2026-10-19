"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import {
  X, Search, Users, ChevronDown, Pencil, Check,
  Paintbrush, Code2, TrendingUp, Hash, Layers, ShoppingBag, HeartHandshake, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createTeam, type CreateTeamState } from "../actions/create-team";
import { updateTeam, type UpdateTeamState } from "../actions/update-team";
import { updateMemberName } from "../actions/update-member-name";
import type { TeamWithMembers, AllUser } from "../queries";

const DEPARTMENTS = ["Engineering", "Design", "Marketing", "Product", "Sales", "Support", "SMM", "Other"];

// Department → colored square icon for team list cards
function DeptIcon({ department }: { department?: string | null }) {
  const base = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg";
  switch (department) {
    case "Design":
      return <span className={cn(base, "bg-orange-100 dark:bg-orange-500/15")}><Paintbrush size={15} className="text-orange-600 dark:text-orange-300" /></span>;
    case "Engineering":
      return <span className={cn(base, "bg-blue-100 dark:bg-blue-500/15")}><Code2 size={15} className="text-blue-600 dark:text-blue-300" /></span>;
    case "Marketing":
      return <span className={cn(base, "bg-green-100 dark:bg-green-500/15")}><TrendingUp size={15} className="text-green-600 dark:text-green-300" /></span>;
    case "SMM":
      return <span className={cn(base, "bg-purple-100 dark:bg-purple-500/15")}><Hash size={15} className="text-purple-600 dark:text-purple-300" /></span>;
    case "Product":
      return <span className={cn(base, "bg-violet-100 dark:bg-violet-500/15")}><Layers size={15} className="text-violet-600 dark:text-violet-300" /></span>;
    case "Sales":
      return <span className={cn(base, "bg-amber-100 dark:bg-amber-500/15")}><ShoppingBag size={15} className="text-amber-600 dark:text-amber-300" /></span>;
    case "Support":
      return <span className={cn(base, "bg-cyan-100 dark:bg-cyan-500/15")}><HeartHandshake size={15} className="text-cyan-600 dark:text-cyan-300" /></span>;
    default:
      return <span className={cn(base, "bg-primary/10")}><Users size={15} className="text-primary" /></span>;
  }
}

type Props = {
  teams: TeamWithMembers[];
  allUsers: AllUser[];
  onClose: () => void;
};

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked ?? false);
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 transform rounded-full bg-card shadow transition-transform",
            on ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </button>
      <input type="hidden" name={name} value={on ? "on" : "off"} />
      <span className="text-sm text-muted-foreground">{label}</span>
    </label>
  );
}

// ── Team Lead search picker ───────────────────────────────────────────────────

function LeadPicker({ allUsers, initialId }: { allUsers: AllUser[]; initialId?: string }) {
  const [selectedId, setSelectedId] = useState(initialId ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedUser = allUsers.find((u) => u.id === selectedId);
  const filtered = allUsers.filter(
    (u) =>
      u.id !== selectedId &&
      (!query ||
        u.name?.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        {selectedUser ? (
          <div className="flex flex-1 items-center justify-between">
            <span className="text-sm">{selectedUser.name ?? selectedUser.email}</span>
            <button
              type="button"
              onClick={() => setSelectedId("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <input
            type="text"
            placeholder="Search for a Leader..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
        )}
      </div>

      {open && !selectedUser && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border bg-card shadow-lg">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => { setSelectedId(u.id); setQuery(""); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {(u.name ?? u.email).slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-medium">{u.name ?? u.email}</p>
                <p className="text-xs text-muted-foreground">{u.title ?? u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <input type="hidden" name="leadId" value={selectedId} />
    </div>
  );
}

// ── Member multi-picker ───────────────────────────────────────────────────────

function MemberPicker({
  allUsers,
  initialIds = [],
  onNameSaved,
}: {
  allUsers: AllUser[];
  initialIds?: string[];
  onNameSaved: (userId: string, name: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const cancelingRef = useRef(false);

  async function saveName(userId: string) {
    if (cancelingRef.current) { cancelingRef.current = false; return; }
    const trimmed = editValue.trim();
    if (!trimmed) {
      setNameError("Name Cannot Be Empty");
      return;
    }
    setSavingId(userId);
    setNameError(null);
    const result = await updateMemberName(userId, trimmed);
    setSavingId(null);
    if (result.ok) {
      onNameSaved(userId, trimmed);
      setEditingId(null);
    } else {
      setNameError(result.message ?? "Failed to Save Name");
    }
  }

  const filtered = allUsers.filter(
    (u) =>
      !selected.includes(u.id) &&
      (u.name?.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase()))
  );
  const selectedUsers = allUsers.filter((u) => selected.includes(u.id));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex min-h-11 flex-wrap gap-1.5 rounded-lg border bg-background p-2.5">
        {selectedUsers.map((u) => (
          <span
            key={u.id}
            className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {(u.name ?? u.email).slice(0, 2).toUpperCase()}
            </span>

            {editingId === u.id ? (
              <input
                autoFocus
                value={editValue}
                disabled={savingId === u.id}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveName(u.id); }
                  if (e.key === "Escape") { e.preventDefault(); cancelingRef.current = true; setEditingId(null); setNameError(null); }
                }}
                onBlur={() => saveName(u.id)}
                className="w-20 bg-transparent text-xs outline-none"
              />
            ) : (
              <>
                {u.name ?? u.email.split("@")[0]}
                <button
                  type="button"
                  onClick={() => { setEditingId(u.id); setEditValue(u.name ?? ""); setNameError(null); }}
                  className="text-muted-foreground hover:text-primary"
                  title="Edit Display Name"
                >
                  <Pencil size={10} />
                </button>
              </>
            )}

            {editingId === u.id && savingId === u.id && (
              <Check size={10} className="animate-pulse text-muted-foreground" />
            )}

            <button
              type="button"
              onClick={() => setSelected((s) => s.filter((id) => id !== u.id))}
              className="ml-0.5 text-muted-foreground hover:text-foreground"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          placeholder={selected.length === 0 ? "Search Users..." : ""}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
        />
      </div>

      {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}

      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border bg-card shadow-lg">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => { setSelected((s) => [...s, u.id]); setQuery(""); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {(u.name ?? u.email).slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-medium">{u.name ?? u.email}</p>
                <p className="text-xs text-muted-foreground">{u.title ?? u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected.map((id) => (
        <input key={id} type="hidden" name="memberIds" value={id} />
      ))}
    </div>
  );
}

// ── Team form (fields + pinned footer) ───────────────────────────────────────

function TeamForm({
  allUsers,
  team,
  onSuccess,
}: {
  allUsers: AllUser[];
  team?: TeamWithMembers;
  onSuccess: () => void;
}) {
  const isEdit = !!team;
  const [createState, createAction, createPending] = useActionState<CreateTeamState, FormData>(createTeam, {});
  const [updateState, updateAction, updatePending] = useActionState<UpdateTeamState, FormData>(updateTeam, {});

  const state = isEdit ? updateState : createState;
  const action = isEdit ? updateAction : createAction;
  const pending = isEdit ? updatePending : createPending;

  // Local overrides so an edited display name shows immediately in both
  // pickers without waiting for the page to revalidate/reload.
  const [users, setUsers] = useState(allUsers);
  const [prevAllUsers, setPrevAllUsers] = useState(allUsers);
  if (allUsers !== prevAllUsers) {
    setUsers(allUsers);
    setPrevAllUsers(allUsers);
  }
  function handleNameSaved(userId: string, name: string) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, name } : u)));
  }

  useEffect(() => {
    if (state.message === "created" || state.message === "updated") {
      onSuccess();
    }
  }, [state.message, onSuccess]);

  return (
    <form action={action} className="flex h-full flex-col">
      {isEdit && <input type="hidden" name="teamId" value={team.id} />}

      {/* Scrollable field area */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Team Name</label>
            <input
              name="name"
              defaultValue={team?.name}
              placeholder="e.g. Product Ops"
              required
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Department</label>
            <div className="relative">
              <select
                name="department"
                defaultValue={team?.department ?? ""}
                className="w-full appearance-none rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="">Select Department...</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Team Lead</label>
          <LeadPicker allUsers={users} initialId={team?.leadId ?? undefined} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Add Members</label>
          <MemberPicker
            allUsers={users}
            initialIds={team?.members.map((m) => m.userId) ?? []}
            onNameSaved={handleNameSaved}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Team Description</label>
          <textarea
            name="description"
            defaultValue={team?.description ?? ""}
            placeholder="What Will This Team Focus On?"
            rows={4}
            className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <Toggle name="requireApproval" label="Require Approval" defaultChecked={team?.requireApproval ?? false} />
          <Toggle name="notifyMembers" label="Notify Members" defaultChecked={team?.notifyMembers ?? true} />
          <Toggle name="allowEdits" label="Allow Edits" defaultChecked={team?.allowEdits ?? false} />
        </div>

        {state.message && state.message !== "created" && state.message !== "updated" && (
          <p className="text-xs text-destructive">{state.message}</p>
        )}
      </div>

      {/* Pinned footer */}
      <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
        <button
          type="button"
          onClick={onSuccess}
          className="rounded-lg border px-6 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending && <Loader2 size={14} className="animate-spin" />}
          {pending
            ? isEdit ? "Saving…" : "Creating…"
            : isEdit ? "Save Team" : "Create Team 🚀"}
        </button>
      </div>
    </form>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

export function NewTeamModal({ teams, allUsers, onClose }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null);
  const [teamSearch, setTeamSearch] = useState("");

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(teamSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-background shadow-2xl">

        {/* Left — existing teams */}
        <div className="flex w-72 shrink-0 flex-col border-r">
          <div className="p-6 pb-4">
            <h2 className="text-xl font-bold">Existing Teams</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage and View Your Current Organizational Structures.
            </p>
          </div>

          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5">
              <Search size={14} className="shrink-0 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter Teams..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTeam(t)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors hover:bg-accent",
                  selectedTeam?.id === t.id && "border-primary bg-primary/5"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <DeptIcon department={t.department} />
                    <p className="text-sm font-semibold leading-snug">{t.name}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {t.members.length} Members
                  </span>
                </div>

                {t.lead && (
                  <p className="mt-1.5 flex items-center gap-1 pl-11 text-xs text-muted-foreground">
                    <Users size={10} />
                    {t.lead.name ?? t.lead.email}
                  </p>
                )}

                {t.members.length > 0 && (
                  <div className="mt-2 flex pl-11">
                    {t.members.slice(0, 3).map((m) => (
                      <span
                        key={m.id}
                        title={m.user.name ?? m.user.email}
                        className="-ml-1.5 first:ml-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary/20 text-xs font-bold text-primary"
                      >
                        {(m.user.name ?? m.user.email).slice(0, 2).toUpperCase()}
                      </span>
                    ))}
                    {t.members.length > 3 && (
                      <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground">
                        +{t.members.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setSelectedTeam(null)}
              className={cn(
                "w-full rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
                !selectedTeam && "border-primary/40 text-primary"
              )}
            >
              + New Team
            </button>
          </div>
        </div>

        {/* Right — create / edit form */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b p-6 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {selectedTeam ? `Edit: ${selectedTeam.name}` : "Create Team"}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {selectedTeam
                    ? "Update Team Parameters and Members."
                    : "Define Your Team Parameters and Invite Initial Members."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <TeamForm
              key={selectedTeam?.id ?? "new"}
              allUsers={allUsers}
              team={selectedTeam ?? undefined}
              onSuccess={onClose}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
