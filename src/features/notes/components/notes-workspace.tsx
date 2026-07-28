"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Share2,
  Calendar,
  X,
  CheckSquare,
  Square,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  GripVertical,
  Pencil,
  FileText,
} from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});
import { NotesTopNav } from "./notes-top-nav";
import { createBoard } from "../actions/create-board";
import { createThread } from "../actions/create-thread";
import { updateBoard } from "../actions/update-board";
import { updateThread } from "../actions/update-thread";
import { shareBoard } from "../actions/share-board";
import { deleteBoard } from "../actions/delete-board";
import { deleteThread } from "../actions/delete-thread";
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
  type: string;
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
  const router = useRouter();
  const [boards, setBoards] = useState<BoardData[]>(initialBoards);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const bId = params.get("boardId") || localStorage.getItem("winos_active_board_id");
      if (bId && initialBoards.some((b) => b.id === bId)) {
        return bId;
      }
    }
    return initialBoards[0]?.id || null;
  });
  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isBoardSectionOpen, setIsBoardSectionOpen] = useState(true);

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
    if (initialBoards.length > 0) {
      const storedId = typeof window !== "undefined" ? localStorage.getItem("winos_active_board_id") : null;
      if (storedId && initialBoards.some((b) => b.id === storedId)) {
        setActiveBoardId(storedId);
      } else if (!activeBoardId || !initialBoards.some((b) => b.id === activeBoardId)) {
        setActiveBoardId(initialBoards[0].id);
      }
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bId = params.get("boardId") || localStorage.getItem("winos_active_board_id");
    if (bId) {
      const exists = initialBoards.some((b) => b.id === bId);
      if (exists) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveBoardId(bId);
      }
    }
    const view = params.get("view");
    if (view === "shared-by-me") {
      const el = document.getElementById("shared-by-me-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (view === "shared-with-me") {
      const el = document.getElementById("shared-with-me-section");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [initialBoards]);

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
  const [newBoardIsDsm, setNewBoardIsDsm] = useState(false);

  const [showNewThread, setShowNewThread] = useState(false);
  const [threadTitle, setThreadTitle] = useState("");
  const [threadNoteTitle, setThreadNoteTitle] = useState("");
  const [threadNoteType, setThreadNoteType] = useState<"TEXT" | "CHECKLIST">("TEXT");
  const [threadContent, setThreadContent] = useState("");
  const [threadChecklist, setThreadChecklist] = useState<string[]>([""]);
  const [threadDeadline, setThreadDeadline] = useState("");
  const [threadColor, setThreadColor] = useState("#ffffff");
  const [threadSharedUsers, setThreadSharedUsers] = useState<string[]>([]);

  const [activeThreadForNote, setActiveThreadForNote] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteNoteType, setNoteNoteType] = useState<"TEXT" | "CHECKLIST">("TEXT");
  const [noteChecklist, setNoteChecklist] = useState<string[]>([""]);
  const [noteDeadline, setNoteDeadline] = useState("");
  const [noteColor, setNoteColor] = useState("#ffffff");

  const [editingBoard, setEditingBoard] = useState<{ id: string; name: string } | null>(null);
  const [editingThread, setEditingThread] = useState<{ id: string; title: string } | null>(null);
  const [editingNote, setEditingNote] = useState<BoardNoteData | null>(null);
  const [sharingItem, setSharingItem] = useState<{
    type: "board" | "thread" | "note";
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
    formData.append("isDsm", newBoardIsDsm ? "true" : "false");

    startTransition(async () => {
      const res = await createBoard({}, formData);
      if (res.message === "created") {
        setNewBoardName("");
        setNewBoardIsDsm(false);
        setShowAddBoard(false);
        if (res.boardId) {
          localStorage.setItem("winos_active_board_id", res.boardId);
          window.location.href = `/notes?boardId=${res.boardId}`;
        } else {
          window.location.reload();
        }
      } else if (res.errors?.name) {
        alert(res.errors.name[0]);
      }
    });
  };

  // Handle Board Update (Rename)
  const handleUpdateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBoard || !editingBoard.name.trim()) return;

    const formData = new FormData();
    formData.append("boardId", editingBoard.id);
    formData.append("name", editingBoard.name.trim());

    startTransition(async () => {
      const res = await updateBoard({}, formData);
      if (res.message === "updated") {
        setEditingBoard(null);
        window.location.reload();
      } else if (res.errors?.name) {
        alert(res.errors.name[0]);
      }
    });
  };

  // Handle Thread Update (Rename List)
  const handleUpdateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingThread || !editingThread.title.trim()) return;

    const formData = new FormData();
    formData.append("threadId", editingThread.id);
    formData.append("title", editingThread.title.trim());

    startTransition(async () => {
      const res = await updateThread({}, formData);
      if (res.message === "updated") {
        setEditingThread(null);
        refreshThreads();
        router.refresh();
      } else if (res.errors?.title) {
        alert(res.errors.title[0]);
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
    if (threadNoteTitle.trim()) formData.append("noteTitle", threadNoteTitle);
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
        setThreadNoteTitle("");
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
    if (noteTitle.trim()) formData.append("title", noteTitle);
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
        setNoteTitle("");
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
    if (editingNote.title !== undefined) formData.append("title", editingNote.title || "");
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

  // Handle Delete Board
  const handleDeleteBoard = async (boardId: string) => {
    if (!confirm("Are you sure you want to delete this board and all its lists?")) return;

    const formData = new FormData();
    formData.append("boardId", boardId);
    startTransition(async () => {
      await deleteBoard({}, formData);
      const updatedBoards = boards.filter((b) => b.id !== boardId);
      setBoards(updatedBoards);
      if (activeBoardId === boardId) {
        const nextBoardId = updatedBoards[0]?.id || null;
        setActiveBoardId(nextBoardId);
        if (nextBoardId) {
          localStorage.setItem("winos_active_board_id", nextBoardId);
        } else {
          localStorage.removeItem("winos_active_board_id");
        }
      }
    });
  };

  // Handle Delete List / Thread
  const handleDeleteThread = async (threadId: string) => {
    if (!confirm("Are you sure you want to delete this list and all its notes?")) return;

    setThreads((prev) => prev.filter((t) => t.id !== threadId));

    const formData = new FormData();
    formData.append("threadId", threadId);
    startTransition(async () => {
      await deleteThread({}, formData);
      await refreshThreads();
    });
  };

  // Handle Share Submit
  const handleShareSubmit = async () => {
    if (!sharingItem) return;
    const formData = new FormData();
    formData.append("shareUserIds", shareSelection.join(","));

    startTransition(async () => {
      if (sharingItem.type === "board") {
        formData.append("boardId", sharingItem.id);
        await shareBoard({}, formData);
      } else if (sharingItem.type === "thread") {
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

  const formatFallbackName = (email: string) => {
    const prefix = email.split("@")[0];
    return prefix
      .split(".")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getInitials = (user: UserBasic) => {
    const displayName = user.name || formatFallbackName(user.email);
    return displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
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
    <div className="flex h-[calc(100vh-4.5rem)] w-full overflow-hidden bg-background">
        {/* ── Sub-sidebar for note boards & history ── */}
        {isSidebarOpen && (
          <aside className="w-60 bg-card flex flex-col shrink-0 select-none text-foreground my-4 ml-4 rounded-2xl border shadow-xs overflow-hidden transition-all duration-300">
            {/* Sidebar Navigation Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Notes Navigation
              </span>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Close Navigation"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>

            {/* Quick Links Navigation */}
            <div className="flex flex-col gap-1 p-3 border-b">
              <Link
                href="/notes"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-primary/10 text-primary transition-colors"
              >
                <FileText size={14} className="text-primary" />
                <span>My Notes</span>
              </Link>
              <Link
                href="/notes/shared-with-me"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Share2 size={14} />
                <span>Shared With Me</span>
              </Link>
              <Link
                href="/notes/shared-by-me"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Users size={14} />
                <span>Shared By Me</span>
              </Link>
            </div>

            {/* Boards Section */}
            <div className="flex flex-col gap-2 p-4 border-b">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsBoardSectionOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {isBoardSectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Note Board</span>
                </button>
                {(isManager || !pageOwnerId || pageOwnerId === userId) && (
                  <button
                    type="button"
                    onClick={() => setShowAddBoard((prev) => !prev)}
                    className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Add Board"
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>

              {isBoardSectionOpen && (
                <>
                  {showAddBoard && (
                    <form onSubmit={handleCreateBoard} className="flex flex-col gap-2 mt-2">
                      <input
                        type="text"
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        placeholder="Board Name..."
                        className="w-full rounded border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
                        maxLength={60}
                        required
                      />
                      <label className="flex items-center gap-1.5 px-0.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newBoardIsDsm}
                          onChange={(e) => setNewBoardIsDsm(e.target.checked)}
                          className="cursor-pointer"
                        />
                        Mark as DSM board (notes shared from here show in /dsm Workspace Notes)
                      </label>
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddBoard(false);
                            setNewBoardIsDsm(false);
                          }}
                          className="rounded px-2.5 py-1 text-xs border hover:bg-accent font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold"
                        >
                          Create
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="flex flex-col gap-0.5 mt-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-h-60">
                    {boards.length === 0 ? (
                      <p className="text-sm text-muted-foreground/60 italic p-2">No Boards Created.</p>
                    ) : (
                      boards.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => {
                            setActiveBoardId(b.id);
                            localStorage.setItem("winos_active_board_id", b.id);
                            if (typeof window !== "undefined") {
                              window.history.pushState(null, "", `/notes?boardId=${b.id}`);
                            }
                          }}
                          className={cn(
                            "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold transition-colors text-left w-full cursor-pointer",
                            activeBoardId === b.id
                              ? "bg-primary/10 text-primary font-bold shadow-2xs"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                        >
                          <span className="flex items-center gap-1.5 truncate pr-1">
                            <span className="truncate">{b.name}</span>
                            {b.type === "DSM" && (
                              <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                                DSM
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {(b.ownerId === userId || isManager) && (
                              <>
                                <button
                                  type="button"
                                  title="Share Board"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSharingItem({
                                      type: "board",
                                      id: b.id,
                                      existingShares: [],
                                    });
                                  }}
                                  className="rounded p-1 hover:bg-background/80 text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <Share2 size={12} />
                                </button>
                                <button
                                  type="button"
                                  title="Delete Board"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteBoard(b.id);
                                  }}
                                  className="rounded p-1 hover:bg-background/80 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                            {activeBoardId === b.id && <ChevronRight size={14} className="ml-0.5 text-primary" />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Shared With Me Section */}
            {/* <div id="shared-with-me-section" className="flex flex-col gap-2 p-4 border-b overflow-hidden max-h-52 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Share2 size={13} className="text-primary" />
              Shared With Me
            </span>
            {sharedNotesList.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
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
                    <span className="text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                      {note.author?.name ? note.author.name.split(" ")[0] : note.author?.email?.split("@")[0]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {note.checklistItems?.length > 0
                      ? note.checklistItems.map((c: { checked: boolean; text: string }) => (c.checked ? "☑ " : "☐ ") + c.text).join(", ")
                      : (note.content || "").replace(/<[^>]*>/g, "")}
                  </p>
                  <span className="text-xs text-muted-foreground/60">
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
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-xs font-bold text-white">
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
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                          {recipients.slice(0, 2).join(", ")}{recipients.length > 2 ? ` +${recipients.length - 2}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {note.checklistItems?.length > 0
                        ? note.checklistItems.map((c: { checked: boolean; text: string }) => (c.checked ? "☑ " : "☐ ") + c.text).join(", ")
                        : (note.content || "").replace(/<[^>]*>/g, "")}
                    </p>
                    <span className="text-xs text-muted-foreground/60">
                      {formatDate(note.updatedAt)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div> */}

            {/* History Section */}
            {/* <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
              Note History
            </span>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-2">
              {historyList.length === 0 ? (
                <p className="text-sm text-muted-foreground/60 italic">No notes found.</p>
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
                    className="group rounded-md border p-2.5 bg-background hover:bg-accent/40 cursor-pointer transition-colors text-left flex flex-col justify-between h-28 shrink-0 border-l-4 text-foreground overflow-hidden"
                    style={{
                      backgroundColor: note.color || undefined,
                      borderLeftColor: note.color ? "rgba(0,0,0,0.15)" : "#e2e8f0",
                    }}
                  >
                    <div className="flex-1 overflow-hidden min-h-0 flex flex-col gap-0.5">
                      {note.thread?.board?.name && (
                        <p className="text-xs font-bold uppercase tracking-wider text-primary/80 line-clamp-1 shrink-0">
                          {note.thread.board.name}
                        </p>
                      )}
                      <p className="text-sm font-bold line-clamp-1 group-hover:text-primary shrink-0">
                        {toTitleCase(note.title || note.thread?.title || "Untitled Note")}
                      </p>
                      {note.checklistItems && note.checklistItems.length > 0 ? (
                        <div className="flex flex-col gap-0.5 my-0.5 overflow-hidden">
                          {note.checklistItems.slice(0, 2).map((item: { id?: string; checked: boolean; text: string }, idx: number) => (
                            <div key={item.id || idx} className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                              <span className={cn("text-xs shrink-0", item.checked ? "text-primary font-bold" : "text-muted-foreground/60")}>
                                {item.checked ? "☑" : "☐"}
                              </span>
                              <span className={cn("truncate leading-tight", item.checked && "line-through text-muted-foreground/60")}>
                                {toTitleCase(item.text)}
                              </span>
                            </div>
                          ))}
                          {note.checklistItems.length > 2 && (
                            <span className="text-xs text-muted-foreground/60 italic pl-0.5 shrink-0">
                              +{note.checklistItems.length - 2} more items
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-tight">
                          {(note.content || "").replace(/<[^>]*>/g, "")}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground/60 shrink-0 mt-auto">
                      {formatDate(note.updatedAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div> */}
          </aside>
        )}

        {/* ── Main Board Workspace ── */}
        <main
          className="flex-1 flex flex-col overflow-hidden m-4 rounded-2xl border shadow-md relative"
          style={{
            backgroundImage: "url('https://thephotoargus.com/wp-content/uploads/2019/09/SunsetHtin.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Header */}
          <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0 bg-black/35 backdrop-blur-sm text-white rounded-t-2xl">
            <div className="flex items-center gap-3">
              {!isSidebarOpen && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-white/20 transition-colors border border-white/15 cursor-pointer"
                  title="Open Navigation"
                >
                  <PanelLeftOpen size={15} />
                  {/* <span>Open Navigation</span> */}
                </button>
              )}
              <h1 className="text-base font-bold text-white">
                {activeBoard ? activeBoard.name : "iNotes"}
              </h1>
            </div>
            {activeBoardId && activeBoard && (activeBoard.ownerId === userId || isManager) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Edit Board"
                  onClick={() => setEditingBoard({ id: activeBoard.id, name: activeBoard.name })}
                  className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-white/20 transition-colors border border-white/15 cursor-pointer"
                >
                  <Pencil size={13} />
                  Edit Board
                </button>
                <button
                  type="button"
                  title="Share Board"
                  onClick={() =>
                    setSharingItem({
                      type: "board",
                      id: activeBoard.id,
                      existingShares: [],
                    })
                  }
                  className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-white/20 transition-colors border border-white/15 cursor-pointer"
                >
                  <Share2 size={13} />
                  Share Board
                </button>
                <button
                  type="button"
                  title="Delete Board"
                  onClick={() => handleDeleteBoard(activeBoard.id)}
                  className="flex items-center gap-1.5 rounded-md bg-red-500/20 text-red-100 border border-red-400/30 px-3 py-1.5 text-xs font-semibold shadow hover:bg-red-500/30 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  Delete Board
                </button>
                <button
                  onClick={() => setShowNewThread(true)}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Plus size={14} />
                  New List
                </button>
              </div>
            )}
          </div>

          {/* Content columns */}
          {loadingThreads ? (
            <div className="flex-1 flex items-center text-white justify-center text-sm text-muted-foreground">
              Loading Workspace Lists...
            </div>
          ) : threads.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-transparent backdrop-blur-xl">
              <h2 className="text-sm font-semibold text-foreground text-white">
                Your Board is a Fresh Start
              </h2>
              {activeBoardId && (
                <button
                  onClick={() => setShowNewThread(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow hover:opacity-95"
                >
                  <Plus size={14} />
                  New List
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
              className="flex-1 flex items-start gap-5 overflow-x-auto p-6 cursor-grab active:cursor-grabbing select-none [scrollbar-width:thin]"
            >
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  draggable
                  onDragStart={(e) => handleDragThreadStart(e, thread.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, thread.id)}
                  className="w-80 shrink-0 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-lg flex flex-col max-h-full"
                >
                  {/* Thread Header */}
                  <div className="flex items-center justify-between p-3.5 border-b border-white/10 shrink-0">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-white">
                        {toTitleCase(thread.title)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(thread.authorId === userId || isManager) && (
                        <>
                          <button
                            type="button"
                            title="Edit List"
                            onClick={() => setEditingThread({ id: thread.id, title: thread.title })}
                            className="rounded p-1 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            title="Share List"
                            onClick={() =>
                              setSharingItem({
                                type: "thread",
                                id: thread.id,
                                existingShares: thread.shares.map((s) => s.userId),
                              })
                            }
                            className="rounded p-1 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                          >
                            <Share2 size={12} />
                          </button>
                          <button
                            type="button"
                            title="Delete List"
                            onClick={() => handleDeleteThread(thread.id)}
                            className="rounded p-1 hover:bg-white/10 text-white/70 hover:text-red-300 transition-colors cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                          <button
                            type="button"
                            title="Add Note"
                            onClick={() => setActiveThreadForNote(thread.id)}
                            className="rounded p-1 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
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
                      <div className="text-center py-6 text-xs text-white/90 font-medium border border-dashed border-white/20 rounded-lg">
                        No Cards. Click + To Add.
                      </div>
                    ) : (
                      thread.notes.map((note) => (
                        <div
                          key={note.id}
                          draggable
                          onDragStart={(e) => handleDragCardStart(e, note.id, thread.id)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => handleDrop(e, thread.id)}
                          onClick={() =>
                            setEditingNote({
                              ...note,
                              checklistItems: note.checklistItems || [],
                              shares: note.shares || [],
                            })
                          }
                          className="rounded-xl border border-white/20 dark:border-white/10 p-3.5 shadow-xs relative flex flex-col justify-between cursor-grab active:cursor-grabbing hover:shadow-md backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 group border-l-4 min-h-[100px] max-h-[220px] shrink-0 overflow-hidden"
                          style={{
                            backgroundColor: note.color ? `${note.color}e6` : "rgba(255, 255, 255, 0.88)",
                            borderLeftColor: note.color ? "rgba(0,0,0,0.2)" : "#3b82f6",
                          }}
                        >
                          {/* Note Card Top Header (Title + Actions Pill) */}
                          <div className="flex items-start justify-between gap-2 shrink-0 mb-2">
                            <h4 className="text-sm font-bold text-foreground line-clamp-2 leading-snug tracking-tight pr-1">
                              {note.title ? toTitleCase(note.title) : "Untitled Note"}
                            </h4>
                            {note.authorId === userId && (
                              <div className="flex items-center gap-1.5 bg-white/90 dark:bg-card/90 backdrop-blur-md px-2 py-1 rounded-xl shadow-2xs border border-border/40 shrink-0">
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
                                  className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                  <Share2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  title="Delete Note"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteNote(note.id);
                                  }}
                                  className="rounded p-0.5 hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Note Content (Text preview) */}
                          <div className="flex-1 overflow-hidden min-h-0 flex flex-col gap-2">
                            {note.content && (
                              <div
                                className="html-content text-xs text-foreground/80 leading-relaxed line-clamp-3 overflow-hidden select-none"
                                dangerouslySetInnerHTML={{ __html: note.content }}
                              />
                            )}

                            {/* Checklist items list matching exact screenshot design */}
                            {note.checklistItems.length > 0 && (
                              <div className="flex flex-col gap-1.5 mt-1 border-t border-foreground/10 pt-2 overflow-hidden">
                                {note.checklistItems.slice(0, 3).map((item) => (
                                  <div
                                    key={item.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (note.authorId === userId) {
                                        handleToggleChecklistItem(item.id);
                                      }
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 rounded px-1 py-0.5",
                                      note.authorId === userId ? "hover:bg-black/5 cursor-pointer" : "cursor-default opacity-85"
                                    )}
                                  >
                                    <button type="button" className="shrink-0">
                                      {item.checked ? (
                                        <CheckSquare size={14} className="text-primary" />
                                      ) : (
                                        <Square size={14} className="text-muted-foreground/60" />
                                      )}
                                    </button>
                                    <span
                                      className={cn(
                                        "text-xs text-foreground leading-tight select-none truncate font-medium",
                                        item.checked && "text-muted-foreground line-through font-normal"
                                      )}
                                    >
                                      {toTitleCase(item.text)}
                                    </span>
                                  </div>
                                ))}
                                {note.checklistItems.length > 3 && (
                                  <span className="text-xs text-muted-foreground/60 font-medium pl-1 pt-0.5">
                                    +{note.checklistItems.length - 3} more items
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Deadline Indicator */}
                          {note.deadline && (
                            <div className="flex items-center gap-1 text-xs text-amber-700/80 mt-1 font-medium bg-amber-500/10 px-2 py-0.5 rounded-full w-fit shrink-0">
                              <Calendar size={11} />
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
                  Share {sharingItem.type === "board" ? "Board" : sharingItem.type === "thread" ? "List" : "Note"}
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
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
                            <span>{u.name || formatFallbackName(u.email)}</span>
                            <span className="text-xs text-muted-foreground/60 font-normal leading-none mt-0.5">
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
                <span className="text-sm font-bold text-foreground">New List</span>
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
                  <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">
                    Title Of List
                  </label>
                  <input
                    type="text"
                    value={threadTitle}
                    onChange={(e) => setThreadTitle(e.target.value)}
                    placeholder="Enter Text Here..."
                    className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    maxLength={120}
                    required
                  />
                </div>

                {/* <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Share This Note/List With
                  </label>
                  <div className="flex flex-wrap gap-1 border rounded-md p-2 bg-background/50">
                    {threadSharedUsers.length === 0 ? (
                      <span className="text-xs text-muted-foreground/60 italic p-1">
                        No One Selected (Draft / Personal)
                      </span>
                    ) : (
                      threadSharedUsers.map((id) => {
                        const userObj = allUsers.find((u) => u.id === id);
                        return (
                          <div
                            key={id}
                            className="flex items-center gap-1 bg-accent rounded-full pl-2 pr-1.5 py-0.5 text-xs text-accent-foreground font-medium"
                          >
                            <span>{userObj?.name || formatFallbackName(userObj?.email || "")}</span>
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
                        + Add People
                      </option>
                      {allUsers
                        .filter((u) => u.id !== userId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || formatFallbackName(u.email)}
                          </option>
                        ))}
                    </select>
                  </div>
                </div> */}

                {/* Initial Note Workspace */}
                <div
                  className="border rounded-lg p-4 flex flex-col gap-2.5"
                  style={{ backgroundColor: threadColor }}
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase">
                      Card Title
                    </label>
                    <input
                      type="text"
                      value={threadNoteTitle}
                      onChange={(e) => setThreadNoteTitle(e.target.value)}
                      placeholder="Enter card title..."
                      className="rounded-md border bg-background px-2.5 py-1 text-xs outline-none focus:border-ring"
                      maxLength={120}
                    />
                  </div>
                  {/* Note Type Selector */}
                  {/* <div className="flex gap-1 bg-black/5 rounded p-0.5 self-start mb-1">
                    <button
                      type="button"
                      onClick={() => setThreadNoteType("TEXT")}
                      className={cn(
                        "px-3 py-1 text-xs font-semibold rounded transition-colors",
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
                        "px-3 py-1 text-xs font-semibold rounded transition-colors",
                        threadNoteType === "CHECKLIST"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Checklist
                    </button>
                  </div> */}

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
                            placeholder={`Checklist Item ${idx + 1}`}
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
                        className="flex items-center gap-1 text-xs font-semibold text-primary self-start mt-1"
                      >
                        <Plus size={11} /> Add Item
                      </button>
                    </div>
                  )}

                  {/* Deadline */}
                  {/* <div className="flex flex-col gap-1 border-t pt-3 mt-1.5 border-black/5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">
                      Deadline (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={threadDeadline}
                      onChange={(e) => setThreadDeadline(e.target.value)}
                      className="bg-transparent border rounded p-1 text-xs outline-none max-w-[180px]"
                    />
                  </div> */}

                  {/* Color Picker */}
                  <div className="flex flex-col gap-1 mt-2 border-t pt-2 border-black/5">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase">
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
              className="w-full max-w-3xl max-h-[88vh] rounded-xl bg-card border p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="flex items-center justify-between border-b pb-3 shrink-0">
                <span className="text-sm font-bold text-foreground">Add Card To Column</span>
                <button
                  type="button"
                  onClick={() => setActiveThreadForNote(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[82vh] pr-1">
                <div
                  className="border rounded-lg p-4 flex flex-col gap-2.5"
                  style={{ backgroundColor: noteColor }}
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase">
                      Card Title
                    </label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Enter card title..."
                      className="rounded-md border bg-background px-2.5 py-1 text-xs outline-none focus:border-ring"
                      maxLength={120}
                    />
                  </div>
                  {/* Note Type Selector */}
                  {/* <div className="flex gap-1 bg-black/5 rounded p-0.5 self-start mb-1">
                    <button
                      type="button"
                      onClick={() => setNoteNoteType("TEXT")}
                      className={cn(
                        "px-3 py-1 text-xs font-semibold rounded transition-colors",
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
                        "px-3 py-1 text-xs font-semibold rounded transition-colors",
                        noteNoteType === "CHECKLIST"
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Checklist
                    </button>
                  </div> */}

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
                            placeholder={`Checklist Item ${idx + 1}`}
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
                        className="flex items-center gap-1 text-xs font-semibold text-primary self-start mt-1"
                      >
                        <Plus size={11} /> Add Item
                      </button>
                    </div>
                  )}

                  {/* Deadline */}
                  {/* <div className="flex flex-col gap-1 border-t pt-3 mt-1.5 border-black/5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">
                      Deadline (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={noteDeadline}
                      onChange={(e) => setNoteDeadline(e.target.value)}
                      className="bg-transparent border rounded p-1 text-xs outline-none max-w-[180px]"
                    />
                  </div> */}

                  {/* Color Picker */}
                  <div className="flex flex-col gap-1 mt-2 border-t pt-2 border-black/5">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase">
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
                className="w-full max-w-3xl max-h-[88vh] rounded-xl bg-card border p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100"
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

                <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[82vh] pr-1">
                  <div
                    className="border rounded-lg p-4 flex flex-col gap-2.5"
                    style={{ backgroundColor: editingNote.color || "#ffffff" }}
                  >
                    {/* Card Title */}
                    {isEditingReadOnly ? (
                      editingNote.title && (
                        <h3 className="text-base font-bold text-foreground mb-1.5">{toTitleCase(editingNote.title)}</h3>
                      )
                    ) : (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Card Title
                        </label>
                        <input
                          type="text"
                          value={editingNote.title || ""}
                          onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                          placeholder="Enter card title..."
                          className="rounded-md border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
                          maxLength={120}
                        />
                      </div>
                    )}
                    {/* Text Content */}
                    {isEditingReadOnly ? (
                      <div
                        className="text-sm text-foreground bg-background rounded-lg border p-3.5 leading-relaxed html-content text-left"
                        dangerouslySetInnerHTML={{ __html: editingNote.content || "" }}
                      />
                    ) : (
                      <div className="bg-background text-foreground rounded border text-sm max-w-full overflow-hidden">
                        <RichTextEditor
                          value={editingNote.content || ""}
                          onChange={(val) =>
                            setEditingNote({ ...editingNote, content: val })
                          }
                        />
                      </div>
                    )}

                    {/* Checklist Section */}
                    {/* <div className="flex flex-col gap-2 border-t pt-3 mt-1.5 border-black/5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">
                        Checklist
                      </label>
                      {editingNote.checklistItems.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {editingNote.checklistItems.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              draggable={!isEditingReadOnly}
                              onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData("text/plain", JSON.stringify({ type: "todo", index: idx }));
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  const raw = e.dataTransfer.getData("text/plain");
                                  if (!raw) return;
                                  const data = JSON.parse(raw);
                                  if (data.type === "todo" && typeof data.index === "number" && data.index !== idx) {
                                    const newItems = [...editingNote.checklistItems];
                                    const [dragged] = newItems.splice(data.index, 1);
                                    newItems.splice(idx, 0, dragged);
                                    setEditingNote({ ...editingNote, checklistItems: newItems });
                                  }
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="flex items-center gap-2 p-1 rounded hover:bg-black/5 cursor-grab active:cursor-grabbing group/todo"
                            >
                              {!isEditingReadOnly && (
                                <div className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground shrink-0 flex items-center">
                                  <GripVertical size={12} />
                                </div>
                              )}
                              {item.checked ? (
                                <CheckSquare size={13} className="text-primary shrink-0" />
                              ) : (
                                <Square size={13} className="text-muted-foreground/40 shrink-0" />
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
                                    placeholder={`Checklist Item ${idx + 1}`}
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
                          className="flex items-center gap-1 text-xs font-semibold text-primary self-start mt-1"
                        >
                          <Plus size={11} /> Add Checklist Item
                        </button>
                      )}
                    </div> */}

                    {/* Deadline */}
                    {/* <div className="flex flex-col gap-1 border-t pt-3 mt-1.5 border-black/5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">
                        Deadline (Optional)
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
                        className="bg-transparent border rounded p-1 text-xs outline-none max-w-[180px] disabled:opacity-75"
                      />
                    </div> */}

                    {/* Color Picker */}
                    <div className="flex flex-col gap-1 mt-2 border-t pt-2 border-black/5">
                      <label className="text-xs font-bold text-muted-foreground uppercase">
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

        {/* 5. Edit Board Dialog Overlay */}
        {editingBoard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs">
            <form
              onSubmit={handleUpdateBoard}
              className="w-full max-w-md rounded-xl bg-card border p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-sm font-bold text-foreground">Edit Board</span>
                <button
                  type="button"
                  onClick={() => setEditingBoard(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Board Name
                </label>
                <input
                  type="text"
                  value={editingBoard.name}
                  onChange={(e) => setEditingBoard({ ...editingBoard, name: e.target.value })}
                  placeholder="Enter board name..."
                  className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  maxLength={60}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingBoard(null)}
                  className="rounded-md border px-4 py-2 text-xs hover:bg-accent font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold shadow hover:opacity-90 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 6. Edit List (Thread) Dialog Overlay */}
        {editingThread && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs">
            <form
              onSubmit={handleUpdateThread}
              className="w-full max-w-md rounded-xl bg-card border p-6 shadow-xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-sm font-bold text-foreground">Edit List</span>
                <button
                  type="button"
                  onClick={() => setEditingThread(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  List Title
                </label>
                <input
                  type="text"
                  value={editingThread.title}
                  onChange={(e) => setEditingThread({ ...editingThread, title: e.target.value })}
                  placeholder="Enter list title..."
                  className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  maxLength={120}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingThread(null)}
                  className="rounded-md border px-4 py-2 text-xs hover:bg-accent font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold shadow hover:opacity-90 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
  );
}
