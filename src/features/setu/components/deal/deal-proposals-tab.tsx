"use client";

import { useRef, useState } from "react";
import { CircleCheck, CircleX, Clock3, Eye, FilePen, FileText, GitBranch, IndianRupee, Pencil, Plus, Save, Send, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RichDescriptionEditor, RichDescriptionView, isEmptyDescription } from "@/components/shared/rich-description";
import { usePageViewState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../../provider";
import type { Deal, DealFile, ProposalVersion } from "../../types";
import { displayCode, formatDate, formatInr, formatPercent, formatTime, parseInr, percentChange, proposalSummary } from "../../utils";
import { SETU_RICH_VIEW, SetuButton, attempt } from "../setu-ui";
import { FileDropzone, FileRow, downloadDealFile } from "./deal-files";
import { DealTabHeader } from "./deal-tab-header";

export function DealProposalsTab({ deal }: { deal: Deal }) {
  const all = useSetuStore((s) => s.proposals);
  const createDraft = useSetuStore((s) => s.createProposalDraft);
  const [newestFirst, setNewestFirst] = usePageViewState("DealProposals:newestFirst", true);
  const [snapshotId, setSnapshotId] = usePageViewState<string | null>("DealProposals:snapshot", null);
  const draftRef = useRef<HTMLDivElement>(null);

  const versions = all.filter((p) => p.dealId === deal.id);
  const { active, baseline, variance, revisions, draft, nextVersion } = proposalSummary(versions);
  const published = versions
    .filter((p) => p.status !== "DRAFT")
    .sort((a, b) => (newestFirst ? b.version - a.version : a.version - b.version));
  const code = displayCode(deal);
  const snapshot = versions.find((v) => v.id === snapshotId);

  const startDraft = () => void attempt(createDraft(deal.id), `Draft V${nextVersion} created`);

  return (
    <div className="space-y-4">
      <DealTabHeader
        icon={FileText}
        title="Proposals & Commercial Versions"
        subtitle={
          <>
            Track formal commercial proposals, scope revisions, and legal attachments for {deal.company} (<span className="font-mono">{code}</span>).
          </>
        }
        actions={
          !draft && (
            <SetuButton variant="primary" size="sm" onClick={startDraft}>
              <Plus /> New Draft
            </SetuButton>
          )
        }
      />

      {/* Summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="setu-card flex items-start justify-between gap-3 px-5 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">Current Active Offer</p>
            {active ? (
              <>
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xl font-bold tabular-nums">{formatInr(active.value)}</span>
                  <span className="rounded-full bg-[var(--setu-well)] px-2 py-0.5 text-xs font-semibold text-foreground">Revision V{active.version}</span>
                </p>
                <p className="setu-text-2 mt-1.5 flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-green-500" /> Shared with Client • Under Review
                </p>
              </>
            ) : (
              <p className="setu-text-2 mt-2 text-sm">No proposal published yet.</p>
            )}
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10">
            <IndianRupee size={18} />
          </span>
        </section>

        <section className="setu-card flex items-start justify-between gap-3 px-5 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">
              Discount Variance {baseline && active ? `(V${baseline.version} → V${active.version})` : ""}
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-xl font-bold tabular-nums">{formatPercent(variance)}</span>
              {baseline && <span className="setu-text-2 text-xs">from {formatInr(baseline.value)} baseline</span>}
            </p>
            <p className="setu-text-2 mt-1.5 text-xs">
              {revisions} total iterative revision{revisions === 1 ? "" : "s"} generated
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10">
            <TrendingDown size={18} />
          </span>
        </section>

        <section className="setu-card flex items-start justify-between gap-3 px-5 py-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
              Next Iteration
              {draft && (
                <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Active Drafting
                </span>
              )}
            </p>
            <p className="mt-2 text-base font-semibold">Draft Proposal V{draft?.version ?? nextVersion}</p>
            {draft ? (
              <SetuButton variant="secondary" size="sm" className="mt-2" onClick={() => draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <Pencil /> Creating in progress…
              </SetuButton>
            ) : (
              <SetuButton variant="secondary" size="sm" className="mt-2" onClick={startDraft}>
                <Plus /> Create Revision (V{nextVersion})
              </SetuButton>
            )}
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--setu-well)] text-[var(--setu-text-2)]">
            <FilePen size={18} />
          </span>
        </section>
      </div>

      {/* Versions */}
      <div className="flex items-center justify-between pt-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <GitBranch size={16} className="setu-text-2" /> Commercial Proposal Versions ({published.length})
        </h3>
        <button type="button" onClick={() => setNewestFirst((v) => !v)} className="setu-text-2 cursor-pointer text-xs hover:text-[var(--setu-text)]">
          Sort by {newestFirst ? "newest" : "oldest"} version
        </button>
      </div>

      {draft && (
        <div ref={draftRef} className="scroll-mt-4">
          <DraftCard key={draft.id} draft={draft} active={active} code={code} />
        </div>
      )}

      {published.length === 0 && !draft && (
        <div className="setu-card setu-text-2 px-6 py-12 text-center text-sm">No proposals yet. Create the first revision.</div>
      )}

      {published.map((p) => (
        <VersionCard key={p.id} proposal={p} code={code} first={p.version === baseline?.version} onSnapshot={() => setSnapshotId(p.id)} />
      ))}

      <SnapshotDialog proposal={snapshot} code={code} onClose={() => setSnapshotId(null)} />
    </div>
  );
}

function Ribbon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("absolute right-0 top-0 rounded-bl-lg rounded-tr-[15px] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white", className)}>
      {children}
    </span>
  );
}

