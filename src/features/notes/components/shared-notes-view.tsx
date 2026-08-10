"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Share2,
  Users,
  Search,
  ArrowLeft,
  Calendar,
  Sparkles,
  CheckSquare,
  User,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import { NotesTopNav } from "./notes-top-nav";

export type SharedNoteItem = {
  id: string;
  title?: string | null;
  content: string;
  color?: string | null;
  deadline?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  author: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
    role?: string;
  };
  thread?: {
    id: string;
    title: string;
    boardId: string;
    board?: {
      id: string;
      name: string;
      type?: string;
    } | null;
    shares?: Array<{
      user: { id: string; name?: string | null; email: string };
    }>;
  } | null;
  shares?: Array<{
    user?: { id: string; name?: string | null; email: string };
  }>;
  checklistItems?: Array<{
    id: string;
    text: string;
    checked: boolean;
  }>;
};

type Props = {
  title: string;
  description: string;
  notes: SharedNoteItem[];
  type: "with-me" | "by-me";
};

export function SharedNotesView({ title, description, notes, type }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNote, setSelectedNote] = useState<SharedNoteItem | null>(null);

  const filteredNotes = notes.filter((n) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const contentMatch = (n.content || "").toLowerCase().includes(query);
    const titleMatch = (n.thread?.title || "").toLowerCase().includes(query);
    const boardMatch = (n.thread?.board?.name || "").toLowerCase().includes(query);
    const authorMatch = (n.author?.name || n.author?.email || "").toLowerCase().includes(query);

    return contentMatch || titleMatch || boardMatch || authorMatch;
  });

  const formatDate = (d: Date | string) => {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));
  };

  return (
    <div className="flex h-full flex-col bg-background p-6 overflow-y-auto">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col gap-4 border-b pb-5">
        <div className="flex items-center justify-between">
          <NotesTopNav />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/notes"
              className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
              title="Back to Workspace Notes"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                {type === "with-me" ? (
                  <Share2 size={20} className="text-primary" />
                ) : (
                  <Users size={20} className="text-emerald-500" />
                )}
                <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {notes.length} {notes.length === 1 ? "card" : "cards"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shared cards..."
              className="w-full rounded-lg border bg-card pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* ── Card Grid ── */}
      <div className="mt-6 flex-1">
        {filteredNotes.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center bg-card/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              {type === "with-me" ? <Share2 size={20} /> : <Users size={20} />}
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {searchQuery ? "No matching cards found" : `No cards ${type === "with-me" ? "shared with you" : "shared by you"} yet`}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {searchQuery
                ? "Try searching with a different term."
                : type === "with-me"
                  ? "When team members share board cards or lists with you, they will appear right here."
                  : "When you share board cards or lists with your team members, you can manage them right here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredNotes.map((note) => {
              const recipients = Array.from(
                new Set([
                  ...((note.shares || []).map((s) => s.user?.name || s.user?.email?.split("@")[0])),
                  ...((note.thread?.shares || []).map((s) => s.user?.name || s.user?.email?.split("@")[0])),
                ])
              ).filter(Boolean);

              const checkedItems = note.checklistItems?.filter((c) => c.checked).length || 0;
              const totalItems = note.checklistItems?.length || 0;
              const authorName = toTitleCase(note.author?.name || note.author?.email?.split("@")[0] || "User");
              const authorInitial = authorName.charAt(0).toUpperCase();

              return (
                <div
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className="group relative flex flex-col justify-between rounded-xl border bg-card/90 backdrop-blur-sm p-4 transition-all duration-200 hover:shadow-md hover:border-primary/50 cursor-pointer overflow-hidden border-l-4"
                  style={{
                    backgroundColor: note.color || undefined,
                    borderLeftColor: note.color ? "rgba(0,0,0,0.25)" : type === "with-me" ? "#3b82f6" : "#10b981",
                  }}
                >
                  <div className="flex flex-col gap-2.5">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-primary truncate">
                        <Sparkles size={12} className="shrink-0 text-primary" />
                        <span className="truncate">{note.thread?.board?.name ? `${note.thread.board.name}` : "Workspace Board"}</span>
                      </span>
                      {note.thread?.board?.type && (
                        <span className="rounded-md bg-accent/80 border border-border/50 px-1.5 py-0.5 text-xs font-bold tracking-wider text-muted-foreground uppercase shrink-0">
                          {note.thread.board.type}
                        </span>
                      )}
                    </div>

                    {/* List/Thread Title */}
                    <h4 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {note.thread?.title || "Untitled Card"}
                    </h4>

                    {/* Content Body / Checklist */}
                    {totalItems > 0 ? (
                      <div className="flex flex-col gap-1.5 my-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                            <CheckSquare size={13} className="text-primary" /> Checklist
                          </span>
                          <span className="text-xs font-bold text-muted-foreground">
                            {checkedItems}/{totalItems}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-accent/70 overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300 rounded-full"
                            style={{ width: `${(checkedItems / totalItems) * 100}%` }}
                          />
                        </div>
                        <div className="mt-1 flex flex-col gap-1">
                          {[
                            ...(note.checklistItems?.filter((c) => !c.checked) || []),
                            ...(note.checklistItems?.filter((c) => c.checked) || []),
                          ].slice(0, 3).map((item) => (
                            <div key={item.id} className="flex items-center gap-2 text-xs text-foreground/80 line-clamp-1">
                              <span className={cn("text-xs font-semibold shrink-0", item.checked ? "text-success" : "text-muted-foreground/60")}>
                                {item.checked ? "✓" : "○"}
                              </span>
                              <span className={cn("truncate", item.checked && "line-through text-muted-foreground/60")}>{item.text}</span>
                            </div>
                          ))}
                          {totalItems > 3 && (
                            <span className="text-xs text-muted-foreground/70 italic">+ {totalItems - 3} more items</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="html-content text-xs text-muted-foreground/90 line-clamp-3 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: note.content || "" }}
                      />
                    )}
                  </div>

                  {/* Card Footer Info */}
                  <div className="mt-4 border-t border-border/40 pt-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      {type === "with-me" ? (
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary shrink-0">
                            {authorInitial}
                          </div>
                          <span className="truncate text-xs font-semibold">{authorName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 font-semibold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full text-xs">
                          <Users size={11} />
                          <span className="truncate">{recipients.length > 0 ? recipients.join(", ") : "Shared"}</span>
                        </div>
                      )}

                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock size={11} />
                        {formatDate(note.createdAt)}
                      </span>
                    </div>

                    {note.deadline && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-md self-start">
                        <Calendar size={11} />
                        Due: {new Date(note.deadline).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Card Detail Modal ── */}
      {selectedNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          onClick={() => setSelectedNote(null)}
        >
          <div
            className="flex w-full max-w-3xl max-h-[85vh] overflow-y-auto flex-col gap-4 rounded-2xl border bg-card p-6 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: selectedNote.color || undefined }}
          >
            <div className="flex items-start justify-between border-b pb-3 border-border/50">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  <Sparkles size={11} />
                  In {selectedNote.thread?.title || "Board Card"} ({selectedNote.thread?.board?.name || "Workspace"})
                </span>
                <h3 className="text-lg font-bold text-foreground mt-0.5">
                  {selectedNote.title || selectedNote.thread?.title || "Card Details"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNote(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4 py-2 text-sm text-foreground">
              {selectedNote.checklistItems && selectedNote.checklistItems.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <CheckSquare size={14} className="text-primary" /> Checklist Items:
                  </span>
                  <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-4 bg-background/60 backdrop-blur-xs max-h-60 overflow-y-auto">
                    {selectedNote.checklistItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2.5 text-sm">
                        <span className={cn("font-bold text-sm shrink-0", item.checked ? "text-success" : "text-muted-foreground/60")}>
                          {item.checked ? "✓" : "○"}
                        </span>
                        <span className={cn("text-foreground", item.checked && "line-through text-muted-foreground/70")}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl border border-border/60 p-4 bg-background/60 leading-relaxed text-sm html-content overflow-y-auto max-h-96"
                  dangerouslySetInnerHTML={{ __html: selectedNote.content || "" }}
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 border-border/50 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Author:</span>
                  <span className="rounded-md bg-accent/80 px-2 py-0.5 font-medium text-foreground">
                    {selectedNote.author?.name || selectedNote.author?.email}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Created:</span> {formatDate(selectedNote.createdAt)}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3 border-border/50">
              <button
                type="button"
                onClick={() => setSelectedNote(null)}
                className="rounded-lg border bg-background px-4 py-2 text-xs font-semibold hover:bg-accent transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
