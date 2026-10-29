"use client";

import Link from "next/link";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Camera,
  Handshake,
  MessageCircle,
  MousePointer2,
  NotebookPen,
  ScanText,
  SquareKanban,
  Trophy,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_BOT_CAPTURES } from "../data/mock-setu";
import { SETU_CHAPTER, SOURCE_LABEL } from "../constants";
import { useSetuStore } from "../store";
import type { Prospect, ProspectSource } from "../types";
import { computeStats, formatDate, referralBalance } from "../utils";
import {
  AvatarStack,
  IconTile,
  PanelLink,
  Pill,
  SetuAvatar,
  SetuButton,
  SetuPage,
  SetuPanel,
  SourceBadge,
  Sparkline,
  StatTile,
} from "./setu-ui";

/** Prospects touched per week for the last `weeks` weeks, ending at the latest update. */
function weeklyActivity(prospects: Prospect[], weeks = 10): number[] {
  const latest = prospects.reduce((m, p) => (p.updatedAt > m ? p.updatedAt : m), "");
  if (!latest) return Array(weeks).fill(0.5);
  const end = new Date(`${latest}T00:00:00Z`).getTime();
  const week = 7 * 24 * 3600 * 1000;
  const counts = Array.from({ length: weeks }, (_, i) => {
    const to = end - (weeks - 1 - i) * week;
    const from = to - week;
    return prospects.filter((p) => {
      const t = new Date(`${p.updatedAt}T00:00:00Z`).getTime();
      return t > from && t <= to;
    }).length;
  });
  const max = Math.max(1, ...counts);
  return counts.map((c) => 0.12 + (c / max) * 0.78);
}

