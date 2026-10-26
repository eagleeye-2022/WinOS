"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  History,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "@/components/shared/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  createSopTemplateAction,
  deleteSopTemplateAction,
  getSopLibraryForViewerAction,
  getSopTemplatesAction,
  importEedSopLibraryAction,
  moveSopTemplateAction,
  previewEedSopLibraryImportAction,
  pushSopTemplateUpdateAction,
  setSopTemplateArchivedAction,
  updateSopTemplateAction,
} from "../actions/template-actions";
import { SOP_CATEGORIES, SopTemplate } from "../types";
import { DocNode } from "../doc";
import { SopTimelineDrawer } from "./sop-timeline-drawer";
import { SopBoard } from "./sop-board";

/** Empty lists made with "Create List" — kept on this browser until their first SOP is saved. */
const LOCAL_LISTS_KEY = "sop-board-lists";

const readLocalLists = (): string[] => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LOCAL_LISTS_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const writeLocalLists = (lists: string[]) => {
  try {
    window.localStorage.setItem(LOCAL_LISTS_KEY, JSON.stringify(lists));
  } catch {
    // Storage unavailable (private window) — the list still shows until the page reloads.
  }
};

/** Keeps `?sop=<id>` in the address bar in step with the open SOP, so the URL itself can be shared. */
const setUrlSop = (id: string | null) => {
  const url = new URL(window.location.href);
  url.searchParams.delete("list");
  if (id) url.searchParams.set("sop", id);
  else url.searchParams.delete("sop");
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
};

/** TipTap needs the browser — loaded on demand. */
const SopDocEditor = dynamic(() => import("../editor/sop-doc-editor"), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-md border bg-muted/40" />,
});
/** Read-only render of an SOP (team members' view of the library). */
const SopDocView = dynamic(() => import("../editor/sop-doc-view"), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-md border bg-muted/40" />,
});
const NO_TICKS = new Map<string, boolean>();

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

/**
 * `canEdit` (managers): create, edit, move, archive, delete and push SOPs. Without it (team members)
 * the library is browse/read plus creating new SOPs — existing SOPs stay read-only for them.
 */
