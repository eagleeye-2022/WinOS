"use client";

import React, { useEffect, useState } from "react";
import { X, Link2, Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { createProjectEffortShareLinkAction } from "../../actions/timesheet-share-actions";

type Range = { from: string; to: string };

interface ShareProjectLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  /**
   * The period the report's date picker shows (YYYY-MM-DD) — exactly what gets shared: the day,
   * month or range picked there, or the project's whole duration in Project Span.
   */
  currentView: Range;
  /** Shown before the dates, e.g. "Project Span". */
  periodLabel?: string;
}

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
  periodLabel,
}: ShareProjectLogsModalProps) {
  const [link, setLink] = useState<{ url: string; ownOnly: boolean } | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  // A new period picked behind the dialog needs a new link.
  const periodKey = `${currentView.from}|${currentView.to}`;
  useEffect(() => {
    if (!isOpen) return;
    React.startTransition(() => {
      setLink(null);
      setCopied(false);
    });
  }, [isOpen, periodKey]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    setIsWorking(true);
    // Links don't expire.
    const res = await createProjectEffortShareLinkAction(projectId, currentView.from, currentView.to, null);
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground min-w-0">
              Sharing:{" "}
              <strong className="text-foreground">
                {periodLabel ? `${periodLabel} · ` : ""}
                {formatRange(currentView)}
              </strong>
            </p>
            {!link && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isWorking}
                className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
