"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  PauseCircle,
  Users,
  Home,
  Search,
  Plus,
  Edit2,
  MoreVertical,
  Sliders,
  Sparkles,
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

export interface LeaveTypePolicyItem {
  id: string;
  name: string;
  description: string;
  code: string;
  category: "Paid Leave" | "Unpaid Leave" | "Partially Paid";
  unit: "Day(s)" | "Hour(s)";
  entitlement: string;
  isActive: boolean;
  iconBg: string;
  iconText: string;
  iconEmoji: string;
}

interface LeavePolicyViewProps {
  onCreateNew?: () => void;
}

export function LeavePolicyView({ onCreateNew }: LeavePolicyViewProps) {
  const router = useRouter();

  const [leavePolicies, setLeavePolicies] = useState<LeaveTypePolicyItem[]>([
    {
      id: "lp-1",
      name: "Paid Leave",
      description: "General paid time off for employees",
      code: "PL",
      category: "Paid Leave",
      unit: "Day(s)",
      entitlement: "12 days / Year",
      isActive: true,
      iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40",
      iconText: "text-emerald-600",
      iconEmoji: "🗓️",
    },
    {
      id: "lp-2",
      name: "Sick Leave",
      description: "For illness or medical reasons",
      code: "SL",
      category: "Paid Leave",
      unit: "Day(s)",
      entitlement: "3 days / month",
      isActive: true,
      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/40",
      iconText: "text-blue-600",
      iconEmoji: "🩺",
    },
    {
      id: "lp-3",
      name: "Casual Leave",
      description: "For short personal work",
      code: "CL",
      category: "Paid Leave",
      unit: "Day(s)",
      entitlement: "6 days / Year",
      isActive: true,
      iconBg: "bg-orange-50 text-orange-600 dark:bg-orange-950/40",
      iconText: "text-orange-600",
      iconEmoji: "🏖️",
    },
    {
      id: "lp-4",
      name: "Maternity Leave",
      description: "For female employees",
      code: "ML",
      category: "Paid Leave",
      unit: "Day(s)",
      entitlement: "180 days / Year",
      isActive: true,
      iconBg: "bg-purple-50 text-purple-600 dark:bg-purple-950/40",
      iconText: "text-purple-600",
      iconEmoji: "🤱",
    },
    {
      id: "lp-5",
      name: "Comp Off",
      description: "Earned for extra weekend/holiday work",
      code: "COMP",
      category: "Paid Leave",
      unit: "Day(s)",
      entitlement: "On-demand",
      isActive: true,
      iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-950/40",
      iconText: "text-amber-600",
      iconEmoji: "⏱️",
    },
    {
      id: "lp-6",
      name: "Loss of Pay (LOP)",
      description: "Unpaid leave beyond available quota",
      code: "LOP",
      category: "Unpaid Leave",
      unit: "Day(s)",
      entitlement: "Unlimited",
      isActive: false,
      iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-950/40",
      iconText: "text-rose-600",
      iconEmoji: "🚫",
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [unitFilter, setUnitFilter] = useState("ALL");

  const togglePolicyStatus = (id: string) => {
    setLeavePolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
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
      if (unitFilter !== "ALL" && p.unit !== unitFilter) {
        return false;
      }
      return true;
    });
  }, [leavePolicies, searchTerm, statusFilter, categoryFilter, unitFilter]);

  const handleCreate = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      router.push("/pulse/leave/policy/new");
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Leave Types
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create and manage all leave types defined in your organization.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleCreate}
          className="h-10 px-5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Leave Type</span>
        </Button>
      </div>

      {/* 5 Metric Summary Cards (Image 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Leave Types */}
        <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-500">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">12</div>
            <div className="text-xs font-semibold text-muted-foreground">Total Leave Types</div>
          </div>
        </div>

        {/* Active Leave Types */}
        <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">10</div>
            <div className="text-xs font-semibold text-muted-foreground">Active Leave Types</div>
          </div>
        </div>

        {/* Inactive Leave Types */}
        <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500">
            <PauseCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">1</div>
            <div className="text-xs font-semibold text-muted-foreground">Inactive Leave Types</div>
          </div>
        </div>

        {/* Paid Leave Types */}
        <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-500">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">8</div>
            <div className="text-xs font-semibold text-muted-foreground">Paid Leave Types</div>
          </div>
        </div>

        {/* Unpaid / LOP Types */}
        <div className="bg-card border rounded-2xl p-4 shadow-2xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500">
            <Home className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">4</div>
            <div className="text-xs font-semibold text-muted-foreground">Unpaid / LOP Types</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search leave types..."
              className="h-9 pl-9 rounded-xl text-xs bg-background"
            />
          </div>

          {/* Status */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">STATUS</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">LEAVE CATEGORY</span>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="Paid Leave">Paid Leave</SelectItem>
                <SelectItem value="Unpaid Leave">Unpaid Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Unit */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">LEAVE UNIT</span>
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="Day(s)">Day(s)</SelectItem>
                <SelectItem value="Hour(s)">Hour(s)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Leave Types Table */}
        <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border/80 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-5 font-semibold">Leave Type</th>
                <th className="py-3 px-4 font-semibold">Code</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Leave Unit</th>
                <th className="py-3 px-4 font-semibold">Entitlement</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                  {/* Leave Type Name & Icon */}
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-xl flex items-center justify-center text-sm", item.iconBg)}>
                        <span>{item.iconEmoji}</span>
                      </div>
                      <div>
                        <div className="font-bold text-foreground leading-tight">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Code */}
                  <td className="py-3 px-4 font-semibold text-foreground">
                    {item.code}
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border",
                        item.category === "Paid Leave"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                      )}
                    >
                      {item.category}
                    </span>
                  </td>

                  {/* Unit */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                      {item.unit}
                    </span>
                  </td>

                  {/* Entitlement */}
                  <td className="py-3 px-4 text-foreground font-medium">
                    {item.entitlement}
                  </td>

                  {/* Status Toggle */}
                  <td className="py-3 px-4">
                    <Switch
                      checked={item.isActive}
                      onCheckedChange={() => togglePolicyStatus(item.id)}
                    />
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <button
                        type="button"
                        onClick={handleCreate}
                        className="hover:text-primary p-1 rounded"
                        title="Edit Leave Type"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="hover:text-foreground p-1 rounded"
                        title="More Options"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
