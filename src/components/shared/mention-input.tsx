"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { FileText } from "lucide-react";
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
  /** Initial plain text content. Only read on mount — pass a `key` prop to reset the editor. */
  defaultValue?: string;
  /** Mentions to hydrate inline at the start of the content on mount (e.g. previously saved mentions). */
  defaultMentions?: MentionMember[];
  /** Fires on every edit with the current plain text and the ordered list of mentioned user ids. */
  onChange: (value: string, mentionIds: string[]) => void;
  name?: string;
  placeholder?: string;
  className?: string;
  teamMembers?: MentionMember[];
  required?: boolean;
  autoFocus?: boolean;
  onEnterSubmit?: () => void;
};

function memberLabel(m: { name: string | null; email: string }): string {
  return (m.name?.split(" ")[0] || m.email.split("@")[0]) ?? "";
}

/** Deletes `count` characters immediately before the caret and returns a collapsed range at the cut point. */
function removeCharsBeforeCaret(root: HTMLElement, count: number): Range | null {
  if (count <= 0) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const { startContainer, startOffset } = range;

  // Fast path: the "@query" text lives entirely within the current text node.
  if (startContainer.nodeType === Node.TEXT_NODE && startOffset >= count) {
    const textNode = startContainer as Text;
    textNode.deleteData(startOffset - count, count);
    const r = document.createRange();
    r.setStart(textNode, startOffset - count);
    r.collapse(true);
    return r;
  }

  // Fallback for cases where the browser split the text across nodes.
  const selAny = sel as Selection & { modify?: (a: string, b: string, c: string) => void };
  if (typeof selAny.modify === "function") {
    for (let i = 0; i < count; i++) selAny.modify("extend", "backward", "character");
    const r = sel.getRangeAt(0);
    r.deleteContents();
    r.collapse(true);
    return r;
  }
  return null;
}

function getTextBeforeCaret(root: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return "";
  const preRange = document.createRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString();
}

