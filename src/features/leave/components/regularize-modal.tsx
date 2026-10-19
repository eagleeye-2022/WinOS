"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionRequiredItem } from "../types";
import { Clock, Calendar, AlertCircle } from "lucide-react";
import {
  SHIFT_END,
  SHIFT_START,
  formatWorkedDuration,
  workedMinutesBetween,
} from "@/features/attendance/utils";

interface RegularizeModalProps {
  item: ActionRequiredItem | null;
  isOpen: boolean;
  onClose: () => void;
  /** Resolves to an error message, or null when the request was submitted. */
  onSubmit: (item: ActionRequiredItem, checkIn: string, checkOut: string, reason: string) => Promise<string | null>;
}

export function RegularizeModal({
  item,
  isOpen,
  onClose,
  onSubmit,
}: RegularizeModalProps) {
  const [checkIn, setCheckIn] = useState(SHIFT_START);
  const [checkOut, setCheckOut] = useState(SHIFT_END);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  const worked = formatWorkedDuration(workedMinutesBetween(checkIn, checkOut));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const message = await onSubmit(item, checkIn, checkOut, reason);
    setIsSubmitting(false);
    if (message) {
      setError(message);
      return;
    }
    setReason("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase">
            <Calendar className="w-3.5 h-3.5" /> Attendance Regularization
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            Regularize {item.date} ({item.dayOfWeek})
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <p className="text-muted-foreground">
            Provide the actual punch timings and explanation for why your record was missing.
            Your manager will review the request before attendance is updated.
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Punch In Time *</label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="h-9 pl-9 text-xs"
                  placeholder="09:30 AM"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Punch Out Time *</label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="h-9 pl-9 text-xs"
                  placeholder="06:30 PM"
                  required
                />
              </div>
            </div>
          </div>

          <p className="text-muted-foreground">
            Worked duration: <span className="font-semibold text-foreground">{worked ?? "--"}</span>
          </p>

          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Reason for Regularization *</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. biometric machine was offline / worked from client location..."
              className="min-h-[80px] text-xs resize-none"
              required
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !reason} size="sm" className="text-xs">
              {isSubmitting ? "Submitting..." : "Submit Regularization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
