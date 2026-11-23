"use client";

import { useState } from "react";
import { BellRing, CalendarDays, CalendarSync, CircleCheck, FileCheck2, Flag, IndianRupee, Save, Trophy, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTRACT_TERMS, LOSS_REASONS, LOSS_REASON_SHORT } from "../../constants";
import { useSetuStore } from "../../provider";
import type { Deal, DealFile, DealLostDetails, DealWonDetails } from "../../types";
import { fiscalQuarter, formatDate, formatInr, isoDate, parseInr, percentOf, proposalSummary } from "../../utils";
import { Field, SetuButton, attempt } from "../setu-ui";
import { FileDropzone, FileRow } from "./deal-files";

const inr = (n: number | undefined) => (n === undefined || !Number.isFinite(n) ? "" : n.toLocaleString("en-IN"));

function MoneyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="setu-text-3 absolute left-3 top-1/2 -translate-y-1/2 text-sm">₹</span>
      <Input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} className="setu-input h-9 pl-7" />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  hintTone,
}: {
  icon?: React.ElementType;
  tone?: string;
  label: string;
  value: string;
  hint: React.ReactNode;
  hintTone?: string;
}) {
  return (
    <section className="setu-card flex items-center gap-4 px-5 py-5">
      {Icon && (
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon size={22} />
        </span>
      )}
      <div className="min-w-0">
        <p className="setu-text-2 text-xs">{label}</p>
        <p className="text-xl font-bold leading-tight tracking-tight">{value}</p>
        <p className={cn("mt-1 flex items-center gap-1 text-xs", hintTone ?? "setu-text-3")}>{hint}</p>
      </div>
    </section>
  );
}

function FormHeader({ icon: Icon, tone, title, badge, badgeTone, subtitle }: { icon: React.ElementType; tone: string; title: string; badge: string; badgeTone: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-[var(--setu-line)] pb-4">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon size={19} />
      </span>
      <div>
        <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold">
          {title}
          <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-semibold", badgeTone)}>{badge}</span>
        </h3>
        <p className="setu-text-2 text-xs">{subtitle}</p>
      </div>
    </div>
  );
}

// ── Closed Won ────────────────────────────────────────────────────────────────

interface WonForm {
  finalValue: string;
  closedDate: string;
  advance: string;
  term: string;
  paymentTerms: string;
  documents: DealFile[];
}

function wonForm(deal: Deal, quoted?: number): WonForm {
  const w = deal.won;
  return {
    finalValue: inr(w?.finalValue ?? deal.value ?? quoted),
    closedDate: w?.closedDate ?? isoDate(new Date()),
    advance: inr(w?.advanceReceived),
    term: w?.contractTerm ?? CONTRACT_TERMS[1],
    paymentTerms: w?.paymentTerms ?? "",
    documents: w?.documents ?? [],
  };
}

