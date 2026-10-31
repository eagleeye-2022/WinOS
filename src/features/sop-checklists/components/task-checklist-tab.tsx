"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Link2,
  ListPlus,
  Loader2,
  MessageSquare,
  History,
  MoreVertical,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { SearchableSelect } from "@/components/shared/searchable-select";
import {
  addChecklistItemAction,
  attachSopChecklistAction,
  createCustomChecklistAction,
  deleteChecklistItemAction,
  detachChecklistAction,
  getTaskChecklistsAction,
  setAllChecklistItemsCheckedAction,
  setChecklistItemCheckedAction,
  syncTaskChecklistAction,
  updateChecklistItemTextAction,
} from "../actions/task-checklist-actions";
import { getSopPickerOptionsAction } from "../actions/template-actions";
import { SopPickerOption, TaskChecklistItemView, TaskChecklistView } from "../types";
import { checklistProgress } from "../utils";
import { docItemIds } from "../doc";
import { SopTimelineDrawer } from "./sop-timeline-drawer";

/** TipTap needs the browser — loaded on demand. */
const SopDocView = dynamic(() => import("../editor/sop-doc-view"), {
  ssr: false,
  loading: () => <div className="h-32 animate-pulse rounded-md bg-muted/40" />,
});

interface TaskChecklistTabProps {
  taskId: string;
}

