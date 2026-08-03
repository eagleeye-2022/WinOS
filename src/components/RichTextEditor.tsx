import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Highlighter,
  Quote,
  Undo2,
  Redo2,
  Link2,
  Unlink,
  Terminal,
  Image as ImageIcon,
  Upload,
  Loader2,
} from "lucide-react";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Highlight } from "@tiptap/extension-highlight";
import { cn } from "@/lib/utils";

// Import custom SCSS node styles
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadAndInsertImage = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fileUrl) {
          editor?.chain().focus().setImage({ src: data.fileUrl }).run();
          setIsUploading(false);
          return;
        }
      }
    } catch (err) {
      console.error("Failed to upload image to /api/uploads", err);
    }

    // Fallback to base64 Data URL
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string" && editor) {
        editor.chain().focus().setImage({ src: reader.result }).run();
      }
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline hover:text-primary/80 transition-colors",
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg shadow-xs my-2 inline-block border border-border/50",
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none min-h-[160px] p-3 text-sm leading-relaxed text-foreground",
      },
      handlePaste: (_view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItems = items.filter((item) => item.type.startsWith("image/"));
        if (imageItems.length > 0) {
          event.preventDefault();
          imageItems.forEach((item) => {
            const file = item.getAsFile();
            if (file) {
              uploadAndInsertImage(file);
            }
          });
          return true;
        }
        return false;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files?.length) {
          const files = Array.from(event.dataTransfer.files).filter((file) =>
            file.type.startsWith("image/")
          );
          if (files.length > 0) {
            event.preventDefault();
            files.forEach((file) => {
              uploadAndInsertImage(file);
            });
            return true;
          }
        }
        return false;
      },
    },
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external changes safely
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl);

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    let href = url;
    if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href) && !/^#/i.test(href) && !/^\//i.test(href)) {
      href = `https://${href}`;
    }

    if (editor.state.selection.empty) {
      editor.chain().focus().insertContent(`<a href="${href}">${url}</a>`).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
  };

  const toolbarBtnClass = (active: boolean) =>
    cn(
      "p-1.5 rounded transition-colors hover:bg-accent hover:text-accent-foreground",
      active ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground"
    );

  return (
    <div className="flex flex-col w-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/40">
        {/* Undo/Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={toolbarBtnClass(false)}
          title="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={toolbarBtnClass(false)}
          title="Redo"
        >
          <Redo2 size={14} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={toolbarBtnClass(editor.isActive("heading", { level: 1 }))}
          title="Heading 1"
        >
          <Heading1 size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={toolbarBtnClass(editor.isActive("heading", { level: 2 }))}
          title="Heading 2"
        >
          <Heading2 size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={toolbarBtnClass(editor.isActive("heading", { level: 3 }))}
          title="Heading 3"
        >
          <Heading3 size={14} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Formatting marks */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={toolbarBtnClass(editor.isActive("bold"))}
          title="Bold"
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={toolbarBtnClass(editor.isActive("italic"))}
          title="Italic"
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={toolbarBtnClass(editor.isActive("underline"))}
          title="Underline"
        >
          <UnderlineIcon size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={toolbarBtnClass(editor.isActive("strike"))}
          title="Strike"
        >
          <Strikethrough size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={toolbarBtnClass(editor.isActive("code"))}
          title="Inline Code"
        >
          <Code size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={toolbarBtnClass(editor.isActive("highlight"))}
          title="Highlight"
        >
          <Highlighter size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={toolbarBtnClass(editor.isActive("codeBlock"))}
          title="Code Block"
        >
          <Terminal size={14} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={toolbarBtnClass(editor.isActive("bulletList"))}
          title="Bullet List"
        >
          <List size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={toolbarBtnClass(editor.isActive("orderedList"))}
          title="Numbered List"
        >
          <ListOrdered size={14} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={toolbarBtnClass(editor.isActive("taskList"))}
          title="Todo List"
        >
          <ListTodo size={14} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Links */}
        <button
          type="button"
          onClick={setLink}
          className={toolbarBtnClass(editor.isActive("link"))}
          title="Link"
        >
          <Link2 size={14} />
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className={toolbarBtnClass(false)}
            title="Unlink"
          >
            <Unlink size={14} />
          </button>
        )}

        <div className="w-px h-5 bg-border mx-1" />

        {/* Blockquote */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={toolbarBtnClass(editor.isActive("blockquote"))}
          title="Quote"
        >
          <Quote size={14} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Image Upload, Paste & URL */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach((file) => {
              if (file.type.startsWith("image/")) {
                uploadAndInsertImage(file);
              }
            });
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={toolbarBtnClass(false)}
          title="Upload or Paste Image"
        >
          {isUploading ? (
            <Loader2 size={14} className="animate-spin text-primary" />
          ) : (
            <ImageIcon size={14} />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Enter Image URL:");
            if (url) {
              editor.chain().focus().setImage({ src: url }).run();
            }
          }}
          className={toolbarBtnClass(false)}
          title="Insert Image by URL"
        >
          <Upload size={14} />
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="bg-background max-h-[300px] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}