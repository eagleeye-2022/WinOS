"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ZoomIn, ZoomOut, RotateCcw, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EmployeeTreeNode } from "@/features/users/actions/user-actions";

// Palette of colors for badges & connecting lines matching the reference design
const COLOR_THEMES = [
  {
    bg: "bg-pink-500 hover:bg-pink-600",
    text: "text-pink-500",
    line: "bg-pink-400 dark:bg-pink-500",
    border: "border-pink-400 dark:border-pink-500",
    hex: "#ec4899",
  },
  {
    bg: "bg-blue-500 hover:bg-blue-600",
    text: "text-blue-500",
    line: "bg-blue-400 dark:bg-blue-500",
    border: "border-blue-400 dark:border-blue-500",
    hex: "#3b82f6",
  },
  {
    bg: "bg-emerald-500 hover:bg-emerald-600",
    text: "text-emerald-500",
    line: "bg-emerald-400 dark:bg-emerald-500",
    border: "border-emerald-400 dark:border-emerald-500",
    hex: "#10b981",
  },
  {
    bg: "bg-purple-500 hover:bg-purple-600",
    text: "text-purple-500",
    line: "bg-purple-400 dark:bg-purple-500",
    border: "border-purple-400 dark:border-purple-500",
    hex: "#a855f7",
  },
  {
    bg: "bg-amber-500 hover:bg-amber-600",
    text: "text-amber-500",
    line: "bg-amber-400 dark:bg-amber-500",
    border: "border-amber-400 dark:border-amber-500",
    hex: "#f59e0b",
  },
];

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

