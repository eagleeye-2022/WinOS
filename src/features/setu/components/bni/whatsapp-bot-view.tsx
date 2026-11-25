"use client";

import { useRef, useState } from "react";
import { ArrowDown, Building2, CalendarHeart, Camera, CircleDashed, ClipboardList, Cpu, IdCard, Mail, MapPin, Network, NotebookPen, Phone, Send, Sparkles, Terminal, UserRoundPlus, UserRoundSearch } from "lucide-react";
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
      subtitle="Capture visiting cards and 121 notes from the phone; they land in the right Setu feature."
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          <CircleDashed size={12} /> Setup pending · Meta Cloud API (no BSP)
        </span>
      }
      hint={
        <>
          The WhatsApp number isn&apos;t connected yet. Until it is, use <strong className="text-[var(--setu-text)]">Try it in WinOS</strong> below — the same commands and card routing,
          saved straight into Setu.
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Responsibility
          tone="blue"
          icon={Camera}
          title="Responsibility 1 — Visiting Card Capture"
          text="Send a card photo → OCR → the bot asks: 121 Meeting or Prospect? → routed to the right Setu feature automatically."
        />
        <Responsibility
          tone="violet"
          icon={NotebookPen}
          title="Responsibility 2 — Meeting Notes Capture"
          text="Upload a photo of handwritten notes → refs received, refs given and member details extracted → saved to 121 Meetings."
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_280px_1fr]">
        <FlowCard
          title="Flow 1 — Visiting Card"
          icon={Camera}
          steps={[
            ["Send Card Photo", "Any visiting card photo in the WhatsApp chat"],
            ["OCR (GPT-4o Vision)", "Extracts name, phone, email, business, address"],
            ["Bot asks: “What type?”", "1️⃣ 121 Meeting (BNI member talk) · 2️⃣ Prospect (wants our service)"],
            ["Route & Save", "→ 121 Meetings, or a Prospect on the Sales Pipeline"],
          ]}
          footer={
            <div className="rounded-xl border border-[var(--setu-line)] bg-[var(--setu-well)] p-3 text-[11px] leading-6 text-[var(--setu-text-2)]">
              <p className="setu-text-3 mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                <Cpu size={11} /> Tech
              </p>
              Meta Cloud API (no BSP)
              <br />
              GPT-4o Vision
              <br />
              Next.js <code className="text-[10px]">/api/setu/whatsapp/webhook</code> (planned)
              <br />
              Bot session table (planned — needs a DB change)
            </div>
          }
        />
        <PhoneMockup />
        <FlowCard
          title="Flow 2 — Meeting Notes"
          icon={NotebookPen}
          steps={[
            ["Send Notes Photo", "Photo of handwritten 121 meeting notes"],
            ["Extract", "Member name, refs received, refs given, next actions, prospect names"],
            ["Auto-saved to Setu", "121 Meeting created / updated, original photo attached"],
            ["Referrals → Prospects", "Referral names extracted are added as Prospects"],
          ]}
          footer={
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-500/25 dark:bg-violet-500/10">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Commands</p>
              <ul className="space-y-1 font-mono text-[10px] text-[var(--setu-text-2)]">
                {COMMANDS.map(([c, d]) => (
                  <li key={c}>
                    <span className="font-bold text-[var(--setu-accent)]">{c}</span> — {d}
                  </li>
                ))}
              </ul>
            </div>
          }
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          <Sparkles size={17} />
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-tight">Try it in WinOS</h2>
          <p className="setu-text-2 text-xs">Works today, without WhatsApp. Everything is saved to Setu.</p>
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <CardCapture />
        <BotConsole />
      </div>
    </SetuShell>
  );
}

function Responsibility({ tone, icon: Icon, title, text }: { tone: "blue" | "violet"; icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="setu-card flex items-start gap-3 p-4">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          tone === "blue" ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" : "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
        )}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="setu-text-2 text-[10px] font-bold uppercase tracking-wider">{tone === "blue" ? "Responsibility 1" : "Responsibility 2"}</p>
        <p className="text-sm font-semibold">{title.replace(/^Responsibility \d — /, "")}</p>
        <p className="setu-text-2 mt-1 text-xs leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

/** Icon tile + title (+ description) + uppercase badge — the Figma card header. */
function CardHeading({ icon: Icon, title, text, badge }: { icon: React.ElementType; title: string; text?: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight">{title}</h3>
          {text && <p className="setu-text-2 mt-0.5 text-xs">{text}</p>}
        </div>
      </div>
      {badge && <span className="rounded-md bg-[var(--setu-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--setu-accent)]">{badge}</span>}
    </div>
  );
}

