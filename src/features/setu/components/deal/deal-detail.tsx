"use client";

import Link from "next/link";
import {
  Mail,
  MapPin,
  MessageCircle,
  Network,
  PencilLine,
  Phone,
  Play,
  Send,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../../provider";
import type { Deal } from "../../types";
import { dealTitle, displayCode, formatClock, formatHoursMinutes, logSeconds, phoneDigits } from "../../utils";
import { EditDealDialog } from "../deal-form-dialog";
import { Breadcrumbs, ComingSoon, SetuButton, SetuPage, StageBadge } from "../setu-ui";
import { DealCallsTab } from "./deal-calls-tab";
import { DealMeetingsTab } from "./deal-meetings-tab";
import { DealNegotiationsTab } from "./deal-negotiations-tab";
import { DealClosedLostTab, DealClosedWonTab } from "./deal-closure-tabs";
import { DealDiscussionsTab, DealNotesTab } from "./deal-notes-tab";
import { DealProposalsTab } from "./deal-proposals-tab";
import { DealTimeLogsTab, StopTimerDialog } from "./deal-time-logs-tab";
import { useElapsedSeconds } from "./use-elapsed-seconds";

const TABS = [
  { id: "calls", label: "Calls" },
  { id: "meetings", label: "Meetings" },
  { id: "notes", label: "Notes" },
  { id: "time-logs", label: "Time Logs" },
  { id: "discussions", label: "Discussions" },
  { id: "proposals", label: "Proposals & Docs" },
  { id: "negotiations", label: "Negotiations" },
  { id: "closed-won", label: "Closed Won" },
  { id: "closed-lost", label: "Closed Lost" },
] as const;

type TabId = (typeof TABS)[number]["id"];
const TAB_IDS: readonly TabId[] = TABS.map((t) => t.id);

export function DealDetail({ dealId }: { dealId: string }) {
  const deal = useSetuStore((s) => s.deals.find((d) => d.id === dealId));

  if (!deal) {
    return (
      <SetuPage>
        <Breadcrumbs items={[{ label: "Sales" }, { label: "Deals" }, { label: "Not found" }]} />
        <ComingSoon title="Deal not found" text="This deal doesn't exist (design-phase data resets when the page is refreshed)." />
        <div className="flex justify-center">
          <SetuButton variant="primary" asChild>
            <Link href={ROUTES.setuTasks}>Back to Tasks</Link>
          </SetuButton>
        </div>
      </SetuPage>
    );
  }
  return <DealDetailBody deal={deal} />;
}

function DealDetailBody({ deal }: { deal: Deal }) {
  const activeTimer = useSetuStore((s) => s.activeTimer);
  const startTimer = useSetuStore((s) => s.startTimer);
  const noteCount = useSetuStore((s) => s.notes.filter((n) => n.dealId === deal.id && n.category === "NOTE").length);
  const negotiationCount = useSetuStore((s) => s.notes.filter((n) => n.dealId === deal.id && n.category === "NEGOTIATION").length);
  const discussionCount = useSetuStore((s) => s.notes.filter((n) => n.dealId === deal.id && n.category === "DISCUSSION").length);
  const proposalCount = useSetuStore((s) => s.proposals.filter((p) => p.dealId === deal.id && p.status !== "DRAFT").length);
  const callCount = useSetuStore((s) => s.calls.filter((c) => c.dealId === deal.id).length);
  const meetingCount = useSetuStore((s) => s.meetings.filter((m) => m.dealId === deal.id).length);
  const loggedSeconds = useSetuStore((s) => s.timeLogs.filter((l) => l.dealId === deal.id).reduce((n, l) => n + logSeconds(l), 0));
  const [tab, setTab] = useUrlState<TabId>("tab", "notes", { allowed: TAB_IDS });
  const [editOpen, setEditOpen] = usePageViewState("DealDetail:edit", false);
  const [stopOpen, setStopOpen] = usePageViewState("DealDetail:stopTimer", false);

  const runningHere = activeTimer?.dealId === deal.id;
  const elapsed = useElapsedSeconds(runningHere ? activeTimer?.startedAt : undefined);

  const onTimerClick = () => {
    if (runningHere) {
      setStopOpen(true);
      return;
    }
    if (activeTimer) {
      toast.warning("Another deal's timer is running. Stop it first (Tasks → Active Task).");
      return;
    }
    startTimer(deal.id)
      .then(() => {
        setTab("time-logs");
        toast.success("Timer started");
      })
      .catch((err: Error) => toast.error(err.message));
  };

  const counts: Partial<Record<TabId, string | number>> = {
    calls: callCount,
    meetings: meetingCount,
    notes: noteCount,
    negotiations: negotiationCount,
    discussions: discussionCount,
    proposals: proposalCount,
    "time-logs": loggedSeconds > 0 ? formatHoursMinutes(loggedSeconds) : undefined,
  };
  /** Outcome pill on the closed tabs ("Won" / "Lost"). */
  const outcome: Partial<Record<TabId, { label: string; tone: string }>> = {
    "closed-won": deal.won ? { label: "Won", tone: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" } : undefined,
    "closed-lost": deal.lost ? { label: "Lost", tone: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" } : undefined,
  };

  return (
    <SetuPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Breadcrumbs items={[{ label: "Sales" }, { label: "Deals", href: ROUTES.setuDeals }, { label: deal.company }]} />
          <span className="setu-text-2 rounded-md border border-[var(--setu-line)] bg-[var(--setu-well)] px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide">
            {displayCode(deal)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {deal.stage === "CLOSED_WON" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Revenue Recognized
            </span>
          )}
          <span className="setu-text-3">
            Owner: <span className="font-medium text-[var(--setu-text)]">{deal.ownerName}</span>
          </span>
        </div>
      </div>

      {/* Header card */}
      <section className="setu-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold leading-tight tracking-tight">{deal.company}</h1>
              <StageBadge stage={deal.stage} />
            </div>
            <p className="setu-text-2 mt-1.5 text-xs">
              {deal.contactName} • {deal.contactRole}
              {deal.stage !== "LEAD" && deal.title && <span className="setu-text-3"> · {dealTitle(deal)}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <SetuButton onClick={() => setEditOpen(true)}>
              <PencilLine /> Edit Deal
            </SetuButton>
            <SetuButton variant="primary" onClick={onTimerClick} className="min-w-[124px] font-mono" title={runningHere ? "Stop & save session" : "Start timer"}>
              {runningHere ? <Square className="fill-current" /> : <Play className="fill-current" />}
              {formatClock(elapsed)}
            </SetuButton>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--setu-line)] pt-4">
          <div className="setu-text-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {deal.phone && (
              <a
                href={`tel:+${phoneDigits(deal.phone)}`}
                className="inline-flex items-center gap-1.5 font-medium text-[var(--setu-text)] transition-colors hover:text-[var(--setu-accent)]"
              >
                <Phone size={13} className="setu-accent-text" /> {deal.phone}
              </a>
            )}
            {deal.email && <InfoItem icon={Mail}>{deal.email}</InfoItem>}
            {deal.location && <InfoItem icon={MapPin}>{deal.location}</InfoItem>}
            {deal.source && (
              <InfoItem icon={Network}>
                Source: <span className="font-medium text-[var(--setu-text)]">{deal.source}</span>
              </InfoItem>
            )}
          </div>
          <div className="flex items-center gap-2">
            {deal.email && (
              <SetuButton variant="soft" size="sm" asChild>
                <a href={`mailto:${deal.email}`}>
                  <Send /> Send Email
                </a>
              </SetuButton>
            )}
            {deal.phone && (
              <SetuButton variant="whatsapp" size="sm" asChild>
                <a href={`https://wa.me/${phoneDigits(deal.phone)}`} target="_blank" rel="noreferrer">
                  <MessageCircle /> WhatsApp
                </a>
              </SetuButton>
            )}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <nav className="setu-scroll-x flex overflow-x-auto border-b border-[var(--setu-line)]" aria-label="Deal sections">
        {TABS.map((t) => {
          const active = tab === t.id;
          const count = counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium transition-colors",
                active
                  ? "border-[var(--setu-accent)] font-semibold text-[var(--setu-accent)]"
                  : "setu-text-2 border-transparent hover:text-[var(--setu-text)]"
              )}
            >
              {t.label}
              {outcome[t.id] && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", outcome[t.id]?.tone)}>
                  {outcome[t.id]?.label}
                </span>
              )}
              {count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    active
                      ? "bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]"
                      : "bg-[var(--setu-well)] text-[var(--setu-text-2)]"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === "calls" && <DealCallsTab deal={deal} />}
      {tab === "meetings" && <DealMeetingsTab deal={deal} />}
      {tab === "notes" && <DealNotesTab dealId={deal.id} />}
      {tab === "time-logs" && <DealTimeLogsTab deal={deal} onStop={() => setStopOpen(true)} onStart={onTimerClick} />}
      {tab === "discussions" && <DealDiscussionsTab dealId={deal.id} />}
      {tab === "proposals" && <DealProposalsTab deal={deal} />}
      {tab === "negotiations" && <DealNegotiationsTab deal={deal} />}
      {/* Keyed by the saved details so the form re-fills after a save. */}
      {tab === "closed-won" && <DealClosedWonTab key={`won-${deal.won ? deal.updatedAt : "new"}`} deal={deal} />}
      {tab === "closed-lost" && <DealClosedLostTab key={`lost-${deal.lost ? deal.updatedAt : "new"}`} deal={deal} />}

      <EditDealDialog deal={deal} open={editOpen} onClose={() => setEditOpen(false)} />
      <StopTimerDialog open={stopOpen && runningHere} onClose={() => setStopOpen(false)} elapsedSeconds={elapsed} />
    </SetuPage>
  );
}

function InfoItem({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} className="setu-text-3 shrink-0" />
      <span>{children}</span>
    </span>
  );
}
