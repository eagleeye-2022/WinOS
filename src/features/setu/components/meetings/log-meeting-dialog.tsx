"use client";

import { useState } from "react";
import { Bot, Handshake } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/shared/toast";
import { MEETING_TYPE_LABEL } from "../../constants";
import { useSetuStore } from "../../store";
import type { MeetingType } from "../../types";
import { Field, IconTile, SetuButton } from "../setu-ui";

const EMPTY = {
  memberName: "",
  business: "",
  connectedVia: "",
  phone: "",
  date: new Date().toISOString().slice(0, 10),
  type: "ONE_TO_ONE" as MeetingType,
  refsGiven: "0",
  referralNames: "",
  notes: "",
};

export function LogMeetingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addMeeting = useSetuStore((s) => s.addMeeting);
  const convertReferrals = useSetuStore((s) => s.convertReferrals);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const referralNames = form.referralNames
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  const save = (convert: boolean) => {
    if (!form.memberName.trim()) {
      setError("Member name is required.");
      return;
    }
    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      setError("Phone must be a 10-digit mobile number.");
      return;
    }
    const meeting = addMeeting({
      memberName: form.memberName.trim(),
      business: form.business.trim(),
      connectedVia: form.connectedVia.trim(),
      phone: form.phone,
      date: form.date,
      type: form.type,
      refsReceived: referralNames.length,
      refsGiven: Math.max(0, Number(form.refsGiven) || 0),
      followUps: 0,
      pendingReferralNames: referralNames,
      prospectIds: [],
      notes: form.notes.trim() ? [{ id: "n1", date: form.date, text: form.notes.trim() }] : [],
      todos: [],
      capturedViaBot: false,
    });
    const converted = convert ? convertReferrals(meeting.id) : 0;
    toast.success(converted > 0 ? `Meeting saved · ${converted} prospects added` : "121 meeting saved");
    setForm(EMPTY);
    setError("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="setu-scope setu-dialog max-h-[90vh] max-w-lg overflow-y-auto p-7">
        <DialogHeader className="flex-row items-center gap-4 space-y-0">
          <IconTile icon={Handshake} size={44} glow iconClassName="setu-accent-text" />
          <div className="text-left">
            <DialogTitle className="setu-heading text-lg">Log 121 Meeting</DialogTitle>
            <DialogDescription className="setu-text-2 mt-0.5 text-xs">
              Record a one-on-one with a BNI member and the referrals you exchanged.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Member name *">
              <Input className="setu-input"value={form.memberName} onChange={(e) => set("memberName", e.target.value)} placeholder="e.g. Rajesh Mehta Ji" />
            </Field>
            <Field label="Business">
              <Input className="setu-input"value={form.business} onChange={(e) => set("business", e.target.value)} placeholder="e.g. CA firm" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Connected via (Co.)">
              <Input className="setu-input"value={form.connectedVia} onChange={(e) => set("connectedVia", e.target.value)} placeholder="Blank if direct BNI" />
            </Field>
            <Field label="Phone">
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Meeting date">
              <Input className="setu-input"type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => set("type", v as MeetingType)}>
                <SelectTrigger className="setu-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEETING_TYPE_LABEL) as MeetingType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {MEETING_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Refs given">
              <Input className="setu-input"type="number" min={0} value={form.refsGiven} onChange={(e) => set("refsGiven", e.target.value)} />
            </Field>
          </div>
          <Field label={`Referrals received — one name per line${referralNames.length ? ` (${referralNames.length})` : ""}`}>
            <Textarea
              rows={3}
              value={form.referralNames}
              onChange={(e) => set("referralNames", e.target.value)}
              placeholder={"Rohit Malviya Ji\nKavya Jain Ji"}
            />
          </Field>
          <Field label="Meeting notes">
            <Textarea className="setu-input"rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="What was discussed, follow-ups…" />
          </Field>

          <div className="setu-chip setu-text-2 flex items-center gap-2 px-3 py-2.5 text-xs">
            <Bot size={14} className="shrink-0 text-emerald-500" /> Or send a photo of your notes to the Setu WhatsApp bot — it
            creates this entry for you.
          </div>
          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <SetuButton variant="ghost" onClick={onClose}>
            Cancel
          </SetuButton>
          <SetuButton onClick={() => save(true)} disabled={referralNames.length === 0}>
            Save & convert refs
          </SetuButton>
          <SetuButton variant="primary" onClick={() => save(false)}>
            Save meeting
          </SetuButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
