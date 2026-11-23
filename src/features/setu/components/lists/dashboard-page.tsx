"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlarmClock, ArrowRight, BadgeCheck, CalendarDays, FileText, IndianRupee, LayoutGrid, MessageSquareText, Percent, PhoneCall, Plus, Timer, UserRoundSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { usePageViewState } from "@/lib/navigation/use-url-state";
import { STAGE_BY_ID, isOnlineChannel } from "../../constants";
import { useSetuStore } from "../../provider";
import { dealTitle, formatClock, formatDate, formatInr, formatInrShort, formatTime, formatTimeRange, isoDate, relativeDay } from "../../utils";
import { followUps, inPeriod, ownerLeaderboard, pipelineStats, recentActivity, stageBreakdown, type ActivityKind } from "../../insights";
import { CreateLeadDialog } from "../deal-form-dialog";
import { useElapsedSeconds } from "../deal/use-elapsed-seconds";
import { SetuAvatar, SetuButton, SetuPage, StageBadge } from "../setu-ui";
import { ListHeader, StatTile } from "./list-ui";

const ACTIVITY_ICON: Record<ActivityKind, React.ElementType> = {
  note: MessageSquareText,
  call: PhoneCall,
  meeting: CalendarDays,
  proposal: FileText,
  time: Timer,
};

