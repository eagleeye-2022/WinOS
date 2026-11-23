"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  Download,
  EllipsisVertical,
  Handshake,
  ListFilter,
  MapPin,
  Percent,
  Plus,
  Timer,
  Trophy,
  Video,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePageViewState } from "@/lib/navigation/use-url-state";
import { STAGE_BY_ID, STAGE_DOT, isOnlineChannel } from "../../constants";
import { useSetuStore } from "../../provider";
import type { Deal, DealCall, DealMeeting, DealStage } from "../../types";
import { dealTitle, formatClock, formatDate, formatInr, formatInrShort, formatTimeRange, isoDate, relativeDay } from "../../utils";
import { changePct, downloadCsv, followUps, inPeriod, monthlySeries, ownerLeaderboard, pipelineStats, previousMonth, stageBreakdown, toCsv } from "../../insights";
import { CreateLeadDialog } from "../deal-form-dialog";
import { useElapsedSeconds } from "../deal/use-elapsed-seconds";
import { useNow } from "../meetings/use-now";
import { SetuAvatar, SetuButton, SetuPage, StageBadge } from "../setu-ui";

// Setu Dashboard — layout modelled on the reference finance dashboard (balance card + KPI cards +
// monthly overview chart, then list cards and a recent table), styled with the app theme tokens.
// Every number comes from the Setu snapshot; nothing is mocked.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
const IST_HOUR = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" });

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type Metric = "won" | "calls" | "meetings";
const METRIC_LABEL: Record<Metric, string> = { won: "Won Revenue", calls: "Calls Logged", meetings: "Meetings Held" };
const METRICS: Metric[] = ["won", "calls", "meetings"];
const SUMMARY_STAGES: DealStage[] = ["PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"];

