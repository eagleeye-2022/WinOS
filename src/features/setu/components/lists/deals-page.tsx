"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Download, Handshake, IndianRupee, Percent } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";
import { STAGE_BY_ID } from "../../constants";
import { useSetuStore } from "../../provider";
import type { Deal, DealStage } from "../../types";
import { dealTitle, displayCode, formatDate, formatDateTime, formatInr, formatInrShort, isoDate } from "../../utils";
import { DEALS_STAGES, downloadCsv, inPeriod, matchesText, pipelineStats, toCsv, type Period } from "../../insights";
import { EditDealDialog } from "../deal-form-dialog";
import { FilterDropdown, SetuAvatar, SetuButton, SetuPage, StageBadge } from "../setu-ui";
import { ClearButton, DealRowMenu, EmptyRow, ListHeader, ListTable, SearchBox, StatTile } from "./list-ui";

type StageFilter = "all" | "open" | DealStage;
type Sort = "updated" | "value" | "closed";
const STAGE_VALUES: readonly StageFilter[] = ["all", "open", ...DEALS_STAGES];
const PERIODS: readonly Period[] = ["all", "month", "quarter"];
const SORTS: readonly Sort[] = ["updated", "value", "closed"];
const PERIOD_LABEL: Record<Period, string> = { all: "Any Time", today: "Today", week: "This Week", month: "This Month", quarter: "This Quarter" };
const SORT_LABEL: Record<Sort, string> = { updated: "Last Updated", value: "Highest Value", closed: "Recently Closed" };