function CodeChip({ children }: { children: React.ReactNode }) {
  return <span className="setu-text-3 rounded border border-[var(--setu-line)] bg-[var(--setu-well)] px-1.5 py-0.5 font-mono text-[11px]">{children}</span>;
}

function DraftCard({ draft, active, code }: { draft: ProposalVersion; active?: ProposalVersion; code: string }) {
  const save = useSetuStore((s) => s.saveProposalDraft);
  const publish = useSetuStore((s) => s.publishProposal);
  const discard = useSetuStore((s) => s.discardProposalDraft);
  const [title, setTitle] = useState(draft.title);
  const [quote, setQuote] = useState(draft.value ? draft.value.toLocaleString("en-IN") : "");
  const [reason, setReason] = useState(draft.reason);
  const [attachment, setAttachment] = useState<DealFile | undefined>(draft.attachment);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const value = parseInr(quote);
  const delta = active && Number.isFinite(value) ? percentChange(active.value, value) : null;

  /** Validated draft fields, or null (with the error shown). */
  const collect = () => {
    const problem = !title.trim() ? "Proposal scope title is required." : !Number.isFinite(value) || value <= 0 ? "Enter the commercial quote." : "";
    setError(problem);
    return problem ? null : { title: title.trim(), value, reason: isEmptyDescription(reason) ? "" : reason.trim() };
  };

  const run = async (action: () => Promise<void>, done: string) => {
    if (busy) return;
    setBusy(true);
    await attempt(action(), done);
    setBusy(false);
  };

  return (
    <article className="setu-card relative border-[var(--setu-line-strong)] px-6 pb-5 pt-7">
      <Ribbon className="bg-foreground text-background">
        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-400" /> In Draft Mode
      </Ribbon>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded bg-[var(--setu-well)] px-2 py-0.5 text-xs font-semibold text-foreground">V{draft.version} Draft</span>
        <h3 className="text-lg font-semibold">Drafting Proposal Revision V{draft.version}</h3>
        <CodeChip>
          {code}-V{draft.version}
        </CodeChip>
      </div>
      <p className="setu-text-2 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <Clock3 size={13} /> Drafting · last saved {formatDate(draft.createdAt)}, {formatTime(draft.createdAt)}
        <span>·</span>
        Author: <span className="font-semibold text-[var(--setu-text)]">{draft.authorName}</span>
        {active && (
          <span className="inline-flex items-center gap-1 rounded border border-[var(--setu-line)] bg-[var(--setu-well)] px-1.5 py-0.5 text-xs font-medium text-foreground">
            <GitBranch size={11} /> Based on: Revision V{active.version} ({formatInr(active.value)})
          </span>
        )}
      </p>

      <div className="mt-4 grid gap-4 rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <label className="block space-y-1.5">
          <span className="block text-xs font-semibold">
            Proposal Scope Title <span className="text-red-500">*</span>
          </span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="setu-input h-9 bg-[var(--setu-card)]!" />
        </label>
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between text-xs font-semibold">
            <span>
              Commercial Quote (₹) <span className="text-red-500">*</span>
            </span>
            {delta !== null && active && (
              <span className={cn("text-[11px] font-semibold", delta <= 0 ? "text-green-600" : "text-amber-600")}>
                {formatPercent(delta)} vs V{active.version}
              </span>
            )}
          </span>
          <div className="relative">
            <span className="setu-text-3 absolute left-3 top-1/2 -translate-y-1/2 text-sm">₹</span>
            <Input inputMode="numeric" value={quote} onChange={(e) => setQuote(e.target.value)} className="setu-input h-9 pl-7 font-semibold" />
          </div>
        </label>
      </div>

      <div className="mt-4 space-y-1.5">
        <span className="block text-xs font-semibold">Revision Justification & Client Covenant Adjustments</span>
        <RichDescriptionEditor value={reason} onChange={setReason} />
      </div>

      <div className="mt-4">
        {attachment ? (
          <div className="rounded-lg border border-[var(--setu-line)] px-4">
            <FileRow file={attachment} onRemove={() => setAttachment(undefined)} />
          </div>
        ) : (
          <FileDropzone
            onFiles={([f]) => setAttachment(f)}
            title={<span className="font-semibold">Attach Revised SOW or Quotation PDF</span>}
            hint="Drag & drop a file here, or click to browse • PDF / DOCX • Max 25MB"
          />
        )}
      </div>

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--setu-line)] pt-4">
        <SetuButton
          size="sm"
          disabled={busy}
          onClick={() => void run(() => discard(draft.id), "Draft discarded")}
        >
          <CircleX /> Cancel / Discard Draft
        </SetuButton>
        <div className="flex flex-wrap gap-2">
          <SetuButton
            size="sm"
            disabled={busy}
            onClick={() => {
              const data = collect();
              if (data) void run(() => save(draft.id, data, attachment ?? null), "Draft saved (internal only)");
            }}
          >
            <Save /> Save as Internal Draft
          </SetuButton>
          <SetuButton
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => {
              const data = collect();
              if (data) void run(() => publish(draft.id, data, attachment ?? null), `V${draft.version} published as the active offer`);
            }}
          >
            <Send /> Publish & Mark as Active V{draft.version}
          </SetuButton>
        </div>
      </div>
    </article>
  );
}