function FlowCard({ title, icon: Icon, steps, footer }: { title: string; icon: React.ElementType; steps: [string, string][]; footer?: React.ReactNode }) {
  return (
    <section className="setu-card p-5">
      <CardHeading icon={Icon} title={title} badge="Flow" />
      <ol className="mt-4 space-y-1">
        {steps.map(([t, d], i) => (
          <li key={t}>
            {i > 0 && <ArrowDown size={13} className="setu-text-3 mx-auto my-0.5" />}
            <div className="flex gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1d4ed8] text-[10px] font-bold text-white dark:bg-blue-600">{i + 1}</span>
              <div>
                <p className="text-xs font-semibold">{t}</p>
                <p className="setu-text-2 text-[11px] leading-snug">{d}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {footer && <div className="mt-3">{footer}</div>}
    </section>
  );
}

/** Illustration of the two flows in a WhatsApp chat (sample content, not live data). */
function PhoneMockup() {
  const out = "self-end rounded-xl rounded-br-sm bg-[#dcf8c6] px-2.5 py-1.5 text-[10px] text-slate-800 shadow-sm";
  const inn = "self-start rounded-xl rounded-bl-sm bg-white px-2.5 py-1.5 text-[10px] leading-relaxed text-slate-800 shadow-sm";
  return (
    <figure className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[1.6rem] border-[3px] border-slate-800 bg-white shadow-xl" aria-label="Sample WhatsApp conversation">
      <div className="flex items-center gap-2 bg-[#25d366] px-3 py-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#128c7e] text-[10px] font-bold text-white">SE</span>
        <div>
          <p className="text-xs font-bold text-white">Setu Bot</p>
          <p className="text-[9px] text-white/80">sample conversation</p>
        </div>
      </div>
      <div className="flex min-h-[330px] flex-col gap-1.5 bg-[#ece5dd] p-2.5">
        <p className="text-center text-[9px] font-semibold text-slate-500">— FLOW 1: CARD —</p>
        <div className={out}>
          <div className="mb-1 flex h-12 items-center justify-center rounded bg-emerald-100 text-[10px]">📸 Visiting card</div>
        </div>
        <div className={inn}>
          ✅ <b>Card read!</b>
          <br />
          Name: Antra Raje · Phone: 88274 83933
          <br />
          Biz: Finance Consulting
          <br />
          What type is this?
          <div className="mt-1 grid grid-cols-2 gap-1">
            <span className="rounded border border-slate-200 py-1 text-center font-bold">1️⃣ 121 Meeting</span>
            <span className="rounded border border-slate-200 py-1 text-center font-bold">2️⃣ Prospect</span>
          </div>
        </div>
        <div className={out}>2 · Co Raj Pagariya Ji</div>
        <div className={inn}>
          🎉 Saved as <b>Prospect</b> · Stage 1 · Ref: Raj Pagariya Ji
        </div>
        <p className="mt-1 text-center text-[9px] font-semibold text-slate-500">— FLOW 2: NOTES —</p>
        <div className={out}>
          <div className="flex h-12 items-center justify-center rounded bg-emerald-100 text-[10px]">📝 Handwritten notes</div>
        </div>
        <div className={inn}>
          📋 <b>Notes read!</b> Member: Shreshtha Goyal Ji
          <br />
          Refs received: 5 · Refs given: 2
          <br />
          Saved to 121 Meetings ✓
        </div>
      </div>
    </figure>
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
      <CardHeading icon={UserRoundPlus} title="Visiting Card Capture" text="Type what's on the card, then choose where it goes." badge="Flow 1" />
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
  const [lines, setLines] = useState<Line[]>([{ from: "bot", text: "Hi! Type a command, or help." }]);
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
          return say({ from: "bot", text: `📝 Note saved to ${m.contactName}.` });
        }
        case "ref": {
          const m = findByName(members, cmd.name);
          await bni.addReferralCount({ memberId: m?.id, memberName: m ? undefined : cmd.name, direction: cmd.direction, count: cmd.count });
          const who = m?.contactName ?? `${cmd.name} (new member)`;
          return say({ from: "bot", text: cmd.direction === "RECEIVED" ? `✅ ${cmd.count} referral(s) received from ${who}. Convert them from 121 Meetings.` : `✅ ${cmd.count} referral(s) given to ${who}.` });
        }
        case "move": {
          const d = findByName(deals.filter(isPipelineRecord), cmd.name);
          if (!d) return say({ from: "bot", text: `No prospect called “${cmd.name}”.` });
          await bni.setStage(d.id, cmd.stage);
          return say({ from: "bot", text: `➡️ ${d.contactName} moved to ${BNI_STAGE_BY_ID[cmd.stage].label}.` });
        }
        case "unknown":
          return say({ from: "bot", text: cmd.reason });
      }
    } catch (err) {
      say({ from: "bot", text: `⚠️ ${(err as Error).message}` });
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
      <CardHeading icon={Terminal} title="Bot Console" text="The same commands the WhatsApp bot will accept." badge="Live" />
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
          <button key={c} type="button" onClick={() => setText(c)} className="setu-text-2 rounded-md border border-[var(--setu-line)] px-2 py-0.5 font-mono text-[10px] hover:text-[var(--setu-accent)]">
            <ClipboardList size={10} className="mr-1 inline" />
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}