function placeCaretAtEnd(root: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export function MentionInput({
  defaultValue = "",
  defaultMentions = [],
  onChange,
  name,
  placeholder,
  className,
  teamMembers = [],
  required,
  autoFocus,
  onEnterSubmit,
}: MentionInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"people" | "file">("people");
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fileList, setFileList] = useState<MentionFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [fallbackMembers, setFallbackMembers] = useState<MentionMember[]>([]);
  const [hiddenValue, setHiddenValue] = useState(defaultValue);

  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveMembers = teamMembers.length > 0 ? teamMembers : fallbackMembers;

  // Hydrate initial content (mentions + free text) once on mount.
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    root.innerHTML = "";

    // `defaultValue` already has "@Label" embedded wherever the user typed the mention
    // (MentionInput's onChange emits root.textContent, mentions included). Rebuild the
    // mention chips in place instead of re-prefixing them, or they'd render twice.
    let rebuiltInline = false;
    if (defaultMentions.length > 0 && defaultValue) {
      const byLabel = defaultMentions
        .map((m) => ({ member: m, label: `@${memberLabel(m)}` }))
        .sort((a, b) => b.label.length - a.label.length); // longest first avoids partial overlaps
      const escaped = byLabel.map((l) => l.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const pattern = new RegExp(`(${escaped.join("|")})`, "g");

      if (pattern.test(defaultValue)) {
        pattern.lastIndex = 0;
        defaultValue.split(pattern).forEach((part) => {
          const match = byLabel.find((l) => l.label === part);
          if (match) {
            root.appendChild(createMentionNode(match.member));
          } else if (part) {
            root.appendChild(document.createTextNode(part));
          }
        });
        rebuiltInline = true;
      }
    }

    if (!rebuiltInline) {
      defaultMentions.forEach((m) => {
        root.appendChild(createMentionNode(m));
        root.appendChild(document.createTextNode(" "));
      });
      if (defaultValue) {
        root.appendChild(document.createTextNode(defaultValue));
      }
    }
    setHiddenValue(root.textContent ?? "");
    if (autoFocus) {
      root.focus();
      placeCaretAtEnd(root);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function createMentionNode(member: MentionMember): HTMLSpanElement {
    const span = document.createElement("span");
    span.contentEditable = "false";
    span.dataset.mentionId = member.id;
    span.className =
      "mx-px inline-block select-none rounded bg-primary/10 px-1 font-semibold text-primary";
    span.textContent = `@${memberLabel(member)}`;
    return span;
  }

  function collectMentionIds(root: HTMLElement): string[] {
    const ids: string[] = [];
    root.querySelectorAll<HTMLElement>("[data-mention-id]").forEach((el) => {
      const id = el.dataset.mentionId;
      if (id && !ids.includes(id)) ids.push(id);
    });
    return ids;
  }

  function emitChange() {
    const root = editorRef.current;
    if (!root) return;
    // Chrome/Firefox sometimes leave a stray empty text node/<br> after the last character is deleted.
    if (root.textContent === "") root.innerHTML = "";
    const text = root.textContent ?? "";
    setHiddenValue(text);
    onChange(text, collectMentionIds(root));
  }

  function detectTrigger(root: HTMLElement) {
    const textBeforeCursor = getTextBeforeCaret(root);
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
  }

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    emitChange();
    detectTrigger(e.currentTarget);
  };

  const handleFocusOrClick = (e: ReactMouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) => {
    detectTrigger(e.currentTarget);
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const root = editorRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    const after = document.createRange();
    after.setStartAfter(node);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    emitChange();
    detectTrigger(root);
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

  function insertNodeReplacingQuery(node: Node & ChildNode, removeLen: number, trailing = " ") {
    const root = editorRef.current;
    if (!root) return;
    root.focus();
    const range = removeCharsBeforeCaret(root, removeLen);
    if (!range) return;
    range.insertNode(node);
    const spaceNode = document.createTextNode(trailing);
    node.after(spaceNode);

    const after = document.createRange();
    after.setStartAfter(spaceNode);
    after.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(after);

    setIsOpen(false);
    emitChange();
  }

  const selectMember = (member: MentionMember) => {
    insertNodeReplacingQuery(createMentionNode(member), 1 + query.length);
  };

  const selectFile = (file: MentionFile) => {
    insertNodeReplacingQuery(document.createTextNode(`📄 ${file.title}`), 1 + 5 + query.length);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      if (isOpen && activeItemsCount > 0) {
        e.preventDefault();
        if (mode === "people" && filteredMembers[selectedIndex]) {
          selectMember(filteredMembers[selectedIndex]);
        } else if (mode === "file" && filteredFiles[selectedIndex]) {
          selectFile(filteredFiles[selectedIndex]);
        }
      } else {
        if (onEnterSubmit) {
          e.preventDefault();
          onEnterSubmit();
        } else {
          const form = editorRef.current?.closest("form");
          if (form) {
            e.preventDefault();
            form.requestSubmit();
          } else {
            e.preventDefault();
          }
        }
      }
      return;
    }

    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, activeItemsCount));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? Math.max(0, activeItemsCount - 1) : prev - 1
      );
    } else if (e.key === "Tab") {
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
      {name && <input type="hidden" name={name} value={hiddenValue} required={required} />}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="false"
        aria-required={required}
        data-placeholder={placeholder || "Type @ for people, @file: for files"}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleFocusOrClick}
        onFocus={handleFocusOrClick}
        onPaste={handlePaste}
        className={cn(
          "w-full whitespace-pre-wrap break-words rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none",
          className
        )}
      />

      {/* Mention Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full z-[9999] mt-1.5 w-72 rounded-xl border bg-card p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
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
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectMember(m)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                      selectedIndex === idx
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">
                        {m.name ?? m.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectFile(f)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                    selectedIndex === idx
                      ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <FileText size={14} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {f.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
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