function VersionCard({ proposal: p, code, first, onSnapshot }: { proposal: ProposalVersion; code: string; first: boolean; onSnapshot: () => void }) {
  const isActive = p.status === "ACTIVE";
  const actions = (
    <div className="flex flex-wrap gap-2">
      {/* Only when a file is attached to this version. */}
      {p.attachment && (
        <SetuButton size="sm" onClick={() => p.attachment && downloadDealFile(p.attachment)}>
          <FileText className="text-red-500" /> Download {p.attachment.name.toLowerCase().endsWith(".pdf") ? "PDF" : "File"}
        </SetuButton>
      )}
      <SetuButton size="sm" onClick={onSnapshot}>
        <Eye /> View Snapshot
      </SetuButton>
    </div>
  );
  const meta = (
    <p className="setu-text-2 mt-1 flex flex-wrap items-center gap-x-2 text-xs">
      <Clock3 size={13} /> Generated on {formatDate(p.createdAt)}, {formatTime(p.createdAt)}
      <span>·</span>
      Author: <span className="font-semibold text-[var(--setu-text)]">{p.authorName}</span>
      {p.authorRole && ` (${p.authorRole})`}
    </p>
  );
  const heading = (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className={cn("rounded px-2 py-0.5 text-xs font-bold", isActive ? "bg-[var(--setu-accent)] text-[var(--setu-accent-ink)]" : "bg-[var(--setu-well)] ring-1 ring-[var(--setu-line)]")}>
        V{p.version}
      </span>
      <h3 className="text-base font-semibold">{p.title}</h3>
      <CodeChip>
        {code}-V{p.version}
      </CodeChip>
    </div>
  );
  const reasonBox = !isEmptyDescription(p.reason) && (
    <div className="setu-soft mt-4 px-4 py-3 text-xs">
      <p className="font-semibold">{first ? "Initial Pitch:" : "Revision Reason:"}</p>
      <RichDescriptionView value={p.reason} className={SETU_RICH_VIEW} />
    </div>
  );

  if (isActive) {
    return (
      <article className="setu-card relative border-[var(--setu-line-strong)] px-6 pb-5 pt-7">
        <Ribbon className="bg-foreground text-background">Current Active Revision</Ribbon>
        {heading}
        {meta}
        <p className="mt-4 text-xs font-semibold text-muted-foreground">Commercial Value</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">{formatInr(p.value)}</p>
        {reasonBox}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--setu-line)] pt-4">
          <span className="setu-text-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2 py-0.5 font-medium text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400">
              <CircleCheck size={13} /> Client Reviewing Proposal
            </span>
            {p.sentVia && <>• Sent via {p.sentVia}</>}
          </span>
          {actions}
        </div>
      </article>
    );
  }

  return (
    <article className="setu-card px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {heading}
          {meta}
        </div>
        <div className="text-right">
          <p className="setu-text-3 text-xs font-semibold uppercase tracking-wider">Commercial Value</p>
          <p className="text-xl font-bold tabular-nums">{formatInr(p.value)}</p>
        </div>
      </div>
      {reasonBox}
      <div className="mt-4 border-t border-[var(--setu-line)] pt-4">{actions}</div>
    </article>
  );
}

