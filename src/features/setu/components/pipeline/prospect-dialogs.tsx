"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, Mail, Phone, PhoneCall, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/shared/toast";
import { PIPELINE_STAGES, SOURCE_LABEL, STAGE_BY_ID } from "../../constants";
import { useSetuStore } from "../../store";
import type { PipelineStageId, Prospect, ProspectSource } from "../../types";
import { formatDate, formatInrShort } from "../../utils";
import { Field, IconTile, SetuAvatar, SetuButton, SourceBadge, StageBadge } from "../setu-ui";

/** The linear funnel shown as a stepper (closed / side stages are excluded). */
const FUNNEL = PIPELINE_STAGES.filter((s) => !s.closed && s.id !== "OPPORTUNITY").concat(STAGE_BY_ID.WON);

export function ProspectDetailDialog({ prospect, onClose }: { prospect: Prospect | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(prospect)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="setu-scope setu-dialog max-h-[90vh] max-w-2xl overflow-y-auto p-7">
        {prospect && <ProspectDetailBody key={prospect.id} prospect={prospect} />}
      </DialogContent>
    </Dialog>
  );
}

function ProspectDetailBody({ prospect }: { prospect: Prospect }) {
  const moveProspect = useSetuStore((s) => s.moveProspect);
  const updateRemark = useSetuStore((s) => s.updateProspectRemark);
  const meeting = useSetuStore((s) => (prospect.meetingId ? s.meetings.find((m) => m.id === prospect.meetingId) : undefined));
  const [remark, setRemark] = useState(prospect.remark);
  const funnelIdx = FUNNEL.findIndex((s) => s.id === prospect.stage);

  const move = (stage: PipelineStageId) => {
    moveProspect(prospect.id, stage);
    toast.success(`Moved to ${STAGE_BY_ID[stage].label}`);
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-4">
          <span className="setu-tile p-1">
            <SetuAvatar name={prospect.name} size="lg" />
          </span>
          <div className="min-w-0 text-left">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
              <span className="setu-heading">{prospect.name}</span> <StageBadge stage={prospect.stage} />
            </DialogTitle>
            <DialogDescription className="setu-text-2 mt-1 text-xs">
              {[prospect.business, prospect.connectedVia].filter(Boolean).join(" · ") || "No business captured"}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Funnel stepper */}
      <div className="setu-chip flex items-center gap-1 overflow-x-auto p-3">
        {FUNNEL.map((s, i) => {
          const done = funnelIdx >= 0 && i <= funnelIdx;
          return (
            <button
              key={s.id}
              type="button"
              title={`Move to ${s.label}`}
              onClick={() => move(s.id)}
              className="group flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  "h-1.5 w-full rounded-full bg-[var(--setu-line-strong)] transition-colors group-hover:opacity-80",
                  done && "bg-[var(--setu-accent)]"
                )}
              />
              <span className={cn("truncate text-[10px]", s.id === prospect.stage ? "font-semibold" : "setu-text-3")}>{s.short}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="setu-chip space-y-3.5 p-5 text-sm">
          <Row icon={Phone} label="Phone" value={prospect.phone || "—"} />
          <Row icon={Mail} label="Email" value={prospect.email || "—"} />
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="setu-text-3">Source</span>
            <SourceBadge source={prospect.source} />
          </div>
          {meeting && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="setu-text-3">From meeting</span>
              <Link href={`/setu/meetings?open=${meeting.id}`} className="setu-accent-text font-semibold hover:underline">
                121 · {meeting.memberName}
              </Link>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="setu-text-3">Expected value</span>
            <span className="font-semibold">{prospect.value ? formatInrShort(prospect.value) : "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="setu-text-3">Last updated</span>
            <span>{formatDate(prospect.updatedAt)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Stage">
            <Select value={prospect.stage} onValueChange={(v) => move(v as PipelineStageId)}>
              <SelectTrigger className="setu-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status line (shown on the card)">
            <div className="flex gap-2">
              <Input value={remark} onChange={(e) => setRemark(e.target.value)} className="setu-input h-9" />
              <SetuButton
                size="sm"
                disabled={remark === prospect.remark}
                onClick={() => {
                  updateRemark(prospect.id, remark.trim());
                  toast.success("Status updated");
                }}
              >
                Save
              </SetuButton>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {prospect.phone ? (
              <SetuButton asChild variant="primary" size="sm">
                <a href={`tel:${prospect.phone}`}>
                  <PhoneCall /> Call now
                </a>
              </SetuButton>
            ) : (
              <SetuButton variant="primary" size="sm" disabled title="No phone captured">
                <PhoneCall /> Call now
              </SetuButton>
            )}
            <SetuButton size="sm" onClick={() => toast.info("Zoho Calendar scheduling will be wired up with the backend")}>
              <CalendarPlus /> Schedule
            </SetuButton>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="setu-text-3 flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </span>
      <span className="truncate">{value}</span>
    </div>
  );
}

const EMPTY = { name: "", business: "", connectedVia: "", phone: "", email: "", value: "", remark: "" };

export function AddProspectDialog({
  stage,
  onClose,
}: {
  /** Stage to create the prospect in; null keeps the dialog closed. */
  stage: PipelineStageId | null;
  onClose: () => void;
}) {
  const addProspect = useSetuStore((s) => s.addProspect);
  const [form, setForm] = useState(EMPTY);
  const [source, setSource] = useState<ProspectSource>("MANUAL");
  const [targetStage, setTargetStage] = useState<PipelineStageId>(stage ?? "PROSPECT");
  const [error, setError] = useState("");
  const [lastStage, setLastStage] = useState(stage);
  // Re-seed the stage picker whenever the dialog is opened from a different column.
  if (stage !== lastStage) {
    setLastStage(stage);
    if (stage) setTargetStage(stage);
  }

  const set = (key: keyof typeof EMPTY, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    if (!form.name.trim()) return setError("Name is required.");
    if (form.phone && !/^\d{10}$/.test(form.phone)) return setError("Phone must be a 10-digit mobile number.");
    addProspect({
      name: form.name.trim(),
      business: form.business.trim(),
      connectedVia: form.connectedVia.trim(),
      phone: form.phone,
      email: form.email.trim(),
      stage: targetStage,
      source,
      remark: form.remark.trim(),
      value: form.value ? Number(form.value) : undefined,
    });
    toast.success(`${form.name.trim()} added to ${STAGE_BY_ID[targetStage].label}`);
    setForm(EMPTY);
    setError("");
    onClose();
  };

  return (
    <Dialog open={stage !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="setu-scope setu-dialog max-h-[90vh] max-w-lg overflow-y-auto p-7">
        <DialogHeader className="flex-row items-center gap-4 space-y-0">
          <IconTile icon={UserPlus} size={44} glow iconClassName="setu-accent-text" />
          <div className="text-left">
            <DialogTitle className="setu-heading text-lg">Add Prospect</DialogTitle>
            <DialogDescription className="setu-text-2 mt-0.5 text-xs">
              Add someone who may need our services to the Setu pipeline.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <Input className="setu-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Antra Raje Ji" />
            </Field>
            <Field label="Business">
              <Input className="setu-input" value={form.business} onChange={(e) => set("business", e.target.value)} />
            </Field>
            <Field label="Referred by (Co.)">
              <Input className="setu-input" value={form.connectedVia} onChange={(e) => set("connectedVia", e.target.value)} placeholder="e.g. Co Raj Pagariya" />
            </Field>
            <Field label="Phone">
              <Input className="setu-input"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile"
              />
            </Field>
            <Field label="Email">
              <Input className="setu-input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Expected value (₹)">
              <Input className="setu-input" type="number" min={0} value={form.value} onChange={(e) => set("value", e.target.value)} />
            </Field>
            <Field label="Stage">
              <Select value={targetStage} onValueChange={(v) => setTargetStage(v as PipelineStageId)}>
                <SelectTrigger className="setu-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Source">
              <Select value={source} onValueChange={(v) => setSource(v as ProspectSource)}>
                <SelectTrigger className="setu-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_LABEL) as ProspectSource[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Status line">
            <Input className="setu-input" value={form.remark} onChange={(e) => set("remark", e.target.value)} placeholder="e.g. Follow up 1 Nov" />
          </Field>
          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <SetuButton variant="ghost" onClick={onClose}>
            Cancel
          </SetuButton>
          <SetuButton variant="primary" onClick={save}>
            Add Prospect
          </SetuButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
