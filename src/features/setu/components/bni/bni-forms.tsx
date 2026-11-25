"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/shared/toast";
import { Building2, CalendarDays, CalendarPlus, IdCard, Lightbulb, Mail, MapPin, Network, Phone, UserPlus, UserRoundPlus } from "lucide-react";
import { useClearPageDraft, usePageDraft } from "@/lib/navigation/use-url-state";
import {
  BNI_STAGES,
  MEETING_TYPES,
  bniStageOf,
  isMember,
  tagsOf,
  type BniMeetingType,
  type BniOrigin,
  type BniStage,
  type PersonInput,
} from "../../bni";
import { useBni } from "../../bni-client";
import { useSetuStore } from "../../provider";
import type { Deal } from "../../types";
import { isoDate } from "../../utils";
import { SetuButton, attempt } from "../setu-ui";
import { BniDialog, Segmented, SelectInput, TextArea, TextInput } from "./bni-dialog";

const ORIGIN_OPTIONS: { value: BniOrigin; label: string }[] = [
  { value: "DIRECT", label: "Direct / manual" },
  { value: "BOT", label: "WhatsApp Bot (visiting card)" },
  { value: "121", label: "From a 121 Meeting" },
];

const personFromDeal = (d: Deal): PersonInput => ({
  name: d.contactName,
  business: d.company === d.contactName ? "" : d.company,
  phone: d.phone,
  email: d.email,
  address: d.location,
  via: d.source,
});

/** Members for pickers, A→Z. */
export function useMembers(): Deal[] {
  const deals = useSetuStore((s) => s.deals);
  return useMemo(() => deals.filter(isMember).sort((a, b) => a.contactName.localeCompare(b.contactName)), [deals]);
}

// ── Log 121 Meeting ───────────────────────────────────────────────────────────

interface Log121Form {
  mode: "new" | "existing";
  memberId: string;
  name: string;
  via: string;
  phone: string;
  business: string;
  date: string;
  type: BniMeetingType;
  refsReceived: string;
  refsGiven: string;
  referralNames: string;
  notes: string;
}

const empty121 = (): Log121Form => ({
  mode: "new",
  memberId: "",
  name: "",
  via: "",
  phone: "",
  business: "",
  date: isoDate(new Date()),
  type: "121 Meeting",
  refsReceived: "0",
  refsGiven: "0",
  referralNames: "",
  notes: "",
});

/**
 * "+ Log 121 Meeting". With `memberId` it logs another meeting for that member; otherwise the
 * member can be picked or created. Refs received can be named (one per line) so "Save & Convert"
 * puts them straight on the pipeline as prospects.
 */
