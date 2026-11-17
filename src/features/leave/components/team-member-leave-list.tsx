"use client";

// Team Leave › Team Member Leave: everyone the manager looks after, with this year's leave totals.
// A row opens that person's leave page (summary, requests, balance, policy).

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { getEmployeesForAdjustmentAction } from "../queries/leave-queries";

type Member = Awaited<ReturnType<typeof getEmployeesForAdjustmentAction>>[number];

const round = (n: number) => Math.round(n * 100) / 100;

export function TeamMemberLeaveList() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    getEmployeesForAdjustmentAction()
      .then(setMembers)
      .catch(() => setError("Couldn't load your team."));
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (members ?? []).filter(
      (m) => !term || m.name.toLowerCase().includes(term) || m.department.toLowerCase().includes(term) || m.empId.toLowerCase().includes(term)
    );
  }, [members, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Team Member Leave</h1>
          <p className="text-xs text-muted-foreground">Open a team member to see and manage their leave.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, department, ID" className="h-9 pl-8 text-xs" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {error ? (
          <p className="px-5 py-6 text-sm text-rose-600">{error}</p>
        ) : !members ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border/70 bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Team member</th>
                <th className="px-4 py-2.5">Department</th>
                <th className="px-4 py-2.5 text-right">Booked this year</th>
                <th className="px-4 py-2.5 text-right">Available</th>
                <th className="w-10 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No team members found.
                  </td>
                </tr>
              )}
              {shown.map((m) => {
                const booked = round(m.balances.reduce((s, b) => s + b.booked, 0));
                const available = round(m.balances.reduce((s, b) => s + Math.max(0, b.available), 0));
                const href = `/pulse/leave/employee/${m.id}`;
                return (
                  <tr key={m.id} className="group cursor-pointer transition-colors hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link href={href} className="flex items-center gap-2.5">
                        <UserAvatar
                          userId={m.id}
                          name={m.name}
                          image={m.avatarUrl}
                          className="h-8 w-8 bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                        >
                          {m.name.slice(0, 2).toUpperCase()}
                        </UserAvatar>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {m.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {m.role} · {m.empId}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.department}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{booked} day(s)</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{available} day(s)</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={href} aria-label={`Open ${m.name}'s leave`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
