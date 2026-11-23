"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, EllipsisVertical, PencilLine, PhoneCall, PhoneForwarded, Plus, Search, Trash2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";
import { CALL_DIRECTION, CALL_OUTCOME, STAGE_BY_ID } from "../../constants";
import { useSetuMe, useSetuStore } from "../../provider";
import type { CallDirection, CallOutcome, Deal, DealCall } from "../../types";
import {
  callStats,
  dealTitle,
  formatDate,
  formatDuration,
  formatHoursMinutes,
  formatTimeRange,
  isoDate,
  istDateTime,
  istHhmm,
  logSeconds,
  searchCalls,
} from "../../utils";
import { Field, SetuButton, attempt } from "../setu-ui";

type CallFilter = "all" | "outbound" | "inbound" | "audio";
type CallSort = "recent" | "oldest" | "longest";
const CALL_FILTERS: readonly CallFilter[] = ["all", "outbound", "inbound", "audio"];
const CALL_SORTS: readonly CallSort[] = ["recent", "oldest", "longest"];
const SORT_LABEL: Record<CallSort, string> = { recent: "Most Recent", oldest: "Oldest", longest: "Longest" };

export function DealCallsTab({ deal }: { deal: Deal }) {
  const allCalls = useSetuStore((s) => s.calls);
  const deleteCall = useSetuStore((s) => s.deleteCall);
  const [q, setQ] = useUrlState("callq", "");
  const [filter, setFilter] = useUrlState<CallFilter>("calls", "all", { allowed: CALL_FILTERS });
  const [sort, setSort] = useUrlState<CallSort>("callsort", "recent", { allowed: CALL_SORTS });
  // null = closed, "new" = Log Call, an id = edit that call.
  const [dialog, setDialog] = usePageViewState<string | null>("DealCalls:dialog", null);

  const calls = allCalls.filter((c) => c.dealId === deal.id);
  const numbers = new Map([...calls].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map((c, i) => [c.id, i + 1]));
  const latestId = [...calls].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]?.id;
  const stats = callStats(calls);

  const visible = searchCalls(calls, q)
    .filter((c) => (filter === "outbound" ? c.direction === "OUTBOUND" : filter === "inbound" ? c.direction === "INBOUND" : filter === "audio" ? Boolean(c.recordingUrl) : true))
    .sort((a, b) =>
      sort === "oldest"
        ? a.startedAt.localeCompare(b.startedAt)
        : sort === "longest"
          ? logSeconds(b) - logSeconds(a)
          : b.startedAt.localeCompare(a.startedAt)
    );

  const chips: { id: CallFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "outbound", label: "Outbound", count: stats.outbound },
    { id: "inbound", label: "Inbound", count: stats.inbound },
    { id: "audio", label: "With Audio", count: stats.withAudio },
  ];

  return (
    <div className="space-y-4">
      <section className="setu-card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
            <PhoneForwarded size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Calls Stream</h2>
            <p className="setu-text-2 text-sm">
              {stats.total} Total Call{stats.total === 1 ? "" : "s"} · {formatHoursMinutes(stats.talkSeconds)} Talk Time · {stats.connectRate}% Connect Rate
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <Search size={15} className="setu-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search call logs, notes…" className="setu-input h-10 pl-9" />
          </div>
          <SetuButton variant="primary" onClick={() => setDialog("new")}>
            <Plus /> Log Call
          </SetuButton>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              aria-pressed={filter === c.id}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === c.id
                  ? "border-[var(--setu-accent-ring)] bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]"
                  : "setu-text-2 border-[var(--setu-line)] bg-[var(--setu-soft)] hover:text-[var(--setu-text)]"
              )}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>
        <SortMenu value={sort} onChange={setSort} options={CALL_SORTS} labels={SORT_LABEL} />
      </div>

      {visible.length === 0 ? (
        <div className="setu-card setu-text-2 px-6 py-12 text-center text-sm">{calls.length === 0 ? "No calls logged yet." : "No calls match."}</div>
      ) : (
        visible.map((c) => (
          <CallCard
            key={c.id}
            call={c}
            number={numbers.get(c.id) ?? 0}
            latest={c.id === latestId}
            onEdit={() => setDialog(c.id)}
            onDelete={() => {
              void attempt(deleteCall(c.id), "Call deleted");
            }}
          />
        ))
      )}

      <LogCallDialog deal={deal} open={dialog !== null} call={calls.find((c) => c.id === dialog)} onClose={() => setDialog(null)} />
    </div>
  );
}

