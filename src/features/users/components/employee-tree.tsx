"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, ChevronRight } from "lucide-react";
import type { EmployeeTreeNode } from "@/features/users/actions/user-actions";

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

/** Flatten all managers/leads that have direct reports */
function getAllManagers(nodes: EmployeeTreeNode[]): EmployeeTreeNode[] {
  const result: EmployeeTreeNode[] = [];
  const visited = new Set<string>();

  function traverse(list: EmployeeTreeNode[]) {
    for (const node of list) {
      if (!visited.has(node.id)) {
        visited.add(node.id);
        result.push(node);
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return result;
}

interface EmployeeTreeProps {
  nodes: EmployeeTreeNode[];
  onSelectUser: (id: string) => void;
}

export function EmployeeTree({ nodes, onSelectUser }: EmployeeTreeProps) {
  // Collect all managers/nodes in hierarchy that have direct reports (or root nodes)
  const allManagers = useMemo(() => {
    const list = getAllManagers(nodes);
    return list.filter((m) => (m.children && m.children.length > 0) || nodes.some((r) => r.id === m.id));
  }, [nodes]);

  const [activeManagerId, setActiveManagerId] = useState<string | null>(
    allManagers[0]?.id ?? null
  );

  const activeManager =
    allManagers.find((m) => m.id === activeManagerId) ?? allManagers[0] ?? null;

  // Measurement & SVG Connector Layout state
  const containerRef = useRef<HTMLDivElement>(null);
  const activeManagerRef = useRef<HTMLButtonElement>(null);
  const memberRefs = useRef<(HTMLDivElement | null)[]>([]);
  const connectorBoxRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState<{
    yParent: number;
    yMembers: number[];
    spineMinY: number;
    spineMaxY: number;
  } | null>(null);

  const updateConnectorLayout = useCallback(() => {
    if (!containerRef.current || !activeManagerRef.current || !connectorBoxRef.current) return;

    const connectorRect = connectorBoxRef.current.getBoundingClientRect();
    const activeRect = activeManagerRef.current.getBoundingClientRect();

    const yParent = activeRect.top - connectorRect.top + activeRect.height / 2;

    const yMembers: number[] = [];
    memberRefs.current.forEach((el) => {
      if (el) {
        const r = el.getBoundingClientRect();
        yMembers.push(r.top - connectorRect.top + r.height / 2);
      }
    });

    if (yMembers.length === 0) {
      setLayout({ yParent, yMembers: [], spineMinY: yParent, spineMaxY: yParent });
      return;
    }

    const minY = Math.min(yParent, yMembers[0]);
    const maxY = Math.max(yParent, yMembers[yMembers.length - 1]);

    setLayout({
      yParent,
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
  }, [activeManagerId, nodes, updateConnectorLayout]);

  if (nodes.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-xs">
        <Users size={32} className="mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-semibold text-foreground">No reporting hierarchy set up yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Assign reporting managers to employees in team management to build the organization tree.
        </p>
      </div>
    );
  }

  const directReports = activeManager?.children ?? [];

  return (
    <div ref={containerRef} className="relative flex items-start gap-0 min-h-[600px] p-2 overflow-x-auto">
      {/* ── Left Sidebar Panel: MANAGERS & LEADS ───────────────────────────── */}
      <div className="w-72 shrink-0 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-card p-4 space-y-3 shadow-xs">
        <h3 className="text-xs font-extrabold tracking-wider text-slate-500 dark:text-slate-400 uppercase px-1">
          MANAGERS & LEADS
        </h3>

        <div className="space-y-2">
          {allManagers.map((manager) => {
            const isActive = manager.id === activeManager?.id;
            const avatarUrl = getAvatarUrl(manager.image, manager.id, manager.name);
            const reportCount = manager.children?.length ?? 0;

            return (
              <button
                key={manager.id}
                ref={isActive ? activeManagerRef : null}
                type="button"
                onClick={() => setActiveManagerId(manager.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 group relative",
                  isActive
                    ? "border-2 border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 shadow-xs"
                    : "border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 bg-card"
                )}
              >
                {/* Manager Avatar */}
                <Avatar className="h-9 w-9 shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <AvatarImage src={avatarUrl} alt={manager.name} className="object-cover" />
                  <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs">
                    {getInitials(manager.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Name & Title */}
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-sm font-bold truncate leading-tight",
                      isActive ? "text-blue-900 dark:text-blue-200" : "text-slate-900 dark:text-slate-100"
                    )}
                  >
                    {manager.name}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                    {manager.title || (manager.role === "MANAGER" ? "Manager" : "Team Member")}
                  </span>
                </div>

                {/* Count Pill Badge */}
                {reportCount > 0 && (
                  <span
                    className={cn(
                      "flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold shadow-2xs shrink-0",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    {reportCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Connector Gap with Pixel-Perfect SVG Lines ────────────────────── */}
      <div ref={connectorBoxRef} className="relative w-14 shrink-0 self-stretch min-h-[500px]">
        {layout && directReports.length > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            {/* Horizontal Line coming out directly from active Manager Card */}
            <line
              x1="0"
              y1={layout.yParent}
              x2="28"
              y2={layout.yParent}
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

      {/* ── Right Panel: Direct Reports List ──────────────────────────────── */}
      {activeManager && (
        <div className="flex flex-col gap-3.5 py-1 flex-1 min-w-0">
          {directReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground text-sm my-auto w-64">
              No direct reports for {activeManager.name}.
            </div>
          ) : (
            directReports.map((member, idx) => {
              const hasSubTeam = member.children && member.children.length > 0;

              return (
                <div
                  key={member.id}
                  ref={(el) => {
                    memberRefs.current[idx] = el;
                  }}
                  className="flex items-center gap-2"
                >
                  <EmployeeMemberCard
                    member={member}
                    onSelectUser={onSelectUser}
                  />

                  {hasSubTeam && (
                    <button
                      type="button"
                      onClick={() => setActiveManagerId(member.id)}
                      title={`View ${member.name}'s team`}
                      className="flex items-center gap-1 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/40 px-2.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shrink-0 shadow-2xs"
                    >
                      Team ({member.children.length})
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const EmployeeMemberCard = React.forwardRef<
  HTMLDivElement,
  { member: EmployeeTreeNode; onSelectUser: (id: string) => void }
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
          {getInitials(member.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-tight tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {member.name}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {member.title || (member.role === "MANAGER" ? "Manager" : "Team Member")}
        </span>
      </div>
    </div>
  );
});

EmployeeMemberCard.displayName = "EmployeeMemberCard";
