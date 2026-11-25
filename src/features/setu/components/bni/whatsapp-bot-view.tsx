"use client";

import { useRef, useState } from "react";
import { Building2, CalendarHeart, CircleDashed, ClipboardList, IdCard, Mail, MapPin, Network, Phone, Send, Terminal, UserRoundPlus, UserRoundSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { usePageViewState } from "@/lib/navigation/use-url-state";
import { BNI_STAGE_BY_ID, findByName, isMember, isPipelineRecord, parseBotCommand, pipelineStatusText, textToHtml, type PersonInput } from "../../bni";
import { useBni } from "../../bni-client";
import { useSetuStore } from "../../provider";
import { SetuButton } from "../setu-ui";
import { TextInput } from "./bni-dialog";
import { Log121Dialog, ProspectDialog } from "./bni-forms";
import { SetuShell } from "./setu-shell";

const COMMANDS: [string, string][] = [
  ["note [member]: text", "add a text note to a member"],
  ["status", "pipeline summary"],
  ["ref recv [n] from [name]", "log referrals received"],
  ["ref gave [n] to [name]", "log referrals given"],
  ["move [name] [stage]", "move a prospect, e.g. move Amit discovery"],
];

/** Setu → WhatsApp Bot: field capture from the phone (visiting cards, 121 notes, quick commands). */
export function WhatsappBotView() {
  return (
    <SetuShell
      tab="bot"
      title="WhatsApp Bot — BNI Field Capture"
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          <CircleDashed size={12} /> Setup pending
        </span>
      }
    >
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <CardCapture />
        <BotConsole />
      </div>
    </SetuShell>
  );
}

/** Icon tile + title + quiet badge — the Figma card header. */
function CardHeading({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
          <Icon size={17} />
        </span>
        <h3 className="min-w-0 text-base font-semibold leading-tight">{title}</h3>
      </div>
      {badge && <span className="rounded-md bg-[var(--setu-well)] px-2 py-0.5 text-[11px] font-medium text-[var(--setu-text-2)]">{badge}</span>}
    </div>
  );
}

const EMPTY_CARD: PersonInput = { name: "", business: "", phone: "", email: "", address: "", via: "" };

/** Flow 1 without WhatsApp: type the card, then pick 121 Meeting or Prospect. */
function CardCapture() {
  const [card, setCard] = usePageViewState<PersonInput>("SetuBot:card", EMPTY_CARD);
  const [route, setRoute] = usePageViewState<"121" | "prospect" | null>("SetuBot:route", null);
  const set = (patch: Partial<PersonInput>) => setCard((c) => ({ ...c, ...patch }));
  const ready = card.name.trim().length > 0;
  const done = () => {
    setRoute(null);
    setCard(EMPTY_CARD);
  };

  return (
    <section className="setu-card p-5">
      <CardHeading icon={UserRoundPlus} title="Visiting Card Capture" />
      <div className="mb-4" />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput icon={IdCard} label="Name" required value={card.name} onChange={(name) => set({ name })} placeholder="e.g. Antra Raje Ji" />
        <TextInput icon={Phone} label="Phone" type="tel" value={card.phone} onChange={(phone) => set({ phone })} placeholder="10-digit mobile" />
        <TextInput icon={Building2} label="Business" value={card.business} onChange={(business) => set({ business })} placeholder="e.g. Finance Consulting" />
        <TextInput icon={Mail} label="Email" type="email" value={card.email} onChange={(email) => set({ email })} placeholder="Optional" />
        <TextInput icon={MapPin} label="Address" value={card.address} onChange={(address) => set({ address })} placeholder="Optional" />
        <TextInput icon={Network} label="Connected Via (Co.)" value={card.via} onChange={(via) => set({ via })} placeholder="e.g. Raj Pagariya Ji" />
      </div>
      <p className="mb-2 mt-5 text-xs font-semibold">
        What type is this? <span className="text-red-500">*</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: "121" as const, icon: CalendarHeart, label: "121 Meeting", hint: "BNI member talk" },
          { id: "prospect" as const, icon: UserRoundSearch, label: "Prospect", hint: "Wants our service" },
        ].map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={!ready}
            onClick={() => setRoute(o.id)}
            className="group flex flex-col items-start gap-2 rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] p-3.5 text-left transition-colors hover:border-[var(--setu-accent)] hover:bg-[var(--setu-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex w-full items-center justify-between">
              <o.icon size={18} className="text-[var(--setu-accent)]" />
              <span className="h-4 w-4 rounded-full border border-[var(--setu-line-strong)] bg-[var(--setu-card)] group-hover:border-[var(--setu-accent)]" />
            </span>
            <span>
              <span className="block text-sm font-semibold group-hover:text-[var(--setu-accent)]">{o.label}</span>
              <span className="setu-text-2 block text-[11px]">{o.hint}</span>
            </span>
          </button>
        ))}
      </div>
      {!ready && <p className="setu-text-3 mt-2 text-[11px]">Enter at least the name to continue.</p>}
      <Log121Dialog open={route === "121"} onClose={done} prefill={card} />
      <ProspectDialog open={route === "prospect"} onClose={done} preset={{ ...card, kind: "PROSPECT", origin: "BOT", stage: "PROSPECT" }} />
    </section>
  );
}

