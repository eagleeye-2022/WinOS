"use client";

// Customize Balance (per-employee leave page), like Zoho People: one row per leave type with the
// existing balance; type a new balance (and a reason) on any rows and save. Each changed row is
// saved through adjustLeaveBalanceAction as an adjustment of (new − existing), with an audit record.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { istDateKey } from "@/features/attendance/utils";
import { getEmployeesForAdjustmentAction } from "../queries/leave-queries";
import { adjustLeaveBalanceAction } from "../actions/leave-actions";
import { errorMessage, unwrap } from "../action-result";

type Member = Awaited<ReturnType<typeof getEmployeesForAdjustmentAction>>[number];
type Balance = Member["balances"][number];

interface RowInput {
  date: string; // YYYY-MM-DD
  newBalance: string;
  reason: string;
}

const DEFAULT_REASON = "Manual correction";
const round = (n: number) => Math.round(n * 100) / 100;
const dmy = (key: string) => key.split("-").reverse().join("/");

export function CustomizeBalanceTable({ userId, onSaved }: { userId: string; onSaved?: () => void }) {
  const today = istDateKey();
  const year = today.slice(0, 4);
  const [member, setMember] = useState<Member | null | undefined>(undefined);
  const [inputs, setInputs] = useState<Record<string, RowInput>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getEmployeesForAdjustmentAction()
      .then((all) => setMember(all.find((m) => m.id === userId) ?? null))
      .catch(() => setMember(null));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const rowOf = (id: string): RowInput => inputs[id] ?? { date: today, newBalance: "", reason: "" };
  const setRow = (id: string, patch: Partial<RowInput>) =>
    setInputs((prev) => ({ ...prev, [id]: { ...rowOf(id), ...patch } }));

  /** Per-row validation; null = fine (or nothing entered). */
  const rowError = (b: Balance): string | null => {
    const r = rowOf(b.leaveTypeId);
    if (r.newBalance.trim() === "") return null;
    const n = Number(r.newBalance);
    if (!Number.isFinite(n)) return "Enter a number.";
    if (n < 0) return "Balance can't be negative.";
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return "Use up to 2 decimals.";
    if (round(n) === round(b.available)) return "Same as the existing balance.";
    if (r.date.slice(0, 4) !== year) return `Pick a date in ${year}.`;
    if ((r.reason || DEFAULT_REASON).length > 280) return "Reason is too long.";
    return null;
  };

  const changed = useMemo(
    () => (member?.balances ?? []).filter((b) => rowOf(b.leaveTypeId).newBalance.trim() !== ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [member, inputs]
  );
  const hasErrors = changed.some((b) => rowError(b) !== null);

  const save = async () => {
    if (!member || changed.length === 0 || hasErrors) return;
    setSaving(true);
    setError(null);
    const saved: string[] = [];
    try {
      for (const b of changed) {
        const r = rowOf(b.leaveTypeId);
        const delta = round(Number(r.newBalance) - b.available);
        unwrap(
          await adjustLeaveBalanceAction({
            employeeId: member.id,
            leaveTypeId: b.leaveTypeId,
            adjustmentDays: delta,
            reason: "OTHER",
            remarks: `${(r.reason || DEFAULT_REASON).trim()} (effective ${dmy(r.date)})`,
            year: Number(r.date.slice(0, 4)),
          })
        );
        saved.push(b.leaveTypeId);
      }
      toast.success(`Updated ${saved.length} leave balance${saved.length === 1 ? "" : "s"} for ${member.name}.`);
      setInputs({});
      onSaved?.();
    } catch (err) {
      // Keep only the rows that didn't save, so saving again can't apply one twice.
      setInputs((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !saved.includes(id))));
      setError(`${errorMessage(err)}${saved.length ? ` (${saved.length} other row(s) were saved.)` : " Nothing was saved."}`);
    } finally {
      setSaving(false);
      load();
    }
  };

  if (member === undefined) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (member === null) {
    return (
      <p className="rounded-lg border border-border/70 bg-card px-5 py-6 text-sm text-muted-foreground">
        You can&apos;t adjust this person&apos;s balance — only managers of other team members can (nobody adjusts their own).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/60 text-left text-[13px] font-medium text-muted-foreground">
            <tr>
              <th className="w-[40%] border-r border-border/60 px-4 py-3 font-medium">Leave type</th>
              {/* Date and Reason hidden for now — saves use today's date and "Manual correction".
              <th className="w-[20%] border-r border-border/60 px-4 py-3 font-medium">Date</th>
              */}
              <th className="w-[25%] border-r border-border/60 px-4 py-3 font-medium">Existing balance</th>
              <th className="px-4 py-3 font-medium">New balance</th>
              {/* <th className="px-4 py-3 font-medium">Reason</th> */}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {member.balances.map((b) => {
              const r = rowOf(b.leaveTypeId);
              const err = rowError(b);
              const delta = r.newBalance.trim() !== "" && !err ? round(Number(r.newBalance) - b.available) : null;
              return (
                <tr key={b.leaveTypeId} className={cn(delta !== null && "bg-blue-50/40 dark:bg-blue-500/5")}>
                  <td className="border-r border-border/60 px-4 py-2.5 font-medium text-foreground">{b.leaveTypeName}</td>
                  {/* Date column hidden for now.
                  <td className="border-r border-border/60 px-4 py-2.5">
                    <Input
                      type="date"
                      value={r.date}
                      min={`${year}-01-01`}
                      max={`${year}-12-31`}
                      onChange={(e) => setRow(b.leaveTypeId, { date: e.target.value || today })}
                      className="h-9 text-sm"
                    />
                  </td>
                  */}
                  <td className={cn("border-r border-border/60 px-4 py-2.5 tabular-nums", b.available < 0 ? "text-rose-600" : "text-foreground")}>
                    {round(b.available)}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <Input
                      inputMode="decimal"
                      value={r.newBalance}
                      onChange={(e) => setRow(b.leaveTypeId, { newBalance: e.target.value })}
                      aria-label={`New ${b.leaveTypeName} balance`}
                      aria-invalid={Boolean(err)}
                      className={cn("h-9 text-sm tabular-nums", err && "border-rose-400 focus-visible:ring-rose-300")}
                    />
                    {err ? (
                      <p className="mt-1 text-[11px] text-rose-600">{err}</p>
                    ) : delta !== null ? (
                      <p className={cn("mt-1 text-[11px] font-medium", delta > 0 ? "text-emerald-600" : "text-amber-600")}>
                        {delta > 0 ? `+${delta}` : delta} day(s)
                      </p>
                    ) : null}
                  </td>
                  {/* Reason column hidden for now.
                  <td className="px-4 py-2.5">
                    <Input
                      value={r.reason}
                      onChange={(e) => setRow(b.leaveTypeId, { reason: e.target.value })}
                      placeholder={DEFAULT_REASON}
                      maxLength={280}
                      className="h-9 text-sm"
                    />
                  </td>
                  */}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted-foreground">
          Balances for {year}. Each change is recorded in the adjustment history.
        </span>
        {changed.length > 0 && (
          <Button type="button" variant="outline" onClick={() => setInputs({})} disabled={saving} className="h-9 text-xs">
            Clear
          </Button>
        )}
        <Button
          type="button"
          onClick={save}
          disabled={saving || changed.length === 0 || hasErrors}
          className="h-9 gap-1.5 bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save{changed.length > 0 ? ` (${changed.length})` : ""}
        </Button>
      </div>
    </div>
  );
}
