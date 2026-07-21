"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
  Plus,
  Trash2,
  Share2,
  Calendar,
  X,
  CheckSquare,
  Square,
  ChevronRight,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import RichTextEditor from "@/components/RichTextEditor";
import { NotesTopNav } from "./notes-top-nav";
import { createBoard } from "../actions/create-board";
import { createThread } from "../actions/create-thread";
import { shareThread } from "../actions/share-thread";
import { createBoardNote } from "../actions/create-board-note";
import { updateBoardNote } from "../actions/update-board-note";
import { deleteBoardNote } from "../actions/delete-board-note";
import { shareBoardNote } from "../actions/share-board-note";
import { toggleBoardNoteItem } from "../actions/toggle-board-note-item";
import { moveBoardNote } from "../actions/move-board-note";


type UserBasic = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  title: string | null;
  role?: string | null;
};

type ChecklistItem = {
  id: string;
  text: string;
  checked: boolean;
  position: number;
};

type BoardNoteData = {
  id: string;
  title: string | null;
  content: string;
  color: string | null;
  deadline: Date | null;
  threadId: string;
  authorId: string;
  author: UserBasic;
  shares: { userId: string }[];
  checklistItems: ChecklistItem[];
  createdAt: Date;
  updatedAt: Date;
};

type ThreadData = {
  id: string;
  title: string;
  boardId: string;
  authorId: string;
  author: UserBasic;
  shares: { userId: string }[];
  notes: BoardNoteData[];
  createdAt: Date;
  updatedAt: Date;
};

type BoardData = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

type HistoryNoteData = BoardNoteData & {
  thread: {
    id: string;
    title: string;
    boardId: string;
  };
};

type NotesWorkspaceProps = {
  initialBoards: BoardData[];
  historyNotes: HistoryNoteData[];
  allUsers: UserBasic[];
  userId: string;
  isManager: boolean;
  pageOwnerId?: string;
};

const PASTEL_COLORS = [
  "#ffffff", // White
  "#fffbeb", // Soft Amber
  "#f0fdf4", // Soft Emerald
  "#eff6ff", // Soft Blue
  "#faf5ff", // Soft Purple
  "#fff1f2", // Soft Rose
  "#f0f9ff", // Soft Sky
  "#fdf2f8", // Soft Pink
];

