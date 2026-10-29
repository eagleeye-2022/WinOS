// Leave balance helpers that need the DB (server-only; not a "use server" module).
// The rules themselves are pure and live in ./leave-rules.

import { db } from "@/lib/db";
import { dateKeyFromUtc } from "@/features/attendance/utils";
import { accruedAllocation, availableToApply, carryForwardFrom, validCompOffDays } from "./leave-rules";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
type Client = typeof db | Tx;

interface TypeForBalance {
  id: string;
  code: string;
  annualEntitlement: number;
  allocationFrequency: string;
  allowCarryForward: boolean;
  carryForwardLimit: number | null;
  balanceResetRule: string;
}

interface BalanceRow {
  id: string;
  allocatedDays: number;
  carriedForward: number;
  adjustedDays: number;
  bookedDays: number;
  pendingDays: number;
}

/**
 * The user's balance row for a year, creating it on first use with the yearly entitlement and
 * whatever carries forward from last year (so the year-end reset happens lazily, no cron needed).
 */
export async function getOrOpenBalance(client: Client, userId: string, type: TypeForBalance, year: number): Promise<BalanceRow> {
  const existing = await client.userLeaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId: type.id, year } },
  });
  if (existing) return existing;

  const previous = await client.userLeaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId: type.id, year: year - 1 } },
  });
  return client.userLeaveBalance.create({
    data: {
      userId,
      leaveTypeId: type.id,
      year,
      // Comp-off balances are only ever credited by approved comp-offs.
      allocatedDays: type.code === "COMP" ? 0 : type.annualEntitlement,
      carriedForward: type.code === "COMP" ? 0 : carryForwardFrom(previous, type),
    },
  });
}

/**
 * What can still be applied for on `onKey`: entitlement earned so far (monthly / quarterly accrual)
 * minus booked and pending days, and for comp-off only credits that haven't expired.
 * `excludePendingDays` removes a request's own pending days (when approving it).
 */
export async function effectiveAvailable(
  client: Client,
  args: { userId: string; type: TypeForBalance; balance: BalanceRow; onKey: string; excludePendingDays?: number }
): Promise<number> {
  const { userId, type, balance, onKey } = args;
  const pendingDays = Math.max(0, balance.pendingDays - (args.excludePendingDays ?? 0));
  let available = availableToApply({
    ...balance,
    pendingDays,
    allocatedDays: accruedAllocation(type.allocationFrequency, balance.allocatedDays, type.annualEntitlement, onKey),
  });

  if (type.code === "COMP") {
    const year = Number(onKey.slice(0, 4));
    const credits = await client.compensatoryRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        workDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      select: { creditedDays: true, expiryDate: true },
    });
    const valid = validCompOffDays(
      credits.map((c) => ({ days: c.creditedDays, expiryKey: dateKeyFromUtc(c.expiryDate) })),
      balance.bookedDays + pendingDays,
      onKey
    );
    available = Math.min(available, valid);
  }
  return Math.round(available * 100) / 100;
}
