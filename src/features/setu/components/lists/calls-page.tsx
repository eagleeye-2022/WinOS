"use client";

import { useMemo } from "react";
import { Clock3, Download, PhoneCall, PhoneForwarded, Plus, Signal } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";
import { CALL_DIRECTION, CALL_OUTCOME } from "../../constants";
import { useSetuStore } from "../../provider";
import type { CallDirection, CallOutcome } from "../../types";
import { callStats, dealTitle, formatDate, formatDuration, formatHoursMinutes, formatTime, isoDate, logSeconds } from "../../utils";
import { downloadCsv, inPeriod, matchesText, toCsv, type Period } from "../../insights";
import { CallCard, LogCallDialog, SortMenu } from "../deal/deal-calls-tab";
import { FilterDropdown, SetuButton, SetuPage, attempt } from "../setu-ui";
import { ClearButton, ListHeader, SearchBox, StatTile } from "./list-ui";

type Sort = "recent" | "oldest" | "longest";
const SORTS: readonly Sort[] = ["recent", "oldest", "longest"];
const SORT_LABEL: Record<Sort, string> = { recent: "Most Recent", oldest: "Oldest", longest: "Longest" };
const PERIODS: readonly Period[] = ["all", "today", "week", "month", "quarter"];
const PERIOD_LABEL: Record<Period, string> = { all: "Any Time", today: "Today", week: "Last 7 Days", month: "This Month", quarter: "This Quarter" };
const DIRECTIONS: readonly (CallDirection | "all")[] = ["all", "OUTBOUND", "INBOUND"];
const OUTCOMES: readonly (CallOutcome | "all")[] = ["all", ...(Object.keys(CALL_OUTCOME) as CallOutcome[])];

