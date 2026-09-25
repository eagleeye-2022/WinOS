"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  CalendarCheck,
  CalendarClock,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getHolidaysAction } from "../queries/leave-queries";
import {
  createHolidayAction,
  deleteHolidayAction,
} from "../actions/leave-actions";

interface HolidayRecord {
  id: string;
  name: string;
  date: string;
  dayOfWeek: string;
  type: "PUBLIC" | "COMPANY_SPECIAL" | "OPTIONAL";
  description?: string;
  addedOn?: string;
  addedBy?: string;
  iconType?: string;
}

export function HolidaysView() {
  const [selectedYear, setSelectedYear] = useState("2025");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Add Holiday Modal
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayType, setNewHolidayType] = useState<"PUBLIC" | "COMPANY_SPECIAL" | "OPTIONAL">("PUBLIC");
  const [newHolidayDesc, setNewHolidayDesc] = useState("");

  const [holidayList, setHolidayList] = useState<HolidayRecord[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    upcoming: 0,
    passed: 0,
    special: 0,
  });

  const loadHolidays = async (yearStr = selectedYear) => {
    try {
      setIsLoading(true);
      const data = await getHolidaysAction(Number(yearStr));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHolidayList(data.holidays as any);
      setMetrics(data.metrics);
    } catch (err) {
      console.error("Failed to load holidays:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays(selectedYear);
  }, [selectedYear]);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayName || !newHolidayDate) return;
    setIsSubmitting(true);

    try {
      await createHolidayAction({
        name: newHolidayName,
        date: newHolidayDate,
        type: newHolidayType,
        description: newHolidayDesc,
      });

      setIsAddModalOpen(false);
      setNewHolidayName("");
      setNewHolidayDate("");
      setNewHolidayDesc("");
      loadHolidays();
    } catch (err) {
      console.error("Failed to create holiday:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      setHolidayList((prev) => prev.filter((h) => h.id !== id));
      await deleteHolidayAction(id);
      loadHolidays();
    } catch (err) {
      console.error("Failed to delete holiday:", err);
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header with Title and + Add Holiday button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Holidays
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            View and manage company holidays
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="h-10 px-5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Holiday</span>
        </Button>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Holidays */}
        <div className="bg-card border rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground tracking-tight">{metrics.total}</div>
            <div className="text-xs font-semibold text-foreground">Total Holidays</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{selectedYear}</div>
          </div>
        </div>

        {/* Upcoming Holidays */}
        <div className="bg-card border rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground tracking-tight">{metrics.upcoming}</div>
            <div className="text-xs font-semibold text-foreground">Upcoming Holidays</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{selectedYear}</div>
          </div>
        </div>

        {/* Holidays Passed */}
        <div className="bg-card border rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground tracking-tight">{metrics.passed}</div>
            <div className="text-xs font-semibold text-foreground">Holidays Passed</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{selectedYear}</div>
          </div>
        </div>

        {/* Special Holiday */}
        <div className="bg-card border rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-foreground tracking-tight">{metrics.special}</div>
            <div className="text-xs font-semibold text-foreground">Special / Optional</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{selectedYear}</div>
          </div>
        </div>
      </div>

      {/* Holidays Table Container */}
      <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
        {/* Year Dropdown */}
        <div className="w-36">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-9 rounded-xl text-xs bg-background">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{selectedYear}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border border-border/80 rounded-xl overflow-hidden bg-background">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border/80 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-5 font-semibold">HOLIDAY NAME</th>
                <th className="py-3 px-4 font-semibold">DATE ↕</th>
                <th className="py-3 px-4 font-semibold">DAY</th>
                <th className="py-3 px-4 font-semibold">TYPE</th>
                <th className="py-3 px-5 font-semibold">DESCRIPTION</th>
                <th className="py-3 px-4 font-semibold text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {holidayList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No holidays listed for {selectedYear}
                  </td>
                </tr>
              ) : (
                holidayList.map((holiday) => (
                  <tr key={holiday.id} className="hover:bg-muted/30 transition-colors">
                    {/* Holiday Name */}
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <span className="text-base">{holiday.iconType || "🎉"}</span>
                        <span className="font-semibold text-foreground">{holiday.name}</span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 font-medium text-foreground">
                      {holiday.date}
                    </td>

                    {/* Day */}
                    <td className="py-3 px-4 text-muted-foreground">
                      {holiday.dayOfWeek}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border",
                          holiday.type === "PUBLIC"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                        )}
                      >
                        {holiday.type === "PUBLIC"
                          ? "Public Holiday"
                          : holiday.type === "COMPANY_SPECIAL"
                          ? "Special Holiday"
                          : "Optional Holiday"}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="py-3 px-5">
                      <div className="text-muted-foreground text-[11px] max-w-xs truncate">
                        {holiday.description || "Company Holiday"}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          className="hover:text-red-500 p-1 rounded"
                          title="Delete Holiday"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500/80 hover:text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Showing Records Footer */}
        <div className="flex items-center justify-end text-xs text-muted-foreground pt-1">
          <span>Showing: <strong className="text-foreground">{holidayList.length}</strong> records</span>
        </div>
      </div>

      {/* Add Holiday Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              Add Holiday
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddHoliday} className="space-y-4 py-2 text-xs">
            {/* Holiday Name */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Holiday Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                placeholder="e.g. Diwali"
                className="h-10 rounded-xl text-xs bg-background"
                required
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="h-10 rounded-xl text-xs bg-background"
                required
              />
            </div>

            {/* Holiday Type */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Holiday Type <span className="text-red-500">*</span>
              </label>
              <Select
                value={newHolidayType}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onValueChange={(val) => setNewHolidayType(val as any)}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs bg-background">
                  <SelectValue placeholder="Select holiday type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Public Holiday</SelectItem>
                  <SelectItem value="COMPANY_SPECIAL">Special Holiday</SelectItem>
                  <SelectItem value="OPTIONAL">Optional Holiday</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Choose whether this is a company holiday or optional holiday.
              </p>
            </div>

            {/* Description / Note */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground">
                  Description / Note (Optional)
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {newHolidayDesc.length}/200
                </span>
              </div>
              <Textarea
                value={newHolidayDesc}
                onChange={(e) => {
                  if (e.target.value.length <= 200) {
                    setNewHolidayDesc(e.target.value);
                  }
                }}
                placeholder="Add a short note or description about the holiday..."
                className="min-h-[80px] text-xs resize-none rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">
                Maximum 200 characters
              </p>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs h-9 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !newHolidayName || !newHolidayDate}
                className="text-xs h-9 rounded-xl bg-primary text-primary-foreground"
              >
                {isSubmitting ? "Adding..." : "Add Holiday"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
