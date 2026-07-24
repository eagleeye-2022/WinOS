"use client";

import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from "react";
import { User, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type MentionMember = {
  id: string;
  name: string | null;
  email: string;
  role?: string | null;
  title?: string | null;
};

export type MentionFile = {
  id: string;
  title: string;
  subtitle?: string;
};

type MentionInputProps = {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  placeholder?: string;
  className?: string;
  teamMembers?: MentionMember[];
  onSelectMention?: (memberId: string) => void;
  required?: boolean;
};

export function MentionInput({
  value,
  onChange,
  name,
  placeholder,
  className,
  teamMembers = [],
  onSelectMention,
  required,
}: MentionInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"people" | "file">("people");
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fileList, setFileList] = useState<MentionFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [fallbackMembers, setFallbackMembers] = useState<MentionMember[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveMembers = teamMembers.length > 0 ? teamMembers : fallbackMembers;

  // Load files for @file: mode
  useEffect(() => {
    let active = true;
    async function loadFiles() {
      setLoadingFiles(true);
      try {
        const res = await fetch("/api/notes/history");
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mapped: MentionFile[] = data.map((n: any) => ({
              id: n.id,
              title: n.title || n.thread?.title || "Untitled Card",
              subtitle: n.thread?.board?.name || "Workspace Note",
            }));
            setFileList(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to load files for mention:", err);
      } finally {
        if (active) setLoadingFiles(false);
      }
    }

    loadFiles();
    return () => {
      active = false;
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle text input & trigger detection
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || val.length;
    onChange(val);

    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      if (/\s/.test(charBefore) || lastAtIndex === 0) {
        const mentionQuery = textBeforeCursor.slice(lastAtIndex + 1);
        if (!/\s/.test(mentionQuery)) {
          if (mentionQuery.toLowerCase().startsWith("file:")) {
            setMode("file");
            setQuery(mentionQuery.slice(5));
          } else {
            setMode("people");
            setQuery(mentionQuery);
          }
          setIsOpen(true);
          setSelectedIndex(0);
          return;
        }
      }
    }
    setIsOpen(false);
  };

  // Also trigger check on focus or click if cursor is on a mention token
  const handleFocusOrClick = () => {
    if (!inputRef.current) return;
    const val = inputRef.current.value;
    const cursorPos = inputRef.current.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      if (/\s/.test(charBefore) || lastAtIndex === 0) {
        const mentionQuery = textBeforeCursor.slice(lastAtIndex + 1);
        if (!/\s/.test(mentionQuery)) {
          if (mentionQuery.toLowerCase().startsWith("file:")) {
            setMode("file");
            setQuery(mentionQuery.slice(5));
          } else {
            setMode("people");
            setQuery(mentionQuery);
          }
          setIsOpen(true);
          return;
        }
      }
    }
  };

  // Filtered lists
  const filteredMembers = effectiveMembers.filter((m) => {
    const q = query.toLowerCase();
    return (
      (m.name || "").toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.title || "").toLowerCase().includes(q)
    );
  });

  const filteredFiles = fileList.filter((f) => {
    const q = query.toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      (f.subtitle || "").toLowerCase().includes(q)
    );
  });

  const activeItemsCount =
    mode === "people" ? filteredMembers.length : filteredFiles.length;

  const selectMember = (member: MentionMember) => {
    const nameStr = member.name || member.email.split("@")[0];
    const mentionText = `@${nameStr} `;

    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    const newTextBefore = value.slice(0, lastAtIndex) + mentionText;
    const newValue = newTextBefore + textAfterCursor.replace(/^\s*/, "");
    const newCursorPos = newTextBefore.length;

    onChange(newValue);
    if (onSelectMention) onSelectMention(member.id);
    setIsOpen(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const selectFile = (file: MentionFile) => {
    const fileText = `📄 ${file.title} `;

    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    const newTextBefore = value.slice(0, lastAtIndex) + fileText;
    const newValue = newTextBefore + textAfterCursor.replace(/^\s*/, "");
    const newCursorPos = newTextBefore.length;

    onChange(newValue);
    setIsOpen(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, activeItemsCount));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? Math.max(0, activeItemsCount - 1) : prev - 1
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (activeItemsCount > 0) {
        e.preventDefault();
        if (mode === "people" && filteredMembers[selectedIndex]) {
          selectMember(filteredMembers[selectedIndex]);
        } else if (mode === "file" && filteredFiles[selectedIndex]) {
          selectFile(filteredFiles[selectedIndex]);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        name={name}
        value={value}
        onChange={handleInputChange}
        onClick={handleFocusOrClick}
        onFocus={handleFocusOrClick}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Type @ for people, @file: for files"}
        required={required}
        className={cn(
          "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50",
          className
        )}
      />

      {/* Mention Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full z-[9999] mt-1.5 w-72 rounded-xl border bg-card p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1">
              {mode === "people" ? (
                <>
                  <User size={12} className="text-primary" /> Mention Member
                </>
              ) : (
                <>
                  <FileText size={12} className="text-emerald-500" /> Mention File / Note
                </>
              )}
            </span>
            <span className="text-[9px] font-normal text-muted-foreground/60">
              {mode === "people" ? "Type @file: for files" : "Type @ for members"}
            </span>
          </div>

          {/* Body List */}
          <div className="max-h-48 overflow-y-auto py-1">
            {mode === "people" ? (
              filteredMembers.length === 0 ? (
                <div className="p-2.5 text-center text-xs text-muted-foreground/60 italic">
                  No matching members found
                </div>
              ) : (
                filteredMembers.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMember(m)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                      selectedIndex === idx
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                      {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">
                        {m.name ?? m.email}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {m.title || m.role || m.email}
                      </p>
                    </div>
                  </button>
                ))
              )
            ) : loadingFiles ? (
              <div className="p-2.5 text-center text-xs text-muted-foreground/60">
                Loading files...
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-2.5 text-center text-xs text-muted-foreground/60 italic">
                No matching files found
              </div>
            ) : (
              filteredFiles.map((f, idx) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => selectFile(f)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                    selectedIndex === idx
                      ? "bg-emerald-500/10 text-emerald-600 font-medium"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <FileText size={14} className="shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {f.title}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {f.subtitle}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