/** Setu → Activities → Calls: every logged call across leads and deals. */
export function CallsPage() {
  const calls = useSetuStore((s) => s.calls);
  const deals = useSetuStore((s) => s.deals);
  const deleteCall = useSetuStore((s) => s.deleteCall);
  const [q, setQ] = useUrlState("q", "");
  const [direction, setDirection] = useUrlState<CallDirection | "all">("direction", "all", { allowed: DIRECTIONS });
  const [outcome, setOutcome] = useUrlState<CallOutcome | "all">("outcome", "all", { allowed: OUTCOMES });
  const [rep, setRep] = useUrlState("rep", "");
  const [period, setPeriod] = useUrlState<Period>("period", "all", { allowed: PERIODS });
  const [sort, setSort] = useUrlState<Sort>("sort", "recent", { allowed: SORTS });
  // null = closed, "new" = Log Call, an id = edit that call.
  const [dialog, setDialog] = usePageViewState<string | null>("CallsPage:dialog", null);

  const today = isoDate(new Date());
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const reps = [...new Set(calls.map((c) => c.repName))].sort();

  const rows = calls
    .filter((c) => {
      const d = dealById.get(c.dealId);
      return (
        (direction === "all" || c.direction === direction) &&
        (outcome === "all" || c.outcome === outcome) &&
        (!rep || c.repName === rep) &&
        inPeriod(c.startedAt, period, today) &&
        matchesText(q, c.title, c.summary, c.contactName, c.repName, d?.company, d?.title)
      );
    })
    .sort((a, b) => (sort === "oldest" ? a.startedAt.localeCompare(b.startedAt) : sort === "longest" ? logSeconds(b) - logSeconds(a) : b.startedAt.localeCompare(a.startedAt)));
  const stats = callStats(rows);
  const filtered = q !== "" || direction !== "all" || outcome !== "all" || rep !== "" || period !== "all";
  const editing = dialog && dialog !== "new" ? calls.find((c) => c.id === dialog) : undefined;

  const exportCsv = () => {
    if (!rows.length) return toast.info("No calls to export");
    downloadCsv(
      `setu-calls-${today}.csv`,
      toCsv([
        ["Date", "Start", "Duration", "Title", "Lead / Deal", "Contact", "Rep", "Direction", "Outcome", "Summary"],
        ...rows.map((c) => [formatDate(c.startedAt), formatTime(c.startedAt), formatDuration(logSeconds(c)), c.title, dealById.get(c.dealId)?.company ?? "", c.contactName, c.repName, CALL_DIRECTION[c.direction].label, CALL_OUTCOME[c.outcome].label, c.summary]),
      ])
    );
  };

  return (
    <SetuPage>
      <ListHeader
        crumbs={[{ label: "Sales" }, { label: "Activities" }, { label: "Calls" }]}
        title="Calls"
        subtitle="Every call logged across your leads and deals."
        actions={
          <>
            <SetuButton onClick={exportCsv} disabled={rows.length === 0}>
              <Download /> Export
            </SetuButton>
            <SetuButton variant="primary" onClick={() => setDialog("new")}>
              <Plus /> Log Call
            </SetuButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={PhoneCall} label="Calls" value={String(stats.total)} hint={`${stats.outbound} outbound · ${stats.inbound} inbound`} />
        <StatTile icon={Clock3} label="Talk Time" value={formatHoursMinutes(stats.talkSeconds)} hint="Across these calls" tone="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
        <StatTile icon={Signal} label="Connect Rate" value={stats.total ? `${stats.connectRate}%` : "—"} hint="Calls that weren't missed" tone="bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300" />
        <StatTile icon={PhoneForwarded} label="With Recording" value={String(stats.withAudio)} hint="Calls with audio" tone="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" />
      </div>

      <div className="setu-card flex flex-wrap items-center gap-2 p-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="Search calls, notes, company, contact…" />
        <FilterDropdown value={period} onChange={(v) => setPeriod(v as Period)} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} className="h-9" />
        <FilterDropdown
          label="Direction"
          value={direction}
          onChange={(v) => setDirection(v as CallDirection | "all")}
          options={DIRECTIONS.map((d) => ({ value: d, label: d === "all" ? "All" : CALL_DIRECTION[d].label }))}
          className="h-9"
        />
        <FilterDropdown
          label="Outcome"
          value={outcome}
          onChange={(v) => setOutcome(v as CallOutcome | "all")}
          options={OUTCOMES.map((o) => ({ value: o, label: o === "all" ? "All" : CALL_OUTCOME[o].label }))}
          className="h-9"
        />
        <FilterDropdown label="Rep" value={rep} onChange={setRep} options={[{ value: "", label: "All Reps" }, ...reps.map((r) => ({ value: r, label: r }))]} className="h-9" />
        <ClearButton
          disabled={!filtered}
          onClick={() => {
            setQ("");
            setDirection("all");
            setOutcome("all");
            setRep("");
            setPeriod("all");
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="setu-text-2 text-xs">
          Showing <span className="font-semibold text-[var(--setu-text)]">{rows.length}</span> of {calls.length} calls · stats follow the filters
        </p>
        <SortMenu value={sort} onChange={setSort} options={SORTS} labels={SORT_LABEL} />
      </div>

      {rows.length === 0 ? (
        <div className="setu-card setu-text-2 px-6 py-14 text-center text-sm">{calls.length === 0 ? "No calls logged yet." : "No calls match these filters."}</div>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const d = dealById.get(c.dealId);
            return (
              <CallCard
                key={c.id}
                call={c}
                related={d ? { href: `${ROUTES.setuDeal(d.id)}?tab=calls`, label: `${d.company} · ${dealTitle(d)}` } : undefined}
                onEdit={() => setDialog(c.id)}
                onDelete={() => void attempt(deleteCall(c.id), "Call deleted")}
              />
            );
          })}
        </div>
      )}

      <LogCallDialog
        key={dialog ?? "closed"}
        deal={editing ? dealById.get(editing.dealId) : undefined}
        call={editing}
        open={dialog === "new" || Boolean(editing)}
        onClose={() => setDialog(null)}
      />
    </SetuPage>
  );
}
