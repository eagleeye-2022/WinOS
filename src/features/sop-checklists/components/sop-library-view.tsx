"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Archive,
  ArchiveRestore,
  ClipboardCheck,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  createSopTemplateAction,
  deleteSopTemplateAction,
  getSopTemplatesAction,
  pushSopTemplateUpdateAction,
  setSopTemplateArchivedAction,
  updateSopTemplateAction,
} from "../actions/template-actions";
import { SOP_CATEGORIES, SopTemplate } from "../types";
import { DocNode } from "../doc";

/** TipTap needs the browser — loaded on demand. */
const SopDocEditor = dynamic(() => import("../editor/sop-doc-editor"), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-md border bg-muted/40" />,
});

const STARTER_DOC: DocNode = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Before you start" }] },
    { type: "paragraph", content: [{ type: "text", text: "Write instructions, paste tables from Excel, and add checkboxes anywhere." }] },
    {
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "First step" }] }] },
      ],
    },
  ],
};

interface Draft {
  /** Remounts the editor when another SOP (or a fresh copy) is loaded. */
  editorKey: string;
  id: string | null;
  name: string;
  description: string;
  category: string;
  content: DocNode;
}

let draftSeq = 0;

const emptyDraft = (): Draft => ({
  editorKey: `new-${++draftSeq}`,
  id: null,
  name: "",
  description: "",
  category: "General",
  content: STARTER_DOC,
});

const draftFrom = (t: SopTemplate): Draft => ({
  editorKey: `${t.id}-${++draftSeq}`,
  id: t.id,
  name: t.name,
  description: t.description,
  category: t.category,
  content: t.content,
});

