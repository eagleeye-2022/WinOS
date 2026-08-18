"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ZoomIn, ZoomOut, RotateCcw, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EmployeeTreeNode } from "@/features/users/actions/user-actions";

// Palette of colors for badges & connecting lines, cycling per depth level
// so each generation of the org chart reads as a distinct branch.
const COLOR_THEMES = [
  { bg: "bg-teal-500 hover:bg-teal-600", hex: "#14b8a6" },
  { bg: "bg-emerald-500 hover:bg-emerald-600", hex: "#10b981" },
  { bg: "bg-blue-500 hover:bg-blue-600", hex: "#3b82f6" },
  { bg: "bg-purple-500 hover:bg-purple-600", hex: "#a855f7" },
  { bg: "bg-amber-500 hover:bg-amber-600", hex: "#f59e0b" },
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

function getAvatarUrl(image?: string | null, _id?: string, _name?: string) {
  if (image && image.trim()) return image;
  return "/default-avatar.png";
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
  colorTheme = COLOR_THEMES[0],
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
          "w-60 cursor-pointer rounded-2xl border p-3 transition-all duration-200 flex items-center gap-3 bg-card shadow-xs hover:shadow-md",
          highlighted
            ? "border-2 border-teal-500 bg-teal-50/20 dark:bg-teal-950/30 shadow-md ring-4 ring-teal-500/10"
            : "border-slate-200/90 dark:border-slate-800 hover:border-teal-400/70 dark:hover:border-teal-500/70",
          matchesSearch && "ring-4 ring-amber-400/50 border-amber-500 bg-amber-50/30"
        )}
      >
        <Avatar className="h-10 w-10 shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <AvatarImage src={avatarUrl} alt={node.name} className="object-cover" />
          <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs">
            <img src="/default-avatar.png" alt="Default Avatar" className="h-full w-full object-cover" />
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col min-w-0 flex-1">
          <span
            className={cn(
              "text-sm font-bold truncate leading-tight tracking-tight",
              highlighted ? "text-teal-900 dark:text-teal-100" : "text-slate-900 dark:text-slate-100"
            )}
          >
            {node.name}
          </span>
          <span
            className={cn(
              "text-xs truncate font-medium mt-0.5",
              highlighted ? "text-teal-600 dark:text-teal-400" : "text-slate-500 dark:text-slate-400"
            )}
          >
            {node.title || (node.role === "MANAGER" ? "Manager" : "Team Member")}
          </span>
        </div>
      </div>

      {/* Child Count Badge — sits on the connecting edge, click to expand/collapse */}
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

    setLayout({ yParent, yChildren, spineMinY: minY, spineMaxY: maxY });
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
          <div className="flex flex-col gap-3 py-1">
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

  return (
    <div className="rounded-2xl border bg-card/60 backdrop-blur-xs p-6 space-y-6 shadow-xs">
      {/* Top Header Bar with Zoom controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* <div className="flex items-center gap-3">
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
        </div> */}

        <div className="flex items-center gap-2 ml-auto">
          {/* <Button
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

          <div className="h-4 w-px bg-border mx-1" /> */}

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

      {/* Main Employee Tree Canvas — root(s) on the left, branches flowing right */}
      <div className="overflow-x-auto overflow-y-visible pb-8 pt-2 min-h-[500px]">
        <div
          className="transition-transform duration-200 origin-top-left flex flex-col items-start gap-8 min-w-max p-4"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          {nodes.map((root) => (
            <TreeNodeBranch
              key={root.id}
              node={root}
              depth={0}
              selectedId={selectedId}
              expandedIds={expandedIds}
              searchQuery={searchQuery}
              onSelectUser={handleSelect}
              onToggleExpand={handleToggleExpand}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