/** Setu → Deals: everything from Proposal on (Proposal, Negotiation, Closed Won, Closed Lost). */
export function DealsPage() {
  const router = useRouter();
  const all = useSetuStore((s) => s.deals);
  const [q, setQ] = useUrlState("q", "");
  const [stage, setStage] = useUrlState<StageFilter>("stage", "all", { allowed: STAGE_VALUES });
  const [owner, setOwner] = useUrlState("owner", "");
  const [period, setPeriod] = useUrlState<Period>("period", "all", { allowed: PERIODS });
  const [sort, setSort] = useUrlState<Sort>("sort", "updated", { allowed: SORTS });
  const [editId, setEditId] = usePageViewState<string | null>("DealsPage:edit", null);

  const today = isoDate(new Date());
  const deals = useMemo(() => all.filter((d) => DEALS_STAGES.includes(d.stage)), [all]);
  const owners = [...new Set(deals.map((d) => d.ownerName))].sort();
  /** Closed deals are dated by their close date; open ones by their last update. */
  const dateOf = (d: Deal) => d.closedAt ?? d.updatedAt;

  const rows = deals
    .filter(
      (d) =>
        (stage === "all" || (stage === "open" ? !STAGE_BY_ID[d.stage].closed : d.stage === stage)) &&
        (!owner || d.ownerName === owner) &&
        inPeriod(dateOf(d), period, today) &&
        matchesText(q, d.title, d.company, d.contactName, d.dealCode, d.leadCode, d.remark)
    )
    .sort((a, b) =>
      sort === "value" ? (b.value ?? 0) - (a.value ?? 0) : sort === "closed" ? (b.closedAt ?? "").localeCompare(a.closedAt ?? "") : b.updatedAt.localeCompare(a.updatedAt)
    );
  const stats = pipelineStats(rows);
  const openRows = rows.filter((d) => !STAGE_BY_ID[d.stage].closed);
  const filtered = q !== "" || stage !== "all" || owner !== "" || period !== "all";
  const editing = all.find((d) => d.id === editId);

  const exportCsv = () => {
    if (!rows.length) return toast.info("No deals to export");
    downloadCsv(
      `setu-deals-${today}.csv`,
      toCsv([
        ["Code", "Deal", "Company", "Contact", "Stage", "Value (INR)", "Proposal", "Owner", "Closed", "Last Updated"],
        ...rows.map((d) => [displayCode(d), dealTitle(d), d.company, d.contactName, STAGE_BY_ID[d.stage].label, d.value ?? "", d.proposalVersion ? `V${d.proposalVersion}` : "", d.ownerName, d.closedAt ?? "", formatDateTime(d.updatedAt)]),
      ])
    );
  };

  return (
    <SetuPage>
      <ListHeader
        crumbs={[{ label: "Sales" }, { label: "Deals" }]}
        title="Deals"
        subtitle="Proposals, negotiations and closed deals — open pipeline and results."
        actions={
          <SetuButton onClick={exportCsv} disabled={rows.length === 0}>
            <Download /> Export
          </SetuButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={IndianRupee} label="Open Pipeline" value={formatInrShort(openRows.reduce((n, d) => n + (d.value ?? 0), 0))} hint={`${openRows.length} open deal${openRows.length === 1 ? "" : "s"}`} />
        <StatTile icon={BadgeCheck} label="Won" value={formatInrShort(stats.wonValue)} hint={`${stats.wonCount} deal${stats.wonCount === 1 ? "" : "s"} closed won`} tone="bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300" />
        <StatTile icon={Percent} label="Win Rate" value={stats.winRate === null ? "—" : `${stats.winRate}%`} hint={`${stats.wonCount} won · ${stats.lostCount} lost`} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" />
        <StatTile icon={Handshake} label="Avg. Won Deal" value={stats.avgWon === null ? "—" : formatInrShort(stats.avgWon)} hint="Closed-won value per deal" tone="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
      </div>

      <div className="setu-card flex flex-wrap items-center gap-2 p-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="Search deal, company, contact, code…" />
        <FilterDropdown
          label="Stage"
          value={stage}
          onChange={(v) => setStage(v as StageFilter)}
          options={[{ value: "all", label: "All" }, { value: "open", label: "Open (Proposal & Negotiation)" }, ...DEALS_STAGES.map((s) => ({ value: s, label: STAGE_BY_ID[s].label }))]}
          className="h-9"
        />
        <FilterDropdown label="Owner" value={owner} onChange={setOwner} options={[{ value: "", label: "All Reps" }, ...owners.map((o) => ({ value: o, label: o }))]} className="h-9" />
        <FilterDropdown value={period} onChange={(v) => setPeriod(v as Period)} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} className="h-9" />
        <FilterDropdown label="Sort" value={sort} onChange={(v) => setSort(v as Sort)} options={SORTS.map((s) => ({ value: s, label: SORT_LABEL[s] }))} className="h-9" />
        <ClearButton
          disabled={!filtered}
          onClick={() => {
            setQ("");
            setStage("all");
            setOwner("");
            setPeriod("all");
          }}
        />
      </div>

      <p className="setu-text-2 text-xs">
        Showing <span className="font-semibold text-[var(--setu-text)]">{rows.length}</span> of {deals.length} deals · stats follow the filters
      </p>

      <ListTable head={["Deal", "Company", "Stage", "Value", "Proposal", "Owner", "Closed / Updated", ""]}>
        {rows.length === 0 ? (
          <EmptyRow colSpan={8} text={deals.length === 0 ? "No deals yet — leads become deals when they reach Proposal." : "No deals match these filters."} />
        ) : (
          rows.map((d) => (
            <tr key={d.id} onClick={() => router.push(ROUTES.setuDeal(d.id))} className="cursor-pointer hover:bg-[var(--setu-soft)]/60">
              <td className="px-4 py-3">
                <p className="font-semibold">{dealTitle(d)}</p>
                <p className="setu-text-3 font-mono text-[11px]">{displayCode(d)}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium">{d.company}</p>
                <p className="setu-text-3 text-xs">{d.contactName}</p>
              </td>
              <td className="px-4 py-3">
                <StageBadge stage={d.stage} suffix="" />
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">{d.value !== undefined ? formatInr(d.value) : <span className="setu-text-3 font-normal">—</span>}</td>
              <td className="setu-text-2 px-4 py-3 text-xs">{d.proposalVersion ? `V${d.proposalVersion}` : "—"}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2 text-xs">
                  <SetuAvatar name={d.ownerName} size="xs" /> {d.ownerName}
                </span>
              </td>
              <td className="setu-text-2 whitespace-nowrap px-4 py-3 text-xs">{d.closedAt ? `Closed ${formatDate(d.closedAt)}` : formatDateTime(d.updatedAt)}</td>
              <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                <DealRowMenu deal={d} onEdit={() => setEditId(d.id)} />
              </td>
            </tr>
          ))
        )}
      </ListTable>

      {editing && <EditDealDialog deal={editing} open onClose={() => setEditId(null)} />}
    </SetuPage>
  );
}
