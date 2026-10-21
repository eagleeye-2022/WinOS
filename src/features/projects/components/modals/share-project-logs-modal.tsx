"use client";

import React, { useEffect, useState } from "react";
import { X, Link2, Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { createProjectEffortShareLinkAction } from "../../actions/timesheet-share-actions";
import {
  SHARE_PERIOD_PRESETS,
  resolveSharePeriod,
  toYYYYMMDD,
  type SharePeriodPreset,
} from "../../utils/share-periods";

type Range = { from: string; to: string };

interface ShareProjectLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  /** What the report's date picker currently shows (YYYY-MM-DD) — prefills the date / range inputs. */
  currentView: Range;
}

type PeriodChoice = SharePeriodPreset | "custom";

// Only Today, Last week and a custom date / range are offered here.
const MODAL_PRESETS = SHARE_PERIOD_PRESETS.filter((p) => p.value === "today" || p.value === "last_week");

const RANGE_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function formatRange({ from, to }: Range): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return RANGE_DATE_FORMAT.format(new Date(y, m - 1, d));
  };
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

export function ShareProjectLogsModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  currentView,
}: ShareProjectLogsModalProps) {
  const [choice, setChoice] = useState<PeriodChoice>("today");
  const [customFrom, setCustomFrom] = useState(currentView.from);
  const [customTo, setCustomTo] = useState(currentView.to);
  const [link, setLink] = useState<{ url: string; ownOnly: boolean } | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    React.startTransition(() => {
      setChoice("today");
      setCustomFrom(currentView.from);
      setCustomTo(currentView.to);
      setLink(null);
      setCopied(false);
    });
    // Reset only when the dialog opens, not while the report re-renders behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const period: Range | null =
    choice === "custom"
      ? customFrom && customTo && customFrom <= customTo
        ? { from: customFrom, to: customTo }
        : null
      : resolveSharePeriod(choice, new Date());

  const pick = (next: PeriodChoice) => {
    setChoice(next);
    setLink(null);
  };

  const handleCreate = async () => {
    if (!period) return;
    setIsWorking(true);
    // Links don't expire (no expiry choice in this dialog).
    const res = await createProjectEffortShareLinkAction(projectId, period.from, period.to, null);
    setIsWorking(false);
    if (!res.success || !res.data) {
      toast.error(res.error || "Failed to create share link");
      return;
    }
    const url = `${window.location.origin}${res.data.path}`;
    setLink({ url, ownOnly: res.data.scope === "own" });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied — send it to the client");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is still shown for manual copy.
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy automatically. Select the link and copy it manually.");
    }
  };

  const chip = (value: PeriodChoice, label: string, disabled = false) => (
    <button
      key={value}
      type="button"
      disabled={disabled}
      onClick={() => pick(value)}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
        choice === value
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );

  const today = toYYYYMMDD(new Date());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl border bg-card text-card-foreground shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 size={16} className="text-primary shrink-0" />
            <h2 className="text-sm font-bold truncate">Share effort logs{projectName ? ` · ${projectName}` : ""}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 text-xs">
          {/* <p className="text-muted-foreground leading-relaxed">
            Anyone with this link — e.g. the client — can view this project&apos;s effort logs for the chosen period,
            read-only, without signing in. Edits made later show up on the shared page.
          </p> */}

          <div className="space-y-2">
            <span className="block font-semibold text-foreground">Period</span>
            <div className="flex flex-wrap gap-1.5">
              {MODAL_PRESETS.map((p) => chip(p.value, p.label))}
              {chip("custom", "Date / range")}
            </div>

            {choice === "custom" && (
              <div className="flex items-end gap-2 pt-1">
                <label className="flex-1 space-y-1">
                  <span className="block text-muted-foreground">From</span>
                  <input
                    type="date"
                    value={customFrom}
                    max={today}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      if (!customTo || e.target.value > customTo) setCustomTo(e.target.value);
                      setLink(null);
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
                  />
                </label>
                <label className="flex-1 space-y-1">
                  <span className="block text-muted-foreground">To (same day for a single date)</span>
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setLink(null);
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
                  />
                </label>
              </div>
            )}

            <p className="text-muted-foreground">
              Sharing:{" "}
              <strong className="text-foreground">{period ? formatRange(period) : "Pick a valid date range"}</strong>
            </p>
          </div>

          <div className="flex justify-end">
            {!link && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isWorking || !period}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWorking ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                Create link
              </button>
            )}
          </div>

          {link && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={link.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-xs text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              {link.ownOnly && (
                <p className="text-warning">
                  Only your own logs are included — managers and the project owner can share the whole team&apos;s.
                </p>
              )}
              <div className="flex items-center justify-end text-xs text-muted-foreground">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  Preview <ExternalLink size={11} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
