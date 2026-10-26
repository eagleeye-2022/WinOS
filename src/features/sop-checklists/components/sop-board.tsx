"use client";

import React, { useState } from "react";
import { Layers, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SopTemplate } from "../types";

const ICON_BTN =
  "cursor-pointer rounded p-1 text-slate-500 transition-colors hover:bg-slate-200/50 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white";

export interface SopBoardProps {
  /** Lists (columns) in display order — every SOP category plus empty lists made on this browser. */
  lists: string[];
  /** SOPs to show (already filtered by search / archived). */
  templates: SopTemplate[];
  canEdit: boolean;
  isLoading: boolean;
  /** Lists that exist only on this browser (no SOP yet) — these can be removed. */
  localLists: string[];
  highlightList: string | null;
  movingId: string | null;
  onOpen: (t: SopTemplate) => void;
  onCreateIn: (list: string) => void;
  onMove: (t: SopTemplate, list: string) => void;
  onCreateList: (name: string) => boolean;
  onRemoveLocalList: (name: string) => void;
}

/** The SOP library as columns (one per category), styled like the WhyFi School board. */
export function SopBoard({
  lists,
  templates,
  canEdit,
  isLoading,
  localLists,
  highlightList,
  movingId,
  onOpen,
  onCreateIn,
  onMove,
  onCreateList,
  onRemoveLocalList,
}: SopBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overList, setOverList] = useState<string | null>(null);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");

  const closeAddList = () => {
    setIsAddingList(false);
    setNewListName("");
  };
  const createList = () => {
    if (onCreateList(newListName)) closeAddList();
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 justify-center p-10">
        <Loader2 size={22} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    // Always-visible horizontal scrollbar (scrollbars are hidden app-wide; see globals.css).
    <div className="dsm-columns-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-4">
      <div className="flex h-full items-stretch gap-4">
        {lists.map((list) => {
          const cards = templates.filter((t) => t.category === list);
          const dragged = dragId ? templates.find((t) => t.id === dragId) : null;
          const canDrop = canEdit && !!dragged && dragged.category !== list;
          return (
            <div
              key={list}
              id={`sop-list-${encodeURIComponent(list)}`}
              onDragOver={(e) => {
                if (!canDrop) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overList !== list) setOverList(list);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverList(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOverList(null);
                if (canDrop && dragged) onMove(dragged, list);
                setDragId(null);
              }}
              className={cn(
                "flex h-full w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100/70 p-3.5 shadow-2xs transition-all duration-200 dark:border-neutral-800 dark:bg-neutral-900/40",
                overList === list && "border-primary/60 ring-2 ring-primary/30",
                highlightList === list && "border-primary ring-2 ring-primary/40"
              )}
            >
              {/* Column header */}
              <div className="mb-3 flex items-center justify-between border-b border-slate-200/60 pb-3 dark:border-neutral-800">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    title={list}
                    className="max-w-[170px] truncate text-xs font-extrabold uppercase tracking-wide text-foreground"
                  >
                    {list}
                  </span>
                  <span className="rounded-full bg-slate-200/80 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {cards.length}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Everyone can add an SOP to a list; moving, archiving and deleting stay manager-only. */}
                  <button type="button" onClick={() => onCreateIn(list)} className={ICON_BTN} title={`New SOP in ${list}`}>
                    <Plus size={14} />
                  </button>
                  {canEdit && cards.length === 0 && localLists.includes(list) && (
                    <button
                      type="button"
                      onClick={() => onRemoveLocalList(list)}
                      className="cursor-pointer rounded p-1 text-slate-500 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Remove this empty list"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Cards */}
              <div className="min-h-[40px] flex-1 space-y-2 overflow-y-auto pr-0.5">
                {cards.map((t) => (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    draggable={canEdit && movingId !== t.id}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", t.id);
                      setDragId(t.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverList(null);
                    }}
                    onClick={() => onOpen(t)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onOpen(t);
                    }}
                    className={cn(
                      "group cursor-pointer rounded-xl border border-slate-200/80 bg-card p-3 text-left shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs dark:border-neutral-800",
                      canEdit && "active:cursor-grabbing",
                      dragId === t.id && "opacity-40",
                      movingId === t.id && "pointer-events-none opacity-60",
                      t.isArchived && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold leading-snug text-foreground">{t.name}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        {movingId === t.id && <Loader2 size={12} className="animate-spin text-primary" />}
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          v{t.version}
                        </span>
                      </div>
                    </div>
                    {t.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{t.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <span>{t.items.length} checkboxes</span>
                      {canEdit && <span>· on {t.attachedCount} task(s)</span>}
                      {t.isArchived && <span className="font-semibold">· Archived</span>}
                      {canEdit && t.outdatedCount > 0 && (
                        <span className="font-semibold text-warning">· {t.outdatedCount} outdated</span>
                      )}
                    </div>
                  </div>
                ))}
                {cards.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-[11px] text-muted-foreground dark:border-neutral-800">
                    {canEdit ? "No SOPs yet — use + or drag one here." : "No SOPs yet — use + to add one."}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Create List column (managers) */}
        {canEdit &&
          (!isAddingList ? (
            <div className="flex h-full w-[300px] shrink-0 flex-col justify-start rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-3.5 shadow-2xs transition-all duration-200 hover:border-primary/50 dark:border-neutral-800 dark:bg-neutral-900/30">
              <button
                type="button"
                onClick={() => setIsAddingList(true)}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0088ff] px-3 py-4 text-xs font-bold text-white shadow-2xs transition-all hover:bg-[#0077ee] hover:shadow-xs"
              >
                <span>Create List</span>
              </button>
            </div>
          ) : (
            <div className="flex h-full w-[300px] shrink-0 flex-col space-y-3 rounded-2xl border border-slate-300 bg-card p-4 shadow-md transition-all duration-200 dark:border-neutral-700 dark:bg-[#16181d]">
              <div className="flex items-center justify-between border-b border-border pb-2.5 dark:border-neutral-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Layers size={14} className="text-[#0088ff]" />
                  <span>Create List</span>
                </div>
                <button
                  type="button"
                  onClick={closeAddList}
                  className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="text-xs">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  List Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newListName}
                  maxLength={60}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Onboarding, Hosting"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newListName.trim()) {
                      e.preventDefault();
                      createList();
                    } else if (e.key === "Escape") {
                      closeAddList();
                    }
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  The list is saved for everyone once its first SOP is created.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border pt-2 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={closeAddList}
                  className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newListName.trim()}
                  onClick={createList}
                  className="cursor-pointer rounded-md bg-[#0088ff] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#0077ee] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create List
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
