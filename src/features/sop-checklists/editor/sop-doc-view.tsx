"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { sopDocExtensions } from "./sop-extensions";
import { applyChecks, type DocNode } from "../doc";
// Same look as the editor (and the iNotes editor): shared node styles, then the SOP additions.
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";
import "./sop-doc.css";

interface SopDocViewProps {
  content: DocNode;
  /** Tick state per checkbox `itemId` — the source of truth; the document's own `checked` is ignored. */
  checkedById: Map<string, boolean>;
  /**
   * Called when someone clicks a checkbox. Return true to show the new state straight away
   * (the caller saves it and corrects `checkedById` if the save fails), false to leave it as is.
   */
  onToggle: (itemId: string, checked: boolean) => boolean;
}

/**
 * Read-only render of an SOP document on a task. Text can't be edited; only the checkboxes react,
 * through TipTap's `onReadOnlyChecked`. Goes through the editor schema, so unknown markup is dropped.
 */
export default function SopDocView({ content, checkedById, onToggle }: SopDocViewProps) {
  // The extension is configured once, so it reads the latest callback through a ref.
  const onToggleRef = useRef(onToggle);
  useEffect(() => {
    onToggleRef.current = onToggle;
  }, [onToggle]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    // TipTap only calls onReadOnlyChecked on a checkbox click, never during render.
    // eslint-disable-next-line react-hooks/refs
    extensions: sopDocExtensions({
      editable: false,
      onReadOnlyChecked: (node, checked) => {
        const id = typeof node.attrs.itemId === "string" ? node.attrs.itemId : "";
        return id ? onToggleRef.current(id, checked) : false;
      },
    }),
    content: applyChecks(content, checkedById),
    editorProps: { attributes: { class: "sop-doc focus:outline-none text-sm leading-snug text-foreground" } },
  });

  // A new document (e.g. after "update to latest SOP") replaces the content.
  useEffect(() => {
    if (editor) editor.commands.setContent(applyChecks(content, checkedById), { emitUpdate: false });
    // checkedById is applied by the effect below; re-running this on every tick would rebuild the doc.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, content]);

  // Tick changes only touch the affected checkboxes.
  useEffect(() => {
    if (!editor) return;
    const { tr } = editor.state;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== "taskItem") return;
      const id = typeof node.attrs.itemId === "string" ? node.attrs.itemId : "";
      const want = id ? checkedById.get(id) === true : false;
      if (node.attrs.checked !== want) tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: want });
    });
    if (tr.docChanged) {
      tr.setMeta("addToHistory", false);
      editor.view.dispatch(tr);
    }
  }, [editor, checkedById]);

  return <EditorContent editor={editor} />;
}