export function Log121Dialog({ open, onClose, memberId, prefill }: { open: boolean; onClose: () => void; memberId?: string; prefill?: Partial<PersonInput> }) {
  const [form, setForm] = usePageDraft<Log121Form>("setu-121", "form", empty121());
  const clearDraft = useClearPageDraft("setu-121");
  const members = useMembers();
  const bni = useBni();
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<Log121Form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!open) return;
    if (memberId) set({ mode: "existing", memberId });
    else if (prefill?.name && !form.name) set({ mode: "new", name: prefill.name, phone: prefill.phone ?? "", business: prefill.business ?? "", via: prefill.via ?? "" });
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memberId]);

  const close = () => {
    clearDraft();
    onClose();
  };

  const save = async (convert: boolean) => {
    if (saving) return;
    const existing = form.mode === "existing" && form.memberId;
    if (form.mode === "existing" && !form.memberId) {
      toast.error("Pick the member, or switch to New member.");
      return;
    }
    setSaving(true);
    const res = await attempt(
      bni.log121({
        memberId: existing ? form.memberId : undefined,
        member: existing ? undefined : { name: form.name, business: form.business, phone: form.phone, email: "", address: "", via: form.via },
        date: form.date,
        type: form.type,
        refsReceived: Number(form.refsReceived || 0),
        refsGiven: Number(form.refsGiven || 0),
        referralNames: form.referralNames.split("\n"),
        notes: form.notes,
        convert,
      }),
      convert ? "121 saved — named referrals added to the pipeline" : "121 meeting saved"
    );
    setSaving(false);
    if (res) close();
  };

  const named = form.referralNames.split("\n").filter((l) => l.trim()).length;
  const fixedMember = memberId ? members.find((m) => m.id === memberId) : undefined;

  return (
    <BniDialog
      open={open}
      onClose={close}
      icon={CalendarPlus}
      title={fixedMember ? `Log 121 — ${fixedMember.contactName}` : "Log 121 Meeting"}
      footer={
        <>
          <SetuButton variant="muted" onClick={close}>
            Cancel
          </SetuButton>
          <SetuButton onClick={() => save(true)} disabled={saving || named === 0} title={named === 0 ? "Name at least one referral to convert" : undefined}>
            Save &amp; Convert Refs → Prospects
          </SetuButton>
          <SetuButton variant="solid" onClick={() => save(false)} disabled={saving}>
            {saving ? "Saving…" : "Save Meeting"}
          </SetuButton>
        </>
      }
    >
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
        {!fixedMember && (
          <div className="sm:col-span-2">
            <Segmented
              value={form.mode}
              onChange={(mode) => set({ mode })}
              options={[
                { value: "new", label: "New member" },
                { value: "existing", label: `Existing member (${members.length})` },
              ]}
            />
          </div>
        )}
        {!fixedMember && form.mode === "existing" ? (
          <SelectInput
            label="Member"
            className="sm:col-span-2"
            value={form.memberId || "__none"}
            onChange={(v) => set({ memberId: v === "__none" ? "" : v })}
            options={[{ value: "__none", label: members.length ? "Pick a member…" : "No members yet — add a new one" }, ...members.map((m) => ({ value: m.id, label: m.contactName }))]}
          />
        ) : (
          !fixedMember && (
            <>
              <TextInput icon={IdCard} label="Member Name" required value={form.name} onChange={(name) => set({ name })} placeholder="e.g. Rajesh Mehta Ji" autoFocus />
              <TextInput icon={Network} label="Connected Via (Co.)" value={form.via} onChange={(via) => set({ via })} placeholder="e.g. Ankur Ji — blank if direct BNI" />
              <TextInput icon={Phone} label="Phone" type="tel" value={form.phone} onChange={(phone) => set({ phone })} placeholder="10-digit mobile" />
              <TextInput icon={Building2} label="Business" value={form.business} onChange={(business) => set({ business })} placeholder="e.g. Arihant Capital" />
            </>
          )
        )}
        <TextInput icon={CalendarDays} label="Meeting Date" type="date" value={form.date} onChange={(date) => set({ date })} required />
        <SelectInput label="Meeting Type" value={form.type} onChange={(type) => set({ type })} options={MEETING_TYPES.map((t) => ({ value: t, label: t === "121 Meeting" ? "121 Meeting (member talk)" : t }))} />
        <TextInput label="Refs Received" type="number" value={form.refsReceived} onChange={(refsReceived) => set({ refsReceived })} />
        <TextInput label="Refs Given" type="number" value={form.refsGiven} onChange={(refsGiven) => set({ refsGiven })} />
        <TextArea
          label="Referral names (one per line)"
          className="sm:col-span-2"
          rows={2}
          value={form.referralNames}
          onChange={(referralNames) => set({ referralNames })}
          placeholder={"Parth Promunch Ji\nSheetal Badole Ji"}
        />
        <TextArea label="Meeting Notes" className="sm:col-span-2" rows={4} value={form.notes} onChange={(notes) => set({ notes })} placeholder="What was discussed, follow-ups, referral names…" />
      </div>
    </BniDialog>
  );
}

// ── Prospect / Opportunity ────────────────────────────────────────────────────

interface ProspectForm extends PersonInput {
  kind: "PROSPECT" | "OPPORTUNITY";
  need: string;
  remark: string;
  stage: BniStage;
  origin: BniOrigin;
}

