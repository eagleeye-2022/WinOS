"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LeaveRequest } from "../types";
import { Calendar, Clock, FileText, Download, AlertCircle, CheckCircle2, User } from "lucide-react";

interface LeaveDetailModalProps {
  request: LeaveRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelRequest?: (id: string) => void;
}

export function LeaveDetailModal({
  request,
  isOpen,
  onClose,
  onCancelRequest,
}: LeaveDetailModalProps) {
  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              Leave Details
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                request.status === "APPROVED"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : request.status === "REJECTED"
                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {request.status}
            </span>
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            {request.leaveTypeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          {/* Date & Duration Card */}
          <div className="bg-muted/40 rounded-xl p-3.5 space-y-2 border border-border/50">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Date / Duration
              </span>
              <span className="font-bold text-foreground">{request.durationText}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">From</span>
                <p className="font-semibold text-foreground whitespace-pre-line mt-0.5">
                  {request.fromDateDisplay}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase">To</span>
                <p className="font-semibold text-foreground whitespace-pre-line mt-0.5">
                  {request.toDateDisplay}
                </p>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">
              Reason for Leave
            </span>
            <p className="p-3 bg-background border rounded-xl text-foreground font-medium leading-relaxed">
              {request.reason}
            </p>
          </div>

          {/* Approver comments if rejected */}
          {request.approverComments && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 uppercase flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Manager Feedback
              </span>
              <p className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-900 dark:text-red-300">
                {request.approverComments}
              </p>
            </div>
          )}

          {/* Attachments */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                Attachments ({request.attachments.length})
              </span>
              <div className="space-y-1.5">
                {request.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2.5 bg-background border rounded-xl"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-red-500 shrink-0" />
                      <div>
                        <div className="font-medium text-foreground truncate max-w-[200px]">
                          {att.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{att.size}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t">
            <span>Applied On: {request.appliedOn}</span>
            <span>Ref ID: #{request.id}</span>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          {request.status === "PENDING" && onCancelRequest ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                onCancelRequest(request.id);
                onClose();
              }}
              className="text-xs"
            >
              Cancel Request
            </Button>
          ) : (
            <div />
          )}
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
