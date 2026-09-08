"use client";

import React, { useState, useEffect } from "react";
import { Info, Edit2, Trash2, X, AlertCircle } from "lucide-react";

interface TimerStoppedModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartTime?: Date;
  initialEndTime?: Date;
  elapsedSeconds?: number;
  taskTitle?: string;
  taskCode?: string;
  onSaveLog?: (data: {
    duration: string;
    startTime: string;
    endTime: string;
    isBillable: boolean;
    notes: string;
  }) => void;
  onDiscardLog?: () => void;
}

import { formatTime12h } from "../../utils/time-helpers";

// Format date time for display (e.g., 30/07/2026 4:04 PM)
function formatDisplayDateTime(d: Date) {
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

// Format for <input type="datetime-local">
function formatDateTimeForInput(d: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function TimerStoppedModal({
  isOpen,
  onClose,
  initialStartTime,
  initialEndTime,
  elapsedSeconds = 0,
  onSaveLog,
  onDiscardLog,
}: TimerStoppedModalProps) {
  const now = new Date();
  const [startTime, setStartTime] = useState<Date>(
    initialStartTime || new Date(now.getTime() - elapsedSeconds * 1000)
  );
  const [endTime, setEndTime] = useState<Date>(initialEndTime || now);

  const [isBillable, setIsBillable] = useState(true);
  const [notes, setNotes] = useState("");

  const [isEditingTimes, setIsEditingTimes] = useState(false);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      const end = initialEndTime || new Date();
      const start =
        initialStartTime || new Date(end.getTime() - elapsedSeconds * 1000);
      setStartTime(start);
      setEndTime(end);
      setStartInput(formatDateTimeForInput(start));
      setEndInput(formatDateTimeForInput(end));
      setNotes("");
      setErrorMsg("");
      setIsEditingTimes(false);
    }
  }

  if (!isOpen) return null;

  // Calculate duration string (HH:MM format)
  function calculateDuration(start: Date, end: Date) {
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return { formatted: "00:00", hours: 0, minutes: 0, valid: false };

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");

    return {
      formatted: `${pad(hrs)}:${pad(mins)}`,
      hours: hrs,
      minutes: mins,
      valid: true,
    };
  }

  const durationObj = calculateDuration(startTime, endTime);

  // Time validator on change
  const handleApplyTimeEdit = () => {
    const newStart = new Date(startInput);
    const newEnd = new Date(endInput);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      setErrorMsg("Please enter valid start and end dates.");
      return;
    }

    if (newEnd <= newStart) {
      setErrorMsg("End time must be after Start time.");
      return;
    }

    setStartTime(newStart);
    setEndTime(newEnd);
    setErrorMsg("");
    setIsEditingTimes(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!durationObj.valid) {
      setErrorMsg("End time must be after Start time.");
      return;
    }

    if (onSaveLog) {
      onSaveLog({
        duration: durationObj.formatted,
        startTime: formatTime12h(startTime),
        endTime: formatTime12h(endTime),
        isBillable,
        notes: notes.trim(),
      });
    }

    onClose();
  };

  const handleDiscard = () => {
    if (onDiscardLog) {
      onDiscardLog();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-0 duration-200">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl overflow-hidden font-sans dark:border-neutral-800 dark:bg-[#16181d]">
        
        {/* Header with Info Icon matching user screenshot */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-border/40 dark:border-neutral-800/40">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-sky-500/15 flex items-center justify-center text-sky-500">
              <Info size={18} />
            </div>
            <h3 className="text-base font-bold text-foreground dark:text-neutral-100">
              Timer has stopped.
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 pt-3 space-y-4">
          
          {/* Duration Card matching user screenshot */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 dark:border-neutral-800/80 dark:bg-[#1c1e24]">
            <div className="flex items-center justify-between">
              
              {/* Duration Display */}
              <div className="flex flex-col items-center justify-center pr-6">
                <span className="text-3xl font-extrabold text-[#0088ff] font-mono tracking-tight">
                  {durationObj.formatted}
                </span>
                <span className="text-xs text-muted-foreground font-medium dark:text-neutral-400">
                  Hours
                </span>
              </div>

              {/* Vertical Separator */}
              <div className="h-12 w-px bg-border/80 dark:bg-neutral-800" />

              {/* Start / End Times */}
              <div className="flex-1 pl-6 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium dark:text-neutral-400">
                    Starts
                  </span>
                  <div className="flex items-center gap-1.5 font-medium text-foreground dark:text-neutral-200">
                    <span>{formatDisplayDateTime(startTime)}</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingTimes(!isEditingTimes)}
                      className="text-sky-500 hover:text-sky-600 p-0.5 rounded cursor-pointer"
                      title="Edit Start / End Time"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium dark:text-neutral-400">
                    Ends
                  </span>
                  <span className="font-medium text-foreground dark:text-neutral-200">
                    {formatDisplayDateTime(endTime)}
                  </span>
                </div>
              </div>
            </div>

            {/* Time Validator / Editor Inline Form */}
            {isEditingTimes && (
              <div className="mt-3 pt-3 border-t border-border/60 space-y-2.5 dark:border-neutral-800">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-muted-foreground font-semibold mb-1">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startInput}
                      onChange={(e) => {
                        setStartInput(e.target.value);
                        setErrorMsg("");
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground font-semibold mb-1">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      value={endInput}
                      onChange={(e) => {
                        setEndInput(e.target.value);
                        setErrorMsg("");
                      }}
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingTimes(false)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyTimeEdit}
                    className="px-3 py-1 rounded bg-sky-500 text-white text-[11px] font-bold hover:bg-sky-600 transition-colors cursor-pointer"
                  >
                    Apply Time
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Validation Error Alert */}
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive font-medium">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Radio Buttons matching user screenshot */}
          <div className="flex items-center gap-6 text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground dark:text-neutral-200">
              <input
                type="radio"
                name="billable"
                checked={isBillable}
                onChange={() => setIsBillable(true)}
                className="h-4 w-4 text-sky-500 focus:ring-sky-500 cursor-pointer"
              />
              <span>Billable</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground dark:text-neutral-200">
              <input
                type="radio"
                name="billable"
                checked={!isBillable}
                onChange={() => setIsBillable(false)}
                className="h-4 w-4 text-sky-500 focus:ring-sky-500 cursor-pointer"
              />
              <span>Non Billable</span>
            </label>
          </div>

          {/* Notes Field matching user screenshot */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold text-foreground dark:text-neutral-300">
              Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What were you working on?"
              className="w-full rounded-xl border border-input bg-muted/20 p-3 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-sky-500 resize-none font-sans dark:border-neutral-800 dark:bg-[#121316] dark:text-neutral-100"
            />
          </div>

          {/* Modal Footer matching user screenshot */}
          <div className="flex items-center justify-between pt-3 border-t border-border dark:border-neutral-800">
            <button
              type="submit"
              className="rounded-lg bg-[#0088ff] px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-[#0077ee] transition-all cursor-pointer"
            >
              Update
            </button>

            <button
              type="button"
              onClick={handleDiscard}
              className="text-destructive hover:bg-destructive/10 p-2 rounded-lg transition-colors cursor-pointer"
              title="Discard Log"
            >
              <Trash2 size={18} />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