export function SopLibraryView({ canEdit = true }: { canEdit?: boolean }) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [templates, setTemplates] = useState<SopTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [localLists, setLocalLists] = useState<string[]>([]);
  const [highlightList, setHighlightList] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (canEdit ? getSopTemplatesAction({ includeArchived: true }) : getSopLibraryForViewerAction())
      .then((rows) => {
        if (cancelled) return;
        setTemplates(rows);
        if (canEdit) setLocalLists(readLocalLists());
        // Shared links: ?sop=<id> opens that SOP, ?list=<name> highlights that list.
        const params = new URLSearchParams(window.location.search);
        const sopId = params.get("sop");
        const list = params.get("list");
        if (sopId) {
          const t = rows.find((r) => r.id === sopId);
          if (t) setDraft(draftFrom(t));
          else toast.error("That SOP wasn't found — it may have been archived or deleted");
        } else if (list) {
          setHighlightList(list);
          setTimeout(() => {
            document
              .getElementById(`sop-list-${encodeURIComponent(list)}`)
              ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
          }, 100);
        }
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
  }, [canEdit]);

  const categories = useMemo(
    () => Array.from(new Set([...SOP_CATEGORIES, ...templates.map((t) => t.category), ...localLists])),
    [templates, localLists]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter(
      (t) =>
        (showArchived || !t.isArchived) &&
        (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    );
  }, [templates, search, showArchived]);

  // Board columns — every list, so team members can add an SOP to an empty one too.
  const boardLists = categories;

  const selected = draft?.id ? templates.find((t) => t.id === draft.id) ?? null : null;

  // Unsaved edits in the open SOP (the editor only replaces `content` when the document changes).
  const isDirty =
    !!draft &&
    (canEdit || !draft.id) &&
    (selected
      ? draft.name !== selected.name ||
        draft.description !== selected.description ||
        draft.category !== selected.category ||
        draft.content !== selected.content
      : !!draft.name.trim() || !!draft.description.trim() || draft.content !== STARTER_DOC);

  const upsertTemplate = (t: SopTemplate) =>
    setTemplates((prev) => (prev.some((p) => p.id === t.id) ? prev.map((p) => (p.id === t.id ? t : p)) : [...prev, t]));

  const openSop = (t: SopTemplate) => {
    setHighlightList(null);
    setDraft(draftFrom(t));
    setUrlSop(t.id);
  };

  const backToBoard = async () => {
    if (isDirty) {
      const ok = await confirm({
        title: "Discard unsaved changes?",
        description: "This SOP has changes that haven't been saved.",
        confirmLabel: "Discard",
      });
      if (!ok) return;
    }
    setDraft(null);
    setUrlSop(null);
  };

  const handleCreateList = (name: string) => {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return false;
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`A list called "${trimmed}" already exists`);
      return false;
    }
    const next = [...localLists, trimmed];
    setLocalLists(next);
    writeLocalLists(next);
    toast.success(`List "${trimmed}" created — add its first SOP with +`);
    return true;
  };

  const handleRemoveLocalList = (name: string) => {
    const next = localLists.filter((l) => l !== name);
    setLocalLists(next);
    writeLocalLists(next);
  };

  const handleMove = async (t: SopTemplate, list: string) => {
    setMovingId(t.id);
    upsertTemplate({ ...t, category: list });
    try {
      const res = await moveSopTemplateAction(t.id, list);
      if (!res.success) {
        upsertTemplate(t);
        toast.error(res.error);
        return;
      }
      toast.success(`Moved to ${list}`);
    } catch (err) {
      console.error("Failed to move SOP:", err);
      upsertTemplate(t);
      toast.error("Failed to move SOP");
    } finally {
      setMovingId(null);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      // Plain JSON only: the editor's document can hold non-plain values (editor objects, pasted
      // files), which reach the server action as client references and fail with "Cannot access
      // toStringTag on the server". The server validates the document shape itself.
      const input = JSON.parse(
        JSON.stringify({ name: draft.name, description: draft.description, category: draft.category, content: draft.content })
      );
      const res = draft.id ? await updateSopTemplateAction(draft.id, input) : await createSopTemplateAction(input);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      upsertTemplate(res.template);
      // Reload the editor from the saved document — it now carries the checkbox ids.
      setDraft(draftFrom(res.template));
      setUrlSop(res.template.id);
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

  const handleImportLibrary = async () => {
    setIsImporting(true);
    try {
      // Dry run first (read-only) so the manager sees exactly what would be created.
      const preview = await previewEedSopLibraryImportAction();
      if (!preview.success) {
        toast.error(preview.error);
        return;
      }
      const { plan } = preview;
      if (plan.create.length === 0) {
        toast.info(
          `Nothing to import — all ${plan.skip.length} SOPs from the sheet already exist` +
            (plan.invalid.length > 0 ? ` (${plan.invalid.length} invalid)` : "")
        );
        return;
      }
      const steps = plan.create.reduce((s, c) => s + c.checkboxes, 0);
      const listed = plan.create
        .slice(0, 8)
        .map((c) => c.name)
        .join(", ");
      const ok = await confirm({
        title: "Dry run: import the EED SOP library?",
        description:
          `Will create ${plan.create.length} SOP(s) with ${steps} checklist steps: ${listed}` +
          (plan.create.length > 8 ? ` and ${plan.create.length - 8} more` : "") +
          `. ` +
          (plan.skip.length > 0 ? `${plan.skip.length} already exist and will be skipped. ` : "") +
          (plan.invalid.length > 0 ? `${plan.invalid.length} can't be imported. ` : "") +
          `Only new SOPs are added — nothing else changes. Nothing has been saved yet; Cancel leaves the database untouched.`,
        confirmLabel: `Import ${plan.create.length} SOP(s)`,
        danger: false,
      });
      if (!ok) return;

      const res = await importEedSopLibraryAction();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setTemplates(await getSopTemplatesAction({ includeArchived: true }));
      toast.success(
        `Imported ${res.created} SOP(s)` +
          (res.skipped > 0 ? ` · ${res.skipped} already existed` : "") +
          (res.failed.length > 0 ? ` · ${res.failed.length} failed` : "")
      );
      if (res.failed.length > 0) console.error("SOP import failures:", res.failed);
    } catch (err) {
      console.error("Failed to import the SOP library:", err);
      toast.error("Failed to import the SOP library");
    } finally {
      setIsImporting(false);
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
    setUrlSop(null);
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
          {/* Hidden by request.
          <p className="text-xs text-muted-foreground">
            Write SOPs like documents — text, tables pasted from Excel, and checkboxes anywhere. Every checkbox is a step
            people tick on the task.
          </p> */}
        </div>
        <div className="flex items-center gap-2">
          {/* "Import EED SOP library" hidden — the library has been imported. Restore to re-run it
              (it only adds SOPs that don't exist yet).
          <button
            type="button"
            disabled={isImporting}
            onClick={handleImportLibrary}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-60"
            title="Create the SOPs from the Team EED - SOP, Checklist, Projects sheet that aren't here yet"
          >
            {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Import EED SOP library
          </button> */}
          {!draft && (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search SOPs"
                  className="w-56 rounded-md border bg-background py-1.5 pl-8 pr-2 text-xs outline-none focus:border-primary"
                />
              </div>
              {canEdit && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                  Archived
                </label>
              )}
            </>
          )}
        </div>
      </div>

      {!draft ? (
        // Board: one column per list (category), like the WhyFi School board.
        <SopBoard
          lists={boardLists}
          templates={visible}
          canEdit={canEdit}
          isLoading={isLoading}
          localLists={localLists}
          highlightList={highlightList}
          movingId={movingId}
          onOpen={openSop}
          onCreateIn={(list) => {
            setHighlightList(null);
            setDraft({ ...emptyDraft(), category: list });
          }}
          onMove={handleMove}
          onCreateList={handleCreateList}
          onRemoveLocalList={handleRemoveLocalList}
        />
      ) : (
        <section className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-2">
            <button
              type="button"
              onClick={backToBoard}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft size={14} /> Back to board
            </button>
            {selected && canEdit && (
              <button
                type="button"
                onClick={() => setTimelineOpen(true)}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                title="Who created, edited and picked this SOP, and everything done with it on tasks"
              >
                <History size={13} /> Timeline
              </button>
            )}
          </div>
          {!canEdit && draft.id ? (
            // Team members: a saved SOP as a read-only document (its checkboxes are ticked on tasks).
            // A new SOP (no id yet) falls through to the editor below so they can create it.
            <div className="mx-auto max-w-4xl space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">{draft.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {draft.category}
                  {selected && ` · ${selected.items.length} checkboxes · v${selected.version}`}
                </p>
                {draft.description && <p className="text-sm text-muted-foreground">{draft.description}</p>}
              </div>
              <div className="rounded-md border bg-background p-3">
                <SopDocView key={draft.editorKey} content={draft.content} checkedById={NO_TICKS} onToggle={() => false} />
              </div>
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
                {/* Hidden by request.
                <p className="text-[11px] text-muted-foreground">
                  Paste from Excel, Sheets, Word or Docs. Select lines or table cells and click{" "}
                  <b>To checkboxes</b> to make them tickable. Put the cursor on a checkbox to mark it{" "}
                  <b>Required</b> or <b>Proof</b>.
                </p> */}
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
      )}
      {selected && canEdit && (
        <SopTimelineDrawer
          open={timelineOpen}
          onClose={() => setTimelineOpen(false)}
          title={selected.name}
          query={{ templateId: selected.id }}
          sopScope
        />
      )}
      {ConfirmDialog}
    </div>
  );
}
