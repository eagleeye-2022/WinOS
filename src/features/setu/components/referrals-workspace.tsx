"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, GitMerge, Plus, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/shared/toast";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { useSetuStore } from "../store";
import type { ReferralDirection, ReferralStatus } from "../types";
import { formatDate, referralBalance } from "../utils";
import { EmptyState, Field, FilterChips, IconTile, Pill, SetuAvatar, SetuButton, SetuPage, StatTile } from "./setu-ui";

type DirectionFilter = "all" | "received" | "given";
const FILTERS: readonly DirectionFilter[] = ["all", "received", "given"];

const STATUS: Record<ReferralStatus, { label: string; dot: string }> = {
  OPEN: { label: "Open", dot: "bg-amber-500" },
  CONVERTED: { label: "In pipeline", dot: "bg-primary" },
  WON: { label: "Won", dot: "bg-green-500" },
  LOST: { label: "Lost", dot: "bg-red-500" },
};

export function ReferralsWorkspace() {
  const referrals = useSetuStore((s) => s.referrals);
  const [filter, setFilter] = useUrlState<DirectionFilter>("filter", "all", { allowed: FILTERS });
  const [logOpen, setLogOpen] = useState(false);

  const balance = referralBalance(referrals);
  const visible = [...referrals]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((r) => filter === "all" || r.direction === (filter === "received" ? "RECEIVED" : "GIVEN"));

  return (
    <SetuPage
      icon={GitMerge}
      title="Referrals"
      description="Track referrals you receive from and give to fellow BNI members — givers gain."
      actions={
        <SetuButton variant="primary" onClick={() => setLogOpen(true)}>
          <Plus /> Log Referral
        </SetuButton>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={ArrowDownLeft} tone="green" value={balance.received} label="Received" />
        <StatTile icon={ArrowUpRight} tone="violet" value={balance.given} label="Given" />
        <StatTile icon={GitMerge} tone="primary" value={balance.converted} label="Received → pipeline" />
        <StatTile icon={Trophy} tone="emerald" value={balance.won} label="Turned into business" />
      </div>

      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: referrals.length },
          { value: "received", label: "Received", count: balance.received },
          { value: "given", label: "Given", count: balance.given },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState icon={GitMerge} text="No referrals logged yet." />
      ) : (
        <div className="setu-card px-2 py-1">
          <ul className="setu-divide">
            {visible.map((r) => {
              const received = r.direction === "RECEIVED";
              const status = STATUS[r.status];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-4 px-4 py-4">
                  <IconTile
                    icon={received ? ArrowDownLeft : ArrowUpRight}
                    size={34}
                    iconClassName={received ? "text-green-500" : "text-violet-500"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {received ? r.memberName : "You"}
                      <ArrowRight size={13} className="setu-text-3" />
                      {received ? r.referralName : `${r.referralName} for ${r.memberName}`}
                    </div>
                    <div className="setu-text-3 mt-0.5 text-xs">
                      {r.service} · {formatDate(r.date)}
                      {r.meetingId && (
                        <>
                          {" · "}
                          <Link href={`/setu/meetings?open=${r.meetingId}`} className="setu-accent-text hover:underline">
                            121 meeting
                          </Link>
                        </>
                      )}
                      {r.prospectId && (
                        <>
                          {" · "}
                          <Link href={`/setu/pipeline?open=${r.prospectId}`} className="setu-accent-text hover:underline">
                            prospect
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  <Pill dot={status.dot}>{received || r.status !== "CONVERTED" ? status.label : "Passed on"}</Pill>
                  <SetuAvatar name={r.memberName} size="sm" className="rounded-full" />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <LogReferralDialog open={logOpen} onClose={() => setLogOpen(false)} />
    </SetuPage>
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
                {d === "RECEIVED" ? <ArrowDownLeft size={15} className="text-green-500" /> : <ArrowUpRight size={15} className="text-violet-500" />}
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
