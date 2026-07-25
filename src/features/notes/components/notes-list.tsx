"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoteWithDetails, NotebookData } from "../queries";
import { applyFilter, applySecondaryFilters, type NotesFilter } from "../utils";
import { NoteCard } from "./note-card";

type FilterTab = { id: NotesFilter; label: string };

function buildTabs(isManager: boolean): FilterTab[] {
  const tabs: FilterTab[] = [
    { id: "all", label: "All" },
    { id: "pinned", label: "Pinned" },
    { id: "recent", label: "Recent" },
    { id: "reminders", label: "Reminders" },
  ];
  if (isManager) tabs.push({ id: "mine", label: "Mine" });
  return tabs;
}

type NotesListProps = {
  notes: NoteWithDetails[];
  notebooks: NotebookData[];
  isManager: boolean;
  userId: string;
};

export function NotesList({ notes, notebooks, isManager, userId }: NotesListProps) {
  const [filter, setFilter] = useState<NotesFilter>("all");
  const [notebookId, setNotebookId] = useState<string>("");
  const [tagId, setTagId] = useState<string>("");
  const [search, setSearch] = useState("");

  const tabs = buildTabs(isManager);

  // Collect all unique tags present in the current note set
  const allTags = useMemo(() => {
    const map = new Map<string, string>(); // id → name
    for (const note of notes) {
      for (const nt of note.tags) map.set(nt.tag.id, nt.tag.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [notes]);

  const visible = useMemo(() => {
    const primary = applyFilter(notes, filter, userId);
    return applySecondaryFilters(primary, { notebookId: notebookId || undefined, tagId: tagId || undefined, search });
  }, [notes, filter, userId, notebookId, tagId, search]);

  const tabCounts: Partial<Record<NotesFilter, number>> = {
    pinned: notes.filter((n) => n.isPinned).length,
    reminders: notes.filter((n) => n.reminderAt !== null).length,
    mine: notes.filter((n) => n.authorId === userId).length,
  };

  const clearFilters = () => { setFilter("all"); setNotebookId(""); setTagId(""); setSearch(""); };
  const hasSecondary = notebookId || tagId || search;

  const emptyMessages: Record<NotesFilter, string> = {
    all: "No notes yet. Add your first note using the form.",
    pinned: "No pinned notes. Pin a note using the pin icon.",
    recent: "No notes yet. Add your first note using the form.",
    mine: "You haven't written any notes yet.",
    reminders: "No reminders set. Add a reminder when creating or editing a note.",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes, tags, notebooks…"
          className="w-full rounded-md border bg-background py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Primary filter tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b pb-3">
        {tabs.map((tab) => {
          const count = tabCounts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filter === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className="tabular-nums opacity-70">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Secondary filters: notebook + tag */}
      <div className="flex flex-wrap items-center gap-2">
        {notebooks.length > 0 && (
          <select
            value={notebookId}
            onChange={(e) => setNotebookId(e.target.value)}
            className={cn(
              "rounded-md border bg-background px-2.5 py-1 text-xs outline-none transition-colors focus:border-ring",
              notebookId ? "border-primary text-foreground" : "text-muted-foreground"
            )}
          >
            <option value="">All notebooks</option>
            {notebooks.map((nb) => (
              <option key={nb.id} value={nb.id}>{nb.name}</option>
            ))}
          </select>
        )}

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map(({ id, name }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTagId(tagId === id ? "" : id)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                  tagId === id
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-accent-foreground hover:bg-accent/80"
                )}
              >
                #{name}
              </button>
            ))}
          </div>
        )}

        {hasSecondary && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X size={11} /> Clear
          </button>
        )}
      </div>

      {/* Results count when filtering */}
      {(hasSecondary || search) && (
        <p className="text-xs text-muted-foreground">
          {visible.length} {visible.length === 1 ? "note" : "notes"} found
        </p>
      )}

      {/* Grid or empty state */}
      {visible.length === 0 ? (
        <div className="flex h-36 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          {hasSecondary || search
            ? "No notes match the current filters."
            : emptyMessages[filter]}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((note) => (
            <NoteCard key={note.id} note={note} showAuthor={isManager} />
          ))}
        </div>
      )}
    </div>
  );
}
