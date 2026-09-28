"use client";

import React, { useEffect, useState } from "react";
import { X, Link2, Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { createTimesheetShareLinkAction } from "../../actions/timesheet-share-actions";

interface ShareTimesheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** YYYY-MM-DD */
  date: string;
  /** Human-readable date for the header, e.g. 25/09/2026 */
  dateLabel: string;
}

const EXPIRY_OPTIONS = [
  { value: "1", label: "24 hours" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "never", label: "Never" },
];

export function ShareTimesheetModal({ isOpen, onClose, date, dateLabel }: ShareTimesheetModalProps) {
  const [expiry, setExpiry] = useState("1");
  const [link, setLink] = useState<{ url: string; expiresAt: string | null } | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    React.startTransition(() => {
      setLink(null);
      setCopied(false);
    });
  }, [isOpen, date]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    setIsWorking(true);
    const res = await createTimesheetShareLinkAction(date, expiry === "never" ? null : Number(expiry));
    setIsWorking(false);
    if (!res.success || !res.data) {
      toast.error(res.error || "Failed to create share link");
      return;
    }
    const url = `${window.location.origin}${res.data.path}`;
    setLink({ url, expiresAt: res.data.expiresAt });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied — paste it in the meeting chat");
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
      <div className="w-full max-w-md rounded-xl border bg-card text-card-foreground shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-primary" />
            <h2 className="text-sm font-bold">Share time logs · {dateLabel}</h2>
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
          <p className="text-muted-foreground leading-relaxed">
            Anyone with this link can view <strong className="text-foreground">your own</strong> time logs for this
            day, read-only, without signing in. Edits you make later show up on the shared page.
          </p>

          <div className="flex items-end gap-2">
            <label className="flex-1 space-y-1.5">
              <span className="block font-semibold text-foreground">Link expires after</span>
              <select
                value={expiry}
                onChange={(e) => {
                  setExpiry(e.target.value);
                  setLink(null);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground cursor-pointer"
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {!link && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isWorking}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
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
                  className="flex-1 min-w-0 rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-[11px] text-foreground outline-none"
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
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {link.expiresAt
                    ? `Expires ${new Date(link.expiresAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
                    : "Never expires"}
                </span>
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
