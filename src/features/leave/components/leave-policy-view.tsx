"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  PauseCircle,
  Users,
  Home,
  Search,
  Plus,
  Sliders,
  Sparkles,
  Loader2,
  Thermometer,
  Heart,
  Pill,
  Plane,
  Baby,
  Clock,
  Gift,
  AlertTriangle,
  FileText,
  Laptop2,
  Coffee,
  Sun,
  Briefcase,
  TimerReset,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { StatusPill, TONE_SOFT, TONE_TEXT, type PulseTone } from "@/components/pulse/pulse-ui";
import { getLeaveTypesAction } from "../queries/leave-queries";
import { deleteLeaveTypeAction, toggleLeaveTypeStatusAction } from "../actions/leave-actions";
import { errorMessage, unwrap } from "../action-result";

export interface LeaveTypePolicyItem {
  id: string;
  name: string;
  description: string;
  /** Who it's for, as saved (employment type, department, audience…); empty = everyone. */
  appliesTo?: string[];
  code: string;
  category: "Paid Leave" | "Unpaid Leave" | "Partially Paid";
  /** Always "Day(s)" — balances are kept in days. */
  unit: string;
  entitlement: string;
  isActive: boolean;
  icon?: string;
  iconBg: string;
  iconText: string;
  iconEmoji: string;
}

interface LeavePolicyViewProps {
  onCreateNew?: () => void;
  /** Open the wizard for this leave type (edit mode). */
  onEdit?: (id: string) => void;
}

