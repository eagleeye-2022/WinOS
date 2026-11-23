"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, CalendarClock, Download, Mail, Phone, Plus, UserRoundSearch } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";
import { STAGE_BY_ID } from "../../constants";
import { useSetuStore } from "../../provider";
import type { DealStage } from "../../types";
import { formatDate, formatDateTime, isoDate, matchesDue, nextMeetingByDeal, phoneDigits, type DueFilter } from "../../utils";
import { LEAD_STAGES, downloadCsv, isLead, matchesText, toCsv } from "../../insights";
import { CreateLeadDialog, EditDealDialog } from "../deal-form-dialog";
import { FilterDropdown, SetuAvatar, SetuButton, SetuPage, StageBadge } from "../setu-ui";
import { ClearButton, DealRowMenu, EmptyRow, ListHeader, ListTable, SearchBox, StatTile } from "./list-ui";

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "any", label: "Any Due Date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due Today" },
  { value: "week", label: "Due This Week" },
  { value: "month", label: "Due This Month" },
];
const DUE_VALUES = DUE_OPTIONS.map((o) => o.value);
const STAGE_VALUES: readonly (DealStage | "all")[] = ["all", ...LEAD_STAGES];

/** Setu → Leads: every record before Proposal (Lead, Meeting, Discussions). */
export function LeadsPage() {
  const router = useRouter();
  const deals = useSetuStore((s) => s.deals);
  const meetings = useSetuStore((s) => s.meetings);
  const [q, setQ] = useUrlState("q", "");
  const [stage, setStage] = useUrlState<DealStage | "all">("stage", "all", { allowed: STAGE_VALUES });
  const [owner, setOwner] = useUrlState("owner", "");
  const [source, setSource] = useUrlState("source", "");
  const [due, setDue] = useUrlState<DueFilter>("due", "any", { allowed: DUE_VALUES });
  const [creating, setCreating] = usePageViewState("LeadsPage:create", false);
  const [editId, setEditId] = usePageViewState<string | null>("LeadsPage:edit", null);

  const today = isoDate(new Date());
  const leads = useMemo(() => deals.filter(isLead), [deals]);
  const nextMeetings = useMemo(() => nextMeetingByDeal(meetings), [meetings]);
  const owners = [...new Set(leads.map((d) => d.ownerName))].sort();
  const sources = [...new Set(leads.map((d) => d.source).filter(Boolean))].sort();
  const dueOf = (id: string, dueDate?: string) => dueDate ?? (nextMeetings.get(id) ? isoDate(nextMeetings.get(id)!.startAt) : undefined);

  const rows = leads
    .filter(
      (d) =>
        (stage === "all" || d.stage === stage) &&
        (!owner || d.ownerName === owner) &&
        (!source || d.source === source) &&
        matchesDue(dueOf(d.id, d.dueDate), due, today) &&
        matchesText(q, d.contactName, d.company, d.leadCode, d.email, d.phone, d.location, d.source, d.remark)
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const filtered = q !== "" || stage !== "all" || owner !== "" || source !== "" || due !== "any";
  const editing = deals.find((d) => d.id === editId);

  const stats = {
    total: leads.length,
    meetings: leads.filter((d) => nextMeetings.has(d.id)).length,
    dueToday: leads.filter((d) => dueOf(d.id, d.dueDate) === today).length,
    overdue: leads.filter((d) => {
      const due = dueOf(d.id, d.dueDate);
      return due !== undefined && due < today;
    }).length,
  };

  const exportCsv = () => {
    if (!rows.length) return toast.info("No leads to export");
    downloadCsv(
      `setu-leads-${today}.csv`,
      toCsv([
        ["Code", "Contact", "Role", "Company", "Stage", "Phone", "Email", "Location", "Source", "Owner", "Due", "Last Updated"],
        ...rows.map((d) => [d.leadCode, d.contactName, d.contactRole, d.company, STAGE_BY_ID[d.stage].label, d.phone, d.email, d.location, d.source, d.ownerName, dueOf(d.id, d.dueDate) ?? "", formatDateTime(d.updatedAt)]),
      ])
    );
  };

  return (
    <SetuPage>
      <ListHeader
        crumbs={[{ label: "Sales" }, { label: "Leads" }]}
        title="Leads"
        subtitle="Prospects before a proposal — new leads, scheduled meetings and open discussions."
        actions={
          <>
            <SetuButton onClick={exportCsv} disabled={rows.length === 0}>
              <Download /> Export
            </SetuButton>
            <SetuButton variant="primary" onClick={() => setCreating(true)}>
              <Plus /> Create Lead
            </SetuButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={UserRoundSearch} label="Total Leads" value={String(stats.total)} hint="Lead, Meeting & Discussions" />
        <StatTile icon={CalendarClock} label="Meetings Booked" value={String(stats.meetings)} hint="Leads with an upcoming meeting" tone="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
        <StatTile icon={AlarmClock} label="Due Today" value={String(stats.dueToday)} hint="Follow-ups for today" tone="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" />
        <StatTile icon={AlarmClock} label="Overdue" value={String(stats.overdue)} hint="Past their due date" tone="bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300" valueTone={stats.overdue ? "text-red-600 dark:text-red-400" : undefined} />
      </div>

      <div className="setu-card flex flex-wrap items-center gap-2 p-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, company, code, phone…" />
        <FilterDropdown label="Stage" value={stage} onChange={(v) => setStage(v as DealStage | "all")} options={[{ value: "all", label: "All" }, ...LEAD_STAGES.map((s) => ({ value: s, label: STAGE_BY_ID[s].label }))]} className="h-9" />
        <FilterDropdown label="Owner" value={owner} onChange={setOwner} options={[{ value: "", label: "All Reps" }, ...owners.map((o) => ({ value: o, label: o }))]} className="h-9" />
        <FilterDropdown label="Source" value={source} onChange={setSource} options={[{ value: "", label: "All" }, ...sources.map((o) => ({ value: o, label: o }))]} className="h-9" />
        <FilterDropdown value={due} onChange={(v) => setDue(v as DueFilter)} options={DUE_OPTIONS} className="h-9" />
        <ClearButton
          disabled={!filtered}
          onClick={() => {
            setQ("");
            setStage("all");
            setOwner("");
            setSource("");
            setDue("any");
          }}
        />
      </div>

      <p className="setu-text-2 text-xs">
        Showing <span className="font-semibold text-[var(--setu-text)]">{rows.length}</span> of {leads.length} leads
      </p>

      <ListTable head={["Lead", "Company", "Stage", "Contact", "Source", "Owner", "Next / Due", "Updated", ""]}>
        {rows.length === 0 ? (
          <EmptyRow colSpan={9} text={leads.length === 0 ? "No leads yet — create the first one." : "No leads match these filters."} />
        ) : (
          rows.map((d) => {
            const next = nextMeetings.get(d.id);
            const dueDate = dueOf(d.id, d.dueDate);
            return (
              <tr key={d.id} onClick={() => router.push(ROUTES.setuDeal(d.id))} className="cursor-pointer hover:bg-[var(--setu-soft)]/60">
                <td className="px-4 py-3">
                  <p className="font-semibold">{d.contactName}</p>
                  <p className="setu-text-3 text-xs">{d.contactRole}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{d.company}</p>
                  <p className="setu-text-3 font-mono text-[11px]">{d.leadCode}</p>
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={d.stage} suffix="" />
                </td>
                <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                  {d.phone && (
                    <a href={`tel:+${phoneDigits(d.phone)}`} className="setu-accent-text flex items-center gap-1 hover:underline">
                      <Phone size={12} /> {d.phone}
                    </a>
                  )}
                  {d.email && (
                    <a href={`mailto:${d.email}`} className="setu-text-2 flex items-center gap-1 hover:underline">
                      <Mail size={12} /> {d.email}
                    </a>
                  )}
                </td>
                <td className="setu-text-2 px-4 py-3 text-xs">{d.source || "—"}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 text-xs">
                    <SetuAvatar name={d.ownerName} size="xs" /> {d.ownerName}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {next ? (
                    <span className="text-violet-600 dark:text-violet-300">Meeting {formatDate(next.startAt)}</span>
                  ) : dueDate ? (
                    <span className={dueDate < today ? "font-semibold text-red-600 dark:text-red-400" : dueDate === today ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
                      {dueDate < today ? "Overdue · " : ""}
                      {formatDate(dueDate)}
                    </span>
                  ) : (
                    <span className="setu-text-3">—</span>
                  )}
                </td>
                <td className="setu-text-2 whitespace-nowrap px-4 py-3 text-xs">{formatDateTime(d.updatedAt)}</td>
                <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                  <DealRowMenu deal={d} onEdit={() => setEditId(d.id)} />
                </td>
              </tr>
            );
          })
        )}
      </ListTable>

      <CreateLeadDialog stage={creating ? "LEAD" : null} onClose={() => setCreating(false)} />
      {editing && <EditDealDialog deal={editing} open onClose={() => setEditId(null)} />}
    </SetuPage>
  );
}