export function SopLibraryView() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [templates, setTemplates] = useState<SopTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSopTemplatesAction({ includeArchived: true })
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch((err) => {
        console.error("Failed to load SOP checklists:", err);
        toast.error("Failed to load SOP checklists");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set([...SOP_CATEGORIES, ...templates.map((t) => t.category)])),
    [templates]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter(
      (t) =>
        (showArchived || !t.isArchived) &&
        (categoryFilter === "ALL" || t.category === categoryFilter) &&
        (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    );
  }, [templates, search, categoryFilter, showArchived]);

  const selected = draft?.id ? templates.find((t) => t.id === draft.id) ?? null : null;

  const upsertTemplate = (t: SopTemplate) =>
    setTemplates((prev) => (prev.some((p) => p.id === t.id) ? prev.map((p) => (p.id === t.id ? t : p)) : [...prev, t]));

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const input = { name: draft.name, description: draft.description, category: draft.category, content: draft.content };
      const res = draft.id ? await updateSopTemplateAction(draft.id, input) : await createSopTemplateAction(input);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      upsertTemplate(res.template);
      // Reload the editor from the saved document — it now carries the checkbox ids.
      setDraft(draftFrom(res.template));
      toast.success(
        `${draft.id ? "SOP saved" : "SOP created"} · ${res.template.items.length} checkbox${res.template.items.length === 1 ? "" : "es"}`
      );
    } catch (err) {
      console.error("Failed to save SOP:", err);
      toast.error("Failed to save SOP");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePush = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Push update to tasks?",
      description: `Update ${selected.outdatedCount} task checklist(s) to version ${selected.version}. The document is replaced, new checkboxes are added and unticked ones take the new wording. Ticks are never lost. Closed tasks are left as they are.`,
      confirmLabel: "Push update",
      danger: false,
    });
    if (!ok) return;
    setIsPushing(true);
    try {
      const res = await pushSopTemplateUpdateAction(selected.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      upsertTemplate({ ...selected, outdatedCount: res.skippedClosed });
      toast.success(
        `Updated ${res.updated} task checklist(s)` +
          (res.skippedClosed > 0 ? ` · ${res.skippedClosed} on closed tasks left as they were` : "")
      );
    } catch (err) {
      console.error("Failed to push SOP update:", err);
      toast.error("Failed to push SOP update");
    } finally {
      setIsPushing(false);
    }
  };

  const handleArchive = async () => {
    if (!selected) return;
    const res = await setSopTemplateArchivedAction(selected.id, !selected.isArchived);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    upsertTemplate({ ...selected, isArchived: !selected.isArchived });
    toast.success(selected.isArchived ? "SOP restored" : "SOP archived — it can no longer be attached to tasks");
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Delete SOP?",
      description:
        selected.attachedCount > 0
          ? `"${selected.name}" is attached to ${selected.attachedCount} task(s). Those copies stay on the tasks, but they will no longer receive updates. This cannot be undone.`
          : `Delete "${selected.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const res = await deleteSopTemplateAction(selected.id);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== selected.id));
    setDraft(null);
    toast.success("SOP deleted");
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <ClipboardCheck size={20} className="text-primary" /> SOP Checklists
          </h1>
          <p className="text-xs text-muted-foreground">
            Write SOPs like documents — text, tables pasted from Excel, and checkboxes anywhere. Every checkbox is a step
            people tick on the task.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(emptyDraft())}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <Plus size={15} /> New SOP
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Library list */}
        <aside className="flex max-h-72 min-h-0 w-full shrink-0 flex-col border-b md:max-h-none md:w-80 md:border-b-0 md:border-r">
          <div className="space-y-2 p-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SOPs"
                className="w-full rounded-md border bg-background py-1.5 pl-8 pr-2 text-xs outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
              >
                <option value="ALL">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Archived
              </label>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 size={20} className="animate-spin text-primary" />
              </div>
            ) : visible.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                {templates.length === 0 ? "No SOPs yet. Create the first one." : "No SOPs match these filters."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {visible.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setDraft(draftFrom(t))}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        draft?.id === t.id ? "border-primary bg-primary/5" : "hover:bg-accent/50",
                        t.isArchived && "opacity-60"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold">{t.name}</span>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          v{t.version}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{t.category}</span>
                        <span>· {t.items.length} checkboxes</span>
                        <span>· on {t.attachedCount} task(s)</span>
                        {t.isArchived && <span className="font-semibold">· Archived</span>}
                        {t.outdatedCount > 0 && (
                          <span className="font-semibold text-warning">· {t.outdatedCount} outdated</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Editor */}
        <section className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {!draft ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <ClipboardCheck size={34} className="text-primary/60" />
              <p className="text-sm font-semibold text-foreground">Select an SOP or create a new one</p>
              <p className="max-w-sm text-xs">
                Managers attach SOPs to tasks from the task&apos;s SOP Checklist tab. Task owners then tick the checkboxes.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-4">
              {selected && selected.outdatedCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                  <span>
                    <b>{selected.outdatedCount}</b> task checklist(s) still use an older version of this SOP.
                  </span>
                  <button
                    type="button"
                    disabled={isPushing}
                    onClick={handlePush}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground disabled:opacity-60"
                  >
                    {isPushing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Push update to tasks
                  </button>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                <label className="space-y-1 text-xs font-semibold">
                  Name
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Website Launch QA"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm font-normal outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold">
                  Category
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm font-normal"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1 text-xs font-semibold">
                Short description
                <input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="When should this SOP be used?"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-normal outline-none focus:border-primary"
                />
              </label>

              <div className="space-y-1">
                <p className="text-xs font-semibold">SOP document</p>
                <p className="text-[11px] text-muted-foreground">
                  Paste from Excel, Sheets, Word or Docs. Select lines or table cells and click{" "}
                  <b>To checkboxes</b> to make them tickable. Put the cursor on a checkbox to mark it{" "}
                  <b>Required</b> or <b>Proof</b>.
                </p>
                <SopDocEditor
                  key={draft.editorKey}
                  initialContent={draft.content}
                  onChange={(content) => setDraft((prev) => (prev ? { ...prev, content } : prev))}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <div className="flex items-center gap-2">
                  {selected && (
                    <>
                      <button
                        type="button"
                        onClick={handleArchive}
                        className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                      >
                        {selected.isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                        {selected.isArchived ? "Restore" : "Archive"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft(selected ? draftFrom(selected) : null)}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
                  >
                    {selected ? "Discard changes" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSave}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {draft.id ? "Save SOP" : "Create SOP"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
      {ConfirmDialog}
    </div>
  );
}