export function DealClosedWonTab({ deal }: { deal: Deal }) {
  const closeWon = useSetuStore((s) => s.closeWon);
  const proposals = useSetuStore((s) => s.proposals);
  const quoted = proposalSummary(proposals.filter((p) => p.dealId === deal.id)).active?.value;
  const [form, setForm] = useState<WonForm>(() => wonForm(deal, quoted));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<WonForm>) => setForm((f) => ({ ...f, ...patch }));
  const w = deal.won;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const finalValue = parseInr(form.finalValue);
    const advance = parseInr(form.advance);
    const problem =
      !(finalValue > 0) ? "Enter the final deal value."
      : !form.closedDate ? "Pick the closed date."
      : !(advance >= 0) ? "Enter the advance received (0 if none)."
      : advance > finalValue ? "Advance can't be more than the final deal value."
      : !form.paymentTerms.trim() ? "Enter the payment terms."
      : "";
    setError(problem);
    if (problem) return;
    const details: DealWonDetails = {
      finalValue,
      closedDate: form.closedDate,
      advanceReceived: advance,
      contractTerm: form.term,
      paymentTerms: form.paymentTerms.trim(),
      documents: form.documents,
    };
    setSaving(true);
    await attempt(closeWon(deal.id, details), `${deal.company} closed as won 🎉`);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {w && (
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="Final Deal Value"
            value={formatInr(w.finalValue)}
            hint={quoted ? <><CircleCheck size={12} /> {percentOf(w.finalValue, quoted)}% of the quoted value</> : "Closed value"}
            hintTone="text-green-600"
          />
          <SummaryCard label="Closed Date" value={formatDate(w.closedDate)} hint={<><CalendarDays size={12} /> {w.contractTerm.replace(/\s*\(.*\)$/, "")}</>} />
          <SummaryCard
            label="Advance Received"
            value={formatInr(w.advanceReceived)}
            hint={<><Wallet size={12} /> {percentOf(w.advanceReceived, w.finalValue)}% Upfront Cleared</>}
            hintTone="text-green-600"
          />
        </div>
      )}

      {w && (
        <section className="setu-card px-6 py-5">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--setu-line)] pb-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
                <FileCheck2 size={17} />
              </span>
              <div>
                <h3 className="text-base font-semibold">Executed Documents & Invoices</h3>
                <p className="setu-text-2 text-xs">Official signed agreements and verified transaction documents</p>
              </div>
            </div>
            <span className="setu-text-3 text-xs">
              {w.documents.length} File{w.documents.length === 1 ? "" : "s"}
            </span>
          </div>
          {w.documents.length === 0 ? (
            <p className="setu-text-2 py-6 text-center text-sm">No documents uploaded yet.</p>
          ) : (
            <div className="divide-y divide-[var(--setu-line)]">
              {w.documents.map((f, i) => (
                <FileRow key={f.id} file={f} index={i} />
              ))}
            </div>
          )}
        </section>
      )}

      <form onSubmit={submit} noValidate className="setu-card space-y-4 px-6 py-5">
        <FormHeader
          icon={Trophy}
          tone="bg-green-50 text-green-600 dark:bg-green-500/10"
          title="Enter Deal Closure Details"
          badge="Stage: Won"
          badgeTone="border-green-300 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400"
          subtitle="Fill in contract, financial closure & handover details"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Final Deal Value (₹)" required>
            <MoneyInput value={form.finalValue} onChange={(finalValue) => set({ finalValue })} />
          </Field>
          <Field label="Closed Date" required>
            <Input type="date" value={form.closedDate} onChange={(e) => set({ closedDate: e.target.value })} className="setu-input h-9" />
          </Field>
          <Field label="Advance Received (₹)" required>
            <MoneyInput value={form.advance} onChange={(advance) => set({ advance })} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Contract Lock-in / Term" required>
            <Select value={form.term} onValueChange={(term) => set({ term })}>
              <SelectTrigger className="setu-input !h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TERMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Payment Terms / Milestone Structure" required>
            <Input value={form.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} placeholder="e.g. 50% Upfront, 50% on UAT Sign-off" className="setu-input h-9" />
          </Field>
        </div>
        <div className="space-y-2">
          <span className="text-xs font-semibold">Upload Executed Agreement / Signed MSA & PO</span>
          <FileDropzone
            multiple
            onFiles={(files) => set({ documents: [...form.documents, ...files] })}
            title={
              <>
                <span className="setu-accent-text font-semibold">Click to upload</span> or drag and drop signed contract / invoice
              </>
            }
            hint="PDF, DOCX up to 25MB (MSA, SOW or Signed Proposal)"
          />
          {form.documents.length > 0 && (
            <div className="divide-y divide-[var(--setu-line)] rounded-xl border border-[var(--setu-line)] px-4">
              {form.documents.map((f, i) => (
                <FileRow key={f.id} file={f} index={i} onRemove={() => set({ documents: form.documents.filter((d) => d.id !== f.id) })} />
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--setu-line)] pt-4">
          <SetuButton
            variant="ghost"
            onClick={() => {
              setForm(wonForm(deal, quoted));
              setError("");
            }}
          >
            Cancel
          </SetuButton>
          <SetuButton type="submit" className="border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-400 dark:hover:bg-green-500/25" disabled={saving}>
            <CircleCheck /> {w ? "Save Closure Details" : "Save & Close Deal"}
          </SetuButton>
        </div>
      </form>
    </div>
  );
}

// ── Closed Lost ───────────────────────────────────────────────────────────────

interface LostForm {
  reason: string;
  secondary: string;
  value: string;
  closedDate: string;
  analysis: string;
  reengageDate: string;
  reengageNote: string;
  keepNurturing: boolean;
}

function lostForm(deal: Deal, quoted?: number): LostForm {
  const l = deal.lost;
  return {
    reason: l?.primaryReason ?? LOSS_REASONS[0],
    secondary: l?.secondaryFactor ?? "",
    value: inr(l?.lostValue ?? quoted ?? deal.value),
    closedDate: l?.closedDate ?? isoDate(new Date()),
    analysis: l?.analysis ?? "",
    reengageDate: l?.reengageDate ?? "",
    reengageNote: l?.reengageNote ?? "",
    keepNurturing: l?.keepNurturing ?? true,
  };
}

export function DealClosedLostTab({ deal }: { deal: Deal }) {
  const closeLost = useSetuStore((s) => s.closeLost);
  const proposals = useSetuStore((s) => s.proposals);
  const active = proposalSummary(proposals.filter((p) => p.dealId === deal.id)).active;
  const [form, setForm] = useState<LostForm>(() => lostForm(deal, active?.value));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<LostForm>) => setForm((f) => ({ ...f, ...patch }));
  const l = deal.lost;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const value = form.value.trim() ? parseInr(form.value) : 0;
    const problem =
      !form.reason ? "Pick the primary loss reason."
      : !(value >= 0) ? "Enter a valid quoted value."
      : !form.closedDate ? "Pick the closed lost date."
      : form.reengageDate && form.reengageDate < form.closedDate ? "Re-engagement date should be after the closed date."
      : "";
    setError(problem);
    if (problem) return;
    const details: DealLostDetails = {
      lostValue: value,
      primaryReason: form.reason,
      secondaryFactor: form.secondary.trim(),
      closedDate: form.closedDate,
      analysis: form.analysis.trim(),
      reengageDate: form.reengageDate || undefined,
      reengageNote: form.reengageNote.trim(),
      keepNurturing: form.keepNurturing,
    };
    setSaving(true);
    await attempt(closeLost(deal.id, details), `${deal.company} marked as closed lost`);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {l && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={IndianRupee}
            tone="bg-red-50 text-red-500 dark:bg-red-500/10"
            label="Lost Deal Value"
            value={formatInr(l.lostValue)}
            hint={deal.proposalVersion ? `Proposal V${deal.proposalVersion} Quoted` : "Final quoted value"}
          />
          <SummaryCard
            icon={Wallet}
            tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10"
            label="Primary Loss Reason"
            value={LOSS_REASON_SHORT[l.primaryReason] ?? l.primaryReason}
            hint={<span className="line-clamp-1">{l.secondaryFactor || "—"}</span>}
          />
          <SummaryCard
            icon={CalendarSync}
            tone="bg-blue-50 text-blue-600 dark:bg-blue-500/10"
            label="Target Re-engagement"
            value={l.reengageDate ? formatDate(l.reengageDate).replace(/^0/, "") : "Not set"}
            hint={l.reengageDate ? `${l.reengageNote || "Follow-up"} · alert set` : "No follow-up planned"}
          />
          <SummaryCard
            icon={CalendarDays}
            tone="bg-[var(--setu-well)] setu-text-2"
            label="Closed Lost Date"
            value={formatDate(l.closedDate).replace(/^0/, "")}
            hint={`${fiscalQuarter(l.closedDate)} Fiscal Period`}
          />
        </div>
      )}

      <form onSubmit={submit} noValidate className="setu-card space-y-4 px-6 py-5">
        <FormHeader
          icon={Flag}
          tone="bg-red-50 text-red-500 dark:bg-red-500/10"
          title="Enter Deal Loss Details"
          badge="STAGE: LOST"
          badgeTone="border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
          subtitle="Document loss rationale, competitor insight, and future re-engagement strategy to improve win rates."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Primary Loss Reason" required>
            <Select value={form.reason} onValueChange={(reason) => set({ reason })}>
              <SelectTrigger className="setu-input !h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Secondary / Contributing Factor">
            <Input value={form.secondary} onChange={(e) => set({ secondary: e.target.value })} placeholder="e.g. Multi-region CDN pricing out of fiscal cap" className="setu-input h-9" />
          </Field>
          <Field label="Final Quoted Value (₹)">
            <MoneyInput value={form.value} onChange={(value) => set({ value })} />
          </Field>
          <Field label="Closed Lost Date" required>
            <Input type="date" value={form.closedDate} onChange={(e) => set({ closedDate: e.target.value })} className="setu-input h-9" />
          </Field>
        </div>
        <Field label="Loss Analysis & Detailed Feedback">
          <Textarea value={form.analysis} onChange={(e) => set({ analysis: e.target.value })} placeholder="What happened, what the client said, what we'd do differently…" className="setu-input min-h-24" />
        </Field>
        <div className="grid items-end gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <BellRing size={13} className="setu-text-3" /> Future Re-engagement / Follow-up Date
            </span>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2">
              <Input type="date" value={form.reengageDate} onChange={(e) => set({ reengageDate: e.target.value })} className="setu-input h-9" aria-label="Re-engagement date" />
              <Input value={form.reengageNote} onChange={(e) => set({ reengageNote: e.target.value })} placeholder="e.g. Q4 Budget Cycle" className="setu-input h-9" aria-label="Re-engagement note" />
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 pb-2.5 text-xs">
            <Checkbox
              checked={form.keepNurturing}
              onCheckedChange={(v) => set({ keepNurturing: v === true })}
              className="mt-0.5 data-[state=checked]:border-red-600 data-[state=checked]:bg-red-600"
            />
            Keep lead active in bi-monthly product newsletter and quarterly tech updates.
          </label>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center justify-end gap-3 rounded-xl bg-[var(--setu-well)] px-4 py-3">
          <SetuButton
            variant="ghost"
            onClick={() => {
              setForm(lostForm(deal, active?.value));
              setError("");
            }}
          >
            <X /> Cancel
          </SetuButton>
          <SetuButton type="submit" className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25" disabled={saving}>
            <Save /> {l ? "Save Loss Details" : "Save & Mark as Closed Lost"}
          </SetuButton>
        </div>
      </form>
    </div>
  );
}