const emptyProspect = (): ProspectForm => ({ kind: "PROSPECT", name: "", business: "", phone: "", email: "", address: "", via: "", need: "", remark: "", stage: "PROSPECT", origin: "DIRECT" });

const fromDeal = (d: Deal): ProspectForm => {
  const t = tagsOf(d);
  return { ...personFromDeal(d), kind: t.kind === "OPPORTUNITY" ? "OPPORTUNITY" : "PROSPECT", need: d.title, remark: d.remark, stage: bniStageOf(d), origin: t.origin };
};

export interface ProspectPreset extends Partial<ProspectForm> {
  stage?: BniStage;
}

/**
 * Add / edit a prospect (or a Mixed / Opportunity card). Create keeps a page draft; `preset`
 * fills an empty form (column "+ Add", visiting-card capture, vCard import).
 */
export function ProspectDialog({
  open,
  onClose,
  deal,
  preset,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  deal?: Deal;
  preset?: ProspectPreset;
  onSaved?: (deal: Deal) => void;
}) {
  const [draft, setDraft] = usePageDraft<ProspectForm>("setu-prospect", "form", emptyProspect());
  const clearDraft = useClearPageDraft("setu-prospect");
  const [editForm, setEditForm] = useState<ProspectForm>(() => (deal ? fromDeal(deal) : emptyProspect()));
  const form = deal ? editForm : draft;
  const setForm = deal ? setEditForm : setDraft;
  const set = (patch: Partial<ProspectForm>) => setForm((f) => ({ ...f, ...patch }));
  const bni = useBni();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (deal) setEditForm(fromDeal(deal));
    else if (preset && !draft.name) {
      const kind = preset.kind ?? (preset.stage === "OPPORTUNITY" ? "OPPORTUNITY" : "PROSPECT");
      setDraft({ ...emptyProspect(), ...preset, kind, stage: kind === "OPPORTUNITY" ? "OPPORTUNITY" : preset.stage ?? "PROSPECT" });
    }
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    if (!deal) clearDraft();
    onClose();
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const input = { ...form, stage: form.kind === "OPPORTUNITY" ? ("OPPORTUNITY" as const) : form.stage };
    const res = await attempt(deal ? bni.updateProspect(deal.id, input) : bni.createProspect(input), deal ? "Saved" : form.kind === "OPPORTUNITY" ? "Opportunity added" : "Prospect added to the pipeline");
    setSaving(false);
    if (res) {
      close();
      if (res.deals[0]) onSaved?.(res.deals[0]);
    }
  };

  const opp = form.kind === "OPPORTUNITY";
  return (
    <BniDialog
      open={open}
      onClose={close}
      icon={opp ? Lightbulb : UserRoundPlus}
      title={deal ? `Edit ${opp ? "Opportunity" : "Prospect"}` : opp ? "Add Opportunity" : "Add Prospect"}
      footer={
        <>
          <SetuButton variant="muted" onClick={close}>
            Cancel
          </SetuButton>
          <SetuButton variant="solid" onClick={save} disabled={saving}>
            {saving ? "Saving…" : deal ? "Save Changes" : opp ? "Add Opportunity" : "Add Prospect"}
          </SetuButton>
        </>
      }
    >
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Segmented<"PROSPECT" | "OPPORTUNITY">
            value={form.kind}
            onChange={(kind) => set({ kind, stage: kind === "OPPORTUNITY" ? "OPPORTUNITY" : form.stage === "OPPORTUNITY" ? "PROSPECT" : form.stage })}
            options={[
              { value: "PROSPECT", label: "Prospect (person)" },
              { value: "OPPORTUNITY", label: "Mixed / Opportunity" },
            ]}
          />
        </div>
        <TextInput label={opp ? "Title" : "Name"} required value={form.name} onChange={(name) => set({ name })} placeholder={opp ? "e.g. Goa Target Pitch" : "e.g. Antra Raje Ji"} autoFocus />
        <TextInput label={opp ? "Type" : "Business"} value={form.business} onChange={(business) => set({ business })} placeholder={opp ? "e.g. Campaign / Company Profile" : "e.g. Finance Consulting"} />
        {!opp && (
          <>
            <TextInput icon={Phone} label="Phone" type="tel" value={form.phone} onChange={(phone) => set({ phone })} placeholder="10-digit mobile" />
            <TextInput icon={Mail} label="Email" type="email" value={form.email} onChange={(email) => set({ email })} placeholder="Optional" />
            <TextInput icon={Network} label="Connected Via (Co.)" value={form.via} onChange={(via) => set({ via })} placeholder="e.g. Raj Pagariya Ji — blank if direct" />
            <TextInput label="Service Needed" value={form.need} onChange={(need) => set({ need })} placeholder="e.g. Web Design & Dev" />
            <SelectInput
              label="Pipeline Stage"
              value={form.stage}
              onChange={(stage) => set({ stage })}
              options={BNI_STAGES.filter((s) => s.id !== "OPPORTUNITY").map((s) => ({ value: s.id, label: s.label }))}
            />
            <SelectInput label="Came In Via" value={form.origin} onChange={(origin) => set({ origin })} options={ORIGIN_OPTIONS} />
            <TextInput icon={MapPin} label="Address" className="sm:col-span-2" value={form.address} onChange={(address) => set({ address })} placeholder="Optional" />
          </>
        )}
        <TextInput label="Card Note" className="sm:col-span-2" value={form.remark} onChange={(remark) => set({ remark })} placeholder="e.g. Follow up 1 Jul · Called 13 Jun" />
      </div>
    </BniDialog>
  );
}

