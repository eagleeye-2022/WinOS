"use client";

import { useRef, useState } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import { CellSelection } from "@tiptap/pm/tables";
import {
  Asterisk,
  Bold,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  ListTodo,
  Loader2,
  Paperclip,
  Redo2,
  Rows3,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { sopDocExtensions } from "./sop-extensions";
import type { DocNode } from "../doc";
import "./sop-doc.css";

interface SopDocEditorProps {
  /** Initial document — the editor is uncontrolled; remount it (key) to load another SOP. */
  initialContent: DocNode;
  onChange: (doc: DocNode) => void;
}

async function uploadImage(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: formData });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.fileUrl === "string" ? data.fileUrl : null;
  } catch (err) {
    console.error("Failed to upload SOP image:", err);
    return null;
  }
}

/**
 * Turns the selection into checkboxes. Inside a table with several cells selected (e.g. a column
 * pasted from Excel), each non-empty cell becomes its own checkbox; elsewhere it's a plain
 * checkbox-list toggle over the selected lines.
 */
function convertToCheckboxes(editor: Editor) {
  const { selection } = editor.state;
  if (selection instanceof CellSelection) {
    const cells: { pos: number; size: number }[] = [];
    selection.forEachCell((node, pos) => {
      if (node.textContent.trim() && node.firstChild?.type.name !== "taskList") {
        cells.push({ pos, size: node.nodeSize });
      }
    });
    // Last cell first, so converting one doesn't shift the positions of the ones still to do.
    cells.sort((a, b) => b.pos - a.pos);
    for (const c of cells) {
      editor.chain().setTextSelection({ from: c.pos + 1, to: c.pos + c.size - 1 }).toggleTaskList().run();
    }
    editor.commands.focus();
    return;
  }
  editor.chain().focus().toggleTaskList().run();
}

export default function SopDocEditor({ initialContent, onChange }: SopDocEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const insertImages = async (files: File[], editor: Editor | null) => {
    if (!editor || files.length === 0) return;
    setIsUploading(true);
    for (const file of files) {
      const url = await uploadImage(file);
      if (url) editor.chain().focus().setImage({ src: url }).run();
      else toast.error(`Couldn't upload ${file.name}`);
    }
    setIsUploading(false);
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: sopDocExtensions({ editable: true }),
    content: initialContent,
    editorProps: {
      attributes: { class: "sop-doc min-h-[320px] p-4" },
      handlePaste: (_view, event) => {
        const data = event.clipboardData;
        // Excel/Sheets put both an HTML table and a picture of the range on the clipboard — keep
        // the table. Only a clipboard with nothing but images is treated as an image paste.
        if (!data || data.types.includes("text/html") || data.types.includes("text/plain")) return false;
        const images = Array.from(data.files).filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return false;
        event.preventDefault();
        insertImages(images, editor);
        return true;
      },
      handleDrop: (_view, event, _slice, moved) => {
        const images = Array.from(event.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
        if (moved || images.length === 0) return false;
        event.preventDefault();
        insertImages(images, editor);
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as DocNode),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      return {
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        h1: e.isActive("heading", { level: 1 }),
        h2: e.isActive("heading", { level: 2 }),
        h3: e.isActive("heading", { level: 3 }),
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        highlight: e.isActive("highlight"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        taskList: e.isActive("taskList"),
        inTaskItem: e.isActive("taskItem"),
        required: e.isActive("taskItem", { required: true }),
        proof: e.isActive("taskItem", { proof: true }),
        inTable: e.isActive("table"),
        link: e.isActive("link"),
      };
    },
  });

  if (!editor || !state) {
    return <div className="h-[360px] animate-pulse rounded-md border bg-muted/40" />;
  }

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave empty to remove):", previous || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(url) || /^mailto:/i.test(url) ? url.trim() : `https://${url.trim()}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  const btn = (active: boolean) =>
    cn(
      "rounded p-1.5 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:hover:bg-transparent",
      active ? "bg-primary/10 text-primary" : "text-muted-foreground"
    );
  const sep = <div className="mx-1 h-5 w-px bg-border" />;

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-muted/60 p-1.5 backdrop-blur">
        <button type="button" className={btn(false)} disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo2 size={14} />
        </button>
        <button type="button" className={btn(false)} disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo2 size={14} />
        </button>
        {sep}
        <button type="button" className={btn(state.h1)} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
          <Heading1 size={14} />
        </button>
        <button type="button" className={btn(state.h2)} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          <Heading2 size={14} />
        </button>
        <button type="button" className={btn(state.h3)} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          <Heading3 size={14} />
        </button>
        {sep}
        <button type="button" className={btn(state.bold)} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold size={14} />
        </button>
        <button type="button" className={btn(state.italic)} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic size={14} />
        </button>
        <button type="button" className={btn(state.underline)} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <UnderlineIcon size={14} />
        </button>
        <button type="button" className={btn(state.strike)} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough size={14} />
        </button>
        <button type="button" className={btn(state.highlight)} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Highlight">
          <Highlighter size={14} />
        </button>
        <button type="button" className={btn(state.link)} onClick={setLink} title="Link">
          <Link2 size={14} />
        </button>
        {sep}
        <button type="button" className={btn(state.bulletList)} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List size={14} />
        </button>
        <button type="button" className={btn(state.orderedList)} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <ListOrdered size={14} />
        </button>
        <button type="button" className={btn(state.taskList)} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checkbox list">
          <ListTodo size={14} />
        </button>
        <button
          type="button"
          className={cn(btn(false), "flex items-center gap-1 px-2 text-xs font-semibold")}
          onClick={() => convertToCheckboxes(editor)}
          title="Turn the selected lines (or selected table cells) into checkboxes"
        >
          <ListChecks size={14} /> To checkboxes
        </button>
        <button
          type="button"
          className={cn(btn(state.required), "flex items-center gap-1 px-2 text-xs font-semibold")}
          disabled={!state.inTaskItem}
          onClick={() => editor.chain().focus().updateAttributes("taskItem", { required: !state.required }).run()}
          title="Mark this checkbox as required"
        >
          <Asterisk size={13} /> Required
        </button>
        <button
          type="button"
          className={cn(btn(state.proof), "flex items-center gap-1 px-2 text-xs font-semibold")}
          disabled={!state.inTaskItem}
          onClick={() => editor.chain().focus().updateAttributes("taskItem", { proof: !state.proof }).run()}
          title="Ticking this checkbox needs a proof link"
        >
          <Paperclip size={13} /> Proof
        </button>
        {sep}
        <button
          type="button"
          className={btn(false)}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insert table"
        >
          <TableIcon size={14} />
        </button>
        {state.inTable && (
          <>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row below">
              <Rows3 size={14} />
            </button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column right">
              <Columns3 size={14} />
            </button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row">
              <Rows3 size={14} className="text-destructive" />
            </button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete column">
              <Columns3 size={14} className="text-destructive" />
            </button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">
              <Trash2 size={14} className="text-destructive" />
            </button>
          </>
        )}
        {sep}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            insertImages(Array.from(e.target.files || []), editor);
            e.target.value = "";
          }}
        />
        <button type="button" className={btn(false)} disabled={isUploading} onClick={() => fileInputRef.current?.click()} title="Insert image">
          {isUploading ? <Loader2 size={14} className="animate-spin text-primary" /> : <ImageIcon size={14} />}
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