/** Setu → Dashboard: the team's pipeline, today's agenda and recent activity. */
export function DashboardPage() {
  const deals = useSetuStore((s) => s.deals);
  const meetings = useSetuStore((s) => s.meetings);
  const notes = useSetuStore((s) => s.notes);
  const calls = useSetuStore((s) => s.calls);
  const proposals = useSetuStore((s) => s.proposals);
  const timeLogs = useSetuStore((s) => s.timeLogs);
  const activeTimer = useSetuStore((s) => s.activeTimer);
  const me = useSetuStore((s) => s.me);
  const [creating, setCreating] = usePageViewState("Dashboard:create", false);
  const elapsed = useElapsedSeconds(activeTimer?.startedAt);

  const today = isoDate(new Date());
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const stats = pipelineStats(deals);
  const wonThisMonth = deals.filter((d) => d.stage === "CLOSED_WON" && inPeriod(d.closedAt, "month", today));
  const stages = stageBreakdown(deals);
  const maxCount = Math.max(1, ...stages.map((s) => s.count));
  const leaders = ownerLeaderboard(deals).slice(0, 5);
  const due = followUps(deals, today).slice(0, 6);
  const upcoming = meetings
    .filter((m) => m.status === "UPCOMING" && isoDate(m.startAt) >= today)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5);
  const activity = recentActivity({ notes, calls, meetings, proposals, timeLogs }, 8);
  const timerDeal = activeTimer ? dealById.get(activeTimer.dealId) : undefined;

  return (
    <SetuPage>
      <ListHeader
        crumbs={[{ label: "Sales" }, { label: "Dashboard" }]}
        title={`Welcome back, ${me.name.split(" ")[0]}`}
        subtitle="Your team's pipeline, today's agenda and the latest activity."
        actions={
          <>
            <SetuButton asChild>
              <Link href={ROUTES.setuTasks}>
                <LayoutGrid /> Tasks Board
              </Link>
            </SetuButton>
            <SetuButton variant="primary" onClick={() => setCreating(true)}>
              <Plus /> Create Lead
            </SetuButton>
          </>
        }
      />

      {activeTimer && timerDeal && (
        <Link
          href={`${ROUTES.setuDeal(timerDeal.id)}?tab=time-logs`}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--setu-accent-ring)] bg-[var(--setu-accent-soft)] px-4 py-3 text-sm hover:brightness-[0.98]"
        >
          <span className="flex items-center gap-3">
            <Timer size={18} className="setu-accent-text" />
            <span>
              Timer running on <span className="font-semibold">{timerDeal.company}</span>
            </span>
          </span>
          <span className="setu-accent-text font-mono font-semibold">{formatClock(elapsed)}</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={IndianRupee} label="Open Pipeline" value={formatInrShort(stats.openValue)} hint={`${stats.openCount} open records`} />
        <StatTile
          icon={BadgeCheck}
          label="Won This Month"
          value={formatInrShort(wonThisMonth.reduce((n, d) => n + (d.value ?? 0), 0))}
          hint={`${wonThisMonth.length} deal${wonThisMonth.length === 1 ? "" : "s"} closed`}
          tone="bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300"
        />
        <StatTile icon={Percent} label="Win Rate" value={stats.winRate === null ? "—" : `${stats.winRate}%`} hint={`${stats.wonCount} won · ${stats.lostCount} lost`} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" />
        <StatTile icon={UserRoundSearch} label="Active Leads" value={String(stats.leadCount)} hint="Before a proposal" tone="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Pipeline by stage */}
        <Panel title="Pipeline by Stage" action={<PanelLink href={ROUTES.setuTasks}>Open board</PanelLink>}>
          <p className="setu-text-3 -mt-2 mb-3 text-xs">Bar length = number of records in the stage; value is the stage total.</p>
          <ul className="space-y-2.5" aria-label="Records per stage">
            {stages.map((s) => {
              const cfg = STAGE_BY_ID[s.stage];
              return (
                <li key={s.stage}>
                  <Link href={`${ROUTES.setuTasks}?stage=${s.stage}`} className="group relative grid grid-cols-[8.5rem_minmax(0,1fr)_7rem] items-center gap-3 rounded-md py-1 hover:bg-[var(--setu-soft)]">
                    <span className="truncate text-xs font-medium">{cfg.label}</span>
                    <span className="relative h-2.5 rounded-full bg-[var(--setu-well)]">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-[var(--setu-accent)] transition-[filter] group-hover:brightness-110"
                        style={{ width: s.count ? `max(${(s.count / maxCount) * 100}%, 6px)` : 0 }}
                      />
                    </span>
                    <span className="text-right text-xs tabular-nums">
                      <span className="font-semibold">{s.count}</span>
                      <span className="setu-text-3"> · {formatInrShort(s.value)}</span>
                    </span>
                    {/* Hover tooltip */}
                    <span className="pointer-events-none absolute -top-9 left-36 z-10 hidden whitespace-nowrap rounded-md border border-[var(--setu-line)] bg-[var(--setu-card)] px-2.5 py-1 text-xs shadow-[var(--setu-shadow-lg)] group-hover:block">
                      <span className="font-semibold">{cfg.label}</span> — {s.count} record{s.count === 1 ? "" : "s"} · {formatInr(s.value)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* Leaderboard */}
        <Panel title="Rep Leaderboard" action={<PanelLink href={ROUTES.setuDeals}>All deals</PanelLink>}>
          {leaders.length === 0 ? (
            <Empty text="No deals yet." />
          ) : (
            <ol className="space-y-2">
              {leaders.map((r, i) => (
                <li key={r.ownerId} className="flex items-center gap-3 rounded-lg bg-[var(--setu-well)] px-3 py-2">
                  <span className="setu-text-3 w-4 text-xs font-bold tabular-nums">{i + 1}</span>
                  <SetuAvatar name={r.ownerName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.ownerName}</span>
                    <span className="setu-text-3 block text-[11px]">
                      {r.open} open · {formatInrShort(r.openValue)} in pipeline
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-bold tabular-nums text-green-600 dark:text-green-400">{formatInrShort(r.wonValue)}</span>
                    <span className="setu-text-3 block text-[11px]">{r.won} won</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Upcoming meetings */}
        <Panel title="Upcoming Meetings" action={<PanelLink href={ROUTES.setuMeetings}>All meetings</PanelLink>}>
          {upcoming.length === 0 ? (
            <Empty text="No meetings scheduled." />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((m) => {
                const d = dealById.get(m.dealId);
                const day = relativeDay(m.startAt, today);
                return (
                  <li key={m.id}>
                    <Link href={ROUTES.setuMeeting(m.id)} className="block rounded-lg bg-[var(--setu-well)] px-3 py-2 hover:bg-[var(--setu-soft)]">
                      <span className="block truncate text-sm font-semibold">{m.title}</span>
                      <span className="setu-text-2 block text-[11px]">
                        <span className={cn(day === "Today" && "font-semibold text-[var(--setu-accent)]")}>{day ?? formatDate(m.startAt)}</span> · {formatTimeRange(m.startAt, m.endAt)} ·{" "}
                        {isOnlineChannel(m.channel) ? "Online" : m.location || "In person"}
                      </span>
                      {d && <span className="setu-text-3 block truncate text-[11px]">{d.company}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Follow-ups */}
        <Panel title="Follow-ups Due" action={<PanelLink href={`${ROUTES.setuTasks}?due=week`}>On board</PanelLink>}>
          {due.length === 0 ? (
            <Empty text="Nothing due in the next 7 days." />
          ) : (
            <ul className="space-y-2">
              {due.map(({ deal, overdue }) => (
                <li key={deal.id}>
                  <Link href={ROUTES.setuDeal(deal.id)} className="flex items-center gap-3 rounded-lg bg-[var(--setu-well)] px-3 py-2 hover:bg-[var(--setu-soft)]">
                    <AlarmClock size={15} className={overdue ? "shrink-0 text-red-500" : "setu-text-3 shrink-0"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{dealTitle(deal)}</span>
                      <span className="setu-text-3 block truncate text-[11px]">
                        {deal.company} · {deal.ownerName}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className={cn("block text-[11px] font-semibold", overdue ? "text-red-600 dark:text-red-400" : deal.dueDate === today ? "text-amber-600 dark:text-amber-400" : "setu-text-2")}>
                        {overdue ? "Overdue" : deal.dueDate === today ? "Today" : formatDate(deal.dueDate as string)}
                      </span>
                      <StageBadge stage={deal.stage} suffix="" className="mt-0.5 px-1.5 py-0 text-[10px]" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Recent activity */}
        <Panel title="Recent Activity">
          {activity.length === 0 ? (
            <Empty text="No activity yet." />
          ) : (
            <ol className="space-y-2.5">
              {activity.map((a) => {
                const Icon = ACTIVITY_ICON[a.kind];
                const d = dealById.get(a.dealId);
                return (
                  <li key={a.id} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
                      <Icon size={12} />
                    </span>
                    <span className="min-w-0">
                      <Link href={d ? ROUTES.setuDeal(d.id) : ROUTES.setuTasks} className="block truncate text-xs font-semibold hover:underline">
                        {a.title}
                      </Link>
                      <span className="setu-text-3 block truncate text-[11px]">
                        {d ? `${d.company} · ` : ""}
                        {a.detail} · {relativeDay(a.at, today) ?? formatDate(a.at)}, {formatTime(a.at)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <CreateLeadDialog stage={creating ? "LEAD" : null} onClose={() => setCreating(false)} />
    </SetuPage>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="setu-card px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="setu-accent-text flex items-center gap-1 text-xs font-medium hover:underline">
      {children} <ArrowRight size={12} />
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="setu-text-3 py-6 text-center text-xs">{text}</p>;
}
