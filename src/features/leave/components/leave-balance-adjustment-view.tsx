"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  User,
  Loader2,
} from "lucide-react";
import { LeaveTypeCode } from "../types";
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
import { getEmployeesForAdjustmentAction } from "../queries/leave-queries";
import { adjustLeaveBalanceAction } from "../actions/leave-actions";

interface AdjustmentRow {
  id: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  adjustmentType: "ADD" | "DEDUCT";
  days: number;
  currentBalance: number;
}

interface LeaveBalanceAdjustmentViewProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function LeaveBalanceAdjustmentView({
  onSuccess,
  onCancel,
}: LeaveBalanceAdjustmentViewProps) {
  const router = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [rows, setRows] = useState<AdjustmentRow[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState<
    "SPECIAL_AWARD" | "POLICY_REVISION" | "JOINING_PRORATION" | "YEARLY_CORRECTION" | "LOSS_OF_PAY_REVERSAL" | "OTHER"
  >("SPECIAL_AWARD");
  const [remarks, setRemarks] = useState("Performance Reward / Adjustment");
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setupInitialRows = (emp: any) => {
    if (!emp?.balances || emp.balances.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initial = emp.balances.slice(0, 2).map((b: any, idx: number) => ({
      id: `row-${idx + 1}`,
      leaveTypeId: b.leaveTypeId,
      leaveTypeCode: b.leaveTypeCode,
      leaveTypeName: `${b.leaveTypeName} (${b.leaveTypeCode})`,
      adjustmentType: "ADD" as const,
      days: 1,
      currentBalance: b.available,
    }));
    setRows(initial);
  };

  useEffect(() => {
    async function load() {
      try {
        const emps = await getEmployeesForAdjustmentAction();
        setEmployees(emps);
        if (emps.length > 0) {
          const firstEmp = emps[0];
          setSelectedEmpId(firstEmp.id);
          setupInitialRows(firstEmp);
        }
      } catch (err) {
        console.error("Failed to load employees for adjustment:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const currentEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmpId) || employees[0];
  }, [employees, selectedEmpId]);

  const availableTypes = useMemo(() => {
    if (!currentEmployee?.balances) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return currentEmployee.balances.map((b: any) => ({
      id: b.leaveTypeId,
      code: b.leaveTypeCode,
      name: `${b.leaveTypeName} (${b.leaveTypeCode})`,
      available: b.available,
    }));
  }, [currentEmployee]);

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setupInitialRows(emp);
    }
  };

  const handleAddRow = () => {
    const unusedType =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      availableTypes.find((t: any) => !rows.some((r) => r.leaveTypeId === t.id)) ||
      availableTypes[0];

    if (!unusedType) return;

    const newRow: AdjustmentRow = {
      id: `row-${Date.now()}`,
      leaveTypeId: unusedType.id,
      leaveTypeCode: unusedType.code,
      leaveTypeName: unusedType.name,
      adjustmentType: "ADD",
      days: 1,
      currentBalance: unusedType.available,
    };
    setRows([...rows, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter((r) => r.id !== id));
    }
  };

  const handleUpdateRow = (id: string, updates: Partial<AdjustmentRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, ...updates };
          if (updates.leaveTypeId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matched = availableTypes.find((t: any) => t.id === updates.leaveTypeId);
            if (matched) {
              updated.leaveTypeId = matched.id;
              updated.leaveTypeCode = matched.code;
              updated.leaveTypeName = matched.name;
              updated.currentBalance = matched.available;
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

  const handleConfirm = async () => {
    if (!currentEmployee) {
      alert("Please select an employee.");
      return;
    }
    if (rows.length === 0) {
      alert("Please add at least one leave type to adjust.");
      return;
    }
    setIsSubmitting(true);
    try {
      for (const row of rows) {
        if (!row.leaveTypeId) continue;
        const adjustmentDays = row.adjustmentType === "ADD" ? (Number(row.days) || 0) : -(Number(row.days) || 0);
        await adjustLeaveBalanceAction({
          employeeId: currentEmployee.id,
          leaveTypeId: row.leaveTypeId,
          adjustmentDays,
          reason,
          remarks,
        });
      }
      setIsSuccessModalOpen(true);
    } catch (err) {
      console.error("Failed to adjust balance:", err);
      alert("Failed to adjust balance: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-12 select-none">
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

      {/* Employee Banner / Selector Card */}
      <div className="bg-card border rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-sm shrink-0 overflow-hidden">
            {currentEmployee?.avatarUrl ? (
              <img
                src={currentEmployee.avatarUrl}
                alt={currentEmployee.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{(currentEmployee?.name || "EM").slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedEmpId}
                onValueChange={(val) => handleSelectEmployee(val)}
              >
                <SelectTrigger className="h-8 w-56 font-bold text-sm bg-background border-none p-0 focus:ring-0">
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.name} ({e.empId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {currentEmployee?.empId} • {currentEmployee?.role}
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
              <div className="font-bold text-foreground">
                {currentEmployee?.department || "Engineering"}
              </div>
            </div>
          </div>

          {/* Joining Date */}
          <div className="flex items-center gap-2.5 border-l pl-6">
            <div className="p-2 rounded-xl bg-muted text-primary">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase">
                Status
              </div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400">
                Active
              </div>
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
                        value={row.leaveTypeId}
                        onValueChange={(val) =>
                          handleUpdateRow(row.id, { leaveTypeId: val })
                        }
                      >
                        <SelectTrigger className="h-9 w-44 rounded-xl text-xs bg-background">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {availableTypes.map((t: any) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
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
            <Select
              value={reason}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onValueChange={(val) => setReason(val as any)}
            >
              <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
                <SelectValue placeholder="Select Reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SPECIAL_AWARD">Performance Reward</SelectItem>
                <SelectItem value="POLICY_REVISION">Policy Revision</SelectItem>
                <SelectItem value="JOINING_PRORATION">Joining Proration</SelectItem>
                <SelectItem value="YEARLY_CORRECTION">Yearly Correction</SelectItem>
                <SelectItem value="LOSS_OF_PAY_REVERSAL">Loss of Pay Reversal</SelectItem>
                <SelectItem value="OTHER">Other Adjustment</SelectItem>
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
            onClick={() => (onCancel ? onCancel() : router.push("/pulse/leave/team"))}
            className="h-10 px-6 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isSubmitting || rows.length === 0}
            onClick={handleConfirm}
            className="h-10 px-6 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
          >
            {isSubmitting ? "Adjusting..." : "Review & Confirm"}
          </Button>
        </div>
      </div>

      {/* Success Confirmation Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-5 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-foreground">
                Leave Balance Adjusted!
              </h3>
              <p className="text-xs text-muted-foreground">
                Successfully updated leave balances for{" "}
                <span className="font-semibold text-foreground">
                  {currentEmployee?.name}
                </span>.
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-3 text-xs space-y-1.5 border text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Adjustment:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {totalDaysAdjustment >= 0 ? `+${totalDaysAdjustment}` : totalDaysAdjustment} Days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reason:</span>
                <span className="font-medium text-foreground">{reason.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective Date:</span>
                <span className="font-medium text-foreground">{effectiveDate}</span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  if (currentEmployee) setupInitialRows(currentEmployee);
                }}
                className="flex-1 h-10 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Adjust Another
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  if (onSuccess) {
                    onSuccess();
                  } else {
                    router.push("/pulse/leave/team");
                  }
                }}
                className="flex-1 h-10 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                Done & View Team
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
