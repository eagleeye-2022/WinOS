import type { Node as PmNode } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Highlight } from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";

/**
 * A checkbox that is also an SOP checklist item: `itemId` links it to its SopChecklistTemplateItem
 * (assigned server-side on save, see doc.ts), `required` / `proof` are the item's flags. All three
 * round-trip through HTML as data attributes, so copy-paste between SOP documents keeps them.
 */
export const SopTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      itemId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-item-id"),
        renderHTML: (attrs: Record<string, unknown>) => (attrs.itemId ? { "data-item-id": attrs.itemId } : {}),
      },
      required: {
        default: false,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-required") === "true",
        renderHTML: (attrs: Record<string, unknown>) => (attrs.required ? { "data-required": "true" } : {}),
      },
      proof: {
        default: false,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-proof") === "true",
        renderHTML: (attrs: Record<string, unknown>) => (attrs.proof ? { "data-proof": "true" } : {}),
      },
    };
  },
});

/** Same schema for the SOP editor and the read-only task view, so a document renders identically. */
export function sopDocExtensions(opts: {
  editable: boolean;
  onReadOnlyChecked?: (node: PmNode, checked: boolean) => boolean;
}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: !opts.editable,
        HTMLAttributes: {
          class: "text-primary underline hover:text-primary/80",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      },
    }),
    TaskList,
    SopTaskItem.configure({ nested: true, onReadOnlyChecked: opts.onReadOnlyChecked }),
    Highlight,
    Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: { class: "max-w-full h-auto rounded-md my-1" },
    }),
    TableKit.configure({ table: { resizable: opts.editable } }),
  ];
}
