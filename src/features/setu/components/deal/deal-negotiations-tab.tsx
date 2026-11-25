"use client";

import { useState } from "react";
import { Handshake, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { LEVEL_TONES } from "../../constants";
import { useSetuStore } from "../../provider";
import type { Deal, NegotiationRequest } from "../../types";
import { formatInr } from "../../utils";
import { SetuButton, attempt } from "../setu-ui";
import { NotesFeed } from "./deal-notes-tab";

/** Negotiations tab: proposed value, multi-level client requests and the negotiation-update feed. */
export function DealNegotiationsTab({ deal }: { deal: Deal }) {
  const allRequests = useSetuStore((s) => s.requests);
  const requests = allRequests.filter((r) => r.dealId === deal.id).sort((a, b) => a.level - b.level);
  // "new" = the add row; a request id = that row in edit mode.
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <section className="setu-card flex items-center gap-4 px-6 py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
          <Handshake size={20} />
        </span>
        <h2 className="text-base font-semibold">Negotiation & Commercial Alignment</h2>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
        {/* Proposed value */}
        <section className="setu-card px-5 py-5">
          <div className="flex items-center justify-between">
            <p className="setu-text-2 text-xs font-semibold uppercase tracking-wider">Proposed Value</p>
            <span className="h-2 w-2 rounded-full bg-[var(--setu-accent)]" />
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{deal.value !== undefined ? formatInr(deal.value) : "Not set"}</p>
          {deal.value !== undefined && deal.proposalVersion ? <p className="setu-text-2 mt-2 text-xs">Proposal V{deal.proposalVersion}</p> : null}
        </section>

        {/* Client requests */}
        <section className="setu-card px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--setu-line)] pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--setu-accent-soft)] text-[var(--setu-accent)]">
                <Handshake size={15} />
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wide">Active Client Requests (Multi-Level)</h3>
            </div>
            <SetuButton variant="soft" size="sm" onClick={() => setEditing("new")} disabled={editing === "new"}>
              <Plus /> Add Request
            </SetuButton>
          </div>

          <div className="mt-4 space-y-2.5">
            {requests.length === 0 && editing !== "new" && <p className="setu-text-2 py-4 text-center text-sm">No client requests yet.</p>}
            {requests.map((r) =>
              editing === r.id ? (
                <RequestForm key={r.id} dealId={deal.id} request={r} defaultBy={deal.contactName} onDone={() => setEditing(null)} />
              ) : (
                <RequestRow key={r.id} request={r} onEdit={() => setEditing(r.id)} />
              )
            )}
            {editing === "new" && <RequestForm dealId={deal.id} defaultBy={deal.contactName} onDone={() => setEditing(null)} />}
            <button
              type="button"
              onClick={() => setEditing("new")}
              disabled={editing === "new"}
              className="setu-text-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--setu-line-strong)] py-2 text-xs font-medium transition-colors hover:border-[var(--setu-accent)] hover:text-[var(--setu-text)] disabled:cursor-default disabled:opacity-50"
            >
              <Plus size={14} /> Add Another Request / Covenant
            </button>
          </div>
        </section>
      </div>

      <NotesFeed
        dealId={deal.id}
        category="NEGOTIATION"
        composerOpen
        labels={{
          form: "Add Negotiation Update",
          title: "Enter update title or heading…",
          body: "Write specific concession notes, internal discount approvals, or stakeholder remarks…",
          pin: "Pin this update to top",
        }}
        empty="No negotiation updates yet."
        highlightPinned
      />
    </div>
  );
}

function LevelBadge({ level }: { level: number }) {
  return (
    <span className={cn("shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", LEVEL_TONES[(level - 1) % LEVEL_TONES.length])}>
      Level {level}
    </span>
  );
}

function RequestRow({ request, onEdit }: { request: NegotiationRequest; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--setu-line)] bg-[var(--setu-soft)] px-3.5 py-3">
      <LevelBadge level={request.level} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">{request.text}</p>
        <p className="setu-text-3 text-xs">
          Requested by: <span className="setu-text-2 font-medium">{request.requestedBy}</span>
        </p>
      </div>
      <button type="button" onClick={onEdit} className="setu-accent-text cursor-pointer px-2 text-xs font-semibold hover:underline">
        Edit
      </button>
    </div>
  );
}

function RequestForm({ dealId, request, defaultBy, onDone }: { dealId: string; request?: NegotiationRequest; defaultBy: string; onDone: () => void }) {
  const addRequest = useSetuStore((s) => s.addRequest);
  const updateRequest = useSetuStore((s) => s.updateRequest);
  const deleteRequest = useSetuStore((s) => s.deleteRequest);
  const [text, setText] = useState(request?.text ?? "");
  const [by, setBy] = useState(request?.requestedBy ?? defaultBy);
  const [saving, setSaving] = useState(false);

  const run = async (action: Promise<void>, done: string) => {
    if (saving) return;
    setSaving(true);
    const ok = await attempt(action.then(() => true), done);
    setSaving(false);
    if (ok) onDone();
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !by.trim()) return;
    const data = { text: text.trim(), requestedBy: by.trim() };
    void run(request ? updateRequest(request.id, data) : addRequest(dealId, data), request ? "Request updated" : "Request added");
  };

  return (
    <form onSubmit={save} className="space-y-2.5 rounded-lg border border-[var(--setu-accent-ring)] bg-[var(--setu-card)] p-3.5">
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 10% discount on 2-yr renewal" className="setu-input h-10" autoFocus />
        <Input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Requested by" className="setu-input h-10" />
      </div>
      <div className="flex items-center justify-between gap-2">
        {request ? (
          <SetuButton
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-600"
            disabled={saving}
            onClick={() => void run(deleteRequest(request.id), "Request removed")}
          >
            <Trash2 /> Remove
          </SetuButton>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <SetuButton size="sm" onClick={onDone}>
            Cancel
          </SetuButton>
          <SetuButton variant="primary" size="sm" type="submit" disabled={!text.trim() || !by.trim() || saving}>
            {request ? "Save" : "Add Request"}
          </SetuButton>
        </div>
      </div>
    </form>
  );
}
