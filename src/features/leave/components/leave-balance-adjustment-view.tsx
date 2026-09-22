"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building,
  Calendar,
  Plus,
  Trash2,
  Scale,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { LeaveTypeCode, LeaveTypeConfig } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AdjustmentRow {
  id: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  adjustmentType: "ADD" | "DEDUCT";
  days: number;
  currentBalance: number;
}

export function LeaveBalanceAdjustmentView() {
  const router = useRouter();

  const [rows, setRows] = useState<AdjustmentRow[]>([
    {
      id: "row-1",
      leaveTypeCode: "CL",
      leaveTypeName: "Casual Leave (CL)",
      adjustmentType: "ADD",
      days: 2,
      currentBalance: 6,
    },
    {
      id: "row-2",
      leaveTypeCode: "SL",
      leaveTypeName: "Sick Leave (SL)",
      adjustmentType: "ADD",
      days: 1,
      currentBalance: 5,
    },
  ]);

  const [effectiveDate, setEffectiveDate] = useState("2025-05-20");
  const [reason, setReason] = useState("Performance Reward");
  const [remarks, setRemarks] = useState("Outstanding performance in Q1 2025");
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // Available leave types to add
  const availableTypes: { code: LeaveTypeCode; name: string; defaultBalance: number }[] = [
    { code: "CL", name: "Casual Leave (CL)", defaultBalance: 6 },
    { code: "SL", name: "Sick Leave (SL)", defaultBalance: 5 },
    { code: "PL", name: "Paid Leave (PL)", defaultBalance: 12 },
    { code: "AL", name: "Annual Leave", defaultBalance: 8 },
    { code: "COMP", name: "Comp Off", defaultBalance: 2 },
  ];

  const handleAddRow = () => {
    const unusedType =
      availableTypes.find((t) => !rows.some((r) => r.leaveTypeCode === t.code)) ||
      availableTypes[0];

    const newRow: AdjustmentRow = {
      id: `row-${Date.now()}`,
      leaveTypeCode: unusedType.code,
      leaveTypeName: unusedType.name,
      adjustmentType: "ADD",
      days: 1,
      currentBalance: unusedType.defaultBalance,
    };
    setRows([...rows, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter((r) => r.id !== id));
    }
  };

  const handleUpdateRow = (
    id: string,
    updates: Partial<AdjustmentRow>
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, ...updates };
          if (updates.leaveTypeCode) {
            const matched = availableTypes.find((t) => t.code === updates.leaveTypeCode);
            if (matched) {
              updated.leaveTypeName = matched.name;
              updated.currentBalance = matched.defaultBalance;
            }
          }
          return updated;
        }
        return r;
      })
    );
  };

  // Total Adjustment computation
  const totalDaysAdjustment = useMemo(() => {
    return rows.reduce((acc, r) => {
      const d = r.days || 0;
      return acc + (r.adjustmentType === "ADD" ? d : -d);
    }, 0);
  }, [rows]);

  const handleConfirm = () => {
    setIsSuccessModalOpen(true);
    setTimeout(() => {
      router.push("/pulse/leave/team");
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 select-none">
      {/* Breadcrumb Header */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Link
            href="/pulse/leave/team"
            className="text-primary hover:underline hover:text-primary/80 transition-colors"
          >
            Employee Leave
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="text-foreground">Adjust Balance</span>
        </nav>

        <div className="pt-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Leave Balance Adjustment
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Adjust leave types for a single employee
          </p>
        </div>
      </div>

      {/* Employee Banner Card */}
      <div className="bg-card border rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-sm shrink-0 overflow-hidden">
            <span>VR</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground leading-tight">
              Vamshi R
            </h3>
            <div className="text-xs text-muted-foreground mt-0.5">
              EMP00123 • Product Manager
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          {/* Department */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-muted text-primary">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase">
                Department
              </div>
              <div className="font-bold text-foreground">Engineering</div>
            </div>
          </div>

          {/* Joining Date */}
          <div className="flex items-center gap-2.5 border-l pl-6">
            <div className="p-2 rounded-xl bg-muted text-primary">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase">
                Joining Date
              </div>
              <div className="font-bold text-foreground">15 Jan 2023</div>
            </div>
          </div>
        </div>
      </div>

      {/* Leave Adjustments Table Card */}
      <div className="bg-card border rounded-2xl p-6 shadow-2xs space-y-6">
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight">
              Leave Adjustments
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add or deduct balance for multiple leave types
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={handleAddRow}
            className="text-xs font-semibold text-primary hover:text-primary/90 hover:bg-primary/5 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Leave Type</span>
          </Button>
        </div>

        {/* Adjustments Table */}
        <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">LEAVE TYPE</th>
                <th className="py-3 px-4 font-semibold">ADJUSTMENT TYPE</th>
                <th className="py-3 px-4 font-semibold">DAYS *</th>
                <th className="py-3 px-4 font-semibold">CURRENT BALANCE</th>
                <th className="py-3 px-4 font-semibold">NEW BALANCE</th>
                <th className="py-3 px-4 font-semibold text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => {
                const newBalance =
                  row.adjustmentType === "ADD"
                    ? row.currentBalance + (row.days || 0)
                    : row.currentBalance - (row.days || 0);

                return (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    {/* Leave Type Select */}
                    <td className="py-3 px-4">
                      <Select
                        value={row.leaveTypeCode}
                        onValueChange={(val) =>
                          handleUpdateRow(row.id, { leaveTypeCode: val as LeaveTypeCode })
                        }
                      >
                        <SelectTrigger className="h-9 w-44 rounded-xl text-xs bg-background">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTypes.map((t) => (
                            <SelectItem key={t.code} value={t.code} className="text-xs">
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Adjustment Type Radio */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`adj-${row.id}`}
                            checked={row.adjustmentType === "ADD"}
                            onChange={() =>
                              handleUpdateRow(row.id, { adjustmentType: "ADD" })
                            }
                            className="text-primary accent-primary"
                          />
                          <span className="font-semibold text-foreground">Add Days</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`adj-${row.id}`}
                            checked={row.adjustmentType === "DEDUCT"}
                            onChange={() =>
                              handleUpdateRow(row.id, { adjustmentType: "DEDUCT" })
                            }
                            className="text-primary accent-primary"
                          />
                          <span className="text-muted-foreground">Deduct Days</span>
                        </label>
                      </div>
                    </td>

                    {/* Days Input */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={row.days}
                          onChange={(e) =>
                            handleUpdateRow(row.id, { days: Number(e.target.value) })
                          }
                          className="h-9 w-24 rounded-xl text-xs bg-background font-semibold"
                        />
                        <div className="text-[10px] text-muted-foreground">
                          Enter positive number for add
                        </div>
                      </div>
                    </td>

                    {/* Current Balance */}
                    <td className="py-3 px-4 font-medium text-foreground">
                      {row.currentBalance} Days
                    </td>

                    {/* New Balance */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {newBalance} Days
                      </span>
                    </td>

                    {/* Delete Action */}
                    <td className="py-3 px-4 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={rows.length <= 1}
                        onClick={() => handleRemoveRow(row.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Form Inputs below table */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Effective Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Effective Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="h-10 rounded-xl text-xs bg-background"
              required
            />
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Reason <span className="text-red-500">*</span>
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
                <SelectValue placeholder="Select Reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Performance Reward">Performance Reward</SelectItem>
                <SelectItem value="Policy Correction">Policy Correction</SelectItem>
                <SelectItem value="Joining Proration">Joining Proration</SelectItem>
                <SelectItem value="Compensatory Conversion">Compensatory Conversion</SelectItem>
                <SelectItem value="Manual Adjustment">Manual Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Remarks (Optional)
              </label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {remarks.length}/300
              </span>
            </div>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Outstanding performance in Q1 2025"
              className="h-10 rounded-xl text-xs bg-background"
            />
          </div>
        </div>

        {/* Adjustment Summary Card */}
        <div className="bg-muted/40 border rounded-2xl p-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-foreground">Adjustment Summary</div>
              <div className="text-muted-foreground">{rows.length} Leave Types</div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">
                Total Adjustment
              </div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {totalDaysAdjustment >= 0 ? `+${totalDaysAdjustment}` : totalDaysAdjustment} Days
              </div>
            </div>

            <div className="border-l pl-6">
              <div className="text-[10px] text-muted-foreground uppercase">
                Updated On
              </div>
              <div className="font-semibold text-foreground">{effectiveDate}</div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/pulse/leave/team")}
            className="h-10 px-6 rounded-xl text-xs font-semibold"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            className="h-10 px-6 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
          >
            Review & Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
