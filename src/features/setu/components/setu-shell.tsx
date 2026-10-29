"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Contact, GitMerge, Handshake, SquareKanban, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { useSetuStore } from "../store";
import { computeStats } from "../utils";
import { Pill } from "./setu-ui";

/** Setu's tabs — one route each, so tabs are linkable and the sidebar mirrors them. */
export const SETU_TABS = [
  { href: ROUTES.setuMeetings, label: "121 Meetings", icon: Users2 },
  { href: ROUTES.setuPipeline, label: "Sales Pipeline", icon: SquareKanban },
  { href: ROUTES.setuWhatsAppBot, label: "WhatsApp Bot", icon: Bot },
  { href: ROUTES.setuContacts, label: "Contacts", icon: Contact },
  { href: ROUTES.setuReferrals, label: "Referrals", icon: GitMerge },
] as const;

/**
 * Setu chrome: title + status and the six headline stats scroll with the page; the tab bar
 * sticks to the top so the tabs stay reachable while the active tab's content scrolls.
 */
export function SetuShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meetings = useSetuStore((s) => s.meetings);
  const prospects = useSetuStore((s) => s.prospects);
  const stats = computeStats(meetings, prospects);

  const chips = [
    { value: `${stats.pipelineHealth}%`, label: "Pipeline Health", tone: "" },
    { value: stats.prospects, label: "Prospects", tone: "setu-accent-text" },
    { value: stats.meetings, label: "121 Meetings", tone: "text-orange-500" },
    { value: stats.refsReceived, label: "Refs Received", tone: "text-green-500" },
    { value: stats.refsGiven, label: "Refs Given", tone: "text-violet-500" },
    { value: stats.won, label: "Won", tone: "text-green-500" },
  ];

  return (
    // One scroll area: title + stats scroll away, the tab bar sticks to the top.
    <div className="h-full overflow-y-auto select-none">
      <header className="px-6 pt-6">
        <div className="mx-auto w-full max-w-[1500px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="setu-tile h-11 w-11">
              <Handshake size={19} className="setu-accent-text" />
            </span>
            <h1 className="setu-heading text-2xl font-bold">Setu — BNI Networking</h1>
            <Pill dot="bg-green-500">Active</Pill>
          </div>

          {/* Six equal columns spanning the full width (wraps to 3 / 2 per row on narrower screens). */}
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {chips.map((c) => (
              <div key={c.label} className="setu-chip px-4 py-2.5">
                <div className={cn("text-lg font-bold leading-tight tabular-nums", c.tone)}>{c.value}</div>
                <div className="setu-text-3 text-[11px]">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-20 mt-6 bg-[var(--setu-canvas)]/90 px-6 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[1500px]">
          <nav className="flex gap-1 overflow-x-auto border-b border-[var(--setu-line)]">
            {SETU_TABS.map((t) => {
              const active = pathname.startsWith(t.href);
              const Icon = t.icon;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors",
                    active
                      ? "border-[var(--setu-accent)] font-semibold text-[var(--setu-text)]"
                      : "setu-text-3 border-transparent hover:text-[var(--setu-text)]"
                  )}
                >
                  <Icon size={15} className={active ? "setu-accent-text" : undefined} />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="px-6 pb-10 pt-6">
        <div className="mx-auto w-full max-w-[1500px]">{children}</div>
      </div>
    </div>
  );
}
