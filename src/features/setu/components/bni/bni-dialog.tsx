"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Field } from "../setu-ui";
import { SetuDrawer } from "../setu-drawer";

// Shared pieces for the BNI forms (Log 121, prospect, member, referral, call note…), which open as
// the app-style right drawer (SetuDrawer).

/** The BNI forms (Log 121, prospect, member, referral, call note…), shown as the app-style right drawer. */
export function BniDialog({
  open,
  onClose,
  title,
  description,
  width,
  children,
  footer,
  badge,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Drawer width class (default `max-w-xl`). */
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Pill next to the title ("Deal #…", "121 Meeting"). */
  badge?: React.ReactNode;
}) {
  return (
    <SetuDrawer open={open} onClose={onClose} title={title} description={description} badge={badge} width={width} footer={footer}>
      {children}
    </SetuDrawer>
  );
}

/** Section label inside dialogs ("Attendees & participation"). */
export function DialogSection({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="setu-text-2 text-xs font-medium">{title}</h4>
        {aside && <span className="setu-text-2 text-[11px]">{aside}</span>}
      </div>
      {children}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  className,
  autoFocus,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
  autoFocus?: boolean;
  /** Leading icon inside the field (Figma: name card, mail, building…). */
  icon?: React.ElementType;
}) {
  return (
    <Field label={label} required={required} className={className}>
      <span className="relative block">
        {Icon && <Icon size={15} className="setu-text-3 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />}
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn("setu-input h-10", Icon && "pl-9")} autoFocus={autoFocus} />
      </span>
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="setu-input min-h-0 resize-y text-sm" />
    </Field>
  );
}

export function SelectInput<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="setu-input !h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="setu-scope">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Two-option toggle ("Existing member" / "New member", "Received" / "Given"). */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--setu-line)] bg-[var(--setu-well)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors",
            value === o.value ? "bg-[var(--setu-solid)] text-white" : "setu-text-2 hover:text-[var(--setu-text)]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Blue info strip inside a dialog ("Or log via WhatsApp Bot…"). */
export function InfoStrip({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "green" }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-xs leading-relaxed",
        tone === "blue" ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300" : "border-green-200 bg-green-50 text-green-700 dark:border-green-500/25 dark:bg-green-500/10 dark:text-green-400"
      )}
    >
      {children}
    </div>
  );
}
