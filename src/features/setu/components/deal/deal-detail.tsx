"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CircleX,
  Clock3,
  FileCheck2,
  FileText,
  Handshake,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Network,
  PencilLine,
  Phone,
  Play,
  Send,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageDescription, PageTitle } from "@/components/shared/page-header";
import { ROUTES } from "@/constants/routes";
import { toast } from "@/components/shared/toast";
import { useUrlState, usePageViewState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../../provider";
import type { Deal } from "../../types";
import { bniStageOf, isMember, prospectSources } from "../../bni";
import { displayCode, formatClock, formatHoursMinutes, logSeconds, phoneDigits } from "../../utils";
import { ProspectDialog } from "../bni/bni-forms";
import { StageTag } from "../bni/setu-shell";
import { Breadcrumbs, ComingSoon, SetuButton, SetuPage } from "../setu-ui";
import { DealCallsTab } from "./deal-calls-tab";
import { DealMeetingsTab } from "./deal-meetings-tab";
import { DealNegotiationsTab } from "./deal-negotiations-tab";
import { DealClosedLostTab, DealClosedWonTab } from "./deal-closure-tabs";
import { DealDiscussionsTab, DealNotesTab } from "./deal-notes-tab";
import { DealProposalsTab } from "./deal-proposals-tab";
import { DealTimeLogsTab, StopTimerDialog } from "./deal-time-logs-tab";
import { useElapsedSeconds } from "./use-elapsed-seconds";

const TABS = [
  { id: "calls", label: "Calls", icon: Phone },
  { id: "meetings", label: "Meetings", icon: CalendarDays },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "time-logs", label: "Effort Logs", icon: Clock3 },
  { id: "discussions", label: "Discussions", icon: MessagesSquare },
  { id: "proposals", label: "Proposals & Docs", icon: FileCheck2 },
  { id: "negotiations", label: "Negotiations", icon: Handshake },
  { id: "closed-won", label: "Closed Won", icon: BadgeCheck },
  { id: "closed-lost", label: "Closed Lost", icon: CircleX },
] as const;

type TabId = (typeof TABS)[number]["id"];
const TAB_IDS: readonly TabId[] = TABS.map((t) => t.id);

export function DealDetail({ dealId }: { dealId: string }) {
  const deal = useSetuStore((s) => s.deals.find((d) => d.id === dealId));
  const router = useRouter();
  const member = deal ? isMember(deal) : false;

  // BNI members live on 121 Meetings, not in the prospect workspace.
  useEffect(() => {
    if (member) router.replace(ROUTES.setuMember(dealId));
  }, [member, dealId, router]);

  if (!deal || member) {
    return (
      <SetuPage>
        <Breadcrumbs items={[{ label: "Sales Pipeline", href: ROUTES.setuPipeline }, { label: member ? "Opening…" : "Not found" }]} />
        {member ? (
          <ComingSoon title="Opening the member's 121 record…" text="BNI members are managed from 121 Meetings." />
        ) : (
          <ComingSoon title="Prospect not found" text="This record doesn't exist any more — it may have been removed." />
        )}
        <div className="flex justify-center">
          <SetuButton variant="primary" asChild>
            <Link href={member ? ROUTES.setuMember(dealId) : ROUTES.setuPipeline}>{member ? "Open 121 record" : "Back to Sales Pipeline"}</Link>
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
  const fromMember = useSetuStore((s) => prospectSources(s.deals, s.notes).get(deal.id));
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
      toast.warning("Another prospect's timer is running. Stop it there first.");
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

  const subtitle = [deal.company !== deal.contactName ? deal.company : "", deal.contactRole, deal.title].filter(Boolean).join(" · ") || "Prospect";

  return (
    <SetuPage>
      <Breadcrumbs items={[{ label: "Sales Pipeline", href: ROUTES.setuPipeline }, { label: deal.contactName }]} />

      {/* Title row — matches SetuShell and MeetingDetail */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <PageTitle>{deal.contactName}</PageTitle>
            <StageTag stage={bniStageOf(deal)} />
            <span className="setu-text-2 rounded-md border border-[var(--setu-line)] bg-[var(--setu-well)] px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide">
              {displayCode(deal)}
            </span>
            {deal.stage === "CLOSED_WON" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Revenue Recognized
              </span>
            )}
            {fromMember && (
              <Link href={ROUTES.setuMember(fromMember.id)} className="setu-text-2 text-xs font-medium transition-colors hover:text-foreground hover:underline">
                ↑ From 121 {fromMember.contactName}
              </Link>
            )}
            {!fromMember && deal.bni?.origin === "BOT" && <span className="setu-text-2 text-xs font-medium">↑ Via WhatsApp Bot</span>}
          </div>
          <PageDescription className="mt-1">
            {subtitle} · Owner: <span className="font-medium text-foreground">{deal.ownerName}</span>
          </PageDescription>
        </div>
        <div className="setu-actions flex flex-wrap items-center gap-2">
          <SetuButton onClick={() => setEditOpen(true)}>
            <PencilLine /> Edit
          </SetuButton>
          <SetuButton variant="primary" onClick={onTimerClick} className="min-w-[124px] font-mono" title={runningHere ? "Stop & save session" : "Start timer"}>
            {runningHere ? <Square className="fill-current" /> : <Play className="fill-current" />}
            {formatClock(elapsed)}
          </SetuButton>
        </div>
      </div>

      {/* Contact & quick actions */}
      {(deal.phone || deal.email || deal.location || deal.source) && (
        <section className="setu-card flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
          <div className="setu-text-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {deal.phone && (
              <a
                href={`tel:+${phoneDigits(deal.phone)}`}
                className="inline-flex items-center gap-1.5 font-medium text-[var(--setu-text)] transition-colors hover:underline"
              >
                <Phone size={13} className="setu-text-3" /> {deal.phone}
              </a>
            )}
            {deal.email && <InfoItem icon={Mail}>{deal.email}</InfoItem>}
            {deal.location && <InfoItem icon={MapPin}>{deal.location}</InfoItem>}
            {deal.source && (
              <InfoItem icon={Network}>
                Connected via: <span className="font-medium text-[var(--setu-text)]">Co {deal.source}</span>
              </InfoItem>
            )}
          </div>
          <div className="flex items-center gap-2">
            {deal.email && (
              <SetuButton variant="secondary" size="sm" asChild>
                <a href={`mailto:${deal.email}`}>
                  <Send /> Send Email
                </a>
              </SetuButton>
            )}
            {deal.phone && (
              <SetuButton variant="secondary" size="sm" asChild>
                <a href={`https://wa.me/${phoneDigits(deal.phone)}`} target="_blank" rel="noreferrer">
                  <MessageCircle /> WhatsApp
                </a>
              </SetuButton>
            )}
          </div>
        </section>
      )}

      {/* Tabs */}
      <nav className="rounded-lg border bg-card p-3 shadow-2xs" aria-label="Deal sections">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            const count = counts[t.id];
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-[var(--setu-accent-ring)] bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]"
                    : "border-border bg-background text-muted-foreground hover:border-[var(--setu-accent-ring)] hover:text-foreground"
                )}
              >
                <Icon size={12} />
                <span>{t.label}</span>
                {outcome[t.id] && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", outcome[t.id]?.tone)}>
                    {outcome[t.id]?.label}
                  </span>
                )}
                {count !== undefined && (
                  <span className={cn("text-xs tabular-nums", active ? "opacity-75" : "text-[var(--setu-text-3)]")}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
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

      <ProspectDialog deal={deal} open={editOpen} onClose={() => setEditOpen(false)} />
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