// ── BNI member ────────────────────────────────────────────────────────────────

const emptyMember = (): PersonInput => ({ name: "", business: "", phone: "", email: "", address: "", via: "" });

/** Add / edit a BNI member (the person 121s are held with). */
export function MemberFormDialog({
  open,
  onClose,
  member,
  preset,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  member?: Deal;
  preset?: Partial<PersonInput>;
  onSaved?: (member: Deal) => void;
}) {
  const [form, setForm] = useState<PersonInput>(emptyMember);
  const set = (patch: Partial<PersonInput>) => setForm((f) => ({ ...f, ...patch }));
  const bni = useBni();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(member ? personFromDeal(member) : { ...emptyMember(), ...preset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const res = await attempt(member ? bni.updateMember(member.id, form) : bni.createMember(form), member ? "Member updated" : "Member added");
    setSaving(false);
    if (res) {
      onClose();
      if (res.deals[0]) onSaved?.(res.deals[0]);
    }
  };

  return (
    <BniDialog
      open={open}
      onClose={onClose}
      icon={UserPlus}
      title={member ? "Edit Member" : "Add BNI Member"}
      footer={
        <>
          <SetuButton variant="muted" onClick={onClose}>
            Cancel
          </SetuButton>
          <SetuButton variant="solid" onClick={save} disabled={saving}>
            {saving ? "Saving…" : member ? "Save Changes" : "Add Member"}
          </SetuButton>
        </>
      }
    >
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
        <TextInput icon={IdCard} label="Member Name" required value={form.name} onChange={(name) => set({ name })} placeholder="e.g. Shreshtha Goyal Ji" autoFocus />
        <TextInput icon={Network} label="Connected Via (Co.)" value={form.via} onChange={(via) => set({ via })} placeholder="Blank if direct BNI" />
        <TextInput icon={Phone} label="Phone" type="tel" value={form.phone} onChange={(phone) => set({ phone })} placeholder="10-digit mobile" />
        <TextInput icon={Mail} label="Email" type="email" value={form.email} onChange={(email) => set({ email })} placeholder="Optional" />
        <TextInput icon={Building2} label="Business" value={form.business} onChange={(business) => set({ business })} placeholder="e.g. Interior Design" />
        <TextInput icon={MapPin} label="Address" value={form.address} onChange={(address) => set({ address })} placeholder="Optional" />
      </div>
    </BniDialog>
  );
}