function SnapshotDialog({ proposal: p, code, onClose }: { proposal?: ProposalVersion; code: string; onClose: () => void }) {
  return (
    <Dialog open={Boolean(p)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="setu-scope setu-dialog max-w-lg p-6">
        {p && (
          <div className="space-y-4">
            <div>
              <DialogTitle className="text-base font-semibold">
                V{p.version} — {p.title}
              </DialogTitle>
              <DialogDescription className="setu-text-2 mt-0.5 font-mono text-xs">
                {code}-V{p.version} · {p.status === "ACTIVE" ? "Active offer" : "Superseded"}
              </DialogDescription>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)]/40 p-3.5 text-sm">
              <div>
                <dt className="setu-text-3 text-[11px] font-medium">Commercial Value</dt>
                <dd className="mt-0.5 text-sm font-semibold">{formatInr(p.value)}</dd>
              </div>
              <div>
                <dt className="setu-text-3 text-[11px] font-medium">Generated</dt>
                <dd className="mt-0.5 text-xs font-medium">
                  {formatDate(p.createdAt)}, {formatTime(p.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="setu-text-3 text-[11px] font-medium">Author</dt>
                <dd className="mt-0.5 text-xs font-medium">
                  {p.authorName}
                  {p.authorRole && ` (${p.authorRole})`}
                </dd>
              </div>
              <div>
                <dt className="setu-text-3 text-[11px] font-medium">Sent via</dt>
                <dd className="mt-0.5 text-xs font-medium">{p.sentVia ?? "—"}</dd>
              </div>
            </dl>
            {!isEmptyDescription(p.reason) && <RichDescriptionView value={p.reason} className={SETU_RICH_VIEW} />}
            {p.attachment && (
              <div className="rounded-lg border border-[var(--setu-line)] px-4">
                <FileRow file={p.attachment} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
