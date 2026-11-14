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
import { UserAvatar } from "@/components/shared/user-avatar";
import { getEmployeesForAdjustmentAction } from "../queries/leave-queries";
import { adjustLeaveBalanceAction } from "../actions/leave-actions";
import { errorMessage, unwrap } from "../action-result";

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
  /** After "Done" in the success dialog; defaults to staying here with a fresh form. */
  onSuccess?: () => void;
  onCancel?: () => void;
}

type AdjustmentReason =
  | "SPECIAL_AWARD"
  | "POLICY_REVISION"
  | "JOINING_PRORATION"
  | "YEARLY_CORRECTION"
  | "LOSS_OF_PAY_REVERSAL"
  | "OTHER";

/** One label per reason, used in the picker, the review step and the success dialog alike. */
const REASON_LABELS: Record<AdjustmentReason, string> = {
  SPECIAL_AWARD: "Special Award",
  POLICY_REVISION: "Policy Revision",
  JOINING_PRORATION: "Joining Proration",
  YEARLY_CORRECTION: "Yearly Correction",
  LOSS_OF_PAY_REVERSAL: "Loss of Pay Reversal",
  OTHER: "Other Adjustment",
};

const MAX_DAYS = 366;

const signedDays = (r: AdjustmentRow) => (r.adjustmentType === "ADD" ? r.days || 0 : -(r.days || 0));
const newBalanceOf = (r: AdjustmentRow) => Math.round((r.currentBalance + signedDays(r)) * 100) / 100;

