"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiffLine } from "@/features/notes/note-versions";
import {
  getSopVersionAction,
  getSopVersionsAction,
  updateSopTemplateAction,
  type SopVersionListItem,
} from "../actions/template-actions";
import { docFromItems } from "../doc";
import { diffSopSnapshots, type SopVersionSnapshot } from "../sop-versions";
import type { SopTemplate } from "../types";

/** Read-only render of the SOP document (TipTap needs the browser). */
const SopDocView = dynamic(() => import("../editor/sop-doc-view"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-md border bg-muted/40" />,
});
const NO_TICKS = new Map<string, boolean>();

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** The SOP's versions (newest first); View opens one — what changed, the full SOP, Restore. */
export function SopVersionsPanel({
  templateId,
  onRestored,
}: {
  templateId: string;
  onRestored?: (template: SopTemplate) => void;
}) {
  const [list, setList] = useState<{ currentVersion: number; versions: SopVersionListItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSopVersionsAction(templateId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) setList({ currentVersion: res.currentVersion, versions: res.versions });
        else setError(res.error);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the versions. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [templateId, reloadKey]);

  if (open !== null) {
    return (
      <SopVersionView
        key={open}
        templateId={templateId}
        version={open}
        onBack={() => setOpen(null)}
        onRestored={(t) => {
          setOpen(null);
          setList(null);
          setReloadKey((k) => k + 1);
          onRestored?.(t);
        }}
      />
    );
  }
  if (error) return <p className="p-8 text-center text-muted-foreground">{error}</p>;
  if (!list) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }
  if (list.versions.length === 0) return <p className="p-8 text-center text-muted-foreground">No versions saved yet.</p>;

  return (
    <ol className="relative space-y-3 border-l pl-5 dark:border-zinc-800">
      {list.versions.map((v) => (
        <li key={v.version} className="relative">
          <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
          <div className="flex items-center justify-between gap-2">
            <p className="leading-snug text-foreground">
              <span className="mr-1.5 rounded bg-primary/10 px-1.5 py-px font-mono text-[11px] font-bold text-primary">v{v.version}</span>
              <span className="font-semibold">{v.userName}</span>
              {v.version === list.currentVersion && (
                <span className="ml-1.5 rounded bg-success/10 px-1.5 py-px text-[10px] font-semibold text-success">Current</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setOpen(v.version)}
              className="shrink-0 rounded border px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
            >
              View
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{formatWhen(v.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}

const DIFF_CLS: Record<DiffLine["kind"], string> = {
  added: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  removed: "bg-rose-500/10 text-rose-700 line-through dark:text-rose-400",
  same: "text-muted-foreground",
};
const DIFF_MARK: Record<DiffLine["kind"], string> = { added: "+", removed: "−", same: " " };

function DiffBlock({ label, lines }: { label: string; lines: DiffLine[] }) {
  if (!lines.some((l) => l.kind !== "same")) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="overflow-hidden rounded-md border">
        {lines.map((l, i) => (
          <div key={i} className={cn("flex gap-2 px-2 py-0.5 whitespace-pre-wrap break-words", DIFF_CLS[l.kind])}>
            <span className="w-3 shrink-0 select-none font-mono">{DIFF_MARK[l.kind]}</span>
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The SOP document of a version — its stored document, or (older SOPs) one built from its steps. */
const documentOf = (s: SopVersionSnapshot) =>
  s.content ??
  docFromItems(s.steps.map((st, i) => ({ id: `v-step-${i}`, text: st.text, isRequired: st.isRequired, requiresEvidence: st.requiresEvidence })));

function SopVersionView({
  templateId,
  version,
  onBack,
  onRestored,
}: {
  templateId: string;
  version: number;
  onBack: () => void;
  onRestored: (template: SopTemplate) => void;
}) {
  const [res, setRes] = useState<Awaited<ReturnType<typeof getSopVersionAction>> | null>(null);
  const [tab, setTab] = useState<"CHANGES" | "FULL">("CHANGES");
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSopVersionAction(templateId, version)
      .then((r) => {
        if (!cancelled) setRes(r);
      })
      .catch(() => {
        if (!cancelled) setRes({ success: false, error: "Couldn't load that version. Please try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [templateId, version]);

  const restore = async () => {
    if (!res?.success) return;
    const s = res.snapshot;
    setRestoring(true);
    setRestoreError(null);
    try {
      // Through the normal SOP save: it becomes the next version, and tasks still on the current
      // one get the usual "push update" offer. Plain JSON only (see the SOP library's save).
      const input = JSON.parse(
        JSON.stringify({ name: s.name, description: s.description, category: s.category, content: documentOf(s) })
      );
      const out = await updateSopTemplateAction(templateId, input);
      if (!out.success) {
        setRestoreError(out.error);
        return;
      }
      onRestored(out.template);
    } catch {
      setRestoreError("Couldn't restore this version.");
    } finally {
      setRestoring(false);
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft size={13} /> Back to versions
      </button>

      {!res ? (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : !res.success ? (
        <p className="py-2 italic text-muted-foreground">{res.error}</p>
      ) : (
        (() => {
          const diff = diffSopSnapshots(res.previous, res.snapshot);
          const changed = (lines: DiffLine[]) => lines.some((l) => l.kind !== "same");
          const nothing = !Object.values(diff).some(changed);
          const isCurrent = res.version === res.currentVersion;
          return (
            <>
              <div>
                <p className="text-sm font-bold text-foreground">
                  Version {res.version}
                  {isCurrent && (
                    <span className="ml-1.5 rounded bg-success/10 px-1.5 py-px text-[11px] font-semibold text-success">Current</span>
                  )}
                </p>
                <p className="text-muted-foreground">
                  {res.userName} · {formatWhen(res.createdAt)}
                </p>
              </div>

              <div className="flex gap-1 border-b pb-2 font-semibold">
                {(
                  [
                    ["CHANGES", res.previous ? "What changed" : "First saved version"],
                    ["FULL", "Full SOP"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={cn("rounded-md px-2.5 py-1", tab === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent")}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "CHANGES" ? (
                <div className="space-y-3">
                  {nothing ? (
                    <p className="italic text-muted-foreground">No content changes in this version.</p>
                  ) : (
                    <>
                      <DiffBlock label="Name" lines={diff.name} />
                      <DiffBlock label="Category" lines={diff.category} />
                      <DiffBlock label="Description" lines={diff.description} />
                      <DiffBlock label="Checklist steps" lines={diff.steps} />
                      <DiffBlock label="Document" lines={diff.document} />
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-foreground">{res.snapshot.name}</p>
                  <p className="text-muted-foreground">
                    {res.snapshot.category} · {res.snapshot.steps.length} steps
                  </p>
                  {res.snapshot.description && <p className="text-muted-foreground">{res.snapshot.description}</p>}
                  <div className="rounded-md border bg-background p-3">
                    <SopDocView content={documentOf(res.snapshot)} checkedById={NO_TICKS} onToggle={() => false} />
                  </div>
                </div>
              )}

              {!isCurrent && (
                <div className="border-t pt-3">
                  {!confirming ? (
                    <button
                      type="button"
                      onClick={() => setConfirming(true)}
                      className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-semibold hover:bg-accent"
                    >
                      <RotateCcw size={13} /> Restore this version
                    </button>
                  ) : (
                    <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-2.5">
                      <p>
                        The SOP goes back to version {res.version}. It&apos;s saved as a new version, so nothing is lost — task
                        checklists on the current version can then be updated with &quot;Push update to tasks&quot;.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={restoring}
                          onClick={restore}
                          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-bold text-primary-foreground disabled:opacity-60"
                        >
                          {restoring && <Loader2 size={12} className="animate-spin" />} Restore
                        </button>
                        <button
                          type="button"
                          disabled={restoring}
                          onClick={() => setConfirming(false)}
                          className="rounded-md px-3 py-1.5 font-semibold text-muted-foreground hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {restoreError && <p className="mt-2 text-destructive">{restoreError}</p>}
                </div>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
