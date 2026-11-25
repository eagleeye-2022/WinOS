"use client";

import { useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, CircleDollarSign, Contact, Filter, Mail, PlusCircle, UserPlus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MEETING_REMINDER_LABEL, MEETING_REMINDERS } from "../../constants";
import { useSetuStore } from "../../provider";
import type { MeetingAttendee, MeetingReminder } from "../../types";
import { initials, isDealStage } from "../../utils";
import { Field, SetuButton } from "../setu-ui";
import { SetuDrawer } from "../setu-drawer";

export const attendeeId = () => `a-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PickerTab = "leads" | "deals" | "team";

interface Candidate {
  key: string;
  name: string;
  subtitle: string;
  attendee: Omit<MeetingAttendee, "id">;
}

/**
 * "Add attendee" search: type a name, pick from Leads / Deals contacts (external, they get a
 * calendar invite) or the team (internal). Already-added names are hidden.
 */
export function AttendeePicker({
  existing,
  onAdd,
  scope = "all",
  placeholder = "Search leads, deals or team to add…",
  exclude = [],
}: {
  existing: MeetingAttendee[];
  onAdd: (a: Omit<MeetingAttendee, "id">) => void;
  /** "external" = Leads / Deals only; "team" = team only. */
  scope?: "all" | "external" | "team";
  placeholder?: string;
  /** Extra names to hide (e.g. the host). */
  exclude?: string[];
}) {
  const deals = useSetuStore((s) => s.deals);
  const teamMembers = useSetuStore((s) => s.team);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tabState, setTab] = useState<PickerTab>(scope === "team" ? "team" : "leads");
  const anchorRef = useRef<HTMLDivElement>(null);

  const taken = new Set([...existing.map((a) => a.name), ...exclude].map((n) => n.toLowerCase()));
  const lists = useMemo(() => {
    const seen = new Set<string>();
    const leads: Candidate[] = [];
    const dealsList: Candidate[] = [];
    for (const d of deals) {
      const key = `${d.contactName}|${d.company}`.toLowerCase();
      if (!d.contactName || seen.has(key)) continue;
      seen.add(key);
      const isDeal = isDealStage(d.stage);
      const c: Candidate = {
        key,
        name: d.contactName,
        subtitle: `${d.company} • ${isDeal ? "Deal" : "Lead"}`,
        attendee: {
          name: d.contactName,
          role: d.contactRole || undefined,
          email: d.email || undefined,
          company: d.company,
          external: true,
          source: isDeal ? "DEAL" : "LEAD",
          rsvp: "PENDING",
        },
      };
      (isDeal ? dealsList : leads).push(c);
    }
    const team: Candidate[] = teamMembers.map((u) => ({
      key: `team|${u.id}`,
      name: u.name,
      subtitle: u.title ? `${u.title} • ${u.email}` : u.email,
      attendee: { userId: u.id, name: u.name, role: u.title, email: u.email, company: "WinOS CRM", external: false, source: "TEAM", rsvp: "ACCEPTED" },
    }));
    return { leads, deals: dealsList, team };
  }, [deals, teamMembers]);

  const needle = q.trim().toLowerCase();
  const filter = (list: Candidate[]) =>
    list.filter((c) => !taken.has(c.name.toLowerCase()) && (!needle || `${c.name} ${c.subtitle}`.toLowerCase().includes(needle)));
  const shown = { leads: filter(lists.leads), deals: filter(lists.deals), team: filter(lists.team) };
  const tabs = (
    [
      { id: "leads", label: "Leads", icon: Filter },
      { id: "deals", label: "Deals", icon: CircleDollarSign },
      { id: "team", label: "Team", icon: Users },
    ] as { id: PickerTab; label: string; icon: React.ElementType }[]
  ).filter((t) => (scope === "external" ? t.id !== "team" : scope === "team" ? t.id === "team" : true));
  const tab = tabs.some((t) => t.id === tabState) ? tabState : tabs[0].id;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={anchorRef} className="relative">
          <Contact size={15} className="setu-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={placeholder}
            className="setu-input h-9 pl-9"
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Typing / clicking in the search box keeps the list open.
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
        className="setu-scope w-[var(--radix-popover-trigger-width)] min-w-[320px] rounded-lg border-[var(--setu-line)] bg-[var(--setu-card)] p-2"
      >
        <div className={cn("grid gap-1 rounded-lg bg-[var(--setu-soft)] p-1", tabs.length === 3 ? "grid-cols-3" : tabs.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex cursor-pointer items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold",
                tab === t.id ? "bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]" : "setu-text-2 hover:text-[var(--setu-text)]"
              )}
            >
              <t.icon size={12} /> {t.label} ({shown[t.id].length})
            </button>
          ))}
        </div>
        <p className="setu-text-3 px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider">Matching {tabs.find((t) => t.id === tab)?.label}</p>
        <div className="max-h-60 overflow-y-auto">
          {shown[tab].length === 0 ? (
            <p className="setu-text-3 px-2 py-4 text-center text-xs">No matches</p>
          ) : (
            shown[tab].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  onAdd(c.attendee);
                  setQ("");
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--setu-soft)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--setu-accent-soft)] text-[11px] font-bold text-[var(--setu-accent)]">
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{c.name}</span>
                  <span className="setu-text-2 block truncate text-xs">{c.subtitle}</span>
                </span>
                <PlusCircle size={17} className="setu-text-2 shrink-0" />
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Attendee chips with remove. */
export function AttendeeChips({ attendees, onRemove }: { attendees: MeetingAttendee[]; onRemove: (id: string) => void }) {
  if (attendees.length === 0) return <p className="setu-text-3 text-xs">No attendees added yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {attendees.map((a) => (
        <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--setu-line)] bg-[var(--setu-soft)] py-1 pl-2.5 pr-1 text-xs font-medium">
          <span className={cn("h-1.5 w-1.5 rounded-full", a.external ? "bg-green-500" : "bg-blue-600")} />
          {a.name}
          {a.external && <span className="setu-text-3">· external</span>}
          <button type="button" onClick={() => onRemove(a.id)} aria-label={`Remove ${a.name}`} className="setu-text-3 cursor-pointer rounded-full p-0.5 hover:text-[var(--setu-text)]">
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}

/** "Add External Attendee" — someone not in Leads / Deals; gets the calendar invite by email. */
export function AddExternalAttendeeDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (a: Omit<MeetingAttendee, "id">) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");

  const close = () => {
    setName("");
    setEmail("");
    setCompany("");
    setError("");
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) return setError("Full name is required.");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid work email.");
    // "HealthTech Sol • Procurement Lead" → company + role.
    const [org, ...roleParts] = company.split("•").map((x) => x.trim());
    onAdd({
      name: name.trim(),
      email: email.trim(),
      company: org || undefined,
      role: roleParts.join(" • ") || undefined,
      external: true,
      source: "GUEST",
      rsvp: "PENDING",
    });
    close();
  };

  return (
    <SetuDrawer open={open} onClose={close} title="Add External Attendee" width="max-w-lg">
        <form onSubmit={submit} noValidate>
          <div className="space-y-4 px-6 py-5">
            <Field label="Full Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vikram Anand" autoFocus className="setu-input h-9" />
            </Field>
            <Field label="Work Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. vikram@abc.com" className="setu-input h-9" />
            </Field>
            <Field label="Company / Organization">
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. HealthTech Sol • Procurement Lead" className="setu-input h-9" />
            </Field>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <div className="flex items-center gap-3 border-t border-border px-6 py-4">
            <SetuButton variant="solid" type="submit" className="px-6">
              Add Attendee
            </SetuButton>
            <SetuButton variant="secondary" className="px-6" onClick={close}>
              Cancel
            </SetuButton>
          </div>
        </form>
    </SetuDrawer>
  );
}

/** Email-reminder picker (30 minutes / 15 minutes / 1 hour / 1 day before). */
export function ReminderSelect({ value, onChange }: { value: MeetingReminder; onChange: (v: MeetingReminder) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="setu-input flex h-9 w-full cursor-pointer items-center gap-2 border px-3 text-left text-sm">
          <Mail size={15} className="setu-accent-text" /> {MEETING_REMINDER_LABEL[value]}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="setu-scope w-[var(--radix-popover-trigger-width)] min-w-[240px] rounded-lg border-[var(--setu-line)] bg-[var(--setu-card)] p-1.5">
        {MEETING_REMINDERS.map((r) => {
          const active = r === value;
          return (
            <button
              key={r}
              type="button"
              onClick={() => {
                onChange(r);
                setOpen(false);
              }}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                active ? "bg-[var(--setu-accent-soft)] font-medium text-[var(--setu-accent)]" : "hover:bg-[var(--setu-soft)]"
              )}
            >
              <Mail size={15} className={active ? undefined : "setu-text-2"} />
              <span className="flex-1 text-left">{MEETING_REMINDER_LABEL[r]}</span>
              {active && <Check size={15} />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