export function DashboardPage() {
  const deals = useSetuStore((s) => s.deals);
  const meetings = useSetuStore((s) => s.meetings);
  const calls = useSetuStore((s) => s.calls);
  const activeTimer = useSetuStore((s) => s.activeTimer);
  const me = useSetuStore((s) => s.me);
  const [creating, setCreating] = usePageViewState("Dashboard:create", false);
  const elapsed = useElapsedSeconds(activeTimer?.startedAt);

  const today = isoDate(new Date());
  const thisMonth = today.slice(0, 7);
  const lastMonth = previousMonth(today);
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  const stats = pipelineStats(deals);
  const stages = stageBreakdown(deals);
  const won = useMemo(() => deals.filter((d) => d.stage === "CLOSED_WON"), [deals]);
  const wonIn = (month: string) => won.filter((d) => d.closedAt?.startsWith(month)).reduce((n, d) => n + (d.value ?? 0), 0);
  const wonThisMonth = wonIn(thisMonth);
  const timerDeal = activeTimer ? dealById.get(activeTimer.dealId) : undefined;
  const dateLabel = `${WEEKDAY.format(new Date())}, ${formatDate(today)}`;
  const now = useNow();
  // Server render / hydration use the neutral greeting; the time-based one appears right after.
  const greeting = now === null ? "Welcome back" : greetingFor(Number(IST_HOUR.format(new Date(now))));
  const meetingsToday = meetings.filter((m) => m.status === "UPCOMING" && isoDate(m.startAt) === today).length;
  const open = deals.filter((d) => !STAGE_BY_ID[d.stage].closed && d.dueDate);
  const dueToday = open.filter((d) => d.dueDate === today).length;
  const overdueCount = open.filter((d) => (d.dueDate as string) < today).length;

  const exportSummary = () =>
    downloadCsv(
      `setu-dashboard-${today}.csv`,
      toCsv([
        ["Metric", "Value"],
        ["Open pipeline (INR)", stats.openValue],
        ["Open records", stats.openCount],
        ["Active leads", stats.leadCount],
        ["Won this month (INR)", wonThisMonth],
        ["Won all time (INR)", stats.wonValue],
        ["Win rate (%)", stats.winRate ?? ""],
        [],
        ["Stage", "Records", "Value (INR)"],
        ...stages.map((s) => [STAGE_BY_ID[s.stage].label, s.count, s.value]),
      ])
    );

  return (
    <SetuPage>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="setu-text-3 text-[11px] font-semibold uppercase tracking-wider">Sales Dashboard</p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight">
            {greeting}, {me.name.split(" ")[0]}
          </h1>
          {/* Today at a glance — each item opens the matching filtered list. */}
          <p className="setu-text-2 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <Link href={`${ROUTES.setuMeetings}?range=today`} className="hover:text-[var(--setu-text)] hover:underline">
              <span className="font-semibold text-[var(--setu-text)]">{meetingsToday}</span> meeting{meetingsToday === 1 ? "" : "s"} today
            </Link>
            <span aria-hidden>·</span>
            <Link href={`${ROUTES.setuLeads}?due=today`} className="hover:text-[var(--setu-text)] hover:underline">
              <span className="font-semibold text-[var(--setu-text)]">{dueToday}</span> follow-up{dueToday === 1 ? "" : "s"} due
            </Link>
            {overdueCount > 0 && (
              <>
                <span aria-hidden>·</span>
                <Link href={`${ROUTES.setuLeads}?due=overdue`} className="font-medium text-red-600 hover:underline dark:text-red-400">
                  {overdueCount} overdue
                </Link>
              </>
            )}
            <span aria-hidden>·</span>
            <Link href={`${ROUTES.setuDeals}?stage=open`} className="hover:text-[var(--setu-text)] hover:underline">
              <span className="font-semibold text-[var(--setu-text)]">{formatInrShort(stats.openValue)}</span> in open pipeline
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="setu-card flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium">
            <CalendarDays size={15} className="setu-text-2" /> {dateLabel}
          </span>
          <SetuButton variant="primary" onClick={exportSummary}>
            <Download /> Export
          </SetuButton>
        </div>
      </div>

      {activeTimer && timerDeal && (
        <Link
          href={`${ROUTES.setuDeal(timerDeal.id)}?tab=time-logs`}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--setu-accent-ring)] bg-[var(--setu-accent-soft)] px-4 py-2.5 text-sm hover:brightness-[0.98]"
        >
          <span className="flex items-center gap-2.5">
            <Timer size={16} className="setu-accent-text" /> Timer running on <span className="font-semibold">{timerDeal.company}</span>
          </span>
          <span className="setu-accent-text font-mono font-semibold">{formatClock(elapsed)}</span>
        </Link>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        {/* ── Pipeline card (the reference's "Account Balance") ── */}
        <Card>
          <CardHead icon={Wallet} title="Open Pipeline" />
          <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums">{formatInr(stats.openValue)}</p>
          <p className="setu-text-2 mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <Chip tone="accent">{stats.openCount} open</Chip>
            {stats.leadCount} leads · {stats.openCount - stats.leadCount} deals in progress
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <SetuButton variant="primary" onClick={() => setCreating(true)}>
              <Plus /> Create Lead
            </SetuButton>
            <SetuButton asChild>
              <Link href={ROUTES.setuMeetingNew}>
                <CalendarPlus /> Schedule Meeting
              </Link>
            </SetuButton>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Deals by Stage</h3>
            <SetuButton size="sm" asChild>
              <Link href={ROUTES.setuDeals}>View all</Link>
            </SetuButton>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {SUMMARY_STAGES.map((id) => {
              const s = stages.find((x) => x.stage === id)!;
              return (
                <Link
                  key={id}
                  href={`${ROUTES.setuDeals}?stage=${id}`}
                  className="rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] px-3 py-2.5 transition-colors hover:border-[var(--setu-line-strong)]"
                >
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <span className={cn("h-2 w-2 rounded-full", STAGE_DOT[id])} />
                    {STAGE_BY_ID[id].label}
                  </span>
                  <span className="mt-1.5 block text-base font-bold tabular-nums">{formatInrShort(s.value)}</span>
                  <span
                    className={cn(
                      "block text-[11px] font-medium",
                      id === "CLOSED_WON" ? "text-green-600 dark:text-green-400" : id === "CLOSED_LOST" ? "text-red-600 dark:text-red-400" : "setu-text-3"
                    )}
                  >
                    {s.count} {s.count === 1 ? "deal" : "deals"}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-4">
          {/* ── KPI cards (the reference's Expenses / Savings) ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              icon={Trophy}
              title="Won This Month"
              value={formatInr(wonThisMonth)}
              change={changePct(wonThisMonth, wonIn(lastMonth))}
              note={wonIn(lastMonth) ? "from last month" : "No wins last month to compare"}
              href={`${ROUTES.setuDeals}?stage=CLOSED_WON&period=month`}
            />
            <KpiCard icon={Percent} title="Win Rate" value={stats.winRate === null ? "—" : `${stats.winRate}%`} note={`${stats.wonCount} won · ${stats.lostCount} lost`} href={ROUTES.setuDeals} />
          </div>
          <OverviewChart won={won} calls={calls} meetings={meetings} today={today} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        <div className="grid content-start gap-4">
          <UpcomingMeetings meetings={meetings} dealById={dealById} today={today} />
          <FollowUpsCard deals={deals} today={today} />
        </div>
        <div className="grid content-start gap-4">
          <RecentDeals deals={deals} />
          <Leaderboard deals={deals} today={today} />
        </div>
      </div>

      <CreateLeadDialog stage={creating ? "LEAD" : null} onClose={() => setCreating(false)} />
    </SetuPage>
  );
}

// ── Building blocks ───────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("setu-card rounded-2xl p-5", className)}>{children}</section>;
}

function CardHead({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)]">
          <Icon size={16} />
        </span>
        {title}
      </h2>
      {action}
    </div>
  );
}

function Chip({ tone, children }: { tone: "up" | "down" | "accent"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        tone === "up" && "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400",
        tone === "down" && "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400",
        tone === "accent" && "bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]"
      )}
    >
      {children}
    </span>
  );
}

/** The ⋯ button on a card: one link to the full page. */
function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="More" className="setu-text-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[var(--setu-line)] hover:bg-[var(--setu-soft)]">
          <EllipsisVertical size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={href}>{label}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function KpiCard({ icon, title, value, change, note, href }: { icon: React.ElementType; title: string; value: string; change?: number | null; note: string; href: string }) {
  return (
    <Card>
      <CardHead icon={icon} title={title} action={<MoreLink href={href} label="View details" />} />
      <p className="mt-4 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="setu-text-2 mt-1.5 flex items-center gap-2 text-xs">
        {change !== undefined && change !== null && (
          <Chip tone={change >= 0 ? "up" : "down"}>
            {change >= 0 ? "+" : ""}
            {change}% {change >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
          </Chip>
        )}
        {note}
      </p>
    </Card>
  );
}

function SmallSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] px-2.5 text-xs font-medium hover:border-[var(--setu-line-strong)] hover:bg-[var(--setu-soft)]">
          {options.find((o) => o.value === value)?.label ?? value}
          <ChevronDown size={12} className="setu-text-2" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="setu-text-3 py-6 text-center text-xs">{text}</p>;
}

// ── Overview chart ────────────────────────────────────────────────────────────

/** Rounds up to a tidy axis maximum (1, 2, 2.5, 5 × 10ⁿ). */
function niceCeil(v: number): number {
  if (v <= 0) return 4;
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

/**
 * Single-series monthly bar chart in one hue (the brand blue). The highlighted bar is the hovered /
 * focused month, otherwise the current month; its tooltip shows the exact value. A screen-reader
 * table carries the same numbers.
 */
function OverviewChart({ won, calls, meetings, today }: { won: Deal[]; calls: DealCall[]; meetings: DealMeeting[]; today: string }) {
  const thisYear = Number(today.slice(0, 4));
  const [metric, setMetric] = usePageViewState<Metric>("Dashboard:metric", "won");
  const [year, setYear] = usePageViewState<number>("Dashboard:year", thisYear);
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(() => {
    if (metric === "won") return monthlySeries(won.map((d) => ({ at: d.closedAt, value: d.value ?? 0 })), year);
    if (metric === "calls") return monthlySeries(calls.map((c) => ({ at: c.startedAt, value: 1 })), year);
    return monthlySeries(meetings.filter((m) => m.status === "COMPLETED").map((m) => ({ at: m.startAt, value: 1 })), year);
  }, [metric, year, won, calls, meetings]);

  const max = Math.max(...series, 0);
  const top = niceCeil(max);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => top * f);
  const fmt = (v: number) => (metric === "won" ? formatInrShort(v) : String(Math.round(v)));
  const fmtFull = (v: number) => (metric === "won" ? formatInr(v) : String(v));
  const currentMonth = year === thisYear ? Number(today.slice(5, 7)) - 1 : -1;
  const focus = hover ?? (currentMonth >= 0 ? currentMonth : series.indexOf(max));
  const total = series.reduce((n, v) => n + v, 0);

  return (
    <Card className="flex flex-col">
      <CardHead
        icon={BarChart3}
        title="Overview"
        action={
          <div className="flex items-center gap-2">
            <SmallSelect value={metric} onChange={(v) => setMetric(v as Metric)} options={METRICS.map((m) => ({ value: m, label: METRIC_LABEL[m] }))} />
            <SmallSelect
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={[
                { value: String(thisYear), label: "This Year" },
                { value: String(thisYear - 1), label: "Last Year" },
              ]}
            />
          </div>
        }
      />
      <p className="setu-text-2 mt-2 text-xs">
        {year} total: <span className="font-semibold text-[var(--setu-text)]">{fmtFull(total)}</span>
      </p>

      <div className="mt-4 grid flex-1 grid-cols-[2.75rem_minmax(0,1fr)] gap-2">
        {/* Y axis */}
        <div className="setu-text-3 flex h-52 flex-col justify-between pb-6 text-right text-[10px] tabular-nums">
          {ticks.map((t, i) => (
            <span key={i} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {fmt(t)}
            </span>
          ))}
        </div>
        <div className="relative">
          {/* Recessive grid */}
          <div className="pointer-events-none absolute inset-x-0 bottom-6 top-0 flex flex-col justify-between">
            {ticks.map((_, i) => (
              <span key={i} className="border-t border-dashed border-[var(--setu-line)]" />
            ))}
          </div>
          <div className="relative flex h-52 items-end gap-[2px] pb-6" onMouseLeave={() => setHover(null)}>
            {series.map((v, i) => {
              const active = i === focus;
              const h = (v / top) * 100;
              return (
                <button
                  key={MONTHS[i]}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${MONTHS[i]} ${year}: ${fmtFull(v)}`}
                  className="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end outline-none"
                >
                  {active && (
                    <span
                      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-[var(--setu-line)] bg-[var(--setu-card)] px-2.5 py-1.5 text-left shadow-[var(--setu-shadow-lg)]"
                      style={{ bottom: `min(calc(${Math.max(h, 2)}% + 0.5rem), calc(100% - 3.25rem))` }}
                    >
                      <span className="setu-text-2 block text-[10px]">
                        {METRIC_LABEL[metric]} · {MONTHS[i]}
                      </span>
                      <span className="block text-sm font-bold tabular-nums">{fmtFull(v)}</span>
                    </span>
                  )}
                  <span
                    className={cn(
                      "w-[62%] max-w-10 rounded-t-[4px] transition-colors",
                      active
                        ? "bg-gradient-to-b from-[var(--setu-accent)] to-[color-mix(in_oklch,var(--setu-accent)_35%,transparent)] ring-2 ring-[var(--setu-accent-ring)]"
                        : "bg-[var(--setu-soft)] group-hover:bg-[var(--setu-line-strong)]"
                    )}
                    style={{ height: `${Math.max(h, v ? 3 : 1.5)}%` }}
                  />
                  <span className={cn("absolute bottom-0 text-[10px]", active ? "font-semibold text-[var(--setu-text)]" : "setu-text-3")}>{MONTHS[i]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>
          {METRIC_LABEL[metric]} per month, {year}
        </caption>
        <tbody>
          {series.map((v, i) => (
            <tr key={i}>
              <th scope="row">{MONTHS[i]}</th>
              <td>{fmtFull(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// ── Lower cards ───────────────────────────────────────────────────────────────

function UpcomingMeetings({ meetings, dealById, today }: { meetings: DealMeeting[]; dealById: Map<string, Deal>; today: string }) {
  const upcoming = meetings
    .filter((m) => m.status === "UPCOMING" && isoDate(m.startAt) >= today)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 3);
  return (
    <Card>
      <CardHead icon={CalendarDays} title="Upcoming Meetings" action={<MoreLink href={ROUTES.setuMeetings} label="All meetings" />} />
      <div className="mt-4 space-y-2.5">
        {upcoming.length === 0 ? (
          <Empty text="No meetings scheduled." />
        ) : (
          upcoming.map((m) => {
            const d = dealById.get(m.dealId);
            const day = relativeDay(m.startAt, today);
            const online = isOnlineChannel(m.channel);
            return (
              <Link
                key={m.id}
                href={ROUTES.setuMeeting(m.id)}
                className="block rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] px-3.5 py-3 transition-colors hover:border-[var(--setu-line-strong)]"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
                    {online ? <Video size={15} /> : <MapPin size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.title}</span>
                    <span className="setu-text-3 block truncate text-[11px]">{d?.company ?? ""}</span>
                  </span>
                </span>
                <span className="setu-text-2 mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className={cn(day === "Today" && "font-semibold text-[var(--setu-accent)]")}>
                    {day ?? formatDate(m.startAt)} · {formatTimeRange(m.startAt, m.endAt)}
                  </span>
                  <span className="setu-text-3 truncate">{online ? "Online" : m.location || "In person"}</span>
                </span>
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}

function FollowUpsCard({ deals, today }: { deals: Deal[]; today: string }) {
  const all = followUps(deals, today);
  const overdue = all.filter((f) => f.overdue).length;
  return (
    <Card>
      <CardHead icon={AlarmClock} title="Follow-ups Due" action={<MoreLink href={`${ROUTES.setuLeads}?due=week`} label="See in Leads" />} />
      <p className="setu-text-2 mt-2 text-xs">
        Next 7 days
        {overdue > 0 && (
          <>
            {" "}
            · <span className="font-semibold text-red-600 dark:text-red-400">{overdue} overdue</span>
          </>
        )}
      </p>
      <div className="mt-3 space-y-2">
        {all.length === 0 ? (
          <Empty text="Nothing due this week." />
        ) : (
          all.slice(0, 4).map(({ deal, overdue: late }) => (
            <Link key={deal.id} href={ROUTES.setuDeal(deal.id)} className="flex items-center gap-3 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] px-3 py-2.5 hover:border-[var(--setu-line-strong)]">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{dealTitle(deal)}</span>
                <span className="setu-text-3 block truncate text-[11px]">
                  {deal.company} · {deal.ownerName}
                </span>
              </span>
              <span className={cn("shrink-0 text-xs font-semibold", late ? "text-red-600 dark:text-red-400" : deal.dueDate === today ? "text-amber-600 dark:text-amber-400" : "setu-text-2")}>
                {late ? "Overdue" : deal.dueDate === today ? "Today" : formatDate(deal.dueDate as string)}
              </span>
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}

function RecentDeals({ deals }: { deals: Deal[] }) {
  const [stage, setStage] = usePageViewState<DealStage | "all">("Dashboard:recentStage", "all");
  const rows = deals
    .filter((d) => stage === "all" || d.stage === stage)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);
  return (
    <Card className="overflow-hidden">
      <CardHead
        icon={Handshake}
        title="Recent Deals"
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SetuButton size="sm" className={cn(stage !== "all" && "ring-2 ring-[var(--setu-accent-ring)]")}>
                {stage === "all" ? "Filter" : STAGE_BY_ID[stage].label} <ListFilter />
              </SetuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={stage} onValueChange={(v) => setStage(v as DealStage | "all")}>
                <DropdownMenuRadioItem value="all">All stages</DropdownMenuRadioItem>
                {Object.values(STAGE_BY_ID).map((s) => (
                  <DropdownMenuRadioItem key={s.id} value={s.id}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <div className="setu-scroll-x mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="setu-text-2 bg-[var(--setu-well)] text-left text-[11px] font-semibold">
              <th className="rounded-l-lg px-3 py-2 font-semibold">Deal</th>
              <th className="px-3 py-2 font-semibold">Updated</th>
              <th className="px-3 py-2 font-semibold">Value</th>
              <th className="rounded-r-lg px-3 py-2 font-semibold">Stage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--setu-line)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <Empty text={stage === "all" ? "No deals yet." : "No deals in this stage."} />
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--setu-soft)]/60">
                  <td className="px-3 py-2.5">
                    <Link href={ROUTES.setuDeal(d.id)} className="flex items-center gap-2.5">
                      <SetuAvatar name={d.company} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium hover:underline">{dealTitle(d)}</span>
                        <span className="setu-text-3 block truncate text-[11px]">{d.company}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="setu-text-2 whitespace-nowrap px-3 py-2.5 text-xs">{formatDate(d.updatedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums">{d.value !== undefined ? formatInr(d.value) : <span className="setu-text-3 font-normal">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <StageBadge stage={d.stage} suffix="" className="px-2 py-0 text-[11px]" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Leaderboard({ deals, today }: { deals: Deal[]; today: string }) {
  const leaders = ownerLeaderboard(deals).slice(0, 4);
  const wonThisQuarter = deals.filter((d) => d.stage === "CLOSED_WON" && inPeriod(d.closedAt, "quarter", today)).length;
  return (
    <Card>
      <CardHead icon={BadgeCheck} title="Rep Leaderboard" action={<MoreLink href={ROUTES.setuDeals} label="All deals" />} />
      <p className="setu-text-2 mt-2 text-xs">
        {wonThisQuarter} deal{wonThisQuarter === 1 ? "" : "s"} won this quarter
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {leaders.length === 0 ? (
          <Empty text="No deals yet." />
        ) : (
          leaders.map((r, i) => (
            <div key={r.ownerId} className="flex items-center gap-3 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] px-3 py-2.5">
              <span className="setu-text-3 w-3 text-xs font-bold tabular-nums">{i + 1}</span>
              <SetuAvatar name={r.ownerName} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.ownerName}</span>
                <span className="setu-text-3 block truncate text-[11px]">
                  {r.open} open · {formatInrShort(r.openValue)}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-bold tabular-nums text-green-600 dark:text-green-400">{formatInrShort(r.wonValue)}</span>
                <span className="setu-text-3 block text-[11px]">{r.won} won</span>
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