function getAvatarUrl(image?: string | null, id?: string, name?: string) {
  if (image && image.trim()) return image;
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(id || name || "user")}`;
}

function getAllParentIds(nodes: EmployeeTreeNode[]): string[] {
  const ids: string[] = [];
  function traverse(list: EmployeeTreeNode[]) {
    for (const node of list) {
      if (node.children && node.children.length > 0) {
        ids.push(node.id);
        traverse(node.children);
      }
    }
  }
  traverse(nodes);
  return ids;
}

function countTotalEmployees(nodes: EmployeeTreeNode[]): number {
  let count = 0;
  function traverse(list: EmployeeTreeNode[]) {
    for (const node of list) {
      count++;
      if (node.children) traverse(node.children);
    }
  }
  traverse(nodes);
  return count;
}

interface EmployeeCardProps {
  node: EmployeeTreeNode;
  isSelected?: boolean;
  isRoot?: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
  childCount?: number;
  colorTheme?: (typeof COLOR_THEMES)[0];
  searchQuery?: string;
  onSelect: (id: string) => void;
  onToggleExpand?: (e: React.MouseEvent) => void;
}

function EmployeeCard({
  node,
  isSelected,
  isRoot,
  hasChildren,
  isExpanded,
  childCount,
  colorTheme = COLOR_THEMES[1],
  searchQuery = "",
  onSelect,
  onToggleExpand,
}: EmployeeCardProps) {
  const avatarUrl = getAvatarUrl(node.image, node.id, node.name);
  const highlighted = isSelected || isRoot || (hasChildren && isExpanded);
  const matchesSearch =
    searchQuery.trim().length > 0 &&
    (node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (node.title && node.title.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <div className="relative group shrink-0 py-1">
      <div
        onClick={() => onSelect(node.id)}
        className={cn(
          "w-64 cursor-pointer rounded-2xl border p-3.5 transition-all duration-200 flex items-center gap-3.5 bg-card shadow-xs hover:shadow-md",
          highlighted
            ? "border-2 border-blue-500 bg-blue-50/20 dark:bg-blue-950/30 shadow-md ring-4 ring-blue-500/10"
            : "border-slate-200/90 dark:border-slate-800 hover:border-blue-400/70 dark:hover:border-blue-500/70",
          matchesSearch && "ring-4 ring-amber-400/50 border-amber-500 bg-amber-50/30"
        )}
      >
        <Avatar className="h-11 w-11 shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <AvatarImage src={avatarUrl} alt={node.name} className="object-cover" />
          <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs">
            {getInitials(node.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col min-w-0 flex-1">
          <span
            className={cn(
              "text-sm font-bold truncate leading-tight tracking-tight",
              highlighted ? "text-blue-900 dark:text-blue-100" : "text-slate-900 dark:text-slate-100"
            )}
          >
            {node.name}
          </span>
          <span
            className={cn(
              "text-xs truncate font-medium mt-0.5",
              highlighted ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
            )}
          >
            {node.title || (node.role === "MANAGER" ? "Super Admin" : "Team Member")}
          </span>
        </div>
      </div>

      {/* Child Count Badge (Pink, Blue, Green, etc.) matching reference image */}
      {hasChildren && childCount && childCount > 0 && (
        <button
          type="button"
          onClick={onToggleExpand}
          title={isExpanded ? "Collapse team branch" : "Expand team branch"}
          className={cn(
            "absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold text-white shadow-md transition-all duration-200 hover:scale-115 active:scale-95 ring-2 ring-background",
            colorTheme.bg
          )}
        >
          {childCount}
        </button>
      )}
    </div>
  );
}

function TreeNodeBranch({
  node,
  depth = 0,
  selectedId,
  expandedIds,
  searchQuery,
  onSelectUser,
  onToggleExpand,
}: {
  node: EmployeeTreeNode;
  depth?: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  searchQuery: string;
  onSelectUser: (id: string) => void;
  onToggleExpand: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const colorTheme = COLOR_THEMES[depth % COLOR_THEMES.length];

  const parentCardRef = useRef<HTMLDivElement>(null);
  const connectorBoxRef = useRef<HTMLDivElement>(null);
  const childCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [layout, setLayout] = useState<{
    yParent: number;
    yChildren: number[];
    spineMinY: number;
    spineMaxY: number;
  } | null>(null);

  const updateLayout = useCallback(() => {
    if (!parentCardRef.current || !connectorBoxRef.current) return;

    const connectorRect = connectorBoxRef.current.getBoundingClientRect();
    const parentRect = parentCardRef.current.getBoundingClientRect();

    const yParent = parentRect.top - connectorRect.top + parentRect.height / 2;

    const yChildren: number[] = [];
    childCardRefs.current.forEach((el) => {
      if (el) {
        const r = el.getBoundingClientRect();
        yChildren.push(r.top - connectorRect.top + r.height / 2);
      }
    });

    if (yChildren.length === 0) {
      setLayout({ yParent, yChildren: [], spineMinY: yParent, spineMaxY: yParent });
      return;
    }

    const minY = Math.min(yParent, yChildren[0]);
    const maxY = Math.max(yParent, yChildren[yChildren.length - 1]);

    setLayout({
      yParent,
      yChildren,
      spineMinY: minY,
      spineMaxY: maxY,
    });
  }, []);

  useEffect(() => {
    if (hasChildren && isExpanded) {
      updateLayout();
      const timer = setTimeout(updateLayout, 50);
      window.addEventListener("resize", updateLayout);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", updateLayout);
      };
    }
  }, [hasChildren, isExpanded, node.children, updateLayout]);

  return (
    <div className="flex items-center gap-0">
      {/* Node Card */}
      <div ref={parentCardRef} className="relative">
        <EmployeeCard
          node={node}
          isSelected={selectedId === node.id}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          childCount={node.children.length}
          colorTheme={colorTheme}
          searchQuery={searchQuery}
          onSelect={onSelectUser}
          onToggleExpand={(e) => {
            e.stopPropagation();
            onToggleExpand(node.id);
          }}
        />
      </div>

      {/* Dynamic SVG Connector lines and Children column */}
      {hasChildren && isExpanded && (
        <div className="flex items-stretch">
          {/* Connector SVG Block */}
          <div ref={connectorBoxRef} className="relative w-14 shrink-0 min-h-[64px]">
            {layout && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                {/* Horizontal line from parent badge to center spine */}
                <line
                  x1="0"
                  y1={layout.yParent}
                  x2="28"
                  y2={layout.yParent}
                  stroke={colorTheme.hex}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Vertical spine line connecting first child to last child */}
                {layout.yChildren.length > 0 && (
                  <line
                    x1="28"
                    y1={layout.spineMinY}
                    x2="28"
                    y2={layout.spineMaxY}
                    stroke={colorTheme.hex}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                )}

                {/* Horizontal branch lines to each child card */}
                {layout.yChildren.map((y, idx) => (
                  <line
                    key={idx}
                    x1="28"
                    y1={y}
                    x2="56"
                    y2={y}
                    stroke={colorTheme.hex}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                ))}
              </svg>
            )}
          </div>

          {/* Children Cards Column */}
          <div className="flex flex-col gap-3.5 py-1">
            {node.children.map((child, idx) => (
              <div
                key={child.id}
                ref={(el) => {
                  childCardRefs.current[idx] = el;
                }}
              >
                <TreeNodeBranch
                  node={child}
                  depth={depth + 1}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  searchQuery={searchQuery}
                  onSelectUser={onSelectUser}
                  onToggleExpand={onToggleExpand}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface EmployeeTreeProps {
  nodes: EmployeeTreeNode[];
  onSelectUser: (id: string) => void;
}

export function EmployeeTree({ nodes, onSelectUser }: EmployeeTreeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);

  const allParentIds = useMemo(() => getAllParentIds(nodes), [nodes]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(allParentIds));

  const totalCount = useMemo(() => countTotalEmployees(nodes), [nodes]);

  function handleSelect(id: string) {
    setSelectedId(id);
    onSelectUser(id);
  }

  function handleToggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleExpandAll() {
    setExpandedIds(new Set(allParentIds));
  }

  function handleCollapseAll() {
    setExpandedIds(new Set());
  }

  if (nodes.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground shadow-xs">
        <Users size={32} className="mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-semibold text-foreground">No reporting hierarchy set up yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Assign reporting managers to employees in team management to build the org tree.</p>
      </div>
    );
  }

  const rootNodes = nodes;

  return (
    <div className="rounded-2xl border bg-card/60 backdrop-blur-xs p-6 space-y-6 shadow-xs">
      {/* Top Header Bar with Search & Zoom controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              type="text"
              placeholder="Search member or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-background"
            />
          </div>
          <span className="text-xs text-muted-foreground font-medium px-2 py-1 bg-accent/50 rounded-lg">
            {totalCount} Total Members
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExpandAll}
            className="h-8 text-xs rounded-lg"
          >
            Expand All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCollapseAll}
            className="h-8 text-xs rounded-lg"
          >
            Collapse All
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
            title="Zoom Out"
            className="h-8 w-8 rounded-lg"
          >
            <ZoomOut size={15} />
          </Button>
          <span className="text-xs font-mono font-medium text-muted-foreground w-10 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
            title="Zoom In"
            className="h-8 w-8 rounded-lg"
          >
            <ZoomIn size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setZoomLevel(1)}
            title="Reset Zoom"
            className="h-8 w-8 rounded-lg"
          >
            <RotateCcw size={15} />
          </Button>
        </div>
      </div>

      {/* Main Employee Tree Canvas */}
      <div className="overflow-x-auto overflow-y-visible pb-8 pt-2 min-h-[500px]">
        <div
          className="transition-transform duration-200 origin-top-left flex flex-col items-start gap-8 min-w-max p-4"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {rootNodes.map((root) => {
            const hasRootChildren = root.children && root.children.length > 0;
            const isRootExpanded = expandedIds.has(root.id);

            return (
              <div key={root.id} className="flex flex-col items-start">
                {/* Root Manager Card Header */}
                <div className="flex flex-col items-start">
                  <EmployeeCard
                    node={root}
                    isSelected={selectedId === root.id}
                    isRoot
                    hasChildren={hasRootChildren}
                    isExpanded={isRootExpanded}
                    childCount={root.children.length}
                    colorTheme={COLOR_THEMES[1]}
                    searchQuery={searchQuery}
                    onSelect={handleSelect}
                    onToggleExpand={(e) => {
                      e.stopPropagation();
                      handleToggleExpand(root.id);
                    }}
                  />

                  {/* Vertical Line going down from Root card to Level 1 team members */}
                  {hasRootChildren && isRootExpanded && (
                    <div className="w-0.5 h-7 bg-blue-500 ml-32 relative">
                      <div className="absolute bottom-0 left-0 w-8 h-0.5 bg-blue-500" />
                    </div>
                  )}
                </div>

                {/* Level 1 Direct Reports & Sub-trees */}
                {hasRootChildren && isRootExpanded && (
                  <div className="flex flex-col gap-3.5 pl-8 border-l-2 border-blue-500 pt-1">
                    {root.children.map((child) => (
                      <TreeNodeBranch
                        key={child.id}
                        node={child}
                        depth={0}
                        selectedId={selectedId}
                        expandedIds={expandedIds}
                        searchQuery={searchQuery}
                        onSelectUser={handleSelect}
                        onToggleExpand={handleToggleExpand}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