export function SortMenu<T extends string>({ value, onChange, options, labels }: { value: T; onChange: (v: T) => void; options: readonly T[]; labels: Record<T, string> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="setu-text-2 flex cursor-pointer items-center gap-1 text-xs">
          Sorted by: <span className="font-semibold text-[var(--setu-text)]">{labels[value]}</span>
          <ChevronDown size={13} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o} value={o}>
              {labels[o]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One call. `related` (Calls page) shows which lead / deal it belongs to. */
export function CallCard({
  call,
  number,
  latest,
  onEdit,
  onDelete,
  related,
}: {
  call: DealCall;
  number?: number;
  latest?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  related?: { href: string; label: string };
}) {
  const outcome = CALL_OUTCOME[call.outcome];
  const direction = CALL_DIRECTION[call.direction];
  return (
    <article className="setu-card px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold",
              latest ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : "bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]"
            )}
          >
            {number ? `#${number}` : <PhoneCall size={12} />}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{call.title}</h3>
            {related && (
              <Link href={related.href} className="setu-accent-text text-xs font-medium hover:underline">
                {related.label}
              </Link>
            )}
            <p className="setu-text-2 mt-1 text-xs">
              {formatDate(call.startedAt)} - {formatTimeRange(call.startedAt, call.endedAt)}
              <Sep />
              Duration: <span className="font-semibold text-[var(--setu-text)]">{formatDuration(logSeconds(call))}</span>
              <Sep />
              Rep: {call.repName}
              {call.repRole && ` (${call.repRole})`}
              <span className="mx-1.5 text-[var(--setu-text)]">‖</span>
              {call.contactName}
              {call.contactRole && ` (${call.contactRole})`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", outcome.tone)}>{outcome.label}</span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", direction.tone)}>{direction.label}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Call actions" className="setu-text-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-[var(--setu-soft)]">
                <EllipsisVertical size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {call.recordingUrl && (
                <DropdownMenuItem asChild>
                  <a href={call.recordingUrl} target="_blank" rel="noreferrer">
                    <Volume2 size={14} /> Play recording
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onEdit}>
                <PencilLine size={14} /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={onDelete}>
                <Trash2 size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {call.summary && (
        <blockquote className="setu-text-2 ml-1 mt-4 border-l-2 border-[var(--setu-line-strong)] pl-5 text-sm italic leading-relaxed">“{call.summary}”</blockquote>
      )}
    </article>
  );
}

function Sep() {
  return <span className="mx-2 text-[var(--setu-text-3)]">•</span>;
}

// ── Log / edit call ───────────────────────────────────────────────────────────

interface CallForm {
  title: string;
  direction: CallDirection;
  outcome: CallOutcome;
  date: string;
  time: string;
  minutes: string;
  seconds: string;
  repId: string;
  repRole: string;
  contactName: string;
  contactRole: string;
  summary: string;
  recordingUrl: string;
}

function initialForm(deal: Deal | undefined, meId: string, call?: DealCall): CallForm {
  if (call) {
    const total = logSeconds(call);
    return {
      title: call.title,
      direction: call.direction,
      outcome: call.outcome,
      date: isoDate(call.startedAt),
      time: istHhmm(call.startedAt),
      minutes: String(Math.floor(total / 60)),
      seconds: String(total % 60),
      repId: call.repId,
      repRole: call.repRole ?? "",
      contactName: call.contactName,
      contactRole: call.contactRole ?? "",
      summary: call.summary,
      recordingUrl: call.recordingUrl ?? "",
    };
  }
  return {
    title: "",
    direction: "OUTBOUND",
    outcome: "CONNECTED",
    date: isoDate(new Date()),
    time: istHhmm(new Date().toISOString()),
    minutes: "",
    seconds: "",
    repId: meId,
    repRole: "",
    contactName: deal?.contactName ?? "",
    contactRole: deal?.contactRole && deal.contactRole !== "Decision Maker" ? deal.contactRole : "",
    summary: "",
    recordingUrl: "",
  };
}

/**
 * Log / edit a call. With `deal` (a deal’s Calls tab) the call belongs to it; without (the Calls
 * page) the dialog asks for the related lead / deal first.
 */
