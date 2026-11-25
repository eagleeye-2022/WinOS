"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, IdCard, Network, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { decodeReferral, isRefIn, convertedDealId, textToHtml, type ReferralDetails } from "../../bni";
import { useBni } from "../../bni-client";
import { useSetuStore } from "../../provider";
import type { CallOutcome, Deal } from "../../types";
import { formatDateTime } from "../../utils";
import { SetuButton, attempt } from "../setu-ui";
import { BniDialog, InfoStrip, Segmented, SelectInput, TextArea, TextInput } from "./bni-dialog";
import { useMembers } from "./bni-forms";

// ── Log Referral ──────────────────────────────────────────────────────────────

interface ReferralForm extends ReferralDetails {
  direction: "RECEIVED" | "GIVEN";
  memberMode: "existing" | "new";
  memberId: string;
  memberName: string;
  convert: boolean;
}

const emptyReferral = (direction: "RECEIVED" | "GIVEN" = "RECEIVED", memberId = ""): ReferralForm => ({
  direction,
  memberMode: "existing",
  memberId,
  memberName: "",
  name: "",
  business: "",
  phone: "",
  via: "",
  convert: true,
});

/** "+ Log Referral": received from a member (optionally straight onto the pipeline) or given to one. */
export function ReferralDialog({ open, onClose, memberId, direction }: { open: boolean; onClose: () => void; memberId?: string; direction?: "RECEIVED" | "GIVEN" }) {
  const members = useMembers();
  const bni = useBni();
  const [form, setForm] = useState<ReferralForm>(() => emptyReferral(direction, memberId));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ReferralForm>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (open) setForm({ ...emptyReferral(direction, memberId), memberMode: memberId || members.length ? "existing" : "new" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const received = form.direction === "RECEIVED";
  const save = async () => {
    if (saving) return;
    setSaving(true);
    const res = await attempt(
      bni.logReferral({
        direction: form.direction,
        memberId: form.memberMode === "existing" ? form.memberId || undefined : undefined,
        memberName: form.memberMode === "new" ? form.memberName : undefined,
        details: { name: form.name, business: form.business, phone: form.phone, via: form.via },
        convert: received && form.convert,
      }),
      received ? (form.convert ? "Referral logged and added to the pipeline" : "Referral logged") : "Referral given logged"
    );
    setSaving(false);
    if (res) onClose();
  };

  const fixed = memberId ? members.find((m) => m.id === memberId) : undefined;
  return (
    <BniDialog
      open={open}
      onClose={onClose}
      title="Log Referral"
      description={fixed ? `With ${fixed.contactName}` : undefined}
      footer={
        <>
          <SetuButton variant="muted" onClick={onClose}>
            Cancel
          </SetuButton>
          <SetuButton variant="solid" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Log Referral"}
          </SetuButton>
        </>
      }
    >
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Segmented
            value={form.direction}
            onChange={(d) => set({ direction: d })}
            options={[
              { value: "RECEIVED", label: "Received" },
              { value: "GIVEN", label: "Given" },
            ]}
          />
        </div>
        {!fixed && (
          <>
            <div className="sm:col-span-2">
              <Segmented
                value={form.memberMode}
                onChange={(memberMode) => set({ memberMode })}
                options={[
                  { value: "existing", label: "Existing member" },
                  { value: "new", label: "New member" },
                ]}
              />
            </div>
            {form.memberMode === "existing" ? (
              <SelectInput
                label={received ? "Received from (member)" : "Given to (member)"}
                className="sm:col-span-2"
                value={form.memberId || "__none"}
                onChange={(v) => set({ memberId: v === "__none" ? "" : v })}
                options={[{ value: "__none", label: members.length ? "Pick a member…" : "No members yet — add a new one" }, ...members.map((m) => ({ value: m.id, label: m.contactName }))]}
              />
            ) : (
              <TextInput icon={IdCard} label="Member Name" required className="sm:col-span-2" value={form.memberName} onChange={(memberName) => set({ memberName })} placeholder="e.g. Ankur Ji" />
            )}
          </>
        )}
        <TextInput label={received ? "Referred person / business" : "Who you referred"} required value={form.name} onChange={(name) => set({ name })} placeholder={received ? "e.g. Parth Promunch Ji" : "e.g. Saksham Ji"} autoFocus />
        <TextInput label={received ? "Business / need" : "Service / detail"} value={form.business} onChange={(business) => set({ business })} placeholder={received ? "e.g. Web Design" : "e.g. IT Services"} />
        {received && (
          <>
            <TextInput icon={Phone} label="Phone" type="tel" value={form.phone} onChange={(phone) => set({ phone })} placeholder="10-digit mobile" />
            <TextInput icon={Network} label="Connected Via (Co.)" value={form.via} onChange={(via) => set({ via })} placeholder="Blank = the member" />
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium sm:col-span-2">
              <Checkbox checked={form.convert} onCheckedChange={(c) => set({ convert: c === true })} />
              Add to the Sales Pipeline as a Prospect now
            </label>
          </>
        )}
      </div>
    </BniDialog>
  );
}

// ── Convert referrals → prospects ─────────────────────────────────────────────

/** The member's pending received referrals, with editable details, converted in one go. */
export function ConvertRefsDialog({ open, onClose, member }: { open: boolean; onClose: () => void; member: Deal | undefined }) {
  const notes = useSetuStore((s) => s.notes);
  const bni = useBni();
  const pending = useMemo(() => (member ? notes.filter((n) => n.dealId === member.id && isRefIn(n) && !convertedDealId(n)) : []), [notes, member]);
  const [rows, setRows] = useState<Record<string, ReferralDetails & { on: boolean }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setRows(Object.fromEntries(pending.map((n) => [n.id, { ...decodeReferral(n.body), on: true }])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const chosen = pending.filter((n) => rows[n.id]?.on);
  const save = async () => {
    if (!member || saving || !chosen.length) return;
    setSaving(true);
    const res = await attempt(
      bni.convertReferrals(
        member.id,
        chosen.map((n) => {
          const { name, business, phone, via } = rows[n.id];
          return { noteId: n.id, details: { name, business, phone, via } };
        })
      ),
      `${chosen.length} referral${chosen.length === 1 ? "" : "s"} added to the pipeline`
    );
    setSaving(false);
    if (res) onClose();
  };
  const edit = (id: string, patch: Partial<ReferralDetails & { on: boolean }>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  return (
    <BniDialog
      open={open}
      onClose={onClose}
      width="max-w-[720px]"
      title="Convert Referrals → Prospects"
      description={member ? `Pending referrals from ${member.contactName}` : undefined}
      footer={
        <>
          <SetuButton variant="muted" onClick={onClose}>
            Cancel
          </SetuButton>
          <SetuButton variant="solid" onClick={save} disabled={saving || !chosen.length}>
            {saving ? "Converting…" : `Convert ${chosen.length || ""} to Prospects`}
          </SetuButton>
        </>
      }
    >
      <div className="space-y-3 px-6 py-5">
        {pending.length === 0 ? (
          <InfoStrip tone="green">All referrals from this member are already on the pipeline.</InfoStrip>
        ) : (
          pending.map((n, i) => {
            const r = rows[n.id];
            if (!r) return null;
            return (
              <div key={n.id} className={cn("rounded-lg border border-[var(--setu-line)] p-3", !r.on && "opacity-60")}>
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-semibold">
                  <Checkbox checked={r.on} onCheckedChange={(c) => edit(n.id, { on: c === true })} />
                  Referral {i + 1}
                </label>
                <div className="grid gap-2 sm:grid-cols-4">
                  <Input className="setu-input h-8 text-xs" value={r.name} onChange={(e) => edit(n.id, { name: e.target.value })} placeholder="Name *" aria-label="Name" />
                  <Input className="setu-input h-8 text-xs" value={r.business} onChange={(e) => edit(n.id, { business: e.target.value })} placeholder="Business / need" aria-label="Business" />
                  <Input className="setu-input h-8 text-xs" value={r.phone} onChange={(e) => edit(n.id, { phone: e.target.value })} placeholder="Phone" aria-label="Phone" type="tel" />
                  <Input className="setu-input h-8 text-xs" value={r.via} onChange={(e) => edit(n.id, { via: e.target.value })} placeholder={`Co. (default ${member?.contactName ?? "member"})`} aria-label="Connected via" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </BniDialog>
  );
}

// ── Call note ("Call Now") ────────────────────────────────────────────────────

/**
 * Opened with "Call Now" (the tel: link dials alongside): note what was said; saved as a call on
 * the record. "Schedule follow-up" opens the meeting scheduler afterwards.
 */
export function CallNoteDialog({ open, onClose, deal }: { open: boolean; onClose: () => void; deal: Deal | undefined }) {
  const router = useRouter();
  const me = useSetuStore((s) => s.me);
  const logCall = useSetuStore((s) => s.logCall);
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<Extract<CallOutcome, "CONNECTED" | "NO_ANSWER">>("CONNECTED");
  const [followUp, setFollowUp] = useState(false);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setText("");
      setOutcome("CONNECTED");
      setFollowUp(false);
      setStartedAt(new Date().toISOString());
    }
  }, [open]);

  const save = async () => {
    if (!deal || saving) return;
    setSaving(true);
    const endedAt = new Date().toISOString();
    const res = await attempt(
      logCall(deal.id, {
        title: `Call with ${deal.contactName}`,
        direction: "OUTBOUND",
        outcome,
        startedAt,
        endedAt: endedAt < startedAt ? startedAt : endedAt,
        repId: me.id,
        contactName: deal.contactName,
        summary: textToHtml(text || (outcome === "NO_ANSWER" ? "Call not attended. Will retry." : "")),
      }).then(() => true),
      "Call note saved"
    );
    setSaving(false);
    if (!res) return;
    onClose();
    if (followUp) router.push(`${ROUTES.setuMeetingNew}?deal=${deal.id}`);
  };

  return (
    <BniDialog
      open={open}
      onClose={onClose}
      width="max-w-[440px]"
      title={`Call Note — ${deal?.contactName ?? ""}`}
      description={formatDateTime(startedAt)}
      footer={
        <>
          <SetuButton variant="muted" onClick={onClose}>
            Cancel
          </SetuButton>
          <SetuButton variant="solid" onClick={save} disabled={saving}>
            <Check /> {saving ? "Saving…" : "Save Note"}
          </SetuButton>
        </>
      }
    >
      <div className="space-y-4 px-6 py-5">
        <Segmented
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: "CONNECTED", label: "Connected" },
            { value: "NO_ANSWER", label: "Not attended" },
          ]}
        />
        <TextArea label="Call notes" rows={4} value={text} onChange={setText} placeholder="e.g. She agreed to meet on Wednesday. Will send portfolio link. 3 more referral names confirmed." />
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
          <Checkbox checked={followUp} onCheckedChange={(c) => setFollowUp(c === true)} />
          <CalendarPlus size={14} className="setu-text-2" /> Schedule follow-up meeting
        </label>
      </div>
    </BniDialog>
  );
}
