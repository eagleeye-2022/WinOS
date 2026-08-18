"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type {
  DepartmentTreeGroup,
  DepartmentTreeMember,
} from "@/features/users/actions/user-actions";

function getAvatarUrl(image?: string | null, _id?: string, _name?: string) {
  if (image && image.trim()) return image;
  return "/default-avatar.png";
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U"
  );
}

interface DepartmentTreeProps {
  groups: DepartmentTreeGroup[];
  onSelectUser: (id: string) => void;
}

export function DepartmentTree({ groups, onSelectUser }: DepartmentTreeProps) {
  const [activeTeamId, setActiveTeamId] = useState<string | null>(groups[0]?.teamId ?? null);

  const activeGroup = groups.find((g) => g.teamId === activeTeamId) ?? groups[0] ?? null;

  // Measurement & SVG Connector Layout state
  const containerRef = useRef<HTMLDivElement>(null);
  const activeDeptRef = useRef<HTMLButtonElement>(null);
  const memberRefs = useRef<(HTMLDivElement | null)[]>([]);
  const connectorBoxRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState<{
    yDept: number;
    yMembers: number[];
    spineMinY: number;
    spineMaxY: number;
  } | null>(null);

  const updateConnectorLayout = useCallback(() => {
    if (!containerRef.current || !activeDeptRef.current || !connectorBoxRef.current) return;

    const connectorRect = connectorBoxRef.current.getBoundingClientRect();
    const activeRect = activeDeptRef.current.getBoundingClientRect();

    const yDept = activeRect.top - connectorRect.top + activeRect.height / 2;

    const yMembers: number[] = [];
    memberRefs.current.forEach((el) => {
      if (el) {
        const r = el.getBoundingClientRect();
        yMembers.push(r.top - connectorRect.top + r.height / 2);
      }
    });

    if (yMembers.length === 0) {
      setLayout({ yDept, yMembers: [], spineMinY: yDept, spineMaxY: yDept });
      return;
    }

    const minY = Math.min(yDept, yMembers[0]);
    const maxY = Math.max(yDept, yMembers[yMembers.length - 1]);

    setLayout({
      yDept,
      yMembers,
      spineMinY: minY,
      spineMaxY: maxY,
    });
  }, []);

  useEffect(() => {
    updateConnectorLayout();
    const timer = setTimeout(updateConnectorLayout, 50);
    window.addEventListener("resize", updateConnectorLayout);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateConnectorLayout);
    };
  }, [activeTeamId, groups, updateConnectorLayout]);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-xs">
        No departments have been set up yet.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex items-start gap-0 min-h-[600px] p-2 overflow-x-auto">
      {/* ── Left Sidebar Panel: DEPARTMENTS ───────────────────────────────── */}
      <div className="w-72 shrink-0 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 space-y-3 shadow-xs">
        <h3 className="text-xs font-extrabold tracking-wider text-slate-500 dark:text-slate-400 uppercase px-1">
          DEPARTMENTS
        </h3>

        <div className="space-y-2">
          {groups.map((group) => {
            const isActive = group.teamId === activeGroup?.teamId;
            const initial = group.name.charAt(0).toUpperCase();

            return (
              <button
                key={group.teamId}
                ref={isActive ? activeDeptRef : null}
                type="button"
                onClick={() => setActiveTeamId(group.teamId)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 group relative",
                  isActive
                    ? "border-2 border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 shadow-xs"
                    : "border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 bg-card"
                )}
              >
                {/* Initial Box */}
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-extrabold text-sm border shadow-2xs transition-colors",
                    isActive
                      ? "bg-white dark:bg-slate-900 border-blue-400 text-blue-600 dark:text-blue-400"
                      : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                  )}
                >
                  {initial}
                </div>

                {/* Name & Head */}
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-sm font-bold truncate leading-tight",
                      isActive ? "text-blue-900 dark:text-blue-200" : "text-slate-900 dark:text-slate-100"
                    )}
                  >
                    {group.name}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                    {group.headName ? `Head: ${group.headName}` : "-"}
                  </span>
                </div>

                {/* Count Pill Badge */}
                {group.members.length > 0 && (
                  <span
                    className={cn(
                      "flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold shadow-2xs shrink-0",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    {group.members.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Connector Gap with Pixel-Perfect SVG Lines ────────────────────── */}
      <div ref={connectorBoxRef} className="relative w-14 shrink-0 self-stretch min-h-[500px]">
        {layout && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            {/* Horizontal Line coming out directly from active Dept Card */}
            <line
              x1="0"
              y1={layout.yDept}
              x2="28"
              y2={layout.yDept}
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Vertical Spine Line */}
            {layout.yMembers.length > 0 && (
              <line
                x1="28"
                y1={layout.spineMinY}
                x2="28"
                y2={layout.spineMaxY}
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}

            {/* Horizontal Branch Lines to Member Cards */}
            {layout.yMembers.map((y, idx) => (
              <line
                key={idx}
                x1="28"
                y1={y}
                x2="56"
                y2={y}
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ))}
          </svg>
        )}
      </div>

      {/* ── Right Panel: Department Members List ──────────────────────────── */}
      {activeGroup && (
        <div className="flex flex-col gap-3.5 py-1 flex-1 min-w-0">
          {activeGroup.members.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground text-sm my-auto w-64">
              No members in {activeGroup.name} department.
            </div>
          ) : (
            activeGroup.members.map((member, idx) => (
              <DepartmentMemberCard
                key={member.id}
                ref={(el) => {
                  memberRefs.current[idx] = el;
                }}
                member={member}
                onSelectUser={onSelectUser}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

const DepartmentMemberCard = React.forwardRef<
  HTMLDivElement,
  { member: DepartmentTreeMember; onSelectUser: (id: string) => void }
>(({ member, onSelectUser }, ref) => {
  const avatarUrl = getAvatarUrl(member.image, member.id, member.name);

  return (
    <div
      ref={ref}
      onClick={() => onSelectUser(member.id)}
      className="w-64 cursor-pointer rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-3.5 shadow-xs hover:shadow-md hover:border-blue-400/80 dark:hover:border-blue-500/80 transition-all duration-200 flex items-center gap-3.5 group shrink-0"
    >
      <Avatar className="h-11 w-11 shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs">
        <AvatarImage src={avatarUrl} alt={member.name} className="object-cover" />
        <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs">
          <img src="/default-avatar.png" alt="Default Avatar" className="h-full w-full object-cover" />
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-tight tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {member.name}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {member.title || "Team Member"}
        </span>
      </div>
    </div>
  );
});

DepartmentMemberCard.displayName = "DepartmentMemberCard";
