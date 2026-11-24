"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/shared/toast";
import { useClearPageDraft, usePageDraft } from "@/lib/navigation/use-url-state";
import { DEAL_STAGES } from "../constants";
import { useSetuStore } from "../provider";
import type { Deal, DealInput, DealStage } from "../types";
import { Field, SetuButton } from "./setu-ui";

/** Form state: everything is a string while editing (value is parsed on save). */
interface DealForm {
  company: string;
  contactName: string;
  contactRole: string;
  phone: string;
  email: string;
  location: string;
  source: string;
  stage: DealStage;
  title: string;
  value: string;
  remark: string;
}

const EMPTY: DealForm = {
  company: "",
  contactName: "",
  contactRole: "",
  phone: "",
  email: "",
  location: "",
  source: "",
  stage: "LEAD",
  title: "",
  value: "",
  remark: "",
};

type Errors = Partial<Record<keyof DealForm, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(f: DealForm): Errors {
  const e: Errors = {};
  if (!f.company.trim()) e.company = "Company name is required";
  if (!f.contactName.trim()) e.contactName = "Decision maker is required";
  if (!f.phone.trim()) e.phone = "Phone number is required";
  else if (f.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a valid phone number";
  if (!f.email.trim()) e.email = "Email is required";
  else if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email";
  if (!f.location.trim()) e.location = "Location is required";
  if (f.value.trim() && !(Number(f.value.replace(/,/g, "")) >= 0)) e.value = "Enter a number";
  return e;
}

function toInput(f: DealForm): DealInput {
  const value = f.value.trim() ? Number(f.value.replace(/,/g, "")) : undefined;
  return {
    company: f.company.trim(),
    contactName: f.contactName.trim(),
    contactRole: f.contactRole.trim() || "Decision Maker",
    phone: f.phone.trim(),
    email: f.email.trim(),
    location: f.location.trim(),
    source: f.source.trim(),
    stage: f.stage,
    title: f.title.trim(),
    value,
    remark: f.remark.trim(),
  };
}

function fromDeal(d: Deal): DealForm {
  return {
    company: d.company,
    contactName: d.contactName,
    contactRole: d.contactRole,
    phone: d.phone,
    email: d.email,
    location: d.location,
    source: d.source,
    stage: d.stage,
    title: d.title,
    value: d.value === undefined ? "" : String(d.value),
    remark: d.remark,
  };
}

const isPristine = (f: DealForm) =>
  !f.company && !f.contactName && !f.phone && !f.email && !f.location && !f.source && !f.title && !f.value && !f.remark;

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * "Create New Lead". `stage` opens it (null = closed) and presets Current Stage when the form is
 * empty. The half-filled form is kept as a page draft; Cancel / ✕ / save clear it.
 */
export function CreateLeadDialog({ stage, onClose, onCreated }: { stage: DealStage | null; onClose: () => void; onCreated?: (deal: Deal) => void }) {
  const [form, setForm] = usePageDraft<DealForm>("setu-lead", "form", EMPTY);
  const clearDraft = useClearPageDraft("setu-lead");
  const createDeal = useSetuStore((s) => s.createDeal);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (stage && isPristine(form) && form.stage !== stage) setForm((f) => ({ ...f, stage }));
    // Only when the dialog opens with a (new) preset stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const close = () => {
    clearDraft();
    setErrors({});
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length || saving) return;
    setSaving(true);
    try {
      const deal = await createDeal(toInput(form));
      toast.success(`Lead created for ${deal.company}`);
      close();
      onCreated?.(deal);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DealDialogShell open={stage !== null} onClose={close} title="Create New Lead" description="Add a new lead to the sales board.">
      <form onSubmit={submit} noValidate>
        <DealFields form={form} setForm={(patch) => setForm((f) => ({ ...f, ...patch }))} errors={errors} />
        <DialogFooterBar>
          <SetuButton variant="ghost" onClick={close}>
            Cancel
          </SetuButton>
          <SetuButton variant="primary" type="submit" className="px-5" disabled={saving}>
            {saving ? "Adding…" : "Add Lead"}
          </SetuButton>
        </DialogFooterBar>
      </form>
    </DealDialogShell>
  );
}

