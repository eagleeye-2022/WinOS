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
import { Clock, Calendar, Check } from "lucide-react";

interface RegularizeModalProps {
  item: ActionRequiredItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (itemId: string, checkIn: string, checkOut: string, reason: string) => void;
}

export function RegularizeModal({
  item,
  isOpen,
  onClose,
  onSubmit,
}: RegularizeModalProps) {
  const [checkIn, setCheckIn] = useState("09:30 AM");
  const [checkOut, setCheckOut] = useState("06:30 PM");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmit(item.id, checkIn, checkOut, reason);
      setIsSubmitting(false);
      onClose();
    }, 400);
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
          </p>

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
