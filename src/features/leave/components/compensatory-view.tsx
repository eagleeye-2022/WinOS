"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { CompensatoryRequest } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function CompensatoryView() {
  const [requests, setRequests] = useState<CompensatoryRequest[]>([
    {
      id: "comp-1",
      workDate: "15 Aug 2026",
      workDayOfWeek: "Sat",
      hoursWorkedDisplay: "09:00 AM - 05:00 PM\n8h 00m",
      fromTime: "09:00 AM",
      toTime: "05:00 PM",
      durationType: "FULL_DAY",
      durationText: "Full Day",
      reason: "Urgent client production release on holiday",
      status: "APPROVED",
      requestedOn: "16 Aug 2026",
      expiryDate: "15 Nov 2026",
    },
    {
      id: "comp-2",
      workDate: "02 Aug 2026",
      workDayOfWeek: "Sun",
      hoursWorkedDisplay: "10:00 AM - 02:00 PM\n4h 00m",
      fromTime: "10:00 AM",
      toTime: "02:00 PM",
      durationType: "HALF_DAY",
      durationText: "Half Day",
      reason: "Database maintenance on weekend",
      status: "APPROVED",
      requestedOn: "03 Aug 2026",
      expiryDate: "02 Nov 2026",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workDate, setWorkDate] = useState("2026-08-20");
  const [reason, setReason] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newReq: CompensatoryRequest = {
      id: `comp-${Date.now()}`,
      workDate,
      workDayOfWeek: "Thu",
      hoursWorkedDisplay: "09:00 AM - 06:00 PM\n8h 00m",
      fromTime: "09:00 AM",
      toTime: "06:00 PM",
      durationType: "FULL_DAY",
      durationText: "Full Day",
      reason,
      status: "PENDING",
      requestedOn: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      expiryDate: "90 Days from approval",
    };
    setRequests([newReq, ...requests]);
    setIsModalOpen(false);
    setReason("");
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-2xl p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-tight">
            Compensatory Off Requests
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Claim compensatory off days for work performed on weekends or company holidays.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="h-9 px-4 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Claim Comp Off
        </Button>
      </div>

      <div className="bg-card border rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="border border-border/80 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">WORKED DATE</th>
                <th className="py-3 px-4">HOURS WORKED</th>
                <th className="py-3 px-4">REASON</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4">REQUESTED ON</th>
                <th className="py-3 px-4">VALIDITY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-foreground">
                    {r.workDate}
                  </td>
                  <td className="py-3 px-4 text-foreground font-medium">
                    {r.hoursWorkedDisplay}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground max-w-[240px] truncate">
                    {r.reason}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        r.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{r.requestedOn}</td>
                  <td className="py-3 px-4 text-muted-foreground">{r.expiryDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Claim Compensatory Off</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Date Worked *</label>
              <Input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Reason / Task Details *</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the urgent assignment or task handled on the holiday/weekend..."
                className="min-h-[80px] text-xs resize-none"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!reason}>
                Submit Claim
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