export function LogCallDialog({ deal: fixedDeal, open, call, onClose }: { deal?: Deal; open: boolean; call?: DealCall; onClose: () => void }) {
  const me = useSetuMe();
  const deals = useSetuStore((s) => s.deals);
  const [dealId, setDealId] = useState(fixedDeal?.id ?? call?.dealId ?? "");
  const deal = fixedDeal ?? deals.find((d) => d.id === dealId);
  const team = useSetuStore((s) => s.team);
  const logCall = useSetuStore((s) => s.logCall);
  const updateCall = useSetuStore((s) => s.updateCall);
  const [form, setForm] = useState<CallForm>(() => initialForm(deal, me.id, call));
  const [error, setError] = useState("");
  const set = (patch: Partial<CallForm>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (open) {
      setDealId(fixedDeal?.id ?? call?.dealId ?? "");
      setForm(initialForm(fixedDeal ?? deals.find((d) => d.id === call?.dealId), me.id, call));
      setError("");
    }
    // Reset each time it opens (or switches call).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, call?.id]);

  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!deal) return setError("Pick the related lead / deal.");
    const duration = (Number(form.minutes) || 0) * 60 + (Number(form.seconds) || 0);
    if (!form.title.trim() || !form.contactName.trim() || !form.repId) return setError("Title, rep and contact are required.");
    if (!form.date || !form.time) return setError("Pick the call's date and time.");
    if (duration <= 0 && form.outcome !== "NO_ANSWER") return setError("Enter the call duration.");
    const startedAt = istDateTime(form.date, form.time);
    const data = {
      title: form.title.trim(),
      direction: form.direction,
      outcome: form.outcome,
      startedAt,
      endedAt: new Date(Date.parse(startedAt) + duration * 1000).toISOString(),
      repId: form.repId,
      repRole: form.repRole.trim() || undefined,
      contactName: form.contactName.trim(),
      contactRole: form.contactRole.trim() || undefined,
      summary: form.summary.trim(),
      recordingUrl: form.recordingUrl.trim() || undefined,
    };
    setSaving(true);
    const ok = await attempt((call ? updateCall(call.id, data) : logCall(deal.id, data)).then(() => true), call ? "Call updated" : "Call logged");
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="setu-scope setu-dialog max-h-[92vh] max-w-[640px] gap-0 overflow-y-auto p-0 [&>button:last-child]:right-6 [&>button:last-child]:top-6">
        <div className="flex items-center gap-3 border-b border-[var(--setu-line)] bg-[var(--setu-well)] px-6 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
            <PhoneCall size={18} />
          </span>
          <div>
            <DialogTitle className="text-lg font-semibold">{call ? "Edit Call" : "Log Call"}</DialogTitle>
            <DialogDescription className="setu-text-2 text-xs">{deal ? deal.company : "Pick the lead or deal this call was about"}</DialogDescription>
          </div>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            {!fixedDeal && (
              <Field label="Related Lead / Deal" required className="sm:col-span-2">
                <Select
                  value={dealId || undefined}
                  disabled={Boolean(call)}
                  onValueChange={(id) => {
                    setDealId(id);
                    const d = deals.find((x) => x.id === id);
                    // Default the contact to the deal’s decision maker when it’s still empty.
                    if (d && !form.contactName.trim()) set({ contactName: d.contactName });
                  }}
                >
                  <SelectTrigger className="setu-input !h-9 w-full">
                    <SelectValue placeholder="Pick a lead or deal" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {deals.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.company} — {dealTitle(d)} · {STAGE_BY_ID[d.stage].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Call Title" required className="sm:col-span-2">
              <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Commercial & API Scope Clarification" className="setu-input h-9" />
            </Field>
            <Field label="Direction">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--setu-soft)] p-1">
                {(["OUTBOUND", "INBOUND"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set({ direction: d })}
                    className={cn(
                      "cursor-pointer rounded-md py-2 text-xs font-semibold",
                      form.direction === d ? "bg-[var(--setu-card)] shadow-sm" : "setu-text-2"
                    )}
                  >
                    {CALL_DIRECTION[d].label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Outcome">
              <Select value={form.outcome} onValueChange={(v) => set({ outcome: v as CallOutcome })}>
                <SelectTrigger className="setu-input !h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CALL_OUTCOME) as CallOutcome[]).map((o) => (
                    <SelectItem key={o} value={o}>
                      {CALL_OUTCOME[o].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date" required>
              <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className="setu-input h-9" />
            </Field>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Start Time (IST)" required>
                <Input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} className="setu-input h-9" />
              </Field>
              <Field label="Duration" required>
                <div className="flex items-center gap-1">
                  <Input inputMode="numeric" value={form.minutes} onChange={(e) => set({ minutes: e.target.value.replace(/\D/g, "") })} placeholder="m" className="setu-input h-9 w-14 text-center" aria-label="Minutes" />
                  <Input inputMode="numeric" value={form.seconds} onChange={(e) => set({ seconds: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="s" className="setu-input h-9 w-14 text-center" aria-label="Seconds" />
                </div>
              </Field>
            </div>
            <Field label="Rep" required>
              <Select value={form.repId} onValueChange={(repId) => set({ repId })}>
                <SelectTrigger className="setu-input !h-9 w-full">
                  <SelectValue placeholder="Pick a rep" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {team.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Rep Role">
              <Input value={form.repRole} onChange={(e) => set({ repRole: e.target.value })} placeholder="e.g. Lead Architect" className="setu-input h-9" />
            </Field>
            <Field label="Contact" required>
              <Input value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} className="setu-input h-9" />
            </Field>
            <Field label="Contact Role">
              <Input value={form.contactRole} onChange={(e) => set({ contactRole: e.target.value })} placeholder="e.g. Client VP" className="setu-input h-9" />
            </Field>
            <Field label="Call Summary" className="sm:col-span-2">
              <Textarea value={form.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="What was discussed and agreed?" className="setu-input min-h-24" />
            </Field>
            <Field label="Recording Link" className="sm:col-span-2">
              <Input type="url" value={form.recordingUrl} onChange={(e) => set({ recordingUrl: e.target.value })} placeholder="https://…" className="setu-input h-9" />
            </Field>
            {error && <p className="text-xs text-red-500 sm:col-span-2">{error}</p>}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[var(--setu-line)] bg-[var(--setu-well)] px-6 py-4">
            <SetuButton variant="ghost" onClick={onClose}>
              Cancel
            </SetuButton>
            <SetuButton variant="primary" type="submit" className="px-5" disabled={saving}>
              {saving ? "Saving…" : call ? "Save Call" : "Log Call"}
            </SetuButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