export function SetuDashboard() {
  const meetings = useSetuStore((s) => s.meetings);
  const prospects = useSetuStore((s) => s.prospects);
  const referrals = useSetuStore((s) => s.referrals);

  const stats = computeStats(meetings, prospects);
  const balance = referralBalance(referrals);
  const byDate = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  const recentMeetings = byDate.slice(0, 5);
  const pendingConversions = meetings.reduce((n, m) => n + m.pendingReferralNames.length, 0);
  const openTodos = meetings.flatMap((m) => m.todos.filter((t) => !t.done).map((t) => ({ ...t, meeting: m }))).slice(0, 5);
  const sources: ProspectSource[] = ["MEETING_121", "WHATSAPP_BOT", "MANUAL"];
  const sourceCounts = sources.map((src) => ({ src, n: prospects.filter((p) => p.source === src).length }));
  const topReferrer = [...meetings].sort((a, b) => b.refsReceived - a.refsReceived)[0];
  const activity = weeklyActivity(prospects);
  const markerIdx = activity.length - 3;
  // "This month" = the month of the latest 121 meeting, so the mock data reads sensibly.
  const latestMonth = byDate[0]?.date.slice(0, 7) ?? "";
  const movedThisMonth = prospects.filter((p) => p.updatedAt.startsWith(latestMonth)).length;

  // Two rows of people for the "121 → Prospect" illustration (members on top, prospects below).
  const memberRow = byDate.map((m) => m.memberName);
  const prospectRow = prospects.filter((p) => p.source !== "MANUAL").map((p) => p.name);

  return (
    <SetuPage
      icon={Handshake}
      title="Setu"
      description={`BNI networking CRM · ${SETU_CHAPTER.name} chapter · ${SETU_CHAPTER.membership}`}
      actions={
        <>
          <SetuButton asChild>
            <Link href="/setu/pipeline">
              <SquareKanban /> Pipeline
            </Link>
          </SetuButton>
          <SetuButton asChild variant="primary">
            <Link href="/setu/meetings?new=1">
              Log 121 Meeting <ArrowRight />
            </Link>
          </SetuButton>
        </>
      }
    >
      {/* Network strip */}
      <div className="flex flex-wrap items-center gap-4">
        <AvatarStack names={memberRow} />
        <div className="text-sm">
          <span className="font-semibold">{meetings.length} members met</span>
          <span className="setu-text-3"> · {stats.refsReceived} referrals received</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Activity} tone="emerald" value={`${stats.pipelineHealth}%`} label="Pipeline Health" hint="Prospects not Lost or On Hold" />
        <StatTile icon={SquareKanban} tone="primary" value={stats.prospects} label="Prospects" />
        <StatTile icon={Users2} tone="orange" value={stats.meetings} label="121 Meetings" />
        <StatTile icon={ArrowDownLeft} tone="green" value={stats.refsReceived} label="Refs Received" />
        <StatTile icon={ArrowUpRight} tone="violet" value={stats.refsGiven} label="Refs Given" />
        <StatTile icon={Trophy} tone="green" value={stats.won} label="Deals Won" />
      </div>

      {/* Bento — row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="setu-card relative overflow-hidden p-7 lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">From 121 meetings to prospects</h2>
          <p className="setu-text-2 mt-1.5 max-w-lg text-sm leading-relaxed">
            Every referral you receive in a 121 becomes a prospect in the pipeline — one click, no re-typing.
          </p>

          <div className="relative mt-6">
            <div className="setu-grid-bg pointer-events-none absolute -inset-6" />
            {/* connector lines */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path d="M38 0 V12 H47 V22" fill="none" stroke="var(--setu-line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <path d="M56 78 V88 H70 V100" fill="none" stroke="var(--setu-accent)" strokeOpacity="0.6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="setu-fade-x relative space-y-4 py-8">
              <div className="flex justify-center gap-4">
                {memberRow.slice(0, 7).map((n) => (
                  <span key={n} className="setu-tile h-16 w-16 shrink-0 p-2.5">
                    <SetuAvatar name={n} className="h-full w-full" />
                  </span>
                ))}
              </div>
              <div className="flex justify-center gap-4 pl-16">
                {prospectRow.slice(0, 7).map((n) => (
                  <span key={n} className="setu-tile h-16 w-16 shrink-0 p-2.5">
                    <SetuAvatar name={n} className="h-full w-full" />
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Pill dot="bg-amber-500">{pendingConversions} names waiting to convert</Pill>
              <Pill dot="bg-[var(--setu-accent)]">
                {balance.converted}/{balance.received} referrals in pipeline
              </Pill>
            </div>
            <SetuButton asChild size="sm">
              <Link href="/setu/meetings?filter=pending">
                Convert referrals <ArrowRight />
              </Link>
            </SetuButton>
          </div>
        </section>

        <section className="setu-card relative flex flex-col overflow-hidden p-7">
          <div className="relative flex-1 pt-12">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap">
              <span className="setu-chip setu-text-2 px-3 py-1.5 text-xs">+{movedThisMonth} prospects moved this month</span>
            </div>
            <Sparkline points={activity} marker={markerIdx} height={150} />
            <MousePointer2
              size={20}
              className="pointer-events-none absolute -rotate-12 fill-[var(--setu-accent)] text-[var(--setu-accent-strong)]"
              style={{ left: `calc(${(markerIdx / (activity.length - 1)) * 100}% + 10px)`, top: "70%" }}
            />
          </div>
          <div className="mt-6">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-semibold tracking-tight">Pipeline health</h2>
              <span className="text-lg font-bold text-emerald-500">{stats.pipelineHealth}%</span>
            </div>
            <p className="setu-text-2 mt-1.5 text-sm leading-relaxed">
              Weekly prospect movement, and the share of your pipeline that&apos;s still alive.
            </p>
          </div>
        </section>
      </div>

      {/* Bento — row 2 */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* WhatsApp bot */}
        <Link href="/setu/whatsapp-bot" className="setu-card setu-card-hover relative flex flex-col overflow-hidden p-7">
          <div className="relative flex h-40 items-center justify-center">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[var(--setu-accent)] to-transparent opacity-40" />
            <div className="setu-fade-x flex items-center gap-3">
              <IconTile icon={MessageCircle} size={44} className="rounded-full" iconClassName="setu-text-3" />
              <IconTile icon={Camera} size={52} className="rounded-full" iconClassName="setu-text-2" />
              <IconTile icon={Bot} size={68} glow className="rounded-full" iconClassName="text-emerald-500" />
              <IconTile icon={NotebookPen} size={52} className="rounded-full" iconClassName="setu-text-2" />
              <IconTile icon={ScanText} size={44} className="rounded-full" iconClassName="setu-text-3" />
            </div>
          </div>
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">WhatsApp bot</h2>
              <Pill dot="bg-green-500">Live</Pill>
            </div>
            <p className="setu-text-2 mt-1.5 text-sm leading-relaxed">Snap a visiting card or your 121 notes — Setu files it for you.</p>
          </div>
        </Link>

        {/* Latest captures */}
        <section className="setu-card relative flex flex-col overflow-hidden p-7">
          <div className="flex justify-center gap-3">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="h-3 w-3 rounded-full border border-[var(--setu-line-strong)] bg-[var(--setu-raised)]" />
            ))}
          </div>
          <div className="setu-fade-b relative mt-6 flex h-36 flex-col items-center gap-3">
            {MOCK_BOT_CAPTURES.filter((c) => c.ok)
              .slice(0, 3)
              .map((c, i) => (
                <span
                  key={c.id}
                  className="setu-chip setu-text-2 max-w-[85%] truncate px-3.5 py-2 text-xs"
                  style={{ transform: `translateX(${[-14, 18, -4][i]}px)` }}
                >
                  {c.kind === "CARD" ? "Card captured" : c.kind === "NOTES" ? "Notes read" : "Command"} · {c.summary.split(" · ")[0]}
                </span>
              ))}
            <span className="pointer-events-none absolute right-[6%] top-0 flex items-start gap-1">
              <MousePointer2 size={18} className="-rotate-12 fill-[var(--setu-accent)] text-[var(--setu-accent-strong)]" />
              <span className="setu-text-3 mt-4 text-[11px]">Setu Bot</span>
            </span>
          </div>
          <div className="mt-6">
            <h2 className="text-lg font-semibold tracking-tight">Captured on the go</h2>
            <p className="setu-text-2 mt-1.5 text-sm leading-relaxed">Latest cards and notes the bot routed into Setu.</p>
          </div>
        </section>

        {/* Top referrer */}
        {topReferrer && (
          <Link
            href={`/setu/meetings?open=${topReferrer.id}`}
            className="setu-card setu-card-hover relative flex flex-col items-center overflow-hidden p-7 text-center"
          >
            <span className="setu-tile mt-2 p-1.5">
              <SetuAvatar name={topReferrer.memberName} size="lg" className="h-20 w-20 rounded-xl text-xl" />
            </span>
            <div className="mt-4 text-base font-semibold">{topReferrer.memberName}</div>
            <div className="setu-text-3 mt-1 text-sm">
              Most referrals <span className="mx-1">•</span>
              <span className="setu-text-2 font-semibold">{topReferrer.refsReceived}</span>
            </div>
            <div className="setu-fade-x mt-auto w-full pt-4">
              <Sparkline points={[0.2, 0.9, 0.1, 0.35, 0.15, 0.7, 0.75, 0.3, 0.5]} height={70} />
            </div>
            <div className="setu-text-3 text-[11px] font-semibold uppercase tracking-[0.08em]">Top referrer</div>
          </Link>
        )}
      </div>

      {/* Lists */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SetuPanel title="Referral balance" description="Givers gain — keep it even." action={<PanelLink href="/setu/referrals">Tracker</PanelLink>}>
          <div className="grid grid-cols-2 gap-3">
            <BalanceCell value={balance.received} label="Received" icon={ArrowDownLeft} tone="text-green-500" />
            <BalanceCell value={balance.given} label="Given" icon={ArrowUpRight} tone="text-violet-500" />
          </div>
          <div className="mt-6 space-y-3">
            {sourceCounts.map(({ src, n }) => {
              const share = n / Math.max(1, prospects.length);
              return (
                <div key={src}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <SourceBadge source={src} label={SOURCE_LABEL[src]} />
                    <span className="text-xs font-semibold tabular-nums">{n}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--setu-line)]">
                    <div className="h-full rounded-full bg-[var(--setu-accent)]" style={{ width: `${share * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SetuPanel>

        <SetuPanel title="Recent 121 meetings" action={<PanelLink href="/setu/meetings">View all</PanelLink>}>
          <ul className="setu-divide -my-3">
            {recentMeetings.map((m) => (
              <li key={m.id}>
                <Link href={`/setu/meetings?open=${m.id}`} className="group flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium group-hover:underline">{m.memberName}</div>
                    <div className="setu-text-3 truncate text-xs">
                      {m.connectedVia || "Direct"} · {formatDate(m.date)}
                    </div>
                  </div>
                  <span className="setu-text-3 text-xs tabular-nums" title="Refs received / given">
                    <span className="font-semibold text-green-500">{m.refsReceived}</span> /{" "}
                    <span className="font-semibold text-violet-500">{m.refsGiven}</span>
                  </span>
                  <SetuAvatar name={m.memberName} size="sm" className="rounded-full" />
                </Link>
              </li>
            ))}
          </ul>
        </SetuPanel>

        <SetuPanel title="Open follow-ups" action={<Pill>{openTodos.length}</Pill>}>
          {openTodos.length === 0 ? (
            <p className="setu-text-3 py-6 text-center text-sm">All caught up.</p>
          ) : (
            <ul className="space-y-2">
              {openTodos.map((t) => (
                <li key={`${t.meeting.id}-${t.id}`}>
                  <Link
                    href={`/setu/meetings?open=${t.meeting.id}`}
                    className="setu-chip flex items-start gap-3 px-3.5 py-2.5 transition-colors hover:border-[var(--setu-text-3)]"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--setu-accent)]" />
                    <div className="min-w-0">
                      <div className="text-[13px]">{t.text}</div>
                      <div className="setu-text-3 text-[11px]">{t.meeting.memberName}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SetuPanel>
      </div>
    </SetuPage>
  );
}

function BalanceCell({ value, label, icon: Icon, tone }: { value: number; label: string; icon: React.ElementType; tone: string }) {
  return (
    <div className="setu-chip p-4">
      <Icon size={16} className={cn(tone)} />
      <div className="setu-heading mt-3 text-3xl font-bold tabular-nums leading-none">{value}</div>
      <div className="setu-text-3 mt-1 text-xs">{label}</div>
    </div>
  );
}
