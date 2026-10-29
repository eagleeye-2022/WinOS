"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, GitMerge, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/shared/toast";
import { STAGE_BY_ID } from "../constants";
import { useSetuStore } from "../store";
import type { Referral, ReferralDirection } from "../types";
import { formatDate } from "../utils";
import { EmptyState, Field, IconTile, Pill, SetuAvatar, SetuButton, SetuSection } from "./setu-ui";

/** Status pill: received referrals by how far they got; given ones are simply "Given". */
function statusOf(r: Referral): { label: string; dot: string } {
  if (r.direction === "GIVEN") return r.status === "WON" ? { label: "Given · Won", dot: "bg-green-500" } : { label: "Given", dot: "bg-orange-500" };
  if (r.status === "WON") return { label: "Received ✓", dot: "bg-green-500" };
  if (r.status === "LOST") return { label: "Lost", dot: "bg-red-500" };
  return { label: "Received", dot: r.status === "CONVERTED" ? "bg-[var(--setu-accent)]" : "bg-amber-500" };
}

export function ReferralsWorkspace() {
  const referrals = useSetuStore((s) => s.referrals);
  const prospects = useSetuStore((s) => s.prospects);
  const [logOpen, setLogOpen] = useState(false);

  const sorted = [...referrals].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <SetuSection
      title="Referrals Tracker"
      actions={
        <SetuButton variant="primary" onClick={() => setLogOpen(true)}>
          <Plus /> Log Referral
        </SetuButton>
      }
    >
      {sorted.length === 0 ? (
        <EmptyState icon={GitMerge} text="No referrals logged yet." />
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((r) => {
            const received = r.direction === "RECEIVED";
            const status = statusOf(r);
            const prospect = r.prospectId ? prospects.find((p) => p.id === r.prospectId) : undefined;
            return (
              <li key={r.id} className="setu-card flex items-center gap-4 rounded-2xl px-5 py-4">
                <SetuAvatar name={received ? r.memberName : "You"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                    {received ? r.memberName : "You"}
                    <ArrowRight size={13} className="setu-text-3" />
                    {received ? r.referralName : `gave ref to ${r.memberName}`}
                  </div>
                  <div className="setu-text-2 mt-0.5 text-xs">
                    {received ? r.service : `${r.referralName} · ${r.service}`} · {formatDate(r.date, true)}
                    {prospect && (
                      <>
                        {" · "}
                        <Link href={`/setu/pipeline?open=${prospect.id}`} className="setu-accent-text hover:underline">
                          {STAGE_BY_ID[prospect.stage].label} stage
                        </Link>
                      </>
                    )}
                    {!prospect && r.meetingId && (
                      <>
                        {" · "}
                        <Link href={`/setu/meetings?open=${r.meetingId}`} className="setu-accent-text hover:underline">
                          121 meeting
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                <Pill dot={status.dot}>{status.label}</Pill>
              </li>
            );
          })}
        </ul>
      )}

      <LogReferralDialog open={logOpen} onClose={() => setLogOpen(false)} />
    </SetuSection>
  );
}

function LogReferralDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addReferral = useSetuStore((s) => s.addReferral);
  const [direction, setDirection] = useState<ReferralDirection>("RECEIVED");
  const [memberName, setMemberName] = useState("");
  const [referralName, setReferralName] = useState("");
  const [service, setService] = useState("");
  const [error, setError] = useState("");

  const save = () => {
    if (!memberName.trim() || !referralName.trim()) return setError("Member and referral names are required.");
    addReferral({
      direction,
      memberName: memberName.trim(),
      referralName: referralName.trim(),
      service: service.trim() || "—",
      date: new Date().toISOString().slice(0, 10),
      status: "OPEN",
    });
    toast.success("Referral logged");
    setMemberName("");
    setReferralName("");
    setService("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="setu-scope setu-dialog max-w-md p-7">
        <DialogHeader className="flex-row items-center gap-4 space-y-0">
          <IconTile icon={GitMerge} size={44} glow iconClassName="setu-accent-text" />
          <div className="text-left">
            <DialogTitle className="setu-heading text-lg">Log Referral</DialogTitle>
            <DialogDescription className="setu-text-2 mt-0.5 text-xs">Record a referral exchanged with a BNI member.</DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="setu-chip grid grid-cols-2 gap-1 p-1">
            {(["RECEIVED", "GIVEN"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
                  direction === d
                    ? "bg-[var(--setu-canvas)] ring-1 ring-[var(--setu-line-strong)]"
                    : "setu-text-3 hover:text-[var(--setu-text)]"
                )}
              >
                {d === "RECEIVED" ? <ArrowDownLeft size={15} className="text-green-500" /> : <ArrowUpRight size={15} className="text-orange-500" />}
                {d === "RECEIVED" ? "Received" : "Given"}
              </button>
            ))}
          </div>
          <Field label={direction === "RECEIVED" ? "From member *" : "To member *"}>
            <Input className="setu-input" value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="e.g. Ankur Ji" />
          </Field>
          <Field label="Referral (person / business) *">
            <Input
              className="setu-input"
              value={referralName}
              onChange={(e) => setReferralName(e.target.value)}
              placeholder="e.g. Parth Promunch Ji"
            />
          </Field>
          <Field label="Service / need">
            <Input className="setu-input" value={service} onChange={(e) => setService(e.target.value)} placeholder="e.g. Website, SEO" />
          </Field>
          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <SetuButton variant="ghost" onClick={onClose}>
            Cancel
          </SetuButton>
          <SetuButton variant="primary" onClick={save}>
            Log Referral
          </SetuButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
