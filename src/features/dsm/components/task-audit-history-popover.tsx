"use client";

import React, { useState } from "react";
import {
  History,
  CalendarCheck,
  UserPlus,
  Pencil,
  Repeat,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export type TaskAuditActor = {
  id?: string;
  name: string | null;
  email: string;
  image?: string | null;
  role?: "TEAM_MEMBER" | "MANAGER";
};

export type TaskCarryLink = {
  date: Date;
  task: {
    id?: string;
    text: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    addedBy?: TaskAuditActor | null;
    editedBy?: TaskAuditActor | null;
    addedAfterReview?: boolean;
  };
};

export type TaskAuditHistoryPopoverProps = {
  task: {
    id?: string;
    text: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    addedBy?: TaskAuditActor | null;
    editedBy?: TaskAuditActor | null;
    addedAfterReview?: boolean;
  };
  chain?: TaskCarryLink[];
  memberUser?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: "TEAM_MEMBER" | "MANAGER";
  } | null;
  className?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function initialsOf(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getUserDisplayName(user?: { name?: string | null; email?: string | null } | null, fallback = "User"): string {
  if (!user) return fallback;
  if (user.name && user.name.trim()) return user.name.trim();
  if (user.email && user.email.includes("@")) return user.email.split("@")[0];
  return fallback;
}

function formatAuditDate(dateInput?: Date | string | null): string {
  if (!dateInput) return "";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

function formatAuditTime(dateInput?: Date | string | null): string {
  if (!dateInput) return "";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return "";
  }
}

export function TaskAuditHistoryPopover({
  task,
  chain = [],
  memberUser,
  className,
  trigger,
  open: propOpen,
  onOpenChange: propOnOpenChange,
}: TaskAuditHistoryPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = propOpen !== undefined;
  const open = isControlled ? propOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    propOnOpenChange?.(v);
  };

  const originTask = chain[0]?.task ?? task;
  const originDate = chain[0]?.date ?? task.createdAt ?? new Date();
  const isCarried = chain.length > 1;
  const isManagerAdded = originTask.addedBy?.role === "MANAGER" || originTask.addedAfterReview;

  // 1. Created By Card (Green / Success Theme)
  const creatorActor = originTask.addedBy ?? null;
  const creatorName = getUserDisplayName(creatorActor ?? memberUser, "Team Member");
  const creatorAvatar = creatorActor?.image ?? memberUser?.image ?? null;
  const createdDateStr = formatAuditDate(originTask.createdAt ?? originDate);
  const createdTimeStr = formatAuditTime(originTask.createdAt ?? originDate);

  // 2. Added By (Manager) Card (Blue / Primary Theme)
  const addedByActor = originTask.addedBy ?? null;
  const showAddedByCard =
    Boolean(addedByActor) &&
    (isManagerAdded || addedByActor?.role === "MANAGER" || originTask.addedAfterReview);
  const addedByName = getUserDisplayName(addedByActor, "Manager");
  const addedByAvatar = addedByActor?.image ?? null;
  const addedDateStr = formatAuditDate(originTask.createdAt ?? task.createdAt);
  const addedTimeStr = formatAuditTime(originTask.createdAt ?? task.createdAt);

  // 3. Last Edited By Card (Amber / Warning Theme)
  const showEditedByCard = Boolean(task.editedBy);
  const editedByName = getUserDisplayName(task.editedBy, "Editor");
  const editedByAvatar = task.editedBy?.image ?? null;
  const editedDateStr = formatAuditDate(task.updatedAt);
  const editedTimeStr = formatAuditTime(task.updatedAt);

  // 4. Carried Over Card (Purple / Indigo Accent Theme)
  const showCarriedOverCard = isCarried;
  const origCreatedDateStr = formatAuditDate(originTask.createdAt ?? originDate);
  const origCreatedTimeStr = formatAuditTime(originTask.createdAt ?? originDate);
  const latestCarryLink = chain[chain.length - 1];
  const carryToDateStr = formatAuditDate(latestCarryLink?.date ?? task.createdAt);

  // Compact rows: icon · label · who · when. A small popover next to the icon — no overlay, no blur.
  const rows: { key: string; icon: React.ReactNode; tone: string; label: string; who?: string; avatar?: string | null; when: string }[] = [
    {
      key: "created",
      icon: <CalendarCheck size={12} />,
      tone: "text-success bg-success/15",
      label: "Created by",
      who: creatorName,
      avatar: creatorAvatar,
      when: [createdDateStr, createdTimeStr].filter(Boolean).join(" · "),
    },
  ];
  if (showAddedByCard) {
    rows.push({
      key: "added",
      icon: <UserPlus size={12} />,
      tone: "text-primary bg-primary/15",
      label: "Added by (Manager)",
      who: addedByName,
      avatar: addedByAvatar,
      when: [addedDateStr, addedTimeStr].filter(Boolean).join(" · "),
    });
  }
  if (showEditedByCard) {
    rows.push({
      key: "edited",
      icon: <Pencil size={12} />,
      tone: "text-warning bg-warning/15",
      label: "Last edited by",
      who: editedByName,
      avatar: editedByAvatar,
      when: [editedDateStr, editedTimeStr].filter(Boolean).join(" · "),
    });
  }
  if (showCarriedOverCard) {
    rows.push({
      key: "carried",
      icon: <Repeat size={12} />,
      tone: "text-indigo-600 bg-indigo-500/15 dark:text-indigo-400",
      label: "Carried over",
      when: `From ${[origCreatedDateStr, origCreatedTimeStr].filter(Boolean).join(" · ")} → ${carryToDateStr}`,
    });
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {trigger ? (
            trigger
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(!open);
              }}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none cursor-pointer shrink-0"
              aria-label="View task audit history"
            >
              <Info size={13} />
            </button>
          )}
        </PopoverTrigger>

        <PopoverContent
          side="left"
          align="center"
          sideOffset={6}
          collisionPadding={12}
          onClick={(e) => e.stopPropagation()}
          className="z-[100] w-64 rounded-lg border bg-popover p-2.5 text-left text-popover-foreground shadow-md outline-none"
        >
          <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-xs font-semibold text-muted-foreground">
            <History size={13} /> Audit &amp; History
          </div>
          <ul className="flex flex-col divide-y divide-border/60">
            {rows.map((row) => (
              <li key={row.key} className="flex items-start gap-2 py-1.5">
                <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded", row.tone)}>
                  {row.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground">{row.label}</p>
                  {row.who && (
                    <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-foreground" title={row.who}>
                      {row.avatar ? (
                        <img src={row.avatar} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold">
                          {initialsOf(row.who)}
                        </span>
                      )}
                      <span className="truncate">{row.who}</span>
                    </p>
                  )}
                  {row.when && <p className="text-[11px] text-muted-foreground">{row.when}</p>}
                </div>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  );
}