/** What's wrong with a row, or null. */
function rowError(r: AdjustmentRow): string | null {
  if (!Number.isFinite(r.days) || r.days <= 0) return "Enter more than 0 days.";
  if (r.days > MAX_DAYS) return `At most ${MAX_DAYS} days.`;
  if (Math.round(r.days * 2) !== r.days * 2) return "Use whole or half days.";
  if (newBalanceOf(r) < 0) return `Can't deduct more than ${Math.max(0, r.currentBalance)} day(s).`;
  return null;
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
  const [reason, setReason] = useState<AdjustmentReason | "">("");
  const [remarks, setRemarks] = useState("");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setupInitialRows = (emp: any) => {
    setSubmitError(null);
    if (!emp?.balances || emp.balances.length === 0) {
      setRows([]);
      return;
    }
    const b = emp.balances[0];
    setRows([
      {
        id: `row-${Date.now()}`,
        leaveTypeId: b.leaveTypeId,
        leaveTypeCode: b.leaveTypeCode,
        leaveTypeName: `${b.leaveTypeName} (${b.leaveTypeCode})`,
        adjustmentType: "ADD",
        days: 1,
        currentBalance: b.available,
      },
    ]);
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

  // A leave type can be adjusted once per submission (two rows for one type would double-count).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unusedTypes = availableTypes.filter((t: any) => !rows.some((r) => r.leaveTypeId === t.id));

  const handleAddRow = () => {
    const unusedType = unusedTypes[0];
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
  const totalDaysAdjustment = useMemo(() => rows.reduce((acc, r) => acc + signedDays(r), 0), [rows]);

  const formError = !currentEmployee
    ? "Select a team member."
    : rows.length === 0
    ? "Add at least one leave type to adjust."
    : rows.some((r) => rowError(r))
    ? "Fix the highlighted rows."
    : !reason
    ? "Pick a reason."
    : remarks.length > 300
    ? "Remarks must be under 300 characters."
    : null;

  /** "Review & Confirm" only opens the review; nothing is saved until it's confirmed there. */
  const handleReview = () => {
    setSubmitError(null);
    if (formError) {
      setSubmitError(formError);
      return;
    }
    setIsReviewOpen(true);
  };

  const handleConfirm = async () => {
    if (formError || !reason) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const saved: string[] = [];
    try {
      for (const row of rows) {
        unwrap(
          await adjustLeaveBalanceAction({
            employeeId: currentEmployee.id,
            leaveTypeId: row.leaveTypeId,
            adjustmentDays: signedDays(row),
            reason,
            remarks: remarks.trim() || undefined,
          })
        );
        saved.push(row.leaveTypeName);
      }
      setIsReviewOpen(false);
      setIsSuccessModalOpen(true);
    } catch (err) {
      setIsReviewOpen(false);
      // Drop the rows that did save, so submitting again can't apply them twice.
      if (saved.length) setRows((prev) => prev.filter((r) => !saved.includes(r.leaveTypeName)));
      setSubmitError(
        `${errorMessage(err)}${saved.length ? ` (Already saved: ${saved.join(", ")}.)` : " Nothing was saved."}`
      );
    } finally {
      setIsSubmitting(false);
      // Balances changed (fully or partly) — show the real figures.
      if (saved.length) {
        getEmployeesForAdjustmentAction()
          .then(setEmployees)
          .catch(() => {});
      }
    }
  };

  return (
    <div className="space-y-6 w-full pb-12 select-none">
      {/* Breadcrumb Header */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Link
            href="/pulse/leave/team"
            className="text-primary hover:underline hover:text-foreground transition-colors"
          >
            Team Member Leave
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
          <span className="text-foreground">Adjust Balance</span>
        </nav>

        <div className="pt-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Leave Balance Adjustment
          </h1>
        </div>
      </div>

      {/* Employee Banner / Selector Card */}
      <div className="bg-card border rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <UserAvatar
            userId={currentEmployee?.id}
            name={currentEmployee?.name}
            image={currentEmployee?.avatarUrl}
            className="w-12 h-12 bg-primary/10 border border-primary/20 text-primary font-bold text-sm"
          >
            {(currentEmployee?.name || "EM").slice(0, 2).toUpperCase()}
          </UserAvatar>
          <div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedEmpId}
                onValueChange={(val) => handleSelectEmployee(val)}
              >
                <SelectTrigger className="h-8 w-64 font-bold text-sm bg-background border-none p-0 focus:ring-0">
                  {/* Just the name here — the large avatar sits beside it. */}
                  <SelectValue placeholder="Select Team Member">{currentEmployee?.name}</SelectValue>
                </SelectTrigger>
                {/* Fixed size; the list scrolls inside it. */}
                <SelectContent className="max-h-72 w-72">
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs py-1.5">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          userId={e.id}
                          name={e.name}
                          image={e.avatarUrl}
                          className="w-6 h-6 bg-primary/10 text-primary text-[10px] font-semibold"
                        >
                          {(e.name || "EM").slice(0, 2).toUpperCase()}
                        </UserAvatar>
                        <span className="truncate">{e.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {currentEmployee?.role}
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
              <div className="text-xs font-medium text-muted-foreground uppercase">
                Department
              </div>
              <div className="font-bold text-foreground">
                {currentEmployee?.department || "Not set"}
              </div>
            </div>
          </div>

          {/* Joining Date */}
          <div className="flex items-center gap-2.5 border-l pl-6">
            <div className="p-2 rounded-xl bg-muted text-primary">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase">
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
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={handleAddRow}
            disabled={unusedTypes.length === 0}
            title={unusedTypes.length === 0 ? "Every leave type is already in the list" : undefined}
            className="text-xs font-semibold text-primary hover:text-foreground hover:bg-primary/5 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Leave Type</span>
          </Button>
        </div>

        {/* Adjustments Table */}
        <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">LEAVE TYPE</th>
                <th className="py-3 px-4 font-semibold">ADJUSTMENT TYPE</th>
                <th className="py-3 px-4 font-semibold">DAYS *</th>
                <th className="py-3 px-4 font-semibold">CURRENT BALANCE</th>
                <th className="py-3 px-4 font-semibold">NEW BALANCE</th>
                <th className="py-3 px-4 font-semibold text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    {isLoading ? "Loading…" : "No active leave types to adjust."}
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const newBalance = newBalanceOf(row);
                const error = rowError(row);

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
                          {availableTypes
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            .filter((t: any) => t.id === row.leaveTypeId || !rows.some((r) => r.leaveTypeId === t.id))
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            .map((t: any) => (
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
                          min={0.5}
                          step={0.5}
                          max={MAX_DAYS}
                          value={Number.isFinite(row.days) ? row.days : ""}
                          aria-invalid={Boolean(error)}
                          onChange={(e) =>
                            handleUpdateRow(row.id, { days: e.target.value === "" ? NaN : Number(e.target.value) })
                          }
                          className={cn(
                            "h-9 w-24 rounded-xl text-xs bg-background font-semibold",
                            error && "border-red-500 focus-visible:ring-red-500"
                          )}
                        />
                        {error && <p className="text-xs text-red-600 dark:text-red-400 max-w-[180px]">{error}</p>}
                      </div>
                    </td>

                    {/* Current Balance */}
                    <td className="py-3 px-4 font-medium text-foreground">
                      {row.currentBalance} Days
                    </td>

                    {/* New Balance — red when it would go below zero (not allowed) */}
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "font-bold text-sm",
                          newBalance < 0
                            ? "text-red-600 dark:text-red-400"
                            : newBalance < row.currentBalance
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
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
            <Select value={reason} onValueChange={(val) => setReason(val as AdjustmentReason)}>
              <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
                <SelectValue placeholder="Select Reason" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(REASON_LABELS) as AdjustmentReason[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {REASON_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Remarks (Optional)
              </label>
              <span className="text-xs text-muted-foreground font-mono">
                {remarks.length}/300
              </span>
            </div>
            <Input
              value={remarks}
              maxLength={300}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Outstanding performance in Q1"
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
              <div className="text-xs text-muted-foreground uppercase">
                Total Adjustment
              </div>
              <div
                className={cn(
                  "text-base font-bold",
                  totalDaysAdjustment < 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {totalDaysAdjustment >= 0 ? `+${totalDaysAdjustment}` : totalDaysAdjustment} Days
              </div>
            </div>

            <div className="border-l pl-6">
              <div className="text-xs text-muted-foreground uppercase">
                Updated On
              </div>
              <div className="font-semibold text-foreground">{effectiveDate}</div>
            </div>
          </div>
        </div>

        {submitError && (
          <div role="alert" className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs font-medium text-red-700 dark:text-red-300">
            {submitError}
          </div>
        )}

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
            onClick={handleReview}
            className="h-10 px-6 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
          >
            Review & Confirm
          </Button>
        </div>
      </div>

      {/* Review step — nothing is saved until "Confirm Adjustment" */}
      {isReviewOpen && currentEmployee && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="adjust-review-title"
          onKeyDown={(e) => e.key === "Escape" && !isSubmitting && setIsReviewOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 id="adjust-review-title" className="text-lg font-bold text-foreground">
                Review balance adjustment
              </h3>
              <p className="text-xs text-muted-foreground">
                For <span className="font-semibold text-foreground">{currentEmployee.name}</span>. This changes their
                leave balance immediately.
              </p>
            </div>

            <table className="w-full text-xs border rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground uppercase tracking-wider">
                  <th className="py-2 px-3 text-left font-semibold">Leave type</th>
                  <th className="py-2 px-3 text-right font-semibold">Change</th>
                  <th className="py-2 px-3 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 px-3 font-medium text-foreground">{r.leaveTypeName}</td>
                    <td className={cn("py-2 px-3 text-right font-bold", signedDays(r) < 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                      {signedDays(r) > 0 ? `+${signedDays(r)}` : signedDays(r)}
                    </td>
                    <td className="py-2 px-3 text-right text-foreground whitespace-nowrap">
                      {r.currentBalance} → <span className="font-bold">{newBalanceOf(r)}</span> days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-muted/40 rounded-xl p-3 text-xs space-y-1.5 border">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Reason:</span>
                <span className="font-medium text-foreground">{reason ? REASON_LABELS[reason] : "—"}</span>
              </div>
              {remarks.trim() && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Remarks:</span>
                  <span className="font-medium text-foreground text-right break-words">{remarks.trim()}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                autoFocus
                disabled={isSubmitting}
                onClick={() => setIsReviewOpen(false)}
                className="flex-1 h-10 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Back to edit
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirm}
                className="flex-1 h-10 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving…
                  </>
                ) : (
                  "Confirm Adjustment"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

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
                <span className="font-bold text-foreground">
                  {totalDaysAdjustment >= 0 ? `+${totalDaysAdjustment}` : totalDaysAdjustment} Days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reason:</span>
                <span className="font-medium text-foreground">{reason ? REASON_LABELS[reason] : "—"}</span>
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
                  // Back to the employee list on this tab, with the updated balances.
                  if (currentEmployee) setupInitialRows(currentEmployee);
                  setReason("");
                  setRemarks("");
                  onSuccess?.();
                }}
                className="flex-1 h-10 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