interface Line {
  from: "me" | "bot";
  text: string;
}

/** The bot's text commands, run against Setu. */
function BotConsole() {
  const deals = useSetuStore((s) => s.deals);
  const addNote = useSetuStore((s) => s.addNote);
  const bni = useBni();
  const [lines, setLines] = useState<Line[]>([{ from: "bot", text: "Type a command, or help" }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const say = (l: Line) => {
    setLines((ls) => [...ls, l]);
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight }));
  };

  const run = async (input: string) => {
    const cmd = parseBotCommand(input);
    const members = deals.filter(isMember);
    try {
      switch (cmd.type) {
        case "help":
          return say({ from: "bot", text: COMMANDS.map(([c, d]) => `${c} — ${d}`).join("\n") });
        case "status":
          return say({ from: "bot", text: pipelineStatusText(deals) });
        case "note": {
          const m = findByName(members, cmd.member);
          if (!m) return say({ from: "bot", text: `No member called “${cmd.member}”. Log a 121 first.` });
          await addNote(m.id, { title: "Note", body: textToHtml(cmd.text), pinned: false, category: "NOTE" });
          return say({ from: "bot", text: `Note saved to ${m.contactName}.` });
        }
        case "ref": {
          const m = findByName(members, cmd.name);
          await bni.addReferralCount({ memberId: m?.id, memberName: m ? undefined : cmd.name, direction: cmd.direction, count: cmd.count });
          const who = m?.contactName ?? `${cmd.name} (new member)`;
          return say({ from: "bot", text: cmd.direction === "RECEIVED" ? `${cmd.count} referral(s) received from ${who}. Convert them from 121 Meetings.` : `${cmd.count} referral(s) given to ${who}.` });
        }
        case "move": {
          const d = findByName(deals.filter(isPipelineRecord), cmd.name);
          if (!d) return say({ from: "bot", text: `No prospect called “${cmd.name}”.` });
          await bni.setStage(d.id, cmd.stage);
          return say({ from: "bot", text: `${d.contactName} moved to ${BNI_STAGE_BY_ID[cmd.stage].label}.` });
        }
        case "unknown":
          return say({ from: "bot", text: cmd.reason });
      }
    } catch (err) {
      say({ from: "bot", text: `Couldn’t do that: ${(err as Error).message}` });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = text.trim();
    if (!input || busy) return;
    setText("");
    say({ from: "me", text: input });
    setBusy(true);
    await run(input);
    setBusy(false);
  };

  return (
    <section className="setu-card flex flex-col p-5">
      <CardHeading icon={Terminal} title="Bot Console" />
      <div className="mb-4" />
      <div ref={scroller} className="flex h-[300px] flex-col gap-1.5 overflow-y-auto rounded-xl bg-[#ece5dd] p-3 dark:bg-[var(--setu-well)]" aria-live="polite">
        {lines.map((l, i) => (
          <p
            key={i}
            className={cn(
              "max-w-[85%] whitespace-pre-line rounded-xl px-2.5 py-1.5 text-[11px] shadow-sm",
              l.from === "me" ? "self-end rounded-br-sm bg-[#dcf8c6] text-slate-800" : "self-start rounded-bl-sm bg-white text-slate-800"
            )}
          >
            {l.text}
          </p>
        ))}
      </div>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. ref recv 3 from Shreshtha" className="setu-input h-9 font-mono text-xs" aria-label="Command" />
        <SetuButton type="submit" variant="solid" disabled={busy || !text.trim()} aria-label="Send">
          <Send />
        </SetuButton>
      </form>
      <div className="mt-2 flex flex-wrap gap-1">
        {["status", "help"].map((c) => (
          <button key={c} type="button" onClick={() => setText(c)} className="setu-text-2 rounded-md border border-[var(--setu-line)] px-2 py-0.5 font-mono text-[11px] transition-colors hover:text-[var(--setu-accent)]">
            <ClipboardList size={10} className="mr-1 inline" />
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}