export function NotesWorkspace({
  initialBoards,
  historyNotes,
  allUsers,
  userId,
  isManager,
  pageOwnerId,
}: NotesWorkspaceProps) {
  const [boards, setBoards] = useState<BoardData[]>(initialBoards);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(
    initialBoards[0]?.id || null
  );
  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Sync props to state during render
  const [prevHistoryNotes, setPrevHistoryNotes] = useState(historyNotes);
  const [historyList, setHistoryList] = useState<HistoryNoteData[]>(historyNotes);
  const historyIds = historyNotes.map((n) => n.id).join(",");
  const prevHistoryIds = prevHistoryNotes.map((n) => n.id).join(",");
  if (historyIds !== prevHistoryIds) {
    setPrevHistoryNotes(historyNotes);
    setHistoryList(historyNotes);
  }


  const [prevInitialBoards, setPrevInitialBoards] = useState(initialBoards);
  const boardIds = initialBoards.map((b) => b.id).join(",");
  const prevBoardIds = prevInitialBoards.map((b) => b.id).join(",");
  if (boardIds !== prevBoardIds) {
    setPrevInitialBoards(initialBoards);
    setBoards(initialBoards);
    if (initialBoards.length > 0 && !activeBoardId) {
      setActiveBoardId(initialBoards[0].id);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view");
    if (view === "shared-by-me") {
      const el = document.getElementById("shared-by-me-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (view === "shared-with-me") {
      const el = document.getElementById("shared-with-me-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Pointer drag-to-scroll logic for board container
  const boardRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Do not initiate drag-scroll if clicking interactive elements or draggable threads/notes
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select") ||
      target.closest("[draggable]")
    ) {
      return;
    }
    isDragging.current = true;
    if (boardRef.current) {
      boardRef.current.style.cursor = "grabbing";
      startX.current = e.pageX - boardRef.current.offsetLeft;
      scrollLeft.current = boardRef.current.scrollLeft;
    }
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    if (boardRef.current) {
      boardRef.current.style.cursor = "grab";
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (boardRef.current) {
      boardRef.current.style.cursor = "grab";
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !boardRef.current) return;
    e.preventDefault();
    const x = e.pageX - boardRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5; // multiplier controls speed
    boardRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const refreshHistory = async () => {
    try {
      const res = await fetch("/api/notes/history");
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error("Failed to refresh history:", err);
    }
  };


  // Overlays & Form States
  const [showAddBoard, setShowAddBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  const [showNewThread, setShowNewThread] = useState(false);
  const [threadTitle, setThreadTitle] = useState("");
  const [threadNoteType, setThreadNoteType] = useState<"TEXT" | "CHECKLIST">("TEXT");
  const [threadContent, setThreadContent] = useState("");
  const [threadChecklist, setThreadChecklist] = useState<string[]>([""]);
  const [threadDeadline, setThreadDeadline] = useState("");
  const [threadColor, setThreadColor] = useState("#ffffff");
  const [threadSharedUsers, setThreadSharedUsers] = useState<string[]>([]);

  const [activeThreadForNote, setActiveThreadForNote] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteNoteType, setNoteNoteType] = useState<"TEXT" | "CHECKLIST">("TEXT");
  const [noteChecklist, setNoteChecklist] = useState<string[]>([""]);
  const [noteDeadline, setNoteDeadline] = useState("");
  const [noteColor, setNoteColor] = useState("#ffffff");

  const [editingNote, setEditingNote] = useState<BoardNoteData | null>(null);
  const [sharingItem, setSharingItem] = useState<{
    type: "thread" | "note";
    id: string;
    existingShares: string[];
  } | null>(null);

  const [shareSelection, setShareSelection] = useState<string[]>([]);

  const [isPending, startTransition] = useTransition();

  // Sync sharingItem selection during render
  const [prevSharingItem, setPrevSharingItem] = useState(sharingItem);
  if (sharingItem !== prevSharingItem) {
    setPrevSharingItem(sharingItem);
    setShareSelection(sharingItem ? sharingItem.existingShares : []);
  }

  const refreshThreads = async () => {
    if (!activeBoardId) return;
    try {
      const res = await fetch(`/api/boards/${activeBoardId}/threads`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data as ThreadData[]);
      }
    } catch (err) {
      console.error("Failed to refresh threads:", err);
    }
  };

  // Adjust state during render when activeBoardId changes
  const [prevActiveBoardId, setPrevActiveBoardId] = useState(activeBoardId);
  if (activeBoardId !== prevActiveBoardId) {
    setPrevActiveBoardId(activeBoardId);
    if (!activeBoardId) {
      setThreads([]);
    } else {
      setLoadingThreads(true);
    }
  }

  // Load threads when active board changes
  useEffect(() => {
    if (!activeBoardId) return;
    fetch(`/api/boards/${activeBoardId}/threads`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setThreads(data as ThreadData[]);
      })
      .catch(() => setThreads([]))
      .finally(() => {
        setLoadingThreads(false);
      });
  }, [activeBoardId]);

  // ── Drag and Drop Handlers ──────────────────────────────────────────────────

  const handleDragThreadStart = (e: React.DragEvent, threadId: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "thread", threadId }));
  };

  const handleDragCardStart = (e: React.DragEvent, noteId: string, sourceThreadId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData("text/plain", JSON.stringify({ type: "card", noteId, sourceThreadId }));
  };

  const handleDrop = async (e: React.DragEvent, targetThreadId: string) => {
    e.preventDefault();
    try {
      const rawData = e.dataTransfer.getData("text/plain");
      if (!rawData) return;
      const data = JSON.parse(rawData);

      if (data.type === "thread") {
        if (data.threadId === targetThreadId) return;
        const draggedIndex = threads.findIndex((t) => t.id === data.threadId);
        const targetIndex = threads.findIndex((t) => t.id === targetThreadId);
        if (draggedIndex !== -1 && targetIndex !== -1) {
          const newThreads = [...threads];
          const [dragged] = newThreads.splice(draggedIndex, 1);
          newThreads.splice(targetIndex, 0, dragged);
          setThreads(newThreads);
        }
      } else if (data.type === "card") {
        const { noteId, sourceThreadId } = data;
        if (sourceThreadId === targetThreadId) return;

        const sourceThread = threads.find((t) => t.id === sourceThreadId);
        const targetThread = threads.find((t) => t.id === targetThreadId);
        if (!sourceThread || !targetThread) return;

        const note = sourceThread.notes.find((n) => n.id === noteId);
        if (!note || note.authorId !== userId || targetThread.authorId !== userId) return;

        // 1. Optimistic update
        const newThreads = threads.map((t) => {
          if (t.id === sourceThreadId) {
            return { ...t, notes: t.notes.filter((n) => n.id !== noteId) };
          }
          if (t.id === targetThreadId) {
            return { ...t, notes: [...t.notes, note] };
          }
          return t;
        });
        setThreads(newThreads);

        // 2. Persist in DB
        startTransition(async () => {
          const formData = new FormData();
          formData.append("noteId", noteId);
          formData.append("targetThreadId", targetThreadId);
          await moveBoardNote({}, formData);
          await Promise.all([refreshThreads(), refreshHistory()]);
        });
      }
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  // Real-time synchronization: poll board threads in the background
  useEffect(() => {
    if (!activeBoardId) return;

    const interval = setInterval(() => {
      // Pause sync if user is typing or has an overlay active
      const isUserActive =
        showAddBoard ||
        showNewThread ||
        editingNote !== null ||
        sharingItem !== null ||
        activeThreadForNote !== null;

      if (!isUserActive && !isPending) {
        fetch(`/api/boards/${activeBoardId}/threads`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data) setThreads(data as ThreadData[]);
          })
          .catch((err) => console.error("Polling error:", err));
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeBoardId, showAddBoard, showNewThread, editingNote, sharingItem, activeThreadForNote, isPending]);

  // Handle Board Creation
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    const formData = new FormData();
    formData.append("name", newBoardName);

    startTransition(async () => {
      const res = await createBoard({}, formData);
      if (res.message === "created") {
        setNewBoardName("");
        setShowAddBoard(false);
        window.location.reload();
      } else if (res.errors?.name) {
        alert(res.errors.name[0]);
      }
    });
  };

  // Handle Thread Creation
  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadTitle.trim() || !activeBoardId) return;

    const formData = new FormData();
    formData.append("boardId", activeBoardId);
    formData.append("title", threadTitle);
    formData.append("noteType", threadNoteType);
    formData.append("color", threadColor);
    if (threadDeadline) formData.append("deadline", threadDeadline);
    if (threadSharedUsers.length > 0) {
      formData.append("shareUserIds", threadSharedUsers.join(","));
    }

    if (threadNoteType === "TEXT") {
      formData.append("content", threadContent);
    } else {
      threadChecklist.forEach((item) => {
        if (item.trim()) formData.append("item", item);
      });
    }

    startTransition(async () => {
      const res = await createThread({}, formData);
      if (res.message === "created") {
        setThreadTitle("");
        setThreadContent("");
        setThreadChecklist([""]);
        setThreadDeadline("");
        setThreadColor("#ffffff");
        setThreadSharedUsers([]);
        setShowNewThread(false);
        await refreshThreads();
      }
    });
  };

  // Handle Note Creation
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadForNote) return;

    const formData = new FormData();
    formData.append("threadId", activeThreadForNote);
    formData.append("noteType", noteNoteType);
    formData.append("color", noteColor);
    if (noteDeadline) formData.append("deadline", noteDeadline);

    if (noteNoteType === "TEXT") {
      formData.append("content", noteContent);
    } else {
      noteChecklist.forEach((item) => {
        if (item.trim()) formData.append("item", item);
      });
    }

    startTransition(async () => {
      const res = await createBoardNote({}, formData);
      if (res.message === "created") {
        console.log("Client: Note created successfully in thread:", activeThreadForNote, "with content:", noteContent, "and items:", noteChecklist);
        setNoteContent("");
        setNoteChecklist([""]);
        setNoteDeadline("");
        setNoteColor("#ffffff");
        setActiveThreadForNote(null);
        await Promise.all([refreshThreads(), refreshHistory()]);
      }
    });
  };

  // Handle Note Update
  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;

    const formData = new FormData();
    formData.append("id", editingNote.id);
    formData.append("color", editingNote.color || "#ffffff");
    if (editingNote.deadline) {
      formData.append("deadline", new Date(editingNote.deadline).toISOString().slice(0, 16));
    }

    formData.append("content", editingNote.content || "");
    editingNote.checklistItems.forEach((item) => {
      if (item.text.trim()) formData.append("item", item.text);
    });

    startTransition(async () => {
      const res = await updateBoardNote({}, formData);
      if (res.message === "updated") {
        console.log("Client: Note updated successfully:", editingNote.id, "with content:", editingNote.content, "and items:", editingNote.checklistItems);
        setEditingNote(null);
        await Promise.all([refreshThreads(), refreshHistory()]);
      }
    });
  };

  // Handle Note Delete
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) return;

    // Optimistic Delete
    setThreads((prevThreads) =>
      prevThreads.map((thread) => ({
        ...thread,
        notes: thread.notes.filter((note) => note.id !== noteId),
      }))
    );

    const formData = new FormData();
    formData.append("id", noteId);
    startTransition(async () => {
      await deleteBoardNote({}, formData);
      await Promise.all([refreshThreads(), refreshHistory()]);
    });
  };

  // Handle Share Submit
  const handleShareSubmit = async () => {
    if (!sharingItem) return;
    const formData = new FormData();
    formData.append("shareUserIds", shareSelection.join(","));

    startTransition(async () => {
      if (sharingItem.type === "thread") {
        formData.append("threadId", sharingItem.id);
        await shareThread({}, formData);
      } else {
        formData.append("noteId", sharingItem.id);
        await shareBoardNote({}, formData);
      }
      setSharingItem(null);
      setShareSelection([]);
      await refreshThreads();
    });
  };

  // Handle Checklist Item Toggle
  const handleToggleChecklistItem = async (itemId: string) => {
    // 1. Optimistic Update (Immediate feedback)
    setThreads((prevThreads) =>
      prevThreads.map((thread) => ({
        ...thread,
        notes: thread.notes.map((note) => ({
          ...note,
          checklistItems: note.checklistItems.map((item) =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          ),
        })),
      }))
    );

    // 2. Server Sync
    const formData = new FormData();
    formData.append("itemId", itemId);
    startTransition(async () => {
      await toggleBoardNoteItem({}, formData);
      await Promise.all([refreshThreads(), refreshHistory()]);
    });
  };

  const getInitials = (user: UserBasic) => {
    if (user.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  return (
    <div>
      <div className="p-3 border-b overflow-x-auto">
        <NotesTopNav onNewBoardClick={() => setShowAddBoard((prev) => !prev)} />
      </div>
      <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-background">
        {/* ── Sub-sidebar for note boards & history ── */}

        <aside className="w-60 border-r bg-card flex flex-col h-full shrink-0 select-none text-foreground">
          {/* Navigation Tabs (New Board, My Notes, Shared with Me, Shared by Me) */}



          {/* Boards Section */}
          <div className="flex flex-col gap-2 p-4 border-b">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Note Board
              </span>
              {(isManager || !pageOwnerId || pageOwnerId === userId) && (
                <button
                  type="button"
                  onClick={() => setShowAddBoard((prev) => !prev)}
                  className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>

            {showAddBoard && (
              <form onSubmit={handleCreateBoard} className="flex flex-col gap-2 mt-2">
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="Board name..."
                  className="w-full rounded border bg-background px-2.5 py-1 text-xs outline-none focus:border-ring"
                  maxLength={60}
                  required
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAddBoard(false)}
                    className="rounded px-2 py-1 text-[10px] border hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded bg-primary text-primary-foreground px-2.5 py-1 text-[10px] font-medium"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-col gap-0.5 mt-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-h-48">
              {boards.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic p-2">No boards created.</p>
              ) : (
                boards.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setActiveBoardId(b.id)}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition-colors text-left w-full",
                      activeBoardId === b.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <span>{b.name}</span>
                    {activeBoardId === b.id && <ChevronRight size={12} />}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Shared With Me Section */}
          {/* <div id="shared-with-me-section" className="flex flex-col gap-2 p-4 border-b overflow-hidden max-h-52 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Share2 size={13} className="text-primary" />
              Shared With Me
            </span>
            {sharedNotesList.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {sharedNotesList.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-1.5 pr-0.5">
            {sharedNotesList.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic p-1">No shared notes.</p>
            ) : (
              sharedNotesList.map((note) => (
                <div
                  key={note.id}
                  onClick={() => {
                    setActiveBoardId(note.thread.boardId);
                    setEditingNote({
                      ...note,
                      checklistItems: note.checklistItems || [],
                      shares: note.shares || [],
                    });
                  }}
                  className="group rounded-md border p-2 bg-background hover:bg-accent/40 cursor-pointer transition-colors text-left flex flex-col gap-1 border-l-4 text-foreground relative"
                  style={{
                    backgroundColor: note.color || undefined,
                    borderLeftColor: note.color ? "rgba(0,0,0,0.15)" : "#3b82f6",
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold line-clamp-1 group-hover:text-primary">
                      {note.thread?.title || "Shared Note"}
                    </p>
                    <span className="text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                      {note.author?.name ? note.author.name.split(" ")[0] : note.author?.email?.split("@")[0]}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {note.checklistItems?.length > 0
                      ? note.checklistItems.map((c: { checked: boolean; text: string }) => (c.checked ? "☑ " : "☐ ") + c.text).join(", ")
                      : (note.content || "").replace(/<[^>]*>/g, "")}
                  </p>
                  <span className="text-[9px] text-muted-foreground/60">
                    Shared on {formatDate(note.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div> */}

          {/* Shared By Me Section */}
          {/* <div id="shared-by-me-section" className="flex flex-col gap-2 p-4 border-b overflow-hidden max-h-52 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users size={13} className="text-emerald-500" />
              Shared By Me
            </span>
            {sharedByMeList.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                {sharedByMeList.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-1.5 pr-0.5">
            {sharedByMeList.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic p-1">No notes shared by you.</p>
            ) : (
              sharedByMeList.map((note) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const recipients = Array.from(new Set([
                  ...((note.shares || []).map((s: any) => s.user?.name || s.user?.email?.split("@")[0])),
                  ...(((note.thread as any)?.shares || []).map((s: any) => s.user?.name || s.user?.email?.split("@")[0]))
                ])).filter(Boolean);

                return (
                  <div
                    key={note.id}
                    onClick={() => {
                      setActiveBoardId(note.thread.boardId);
                      setEditingNote({
                        ...note,
                        checklistItems: note.checklistItems || [],
                        shares: note.shares || [],
                      });
                    }}
                    className="group rounded-md border p-2 bg-background hover:bg-accent/40 cursor-pointer transition-colors text-left flex flex-col gap-1 border-l-4 text-foreground relative"
                    style={{
                      backgroundColor: note.color || undefined,
                      borderLeftColor: note.color ? "rgba(0,0,0,0.15)" : "#10b981",
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold line-clamp-1 group-hover:text-primary">
                        {note.thread?.title || "Shared Note"}
                      </p>
                      {recipients.length > 0 && (
                        <span className="text-[9px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                          {recipients.slice(0, 2).join(", ")}{recipients.length > 2 ? ` +${recipients.length - 2}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {note.checklistItems?.length > 0
                        ? note.checklistItems.map((c: { checked: boolean; text: string }) => (c.checked ? "☑ " : "☐ ") + c.text).join(", ")
                        : (note.content || "").replace(/<[^>]*>/g, "")}
                    </p>
                    <span className="text-[9px] text-muted-foreground/60">
                      {formatDate(note.updatedAt)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div> */}

          {/* History Section */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
              Note History
            </span>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-2">
              {historyList.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic">No notes found.</p>
              ) : (
                historyList.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => {
                      // Navigate to board or open note edit dialog
                      setActiveBoardId(note.thread.boardId);
                      setEditingNote({
                        ...note,
                        checklistItems: note.checklistItems || [],
                        shares: note.shares || [],
                      });
                    }}
                    className="group rounded-md border p-2.5 bg-background hover:bg-accent/40 cursor-pointer transition-colors text-left flex flex-col gap-1 border-l-4 text-foreground"
                    style={{
                      backgroundColor: note.color || undefined,
                      borderLeftColor: note.color ? "rgba(0,0,0,0.15)" : "#e2e8f0",
                    }}
                  >
                    <p className="text-xs font-semibold line-clamp-1 group-hover:text-primary">
                      {note.thread?.title || "Untitled Note"}
                    </p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {note.checklistItems?.length > 0
                        ? note.checklistItems.map((c: { checked: boolean; text: string }) => (c.checked ? "☑ " : "☐ ") + c.text).join(", ")
                        : (note.content || "").replace(/<[^>]*>/g, "")}
                    </p>
                    <span className="text-[9px] text-muted-foreground/60">
                      {formatDate(note.updatedAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* ── Main Board Workspace ── */}
        <main
          className="flex-1 flex flex-col h-[calc(100vh-5.5rem)] overflow-hidden m-4 rounded-2xl border shadow-md relative"
          style={{
            backgroundImage: "url('https://thephotoargus.com/wp-content/uploads/2019/09/SunsetHtin.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Header */}
          <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0 bg-black/35 backdrop-blur-sm text-white rounded-t-2xl">
            <div>
              <h1 className="text-base font-bold text-white">
                {activeBoard ? activeBoard.name : "Standup Workspace"}
              </h1>
              <p className="text-xs text-white/70 mt-0.5">
                Notes you write here are visible only to the people or departments you assign them to.
              </p>
            </div>
            {activeBoardId && activeBoard && activeBoard.ownerId === userId && (
              <button
                onClick={() => setShowNewThread(true)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:opacity-90 transition-opacity"
              >
                <Plus size={14} />
                New List
              </button>
            )}
          </div>

          {/* Content columns */}
          {loadingThreads ? (
            <div className="flex-1 flex items-center text-white justify-center text-sm text-muted-foreground">
              Loading workspace threads...
            </div>
          ) : threads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-transparent backdrop-blur-xl">
              <div className="relative mb-4 flex items-center justify-center h-24 w-24 rounded-full bg-accent/30 text-muted-foreground">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-10 w-10"
                >
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                {activeBoardId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNewThread(true);
                    }}
                    className="absolute bg-primary -top-1 -right-1 z-10 cursor-pointer flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:opacity-90 active:scale-95 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <h2 className="text-sm font-semibold text-foreground text-white">
                Your board is a fresh start
              </h2>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground text-white/75">
                Every great product starts with a single thought. Capture yours here—notes, sketches, or checklists.
              </p>
              {activeBoardId && (
                <button
                  onClick={() => setShowNewThread(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow hover:opacity-95"
                >
                  Create First Thread
                </button>
              )}
            </div>
          ) : (
            <div
              ref={boardRef}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              className="flex-1 flex gap-5 bg-transparent backdrop-blur-[2px] p-6 overflow-x-auto items-start h-full scrollbar-thin select-none cursor-grab active:cursor-grabbing"
            >
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  draggable
                  onDragStart={(e) => handleDragThreadStart(e, thread.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, thread.id)}
                  className="w-72 shrink-0 flex flex-col max-h-full overflow-hidden shadow-md cursor-grab active:cursor-grabbing"
                  style={{
                    background: "rgba(255, 255, 255, 0.11)",
                    borderRadius: "16px",
                    boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid rgba(255, 255, 255, 1)",
                    transform: "translateZ(0)",
                    WebkitTransform: "translateZ(0)",
                  }}
                >
                  {/* Thread Header */}
                  <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/10 bg-white/5 shrink-0 text-white">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-white">
                        {thread.title}
                      </span>
                      <span className="text-[9px] text-white/75">
                        by {thread.author.name || thread.author.email.split("@")[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {thread.authorId === userId && (
                        <>
                          <button
                            type="button"
                            title="Share Thread"
                            onClick={() =>
                              setSharingItem({
                                type: "thread",
                                id: thread.id,
                                existingShares: thread.shares.map((s) => s.userId),
                              })
                            }
                            className="rounded p-1 hover:bg-white/10 text-white/70 hover:text-white"
                          >
                            <Share2 size={12} />
                          </button>
                          <button
                            type="button"
                            title="Add Note"
                            onClick={() => setActiveThreadForNote(thread.id)}
                            className="rounded p-1 hover:bg-white/10 text-white/70 hover:text-white"
                          >
                            <Plus size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notes Container */}
                  <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3.5 min-h-[100px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {thread.notes.length === 0 ? (
                      <div className="text-center py-6 text-[11px] text-muted-foreground/60 border border-dashed rounded-lg">
                        No cards. Click + to add.
                      </div>
                    ) : (
                      thread.notes.map((note) => (
                        <div
                          key={note.id}
                          draggable
                          onDragStart={(e) => handleDragCardStart(e, note.id, thread.id)}
                          onClick={() =>
                            setEditingNote({
                              ...note,
                              checklistItems: note.checklistItems || [],
                              shares: note.shares || [],
                            })
                          }
                          className="rounded-xl border border-white/15 dark:border-white/5 p-4 shadow-sm relative flex flex-col gap-2.5 cursor-grab active:cursor-grabbing hover:shadow-md backdrop-blur-xs transition-all duration-200 hover:-translate-y-0.5 group border-l-4"
                          style={{
                            backgroundColor: note.color ? `${note.color}cc` : "rgba(255, 255, 255, 0.75)",
                            borderLeftColor: note.color ? "rgba(0,0,0,0.15)" : "#e2e8f0",
                          }}
                        >
                          {/* Note Card Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                                {getInitials(note.author)}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-foreground leading-none">
                                  {note.author.name || note.author.email.split("@")[0]}
                                </span>
                                <span className="text-[8px] text-muted-foreground mt-0.5">
                                  {formatDate(note.createdAt)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {note.authorId === userId && (
                                <>
                                  <button
                                    type="button"
                                    title="Share Note"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSharingItem({
                                        type: "note",
                                        id: note.id,
                                        existingShares: note.shares.map((s) => s.userId),
                                      });
                                    }}
                                    className="rounded p-0.5 hover:bg-black/5 text-muted-foreground"
                                  >
                                    <Share2 size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete Note"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteNote(note.id);
                                    }}
                                    className="rounded p-0.5 hover:bg-black/5 text-destructive"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Note Body */}
                          <div
                            className="text-[11px] text-foreground leading-relaxed html-content"
                            dangerouslySetInnerHTML={{ __html: note.content || "" }}
                          />

                          {/* Checklist items */}
                          {note.checklistItems.length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-1 border-t pt-2 border-black/5">
                              {note.checklistItems.map((item) => (
                                <div
                                  key={item.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (note.authorId === userId) {
                                      handleToggleChecklistItem(item.id);
                                    }
                                  }}
                                  className={cn(
                                    "flex items-start gap-2 rounded p-0.5",
                                    note.authorId === userId ? "hover:bg-black/5 cursor-pointer" : "cursor-default opacity-85"
                                  )}
                                >
                                  <button type="button" className="mt-0.5 shrink-0">
                                    {item.checked ? (
                                      <CheckSquare size={12} className="text-primary" />
                                    ) : (
                                      <Square size={12} className="text-muted-foreground/60" />
                                    )}
                                  </button>
                                  <span
                                    className={cn(
                                      "text-[10px] leading-tight select-none",
                                      item.checked && "text-muted-foreground line-through"
                                    )}
                                  >
                                    {item.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Deadline Indicator */}
                          {note.deadline && (
                            <div className="flex items-center gap-1 text-[9px] text-amber-700/80 mt-1 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full w-fit">
                              <Calendar size={9} />
                              <span>Due {new Date(note.deadline).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* ── Modals / Overlays ── */}

        {/* 1. Share Dialog Overlay */}
        {sharingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
            <div className="w-80 rounded-xl bg-card border p-5 shadow-lg flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Users size={14} />
                  Share {sharingItem.type === "thread" ? "Thread" : "Note"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSharingItem(null);
                    setShareSelection([]);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Select Members
                </label>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border rounded p-2">
                  {allUsers
                    .filter((u) => u.id !== userId)
                    .map((u) => {
                      const isChecked = shareSelection.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setShareSelection(shareSelection.filter((id) => id !== u.id));
                            } else {
                              setShareSelection([...shareSelection, u.id]);
                            }
                          }}
                          className="flex items-center justify-between text-left py-1 px-1.5 rounded hover:bg-accent text-xs font-medium"
                        >
                          <div className="flex flex-col">
                            <span>{u.name || u.email.split("@")[0]}</span>
                            <span className="text-[9px] text-muted-foreground/60 font-normal leading-none mt-0.5">
                              {u.title || u.role}
                            </span>
                          </div>
                          {isChecked ? (
                            <CheckSquare size={13} className="text-primary" />
                          ) : (
                            <Square size={13} className="text-muted-foreground/40" />
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSharingItem(null);
                    setShareSelection([]);
                  }}
                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleShareSubmit}
                  disabled={isPending}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-xs font-semibold shadow hover:opacity-90 disabled:opacity-50"
                >
                  Share
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. New Thread Overlay */}
        {showNewThread && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs">
            <form
              onSubmit={handleCreateThread}
              className="w-full max-w-xl rounded-xl bg-card border p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="flex items-center justify-between border-b pb-3 shrink-0">
                <span className="text-sm font-bold text-foreground">New Thread</span>
                <button
                  type="button"
                  onClick={() => setShowNewThread(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[75vh] pr-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Title of Thread
                  </label>
                  <input
                    type="text"
                    value={threadTitle}
                    onChange={(e) => setThreadTitle(e.target.value)}
                    placeholder="Enter text here..."
                    className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    maxLength={120}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Share this note/thread with
                  </label>
                  <div className="flex flex-wrap gap-1 border rounded-md p-2 bg-background/50">
                    {threadSharedUsers.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground/60 italic p-1">
                        No one selected (Draft / Personal)
                      </span>
                    ) : (
                      threadSharedUsers.map((id) => {
                        const userObj = allUsers.find((u) => u.id === id);
                        return (
                          <div
                            key={id}
                            className="flex items-center gap-1 bg-accent rounded-full pl-2 pr-1.5 py-0.5 text-xs text-accent-foreground font-medium"
                          >
                            <span>{userObj?.name || userObj?.email.split("@")[0]}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setThreadSharedUsers(threadSharedUsers.filter((u) => u !== id))
                              }
                              className="rounded-full hover:bg-black/10 text-muted-foreground"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })
                    )}
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !threadSharedUsers.includes(val)) {
                          setThreadSharedUsers([...threadSharedUsers, val]);
                        }
                        e.target.value = "";
                      }}
                      className="border-none bg-transparent outline-none text-xs text-primary font-semibold cursor-pointer max-w-[100px]"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        + Add people
                      </option>
                      {allUsers
                        .filter((u) => u.id !== userId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email.split("@")[0]}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Initial Note Workspace */}
                <div
                  className="border rounded-lg p-4 flex flex-col gap-2.5"
                  style={{ backgroundColor: threadColor }}
                >
                  {/* Note Type Selector */}
                  <div className="flex gap-1 bg-black/5 rounded p-0.5 self-start mb-1">
                    <button
                      type="button"
                      onClick={() => setThreadNoteType("TEXT")}
                      className={cn(
                        "px-3 py-1 text-[10px] font-semibold rounded transition-colors",
                        threadNoteType === "TEXT"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Text Note
                    </button>
                    <button
                      type="button"
                      onClick={() => setThreadNoteType("CHECKLIST")}
                      className={cn(
                        "px-3 py-1 text-[10px] font-semibold rounded transition-colors",
                        threadNoteType === "CHECKLIST"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Checklist
                    </button>
                  </div>

                  {threadNoteType === "TEXT" ? (
                    <div className="bg-background text-foreground rounded border text-sm max-w-full overflow-hidden">
                      <RichTextEditor
                        value={threadContent}
                        onChange={(val) => setThreadContent(val)}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {threadChecklist.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Square size={13} className="text-muted-foreground/50 shrink-0" />
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const newChecklist = [...threadChecklist];
                              newChecklist[idx] = e.target.value;
                              setThreadChecklist(newChecklist);
                            }}
                            placeholder={`Checklist item ${idx + 1}`}
                            className="flex-1 bg-transparent border-none outline-none text-xs"
                          />
                          {threadChecklist.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setThreadChecklist(threadChecklist.filter((_, i) => i !== idx))
                              }
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setThreadChecklist([...threadChecklist, ""])}
                        className="flex items-center gap-1 text-[10px] font-semibold text-primary self-start mt-1"
                      >
                        <Plus size={11} /> Add item
                      </button>
                    </div>
                  )}

                  {/* Deadline */}
                  <div className="flex flex-col gap-1 border-t pt-3 mt-1.5 border-black/5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">
                      Deadline (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={threadDeadline}
                      onChange={(e) => setThreadDeadline(e.target.value)}
                      className="bg-transparent border rounded p-1 text-[11px] outline-none max-w-[180px]"
                    />
                  </div>

                  {/* Color Picker */}
                  <div className="flex flex-col gap-1 mt-2 border-t pt-2 border-black/5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">
                      Card Color
                    </label>
                    <div className="flex items-center gap-1.5 mt-1">
                      {PASTEL_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setThreadColor(c)}
                          className={cn(
                            "h-5.5 w-5.5 rounded-full border border-black/10 shadow-xs relative transition-transform hover:scale-110",
                            threadColor === c && "ring-1 ring-primary scale-110"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNewThread(false)}
                  className="rounded-md border px-4 py-2 text-xs hover:bg-accent font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold shadow hover:opacity-90 disabled:opacity-50"
                >
                  Publish
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 3. Add Note inside Column Overlay */}
        {activeThreadForNote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs">
            <form
              onSubmit={handleCreateNote}
              className="w-full max-w-lg rounded-xl bg-card border p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="flex items-center justify-between border-b pb-3 shrink-0">
                <span className="text-sm font-bold text-foreground">Add Card to Column</span>
                <button
                  type="button"
                  onClick={() => setActiveThreadForNote(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[70vh] pr-1">
                <div
                  className="border rounded-lg p-4 flex flex-col gap-2.5"
                  style={{ backgroundColor: noteColor }}
                >
                  {/* Note Type Selector */}
                  <div className="flex gap-1 bg-black/5 rounded p-0.5 self-start mb-1">
                    <button
                      type="button"
                      onClick={() => setNoteNoteType("TEXT")}
                      className={cn(
                        "px-3 py-1 text-[10px] font-semibold rounded transition-colors",
                        noteNoteType === "TEXT"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Text Note
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteNoteType("CHECKLIST")}
                      className={cn(
                        "px-3 py-1 text-[10px] font-semibold rounded transition-colors",
                        noteNoteType === "CHECKLIST"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Checklist
                    </button>
                  </div>

                  {noteNoteType === "TEXT" ? (
                    <div className="bg-background text-foreground rounded border text-sm max-w-full overflow-hidden">
                      <RichTextEditor
                        value={noteContent}
                        onChange={(val) => setNoteContent(val)}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {noteChecklist.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Square size={13} className="text-muted-foreground/50 shrink-0" />
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => {
                              const newChecklist = [...noteChecklist];
                              newChecklist[idx] = e.target.value;
                              setNoteChecklist(newChecklist);
                            }}
                            placeholder={`Checklist item ${idx + 1}`}
                            className="flex-1 bg-transparent border-none outline-none text-xs"
                          />
                          {noteChecklist.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setNoteChecklist(noteChecklist.filter((_, i) => i !== idx))
                              }
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setNoteChecklist([...noteChecklist, ""])}
                        className="flex items-center gap-1 text-[10px] font-semibold text-primary self-start mt-1"
                      >
                        <Plus size={11} /> Add item
                      </button>
                    </div>
                  )}

                  {/* Deadline */}
                  <div className="flex flex-col gap-1 border-t pt-3 mt-1.5 border-black/5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">
                      Deadline (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={noteDeadline}
                      onChange={(e) => setNoteDeadline(e.target.value)}
                      className="bg-transparent border rounded p-1 text-[11px] outline-none max-w-[180px]"
                    />
                  </div>

                  {/* Color Picker */}
                  <div className="flex flex-col gap-1 mt-2 border-t pt-2 border-black/5">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">
                      Card Color
                    </label>
                    <div className="flex items-center gap-1.5 mt-1">
                      {PASTEL_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNoteColor(c)}
                          className={cn(
                            "h-5.5 w-5.5 rounded-full border border-black/10 shadow-xs relative transition-transform hover:scale-110",
                            noteColor === c && "ring-1 ring-primary scale-110"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveThreadForNote(null)}
                  className="rounded-md border px-4 py-2 text-xs hover:bg-accent font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold shadow hover:opacity-90 disabled:opacity-50"
                >
                  Save Card
                </button>
              </div>
            </form>
          </div>
        )}
        {/* 4. Edit Note Dialog Overlay */}
        {editingNote && (() => {
          const isEditingReadOnly = editingNote.authorId !== userId;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs">
              <form
                onSubmit={handleUpdateNote}
                className="w-full max-w-lg rounded-xl bg-card border p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="flex items-center justify-between border-b pb-3 shrink-0">
                  <span className="text-sm font-bold text-foreground">
                    {isEditingReadOnly ? "View Note Card" : "Edit Note Card"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingNote(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[70vh] pr-1">
                  <div
                    className="border rounded-lg p-4 flex flex-col gap-2.5"
                    style={{ backgroundColor: editingNote.color || "#ffffff" }}
                  >
                    {/* Text Content */}
                    {isEditingReadOnly ? (
                      <div
                        className="text-xs text-foreground bg-background rounded border p-3 leading-relaxed html-content text-left"
                        dangerouslySetInnerHTML={{ __html: editingNote.content || "" }}
                      />
                    ) : (
                      <div className="bg-background px-3 text-foreground rounded border text-sm max-w-full overflow-hidden">
                        <RichTextEditor
                          value={editingNote.content || ""}
                          onChange={(val) =>
                            setEditingNote({ ...editingNote, content: val })
                          }
                        />
                      </div>
                    )}

                    {/* Checklist Section */}
                    <div className="flex flex-col gap-2 border-t pt-3 mt-1.5 border-black/5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase">
                        Checklist
                      </label>
                      {editingNote.checklistItems.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {editingNote.checklistItems.map((item, idx) => (
                            <div key={item.id} className="flex items-start gap-2">
                              {item.checked ? (
                                <CheckSquare size={13} className="text-primary mt-0.5 shrink-0" />
                              ) : (
                                <Square size={13} className="text-muted-foreground/40 mt-0.5 shrink-0" />
                              )}
                              {isEditingReadOnly ? (
                                <span className={cn(
                                  "text-xs select-none",
                                  item.checked && "text-muted-foreground line-through"
                                )}>
                                  {item.text}
                                </span>
                              ) : (
                                <>
                                  <input
                                    type="text"
                                    value={item.text}
                                    onChange={(e) => {
                                      const newItems = [...editingNote.checklistItems];
                                      newItems[idx].text = e.target.value;
                                      setEditingNote({ ...editingNote, checklistItems: newItems });
                                    }}
                                    placeholder={`Checklist item ${idx + 1}`}
                                    className="flex-1 bg-transparent border-none outline-none text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newItems = editingNote.checklistItems.filter(
                                        (_, i) => i !== idx
                                      );
                                      setEditingNote({ ...editingNote, checklistItems: newItems });
                                    }}
                                    className="text-muted-foreground hover:text-destructive shrink-0"
                                  >
                                    <X size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {!isEditingReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = [
                              ...editingNote.checklistItems,
                              {
                                id: "new-" + Math.random(),
                                text: "",
                                checked: false,
                                position: editingNote.checklistItems.length,
                              },
                            ];
                            setEditingNote({ ...editingNote, checklistItems: newItems });
                          }}
                          className="flex items-center gap-1 text-[10px] font-semibold text-primary self-start mt-1"
                        >
                          <Plus size={11} /> Add checklist item
                        </button>
                      )}
                    </div>

                    {/* Deadline */}
                    <div className="flex flex-col gap-1 border-t pt-3 mt-1.5 border-black/5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase">
                        Deadline (optional)
                      </label>
                      <input
                        type="datetime-local"
                        disabled={isEditingReadOnly}
                        value={
                          editingNote.deadline
                            ? new Date(editingNote.deadline).toISOString().slice(0, 16)
                            : ""
                        }
                        onChange={(e) =>
                          setEditingNote({
                            ...editingNote,
                            deadline: e.target.value ? new Date(e.target.value) : null,
                          })
                        }
                        className="bg-transparent border rounded p-1 text-[11px] outline-none max-w-[180px] disabled:opacity-75"
                      />
                    </div>

                    {/* Color Picker */}
                    <div className="flex flex-col gap-1 mt-2 border-t pt-2 border-black/5">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase">
                        Card Color
                      </label>
                      <div className="flex items-center gap-1.5 mt-1">
                        {PASTEL_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            disabled={isEditingReadOnly}
                            onClick={() => setEditingNote({ ...editingNote, color: c })}
                            className={cn(
                              "h-5.5 w-5.5 rounded-full border border-black/10 shadow-xs relative transition-transform hover:scale-110",
                              editingNote.color === c && "ring-1 ring-primary scale-110"
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t pt-3 mt-2 shrink-0">
                  {isEditingReadOnly ? (
                    <button
                      type="button"
                      onClick={() => setEditingNote(null)}
                      className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold shadow hover:opacity-90"
                    >
                      Close
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingNote(null)}
                        className="rounded-md border px-4 py-2 text-xs hover:bg-accent font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold shadow hover:opacity-90 disabled:opacity-50"
                      >
                        Save Edits
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
