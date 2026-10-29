"use client";

import { ArrowRight, Bot, Camera, CheckCheck, NotebookPen, ScanText, Terminal, TriangleAlert } from "lucide-react";
import { MOCK_BOT_CAPTURES } from "../data/mock-setu";
import { IconTile, Pill, SectionLabel, SetuPage, SetuPanel } from "./setu-ui";

const COMMANDS = [
  { cmd: "note [member]", desc: "Add a text note to a 121 meeting" },
  { cmd: "status", desc: "Pipeline summary" },
  { cmd: "ref recv [n] from [name]", desc: "Log referrals received" },
  { cmd: "ref gave [n] to [name]", desc: "Log referrals given" },
  { cmd: "move [name] [stage]", desc: "Move a prospect to a stage" },
];

const ROUTED_LABEL = { MEETING: "121 Meetings", PROSPECT: "Pipeline", NONE: "—" } as const;

export function WhatsAppBotView() {
  return (
    <SetuPage
      icon={Bot}
      title="WhatsApp Bot"
      description="Capture BNI contacts and meeting notes from the field — the bot files them into Setu for you."
      actions={<Pill dot="bg-green-500">Live · Meta Cloud API</Pill>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Responsibility
          icon={Camera}
          title="Visiting card capture"
          text="Send a card photo → OCR reads it → the bot asks 121 Meeting or Prospect? → saved to the right Setu feature."
        />
        <Responsibility
          icon={NotebookPen}
          title="Meeting notes capture"
          text="Send a photo of handwritten 121 notes → refs received / given and member details are extracted → saved to 121 Meetings."
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px_1fr]">
        <SetuPanel title="Flow 1 — Visiting card">
          <Steps
            steps={[
              { title: "Send card photo", desc: "Any visiting card photo in the Setu WhatsApp chat." },
              { title: "OCR extracts details", desc: "Name, phone, email, business, address." },
            ]}
          />
          <div className="setu-chip my-4 p-4">
            <div className="mb-3 text-xs font-semibold">Bot asks: “What type is this?”</div>
            <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
              <div className="rounded-lg border border-[var(--setu-line-strong)] bg-[var(--setu-canvas)] px-2 py-2">
                <div className="font-semibold">1 · 121 Meeting</div>
                <div className="setu-text-3">BNI member talk</div>
              </div>
              <div className="rounded-lg border border-[var(--setu-accent)] bg-[var(--setu-canvas)] px-2 py-2 shadow-[0_0_14px_-4px_var(--setu-accent-glow)]">
                <div className="font-semibold">2 · Prospect</div>
                <div className="setu-text-3">Wants our service</div>
              </div>
            </div>
          </div>
          <Steps start={3} steps={[{ title: "Route & save", desc: "→ 121 Meetings, or a Stage-1 Prospect in the Sales Pipeline." }]} />
        </SetuPanel>

        <PhoneMockup />

        <SetuPanel title="Flow 2 — Meeting notes">
          <Steps
            steps={[
              { title: "Send notes photo", desc: "Photo of your handwritten 121 meeting notes." },
              { title: "Details extracted", desc: "Member name, refs received / given, next actions, prospect names." },
              { title: "Saved to Setu", desc: "121 meeting created or updated; original photo attached." },
              { title: "Referrals → Prospects", desc: "Referral names extracted are added to the Sales Pipeline." },
            ]}
          />
          <div className="mt-6">
            <SectionLabel>Commands</SectionLabel>
            <ul className="space-y-2">
              {COMMANDS.map((c) => (
                <li key={c.cmd} className="flex flex-wrap items-center gap-2 text-xs">
                  <code className="setu-chip setu-accent-text px-2 py-1 font-mono text-[11px] font-semibold">{c.cmd}</code>
                  <span className="setu-text-3">{c.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </SetuPanel>
      </div>

      <SetuPanel title="Recent bot activity" description="What the bot captured and where it filed it.">
        <ul className="setu-divide -my-3">
          {MOCK_BOT_CAPTURES.map((c) => {
            const Icon = c.kind === "CARD" ? ScanText : c.kind === "NOTES" ? NotebookPen : Terminal;
            return (
              <li key={c.id} className="flex items-center gap-4 py-3.5 text-sm">
                <IconTile icon={c.ok ? Icon : TriangleAlert} size={36} iconClassName={c.ok ? "setu-text-2" : "text-red-500"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{c.summary}</div>
                  <div className="setu-text-3 text-xs">
                    {new Date(c.at).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Kolkata",
                    })}
                  </div>
                </div>
                {c.ok ? (
                  c.routedTo !== "NONE" && (
                    <Pill>
                      <ArrowRight size={11} /> {ROUTED_LABEL[c.routedTo]}
                    </Pill>
                  )
                ) : (
                  <Pill dot="bg-red-500">Needs retry</Pill>
                )}
              </li>
            );
          })}
        </ul>
      </SetuPanel>
    </SetuPage>
  );
}

function Responsibility({ icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="setu-card relative flex items-start gap-4 overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--setu-accent-glow)] opacity-60 blur-3xl" />
      <IconTile icon={icon} size={44} glow iconClassName="setu-accent-text" />
      <div className="relative">
        <div className="text-[15px] font-semibold tracking-tight">{title}</div>
        <p className="setu-text-2 mt-1 text-[13px] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function Steps({ steps, start = 1 }: { steps: { title: string; desc: string }[]; start?: number }) {
  return (
    <ol className="relative space-y-5">
      {steps.length > 1 && <span className="absolute bottom-3 left-[15px] top-3 w-px bg-[var(--setu-line-strong)]" />}
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex items-start gap-3.5">
          <span className="setu-tile h-8 w-8 rounded-lg text-xs font-semibold">{start + i}</span>
          <div>
            <div className="text-sm font-semibold">{s.title}</div>
            <div className="setu-text-3 text-xs leading-relaxed">{s.desc}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Static chat preview — WhatsApp's own colours are kept so it reads as a phone at a glance. */
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div className="pointer-events-none absolute inset-x-6 -bottom-6 top-10 rounded-full bg-[var(--setu-accent-glow)] blur-3xl" />
      <div className="relative overflow-hidden rounded-[2.25rem] border border-[var(--setu-line-strong)] bg-[#0b0c0e] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_60px_-20px_rgba(0,0,0,0.6)]">
        <div className="overflow-hidden rounded-[1.75rem]">
          <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#128c7e] text-white">
              <Bot size={16} />
            </span>
            <div>
              <div className="text-xs font-bold text-white">Setu Bot</div>
              <div className="text-[10px] text-white/80">online</div>
            </div>
          </div>
          <div className="flex min-h-[400px] flex-col gap-1.5 bg-[#ece5dd] p-2.5 text-[11px] leading-snug text-slate-900">
            <Divider>Flow 1 · Card</Divider>
            <Out time="10:32">
              <div className="mb-1 flex h-14 items-center justify-center gap-1 rounded-md bg-emerald-100 text-emerald-700">
                <Camera size={14} /> Visiting card
              </div>
            </Out>
            <In time="10:32">
              <b>Card read!</b>
              <br />
              Name: Antra Raje
              <br />
              Phone: 8827483933
              <br />
              Biz: Finance Consulting
              <br />
              <br />
              What type is this?
              <div className="mt-1.5 grid grid-cols-2 gap-1 text-center text-[10px] font-bold">
                <span className="rounded-md border bg-white py-1">1 · 121 Meeting</span>
                <span className="rounded-md border bg-white py-1">2 · Prospect</span>
              </div>
            </In>
            <Out time="10:33">2 · Co Raj Pagariya Ji</Out>
            <In time="10:33">
              Saved as <b>Prospect</b> · Stage 1
              <br />
              Ref: Raj Pagariya Ji
            </In>
            <Divider>Flow 2 · Notes</Divider>
            <Out time="11:15">
              <div className="flex h-12 items-center justify-center gap-1 rounded-md bg-emerald-100 text-emerald-700">
                <NotebookPen size={14} /> Handwritten notes
              </div>
            </Out>
            <In time="11:15">
              <b>Notes read!</b>
              <br />
              Member: Shreshtha Goyal Ji
              <br />
              Refs received: 5 · given: 2
              <br />
              Next: follow up Tue
              <br />
              Saved to 121 Meetings
            </In>
          </div>
        </div>
      </div>
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return <div className="my-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-500">{children}</div>;
}

function Out({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <div className="max-w-[80%] self-end rounded-lg rounded-br-sm bg-[#dcf8c6] px-2.5 py-1.5 shadow-sm">
      {children}
      <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] text-slate-500">
        {time} <CheckCheck size={11} className="text-sky-500" />
      </div>
    </div>
  );
}

function In({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <div className="max-w-[88%] self-start rounded-lg rounded-bl-sm bg-white px-2.5 py-1.5 shadow-sm">
      {children}
      <div className="mt-0.5 text-right text-[9px] text-slate-500">{time}</div>
    </div>
  );
}