export function LeavePolicyView({ onCreateNew, onEdit }: LeavePolicyViewProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Deletes only never-used types; the server refuses (with the reason) if it has any history.
  const deletePolicy = async (item: LeaveTypePolicyItem) => {
    if (!window.confirm(`Delete the leave type "${item.name}" (${item.code})? This can't be undone.`)) return;
    setDeletingId(item.id);
    try {
      unwrap(await deleteLeaveTypeAction(item.id));
      setLeavePolicies((prev) => prev.filter((p) => p.id !== item.id));
      loadPolicies();
    } catch (err) {
      alert(errorMessage(err, "Couldn't delete this leave type."));
    } finally {
      setDeletingId(null);
    }
  };

  const [leavePolicies, setLeavePolicies] = useState<LeaveTypePolicyItem[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    paid: 0,
    unpaid: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const getLeaveIcon = (iconName?: string) => {
    switch (iconName) {
      case "Thermometer":
        return Thermometer;
      case "Heart":
        return Heart;
      case "Pill":
        return Pill;
      case "Plane":
        return Plane;
      case "CalendarDays":
        return CalendarDays;
      case "Baby":
        return Baby;
      case "Users":
        return Users;
      case "Clock":
        return Clock;
      case "Gift":
        return Gift;
      case "AlertTriangle":
        return AlertTriangle;
      case "Sparkles":
        return Sparkles;
      case "FileText":
        return FileText;
      case "Laptop2":
        return Laptop2;
      case "Coffee":
        return Coffee;
      case "Sun":
        return Sun;
      case "Briefcase":
        return Briefcase;
      case "TimerReset":
        return TimerReset;
      default:
        return Calendar;
    }
  };

  const loadPolicies = async () => {
    try {
      const data = await getLeaveTypesAction();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLeavePolicies(data.leaveTypes as any);
      setMetrics(data.metrics);
    } catch (err) {
      console.error("Failed to load leave types:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const togglePolicyStatus = async (id: string, currentActive: boolean) => {
    try {
      const newStatus = !currentActive;
      setLeavePolicies((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: newStatus } : p))
      );
      unwrap(await toggleLeaveTypeStatusAction(id, newStatus));
      loadPolicies();
    } catch (err) {
      alert(errorMessage(err));
      loadPolicies();
    }
  };

  const filtered = useMemo(() => {
    return leavePolicies.filter((p) => {
      if (
        searchTerm &&
        !p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !p.code.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      if (statusFilter !== "ALL") {
        if (statusFilter === "ACTIVE" && !p.isActive) return false;
        if (statusFilter === "INACTIVE" && p.isActive) return false;
      }
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [leavePolicies, searchTerm, statusFilter, categoryFilter]);

  const handleCreate = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      router.push(ROUTES.pulseTeamLeavePolicyNew);
    }
  };

  const CARD = "rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
  const stats: { label: string; value: number; tone: PulseTone; icon: React.ReactNode }[] = [
    { label: "Total Leave Types", value: metrics.total, tone: "blue", icon: <Calendar className="h-4 w-4" /> },
    { label: "Active", value: metrics.active, tone: "green", icon: <CheckCircle2 className="h-4 w-4" /> },
    { label: "Inactive", value: metrics.inactive, tone: "amber", icon: <PauseCircle className="h-4 w-4" /> },
    { label: "Paid", value: metrics.paid, tone: "violet", icon: <Users className="h-4 w-4" /> },
    { label: "Unpaid / LOP", value: metrics.unpaid, tone: "red", icon: <Home className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4 select-none">
      {/* Toolbar */}
      <div className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between", CARD)}>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Leave Types</h1>
        </div>

        <Button
          type="button"
          onClick={handleCreate}
          className="h-8 self-start rounded-md bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Create Leave Type
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className={cn("flex items-center gap-3 px-4 py-3", CARD)}>
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", TONE_SOFT[s.tone])}>{s.icon}</span>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table card with filter bar */}
      <div className={cn("overflow-hidden", CARD)}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search leave types..."
              className="h-8 w-full rounded-md bg-background pl-9 text-xs"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 rounded-md bg-background text-xs">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-40 rounded-md bg-background text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="Paid Leave">Paid Leave</SelectItem>
              <SelectItem value="Unpaid Leave">Unpaid Leave</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5">Leave Type</th>
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Leave Unit</th>
                <th className="px-4 py-2.5">Entitlement</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {isLoading && leavePolicies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                    Loading leave types...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                    No leave types found matching the criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const IconComponent = getLeaveIcon(item.icon);
                  const isPaid = item.category === "Paid Leave";
                  return (
                    <tr key={item.id} className={cn("transition-colors hover:bg-muted/40", !item.isActive && "opacity-70")}>
                      {/* Leave type */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", item.iconBg)}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold leading-tight text-foreground">{item.name}</div>
                            <div className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">{item.description}</div>
                            {/* Who this type is for — checked against each member's profile in User Management. */}
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(item.appliesTo?.length ? item.appliesTo : ["Everyone"]).map((rule) => (
                                <StatusPill key={rule} tone={item.appliesTo?.length ? "violet" : "gray"}>
                                  {rule}
                                </StatusPill>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="px-4 py-3">
                        <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                          {item.code}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <StatusPill tone={isPaid ? "green" : "red"}>{item.category}</StatusPill>
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-3">
                        <StatusPill tone="blue">{item.unit}</StatusPill>
                      </td>

                      {/* Entitlement */}
                      <td className="px-4 py-3 font-medium text-foreground">{item.entitlement}</td>

                      {/* Status toggle */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Switch checked={item.isActive} onCheckedChange={() => togglePolicyStatus(item.id, item.isActive)} />
                          <span className={cn("text-[11px] font-semibold", item.isActive ? TONE_TEXT.green : "text-muted-foreground")}>
                            {item.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>

                      {/* Edit / delete */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(item.id)}
                              title={`Edit ${item.name}`}
                              className="rounded-md p-1.5 text-blue-600 transition-colors hover:bg-muted hover:text-foreground dark:text-blue-400"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deletePolicy(item)}
                            disabled={deletingId === item.id}
                            title={`Delete ${item.name}`}
                            className="rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/40"
                          >
                            {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
          Showing <strong className="mx-1 text-foreground">{filtered.length}</strong> of {leavePolicies.length} leave types
        </div>
      </div>
    </div>
  );
}