// ── Edit ──────────────────────────────────────────────────────────────────────

export function EditDealDialog({ deal, open, onClose }: { deal: Deal; open: boolean; onClose: () => void }) {
  const updateDeal = useSetuStore((s) => s.updateDeal);
  const [form, setForm] = useState<DealForm>(() => fromDeal(deal));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // Fresh values every time it opens.
  useEffect(() => {
    if (open) {
      setForm(fromDeal(deal));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length || saving) return;
    setSaving(true);
    try {
      await updateDeal(deal.id, toInput(form));
      toast.success("Deal updated");
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DealDialogShell open={open} onClose={onClose} title="Edit Deal" description={`Update ${deal.company}.`}>
      <form onSubmit={submit} noValidate>
        <DealFields form={form} setForm={(patch) => setForm((f) => ({ ...f, ...patch }))} errors={errors} extended />
        <DialogFooterBar>
          <SetuButton variant="ghost" onClick={onClose}>
            Cancel
          </SetuButton>
          <SetuButton variant="primary" type="submit" className="px-5" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </SetuButton>
        </DialogFooterBar>
      </form>
    </DealDialogShell>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function DealDialogShell({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="setu-scope setu-dialog max-h-[92vh] max-w-[680px] gap-0 overflow-y-auto p-0 [&>button:last-child]:right-6 [&>button:last-child]:top-6">
        <div className="border-b border-[var(--setu-line)] px-6 py-4">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="setu-text-2 mt-0.5 text-xs">{description}</DialogDescription>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function DialogFooterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--setu-line)] bg-[var(--setu-card)] px-6 py-3.5">{children}</div>
  );
}

function DealFields({
  form,
  setForm,
  errors,
  extended,
}: {
  form: DealForm;
  setForm: (patch: Partial<DealForm>) => void;
  errors: Errors;
  /** Edit Deal also edits the title, role, value and card remark. */
  extended?: boolean;
}) {
  const text = (key: keyof DealForm, placeholder: string, type = "text") => (
    <>
      <Input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ [key]: e.target.value } as Partial<DealForm>)}
        placeholder={placeholder}
        aria-invalid={Boolean(errors[key])}
        className="setu-input h-9"
      />
      {errors[key] && <span className="block text-xs text-red-500">{errors[key]}</span>}
    </>
  );

  return (
    <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
      {extended && (
        <Field label="Deal Title" className="sm:col-span-2">
          {text("title", "e.g. Website Development Proposal")}
        </Field>
      )}
      <Field label="Company Name" required className="sm:col-span-2">
        {text("company", "Company name")}
      </Field>
      <Field label="Decision Maker Name" required>
        {text("contactName", "Full name")}
      </Field>
      <Field label="Phone Number" required>
        {text("phone", "+91-98765 43210", "tel")}
      </Field>
      {extended && (
        <Field label="Role" className="sm:col-span-2">
          {text("contactRole", "e.g. Decision Maker (VP Engineering)")}
        </Field>
      )}
      <Field label="Email" required>
        {text("email", "name@company.com", "email")}
      </Field>
      <Field label="Location" required>
        {text("location", "City")}
      </Field>
      <Field label="Source">{text("source", "Who referred this lead?")}</Field>
      <Field label="Current Stage">
        <Select value={form.stage} onValueChange={(v) => setForm({ stage: v as DealStage })}>
          <SelectTrigger className="setu-input !h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEAL_STAGES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {extended && (
        <>
          <Field label="Deal Value (₹)">{text("value", "e.g. 450000", "text")}</Field>
          <Field label="Card Note">{text("remark", "Note / client request / lost reason")}</Field>
        </>
      )}
    </div>
  );
}