export function TaskChecklistTab({ taskId }: TaskChecklistTabProps) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [checklists, setChecklists] = useState<TaskChecklistView[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canCheck, setCanCheck] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [pickerOpen, setPickerOpen] = useState(false);
  // "" = all categories (SearchableSelect's placeholder row clears it).
  const [category, setCategory] = useState("");
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<SopPickerOption[] | null>(null);
  const [customName, setCustomName] = useState("");
  // Timeline drawer: the whole task's checklists, or one checklist (checklistId).
  const [timeline, setTimeline] = useState<{ title: string; checklistId?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getTaskChecklistsAction(taskId)
      .then((res) => {
        if (cancelled) return;
        setChecklists(res.checklists);
        setCanManage(res.canManage);
        setCanCheck(res.canCheck);
      })
      .catch((err) => console.error("Failed to load task checklists:", err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const replaceChecklist = (c: TaskChecklistView) =>
    setChecklists((prev) => prev.map((p) => (p.id === c.id ? c : p)));

  const replaceItem = (checklistId: string, item: TaskChecklistItemView) =>
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklistId ? { ...c, items: c.items.map((i) => (i.id === item.id ? item : i)) } : c))
    );

  // Anyone who can work on the task gets the Category / Checklist pickers, so load the SOPs up front.
  useEffect(() => {
    if (!canCheck || templates !== null) return;
    let cancelled = false;
    getSopPickerOptionsAction()
      .then((res) => {
        if (!cancelled) setTemplates(res);
      })
      .catch((err) => {
        console.error("Failed to load SOPs:", err);
        if (!cancelled) setTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canCheck, templates]);

  // Opened the "Attach an SOP" panel from the (now hidden) "Add checklist" button.
  // const openPicker = async () => {
  //   setPickerOpen((o) => !o);
  //   if (templates === null) {
  //     try {
  //       setTemplates(await getSopPickerOptionsAction());
  //     } catch (err) {
  //       console.error("Failed to load SOPs:", err);
  //       setTemplates([]);
  //     }
  //   }
  // };

  const handleAttach = async (templateId: string) => {
    if (!templateId || attachingId) return;
    setAttachingId(templateId);
    const res = await attachSopChecklistAction(taskId, templateId).finally(() => setAttachingId(null));
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setChecklists((prev) => [...prev, res.checklist]);
    setPickerOpen(false);
    toast.success(`Attached "${res.checklist.name}"`);
  };

  const handleCreateCustom = async () => {
    const res = await createCustomChecklistAction(taskId, customName);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setChecklists((prev) => [...prev, res.checklist]);
    setCustomName("");
    setPickerOpen(false);
  };

  const handleDetach = async (c: TaskChecklistView) => {
    const ok = await confirm({
      title: "Remove checklist?",
      description: `Remove "${c.name}" and all its ticks from this task? This cannot be undone.`,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    const res = await detachChecklistAction(c.id);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setChecklists((prev) => prev.filter((p) => p.id !== c.id));
  };

  const handleSync = async (c: TaskChecklistView) => {
    const res = await syncTaskChecklistAction(c.id);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    replaceChecklist(res.checklist);
    toast.success("Checklist updated to the latest SOP");
  };

  const attachedTemplateIds = new Set(checklists.map((c) => c.templateId).filter(Boolean));

  // Department filter (header picker), shared by the Checklist picker and the "Attach an SOP" list.
  const categories = Array.from(new Set((templates ?? []).map((t) => t.department))).sort((a, b) => a.localeCompare(b));
  const shownTemplates = (templates ?? []).filter((t) => !category || t.department === category);
  const categoryOptions = categories.map((c) => ({
    value: c,
    label: `${c} (${(templates ?? []).filter((t) => t.department === c).length})`,
  }));
  // Picking a checklist attaches it; ones already on this task aren't offered again.
  const checklistOptions = shownTemplates
    .filter((t) => !attachedTemplateIds.has(t.id))
    .map((t) => ({ value: t.id, label: `${t.name} · ${t.stepCount} steps${category ? ` · ${t.list}` : ` · ${t.department}`}` }));

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-bold text-foreground">
          {/* <ClipboardCheck size={15} className="text-primary" /> SOP Checklists */}
          {/* Task-wide timeline button, hidden by request — each checklist has its own Timeline button.
          {canCheck && (
            <button
              type="button"
              onClick={() => setTimeline({ title: "All SOP checklists on this task" })}
              className="ml-1 flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground dark:border-zinc-800"
              title="Who picked, ticked and changed this task's checklists, and when"
            >
              <History size={12} /> Timeline
            </button>
          )} */}
        </h3>
        {canCheck && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Search & pick: Category narrows the Checklist list; picking a checklist attaches it. */}
            <SearchableSelect
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              placeholder={templates === null ? "Loading…" : "All departments"}
              searchPlaceholder="Search departments..."
              disabled={templates === null}
              className="flex max-w-[190px] items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary dark:border-zinc-800"
            />
            <SearchableSelect
              value=""
              onChange={handleAttach}
              options={checklistOptions}
              placeholder={
                attachingId
                  ? "Attaching…"
                  : templates === null
                  ? "Loading…"
                  : checklistOptions.length === 0
                  ? "No checklists left"
                  : "Select checklist"
              }
              searchPlaceholder="Search checklists..."
              disabled={templates === null || !!attachingId || checklistOptions.length === 0}
              className="flex max-w-[240px] items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary dark:border-zinc-800"
              contentClassName="w-80"
            />
            {attachingId && <Loader2 size={14} className="animate-spin text-primary" />}
            {/* "Add checklist" button hidden by request — the Category / Checklist pickers above attach SOPs.
            <button
              type="button"
              onClick={openPicker}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={13} /> Add checklist
            </button> */}
          </div>
        )}
      </div>

      {pickerOpen && canCheck && (
        <div className="space-y-3 rounded-lg border bg-card p-3 dark:border-zinc-800">
          <p className="font-semibold text-foreground">
            Attach an SOP{category && <span className="font-normal text-muted-foreground"> · {category}</span>}
          </p>
          {templates === null ? (
            <Loader2 size={16} className="animate-spin text-primary" />
          ) : templates.length === 0 ? (
            <p className="text-muted-foreground">
              {canManage ? "No SOPs yet — create one under Srijan → SOP Checklists." : "No SOPs have been shared with you yet — ask a manager."}
            </p>
          ) : shownTemplates.length === 0 ? (
            <p className="text-muted-foreground">No SOPs in this department.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {shownTemplates.map((t) => {
                const attached = attachedTemplateIds.has(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={attached}
                      onClick={() => handleAttach(t.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800"
                    >
                      <span>
                        <span className="font-semibold text-foreground">{t.name}</span>
                        <span className="text-muted-foreground"> · {t.department} · {t.list} · {t.stepCount} steps</span>
                      </span>
                      {attached && <span className="text-[11px] text-muted-foreground">Attached</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {canManage && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateCustom();
            }}
            className="flex items-center gap-2 border-t pt-3 dark:border-zinc-800"
          >
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="…or name a one-off checklist for this task"
              className="flex-1 rounded-md border bg-background px-2 py-1.5 outline-none focus:border-primary dark:border-zinc-800"
            />
            <button
              type="submit"
              disabled={!customName.trim()}
              className="flex items-center gap-1 rounded-md border px-3 py-1.5 font-semibold hover:bg-accent disabled:opacity-50 dark:border-zinc-800"
            >
              <ListPlus size={13} /> Create
            </button>
          </form>
          )}
        </div>
      )}

      {checklists.length === 0 ? (
        <div className="space-y-1 rounded-lg border border-dashed p-8 text-center text-muted-foreground dark:border-zinc-800">
          <ClipboardCheck size={28} className="mx-auto opacity-40" />
          <p className="font-semibold text-foreground">No checklist on this task yet.</p>
          <p>
            {canCheck
              ? "Select an SOP checklist above (pick a department to narrow the list). The task can't be closed until its checklist is complete."
              : "Only this task's owners, project users and managers can add a checklist."}
          </p>
        </div>
      ) : (
        checklists.map((c) => (
          <ChecklistCard
            key={c.id}
            checklist={c}
            canManage={canManage}
            canCheck={canCheck}
            onItemChange={(item) => replaceItem(c.id, item)}
            onChecklistChange={replaceChecklist}
            onDetach={() => handleDetach(c)}
            onSync={() => handleSync(c)}
            onOpenTimeline={() => setTimeline({ title: c.name, checklistId: c.id })}
          />
        ))
      )}
      <SopTimelineDrawer
        open={timeline !== null}
        onClose={() => setTimeline(null)}
        title={timeline?.title ?? ""}
        query={{ taskId, checklistId: timeline?.checklistId }}
      />
      {ConfirmDialog}
    </div>
  );
}

function ChecklistCard({
  checklist,
  canManage,
  canCheck,
  onItemChange,
  onChecklistChange,
  onDetach,
  onSync,
  onOpenTimeline,
}: {
  checklist: TaskChecklistView;
  canManage: boolean;
  canCheck: boolean;
  onItemChange: (item: TaskChecklistItemView) => void;
  onChecklistChange: (c: TaskChecklistView) => void;
  onDetach: () => void;
  onSync: () => void;
  onOpenTimeline: () => void;
}) {
  const [newItem, setNewItem] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const handleSelectAll = async (checked: boolean) => {
    setIsBulkSaving(true);
    try {
      const res = await setAllChecklistItemsCheckedAction(checklist.id, checked);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      onChecklistChange(res.checklist);
      if (res.skippedForProof > 0) {
        toast.info(`${res.skippedForProof} step(s) need a proof link before they can be ticked`);
        setShowDetails(true);
      }
    } catch (err) {
      console.error("Failed to update checklist:", err);
      toast.error("Failed to update checklist");
    } finally {
      setIsBulkSaving(false);
    }
  };
  const progress = checklistProgress(checklist.items);
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const isBehind =
    checklist.latestTemplateVersion !== null && checklist.templateVersion < checklist.latestTemplateVersion;

  // Document mode: the SOP doc shows the checkboxes; ticks live on the items, matched by sourceItemId.
  const [showDetails, setShowDetails] = useState(false);
  const [proofItemId, setProofItemId] = useState<string | null>(null);
  const docIds = useMemo(() => (checklist.content ? docItemIds(checklist.content) : null), [checklist.content]);
  const { docItems, extraItems, itemBySource, checkedById } = useMemo(() => {
    const bySource = new Map<string, TaskChecklistItemView>();
    const inDoc: TaskChecklistItemView[] = [];
    const extra: TaskChecklistItemView[] = [];
    for (const i of checklist.items) {
      if (docIds && i.sourceItemId && docIds.has(i.sourceItemId) && !i.isRemovedFromSop) {
        bySource.set(i.sourceItemId, i);
        inDoc.push(i);
      } else {
        extra.push(i);
      }
    }
    return {
      docItems: inDoc,
      extraItems: extra,
      itemBySource: bySource,
      checkedById: new Map(inDoc.map((i) => [i.sourceItemId as string, i.checked])),
    };
  }, [checklist.items, docIds]);

  /**
   * A checkbox click in the document. Always returns false (TipTap leaves the box as it was) and
   * updates the item optimistically instead — the view re-ticks from `checkedById`, and a failed
   * save puts the old item back.
   */
  const handleDocToggle = (sourceId: string, checked: boolean): boolean => {
    const item = itemBySource.get(sourceId);
    if (!item) return false;
    if (!canCheck) {
      toast.info("Only this task's owners and project users can tick its checklist");
      return false;
    }
    if (checked && item.requiresEvidence && !item.evidenceUrl) {
      setProofItemId(item.id);
      setShowDetails(true);
      toast.info("This step needs a proof link — add it below to tick it");
      return false;
    }
    onItemChange({ ...item, checked });
    setChecklistItemCheckedAction(item.id, checked)
      .then((res) => {
        if (res.success) onItemChange(res.item);
        else {
          toast.error(res.error);
          onItemChange(item);
        }
      })
      .catch((err) => {
        console.error("Failed to update checklist item:", err);
        toast.error("Failed to update checklist item");
        onItemChange(item);
      });
    return false;
  };

  const handleAddItem = async () => {
    const res = await addChecklistItemAction(checklist.id, newItem);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    onChecklistChange(res.checklist);
    setNewItem("");
  };

  const handleDeleteItem = async (itemId: string) => {
    const res = await deleteChecklistItemAction(itemId);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    onChecklistChange({ ...checklist, items: checklist.items.filter((i) => i.id !== itemId) });
  };

  return (
    <div className="rounded-lg border bg-card dark:border-zinc-800 dark:bg-[#121215]">
      {/* Header: chevron · name … done [progress] total · ⋮ */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/60 text-primary hover:bg-primary/10"
          title={isOpen ? "Collapse" : "Expand"}
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-foreground">{checklist.name}</h4>
            {/* <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {checklist.templateId ? `SOP v${checklist.templateVersion}` : "Custom"}
            </span> */}
            <button
              type="button"
              onClick={onOpenTimeline}
              className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground dark:border-zinc-800"
              title="Timeline of this checklist"
            >
              <History size={12} /> Timeline
            </button>
            {progress.requiredOpen > 0 && (
              <span className="text-[11px] font-semibold text-warning">{progress.requiredOpen} required open</span>
            )}
            {isBehind && (
              <span className="text-[11px] text-muted-foreground">
                SOP updated to v{checklist.latestTemplateVersion}
                {!canManage && " — ask a manager to sync"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground" title={`${pct}% done`}>
          <span className="w-5 text-right tabular-nums">{progress.done}</span>
          <div className="h-3 w-28 overflow-hidden rounded-sm border border-muted-foreground/50 sm:w-40">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-5 tabular-nums">{progress.total}</span>
        </div>

        {/* Moved next to the "SOP v1" badge.
        <button
          type="button"
          onClick={onOpenTimeline}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          title="Timeline of this checklist"
        >
          <History size={14} />
        </button> */}

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Checklist actions"
              >
                {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <MoreVertical size={15} />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-1">
              {isBehind && (
                <DropdownMenuItem
                  onClick={async () => {
                    setIsSyncing(true);
                    await onSync();
                    setIsSyncing(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 text-xs font-medium"
                >
                  <RefreshCw size={13} className="text-muted-foreground" />
                  Update to latest SOP (v{checklist.latestTemplateVersion})
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  setIsOpen(true);
                  setShowDetails(true);
                }}
                className="flex cursor-pointer items-center gap-2 text-xs font-medium"
              >
                <MessageSquare size={13} className="text-muted-foreground" /> Notes &amp; proof links
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDetach}
                className="flex cursor-pointer items-center gap-2 text-xs font-medium text-destructive"
              >
                <Trash2 size={13} /> Remove from task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isOpen && (
        <div className="space-y-3 border-t px-4 pb-4 pt-3 dark:border-zinc-800">
          {/* "Select All" removed by request — every step is ticked on its own. Restore by
              dropping `false &&`.
          */}
          {false && canCheck && progress.total > 0 && (
            <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
              <input
                type="checkbox"
                checked={progress.done === progress.total}
                ref={(el) => {
                  if (el) el.indeterminate = progress.done > 0 && progress.done < progress.total;
                }}
                disabled={isBulkSaving}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-input"
              />
              {isBulkSaving ? <Loader2 size={12} className="animate-spin" /> : "Select All"}
            </label>
          )}

          {checklist.content && docIds ? (
            <>
              <div className="px-1">
                <SopDocView content={checklist.content} checkedById={checkedById} onToggle={handleDocToggle} />
              </div>

              {extraItems.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Also on this task</p>
                  <ul className="space-y-1">
                    {extraItems.map((item) => (
                      <ChecklistItemRow
                        key={item.id}
                        item={item}
                        canCheck={canCheck}
                        canManage={canManage}
                        onChange={onItemChange}
                        onDelete={() => handleDeleteItem(item.id)}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {docItems.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDetails((s) => !s)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {showDetails ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Who ticked what · notes &amp; proof links
                  </button>
                  {showDetails && (
                    <ul className="mt-1 space-y-1">
                      {docItems.map((item) => (
                        <ChecklistItemRow
                          key={item.id}
                          item={item}
                          canCheck={canCheck}
                          canManage={false}
                          openDetails={proofItemId === item.id}
                          onChange={(updated) => {
                            if (updated.id === proofItemId) setProofItemId(null);
                            onItemChange(updated);
                          }}
                          onDelete={() => {}}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          ) : (
            <ul className="space-y-1">
              {checklist.items.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  canCheck={canCheck}
                  canManage={canManage}
                  onChange={onItemChange}
                  onDelete={() => handleDeleteItem(item.id)}
                />
              ))}
            </ul>
          )}

          {canManage && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newItem.trim()) handleAddItem();
              }}
              className="flex items-center gap-2 pl-6"
            >
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Add an item to this task's checklist"
                className="flex-1 rounded-md border bg-background px-2 py-1.5 outline-none focus:border-primary dark:border-zinc-800"
              />
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistItemRow({
  item,
  canCheck,
  canManage,
  openDetails,
  onChange,
  onDelete,
}: {
  item: TaskChecklistItemView;
  canCheck: boolean;
  canManage: boolean;
  /** Opens the note/proof form (e.g. after a proof-required checkbox was clicked in the doc). */
  openDetails?: boolean;
  onChange: (item: TaskChecklistItemView) => void;
  onDelete: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(!!openDetails);
  useEffect(() => {
    if (openDetails) setDetailsOpen(true);
  }, [openDetails]);
  const [note, setNote] = useState(item.note || "");
  const [evidenceUrl, setEvidenceUrl] = useState(item.evidenceUrl || "");
  const [isSaving, setIsSaving] = useState(false);

  const save = async (checked: boolean, withDetails: boolean) => {
    setIsSaving(true);
    try {
      const res = await setChecklistItemCheckedAction(
        item.id,
        checked,
        withDetails ? { note, evidenceUrl } : undefined
      );
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      onChange(res.item);
      if (withDetails) setDetailsOpen(false);
    } catch (err) {
      console.error("Failed to update checklist item:", err);
      toast.error("Failed to update checklist item");
    } finally {
      setIsSaving(false);
    }
  };

  // Managers can reword items added on the task itself; SOP steps are edited in the SOP.
  const canEditText = canManage && !item.sourceItemId;
  const [isEditingText, setIsEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState(item.text);

  const saveText = async () => {
    setIsEditingText(false);
    const next = textDraft.trim();
    if (!next || next === item.text) {
      setTextDraft(item.text);
      return;
    }
    const res = await updateChecklistItemTextAction(item.id, next);
    if (!res.success) {
      toast.error(res.error);
      setTextDraft(item.text);
      return;
    }
    onChange(res.item);
  };

  const handleToggle = () => {
    // A proof-required item opens the details form instead of ticking straight away.
    if (!item.checked && item.requiresEvidence && !item.evidenceUrl) {
      setDetailsOpen(true);
      return;
    }
    save(!item.checked, false);
  };

  return (
    <li className="group rounded-md px-1 py-1 hover:bg-accent/30">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={item.checked}
          disabled={!canCheck || isSaving}
          onChange={handleToggle}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-input disabled:cursor-not-allowed"
          aria-label={item.text}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {isEditingText ? (
              <input
                autoFocus
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                onBlur={saveText}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setTextDraft(item.text);
                    setIsEditingText(false);
                  }
                }}
                className="min-w-48 flex-1 rounded border bg-background px-1.5 py-0.5 outline-none focus:border-primary dark:border-zinc-800"
              />
            ) : (
              <span className={cn("text-foreground", item.checked && "text-muted-foreground line-through")}>
                {item.text}
              </span>
            )}
            {item.isRequired && (
              <span className="rounded bg-destructive/10 px-1 text-[10px] font-semibold text-destructive">Required</span>
            )}
            {item.requiresEvidence && (
              <span className="flex items-center gap-0.5 rounded bg-info/10 px-1 text-[10px] font-semibold text-info">
                <Link2 size={10} /> Proof
              </span>
            )}
            {item.isRemovedFromSop && (
              <span className="rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                No longer in SOP
              </span>
            )}
          </div>
          {(item.checked || item.note || item.evidenceUrl) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              {item.checked && item.checkedByName && (
                <span>
                  ✓ {item.checkedByName}
                  {item.checkedAt && ` · ${new Date(item.checkedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}
                </span>
              )}
              {item.evidenceUrl && (
                <a
                  href={item.evidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-0.5 text-primary hover:underline"
                >
                  <ExternalLink size={10} /> Proof
                </a>
              )}
              {item.note && <span className="italic">“{item.note}”</span>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          {canCheck && (
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="rounded p-1 text-muted-foreground hover:bg-accent"
              title="Add note / proof link"
            >
              <MessageSquare size={12} />
            </button>
          )}
          {canEditText && !isEditingText && (
            <button
              type="button"
              onClick={() => setIsEditingText(true)}
              className="rounded p-1 text-muted-foreground hover:bg-accent"
              title="Edit item"
            >
              <Pencil size={12} />
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Remove item from this task"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {detailsOpen && canCheck && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(item.requiresEvidence && !item.checked ? true : item.checked, true);
          }}
          className="mt-2 space-y-2 rounded-md border bg-background p-2 pl-6 dark:border-zinc-800"
        >
          <input
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder={item.requiresEvidence ? "Proof link (required), e.g. https://…" : "Proof link (optional)"}
            className="w-full rounded border bg-background px-2 py-1 outline-none focus:border-primary dark:border-zinc-800"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded border bg-background px-2 py-1 outline-none focus:border-primary dark:border-zinc-800"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDetailsOpen(false)}
              className="rounded px-2 py-1 font-semibold text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1 rounded bg-primary px-3 py-1 font-semibold text-primary-foreground disabled:opacity-60"
            >
              {isSaving && <Loader2 size={11} className="animate-spin" />}
              {item.requiresEvidence && !item.checked ? "Save & tick" : "Save"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
