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
import { DateTile, StatusPill, TONE_SOFT, type PulseTone } from "@/components/pulse/pulse-ui";
import { getHolidaysAction } from "../queries/leave-queries";
import {
  createHolidayAction,
  deleteHolidayAction,
} from "../actions/leave-actions";
import { errorMessage, unwrap } from "../action-result";
import { istDateKey } from "@/features/attendance/utils";
import { usePageViewState, usePageDraft, useClearPageDraft } from "@/lib/navigation/use-url-state";

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

const CURRENT_YEAR = Number(istDateKey().slice(0, 4));
/** Last year, this year and next year. */
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(String);

/** `canManage` shows add/delete (Team Leave); My Leaves shows the same list read-only. */
export function HolidaysView({ canManage = false }: { canManage?: boolean }) {
  const [selectedYear, setSelectedYear] = useState(String(CURRENT_YEAR));
  const [isAddModalOpen, setIsAddModalOpen] = usePageViewState("HolidaysView:isAddModalOpen", false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Add Holiday Modal
  // What's typed is kept as a draft (survives leaving the page and a refresh) until it's saved or the
  // form is closed.
  const draft = "add-holiday";
  const clearDraft = useClearPageDraft(draft);
  /** Closing the dialog (Cancel, ✕, or after saving) forgets the draft. */
  const setAddOpen = (open: boolean) => {
    if (!open) clearDraft();
    setIsAddModalOpen(open);
  };
  const [newHolidayName, setNewHolidayName] = usePageDraft(draft, "newHolidayName", "");
  const [newHolidayDate, setNewHolidayDate] = usePageDraft(draft, "newHolidayDate", "");
  const [newHolidayType, setNewHolidayType] = usePageDraft<"PUBLIC" | "COMPANY_SPECIAL" | "OPTIONAL">(draft, "newHolidayType", "PUBLIC");
  const [newHolidayDesc, setNewHolidayDesc] = usePageDraft(draft, "newHolidayDesc", "");

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
      unwrap(
        await createHolidayAction({
          name: newHolidayName,
          date: newHolidayDate,
          type: newHolidayType,
          description: newHolidayDesc,
        })
      );

      setAddOpen(false);
      loadHolidays();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      setHolidayList((prev) => prev.filter((h) => h.id !== id));
      unwrap(await deleteHolidayAction(id));
      loadHolidays();
    } catch (err) {
      alert(errorMessage(err));
      loadHolidays();
    }
  };

  const TYPE_LOOK: Record<HolidayRecord["type"], { label: string; tone: PulseTone }> = {
    PUBLIC: { label: "Public Holiday", tone: "blue" },
    COMPANY_SPECIAL: { label: "Special Holiday", tone: "violet" },
    OPTIONAL: { label: "Optional Holiday", tone: "green" },
  };
  const stats: { label: string; value: number; tone: PulseTone; icon: React.ReactNode }[] = [
    { label: "Total Holidays", value: metrics.total, tone: "violet", icon: <Calendar className="h-4 w-4" /> },
    { label: "Upcoming", value: metrics.upcoming, tone: "green", icon: <CalendarCheck className="h-4 w-4" /> },
    { label: "Passed", value: metrics.passed, tone: "amber", icon: <CalendarClock className="h-4 w-4" /> },
    { label: "Special / Optional", value: metrics.special, tone: "blue", icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4 select-none">
      {/* Toolbar: title, year, add */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Holidays</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-8 w-32 rounded-md bg-background text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{selectedYear}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <Button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="h-8 rounded-md bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Holiday
            </Button>
          )}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", TONE_SOFT[s.tone])}>{s.icon}</span>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Holiday list */}
      <div className="overflow-x-auto rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2.5">Holiday</th>
              <th className="px-4 py-2.5">Day</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-5 py-2.5">Description</th>
              {canManage && <th className="px-4 py-2.5 text-center">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {isLoading && holidayList.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                  Loading holidays...
                </td>
              </tr>
            ) : holidayList.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="py-10 text-center text-muted-foreground">
                  No holidays listed for {selectedYear}
                </td>
              </tr>
            ) : (
              holidayList.map((holiday) => {
                const look = TYPE_LOOK[holiday.type] ?? TYPE_LOOK.PUBLIC;
                return (
                  <tr key={holiday.id} className="transition-colors hover:bg-muted/40">
                    {/* Holiday + date block */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <DateTile date={holiday.date} tone={look.tone} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                            <span>{holiday.iconType || "🎉"}</span>
                            {holiday.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{holiday.date}</p>
                        </div>
                      </div>
                    </td>

                    {/* Day */}
                    <td className="px-4 py-3 text-muted-foreground">{holiday.dayOfWeek}</td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <StatusPill tone={look.tone}>{look.label}</StatusPill>
                    </td>

                    {/* Description */}
                    <td className="px-5 py-3">
                      <div className="max-w-xs truncate text-xs text-muted-foreground">{holiday.description || "Company Holiday"}</div>
                    </td>

                    {/* Actions */}
                    {canManage && (
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          className="rounded p-1.5 text-red-500/80 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                          title="Delete Holiday"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border/70 px-5 py-2.5 text-xs text-muted-foreground">
          Showing <strong className="mx-1 text-foreground">{holidayList.length}</strong> records
        </div>
      </div>

      {/* Add Holiday Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setAddOpen}>
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
            </div>

            {/* Description / Note */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground">
                  Description / Note (Optional)
                </label>
                <span className="text-xs text-muted-foreground font-mono">
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
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(false)}
                className="text-xs h-9 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !newHolidayName || !newHolidayDate}
                className="text-xs h-9 rounded-lg bg-primary text-primary-foreground"
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
