"use client";

import React, { useState, useRef } from "react";
import {
  History,
  CalendarCheck,
  UserPlus,
  Pencil,
  Repeat,
  Calendar,
  Clock,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";

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
}: TaskAuditHistoryPopoverProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
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

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        {open && (
          <PopoverPrimitive.Portal>
            <div
              className="fixed inset-0 z-[90] bg-black/25 dark:bg-black/55 backdrop-blur-sm transition-all duration-200 pointer-events-none animate-in fade-in-0"
              aria-hidden="true"
            />
          </PopoverPrimitive.Portal>
        )}

        <PopoverTrigger asChild>
          <button
            type="button"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none cursor-help shrink-0"
            aria-label="View task audit history"
          >
            <Info size={13} />
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="z-[100] border border-border bg-popover text-popover-foreground p-4 text-left shadow-2xl backdrop-blur-md w-fit max-w-[calc(100vw-2rem)] overflow-x-auto rounded-2xl outline-none"
        >
          {/* Header */}
          <div className="mb-3.5 flex items-center gap-2.5 border-b border-border/60 pb-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
              <History size={16} />
            </div>
            <span className="text-sm font-bold text-popover-foreground tracking-tight">Audit & History</span>
          </div>

          {/* Cards Flex Row */}
          <div className="flex flex-row items-stretch gap-3">
            {/* Card 1: Created By (Success Theme) */}
            <div className="flex flex-col justify-between w-[175px] shrink-0 rounded-2xl border border-success/30 bg-success/10 p-3.5 dark:bg-success/15 dark:border-success/40">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-success">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-success/20">
                    <CalendarCheck size={12} />
                  </div>
                  <span>Created By</span>
                </div>
                <div className="my-3 flex items-center gap-2.5">
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-success/20 text-xs font-bold text-success ring-1 ring-success/30">
                    {creatorAvatar ? (
                      <img src={creatorAvatar} alt={creatorName} className="h-full w-full object-cover" />
                    ) : (
                      initialsOf(creatorName)
                    )}
                  </div>
                  <span className="truncate text-xs font-bold text-foreground" title={creatorName}>
                    {creatorName}
                  </span>
                </div>
              </div>
              <div className="space-y-1 pt-2 text-[11px] text-muted-foreground border-t border-success/20">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="shrink-0 text-success/80" />
                  <span>{createdDateStr}</span>
                </div>
                {createdTimeStr && (
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="shrink-0 text-success/80" />
                    <span>{createdTimeStr}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 2: Added By (Manager) (Primary Theme) */}
            {showAddedByCard && (
              <div className="flex flex-col justify-between w-[175px] shrink-0 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 dark:bg-primary/15 dark:border-primary/40">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/20">
                      <UserPlus size={12} />
                    </div>
                    <span>Added By (Manager)</span>
                  </div>
                  <div className="my-3 flex items-center gap-2.5">
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/20 text-xs font-bold text-primary ring-1 ring-primary/30">
                      {addedByAvatar ? (
                        <img src={addedByAvatar} alt={addedByName} className="h-full w-full object-cover" />
                      ) : (
                        initialsOf(addedByName)
                      )}
                    </div>
                    <span className="truncate text-xs font-bold text-foreground" title={addedByName}>
                      {addedByName}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 pt-2 text-[11px] text-muted-foreground border-t border-primary/20">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="shrink-0 text-primary/80" />
                    <span>{addedDateStr}</span>
                  </div>
                  {addedTimeStr && (
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="shrink-0 text-primary/80" />
                      <span>{addedTimeStr}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Card 3: Last Edited By (Warning Theme) */}
            {showEditedByCard && (
              <div className="flex flex-col justify-between w-[175px] shrink-0 rounded-2xl border border-warning/30 bg-warning/10 p-3.5 dark:bg-warning/15 dark:border-warning/40">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-warning">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-warning/20">
                      <Pencil size={12} />
                    </div>
                    <span>Last Edited By</span>
                  </div>
                  <div className="my-3 flex items-center gap-2.5">
                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-warning/20 text-xs font-bold text-warning ring-1 ring-warning/30">
                      {editedByAvatar ? (
                        <img src={editedByAvatar} alt={editedByName} className="h-full w-full object-cover" />
                      ) : (
                        initialsOf(editedByName)
                      )}
                    </div>
                    <span className="truncate text-xs font-bold text-foreground" title={editedByName}>
                      {editedByName}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 pt-2 text-[11px] text-muted-foreground border-t border-warning/20">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="shrink-0 text-warning/80" />
                    <span>{editedDateStr}</span>
                  </div>
                  {editedTimeStr && (
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="shrink-0 text-warning/80" />
                      <span>{editedTimeStr}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Card 4: Carried Over (Indigo/Purple Theme) */}
            {showCarriedOverCard && (
              <div className="flex flex-col justify-between w-[185px] shrink-0 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 dark:bg-indigo-500/15 dark:border-indigo-500/40 text-indigo-600 dark:text-indigo-400">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-500/20">
                    <Repeat size={12} />
                  </div>
                  <span>Carried Over</span>
                </div>

                <div className="my-2 space-y-1">
                  <span className="block text-[11px] font-medium text-muted-foreground">Originally created on</span>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                    <Calendar size={12} className="shrink-0 text-indigo-600/80 dark:text-indigo-400/80" />
                    <span>{origCreatedDateStr}</span>
                  </div>
                  {origCreatedTimeStr && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock size={12} className="shrink-0 text-indigo-600/80 dark:text-indigo-400/80" />
                      <span>{origCreatedTimeStr}</span>
                    </div>
                  )}
                </div>

                <div className="my-1 border-t border-dashed border-indigo-500/30" />

                <div className="space-y-1">
                  <span className="block text-[11px] font-medium text-muted-foreground">Carried over to</span>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                    <Calendar size={12} className="shrink-0 text-indigo-600/80 dark:text-indigo-400/80" />
                    <span>{carryToDateStr}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}
