import type { Metadata } from "next";
import Image from "next/image";
import { AlertCircle, CalendarDays, Clock, Folder } from "lucide-react";
import { APP_CONFIG } from "@/config/app";
import { getSharedTimesheet } from "@/features/projects/timesheet-share-queries";
import { formatMinutesToHHMM } from "@/features/projects/utils/time-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Shared Timesheet | ${APP_CONFIG.name}`,
  robots: { index: false, follow: false },
};

const UNAVAILABLE_MESSAGES = {
  invalid: "This timesheet link isn't valid. Check that you copied the full URL.",
  expired: "This timesheet link has expired. Ask the owner for a new one.",
  inactive: "This timesheet is no longer available.",
} as const;

const STATUS_STYLES = {
  APPROVED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  PENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
} as const;

const STATUS_LABELS = { APPROVED: "Approved", REJECTED: "Rejected", PENDING: "Pending" } as const;

function formatLongDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/winos-logo.png"
        alt={APP_CONFIG.name}
        width={150}
        height={50}
        unoptimized
        className="h-8 w-auto object-contain dark:hidden"
        priority
      />
      <Image
        src="/winos-logo-dark.png"
        alt={APP_CONFIG.name}
        width={150}
        height={50}
        unoptimized
        className="h-8 w-auto object-contain hidden dark:block"
        priority
      />
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
        Shared Timesheet
      </span>
    </div>
  );
}

export default async function SharedTimesheetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getSharedTimesheet(token);

  if (result.status !== "ok") {
    return (
      <div className="h-full w-full overflow-y-auto bg-background flex flex-col items-center justify-center p-4 gap-6">
        <Brand />
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm flex flex-col items-center text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle size={26} />
          </div>
          <h1 className="text-lg font-bold text-foreground">Link unavailable</h1>
          <p className="text-sm text-muted-foreground">{UNAVAILABLE_MESSAGES[result.status]}</p>
        </div>
      </div>
    );
  }

  const sheet = result.data;
  const stats = [
    { label: "Total", value: sheet.totalMinutes, className: "text-foreground" },
    { label: "Billable", value: sheet.billableMinutes, className: "text-info" },
    { label: "Non-billable", value: sheet.nonBillableMinutes, className: "text-warning" },
  ];

  return (
    // The root layout locks body scrolling, so this page scrolls itself.
    <div className="h-full w-full overflow-y-auto bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3">
          <Brand />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{sheet.userName}</h1>
            {sheet.userTitle && <p className="text-sm text-muted-foreground">{sheet.userTitle}</p>}
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays size={16} className="text-primary" />
            <span>{formatLongDate(sheet.date)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
              <span className={`mt-1 block font-mono text-lg sm:text-xl font-bold ${s.className}`}>
                {formatMinutesToHHMM(s.value)} h
              </span>
            </div>
          ))}
        </div>

        {sheet.logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No time was logged on this day.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-foreground">
                  <th className="py-2.5 px-4 font-bold">Task ID</th>
                  <th className="py-2.5 px-4 font-bold">Log Title</th>
                  <th className="py-2.5 px-4 font-bold">Project</th>
                  <th className="py-2.5 px-4 font-bold">Time Period</th>
                  <th className="py-2.5 px-4 font-bold text-right">Hours</th>
                  <th className="py-2.5 px-4 font-bold">Billing</th>
                  <th className="py-2.5 px-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sheet.logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="py-2.5 px-4 font-mono text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                      {log.taskCode || "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold">{log.title}</div>
                      {log.remarks && log.remarks !== log.title && (
                        <div className="mt-0.5 text-muted-foreground">{log.remarks}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Folder size={13} className="text-muted-foreground shrink-0" />
                        <span>{log.project}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {log.timePeriod || "—"}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-right whitespace-nowrap">{log.duration}</td>
                    <td
                      className={`py-2.5 px-4 font-bold whitespace-nowrap ${
                        log.billingType === "BILLABLE" ? "text-info" : "text-warning"
                      }`}
                    >
                      {log.billingType}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[log.approvalStatus]}`}
                      >
                        {STATUS_LABELS[log.approvalStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock size={12} />
          Read-only view shared from {APP_CONFIG.name}. Shows the latest logged entries for this day.
          {sheet.expiresAt && ` Link expires ${new Date(sheet.expiresAt).toLocaleDateString("en-GB")}.`}
        </p>
      </main>
    </div>
  );
}
