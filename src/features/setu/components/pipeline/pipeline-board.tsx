"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, SquareKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { PIPELINE_STAGES, STAGE_BY_ID } from "../../constants";
import { useSetuStore } from "../../store";
import type { PipelineStageId, ProspectSource } from "../../types";
import { computeStats, formatInrShort, openPipelineValue } from "../../utils";
import { FilterChips, Pill, SearchInput, SetuButton, SetuPage } from "../setu-ui";
import { ProspectCard } from "./prospect-card";
import { AddProspectDialog, ProspectDetailDialog } from "./prospect-dialogs";

type SourceFilter = "all" | ProspectSource;
const SOURCE_FILTERS: readonly SourceFilter[] = ["all", "MEETING_121", "WHATSAPP_BOT", "MANUAL"];
const STAGE_IDS = PIPELINE_STAGES.map((s) => s.id);

export function PipelineBoard() {
  const prospects = useSetuStore((s) => s.prospects);
  const meetings = useSetuStore((s) => s.meetings);
  const moveProspect = useSetuStore((s) => s.moveProspect);
  const [q, setQ] = useUrlState("q", "");
  const [source, setSource] = useUrlState<SourceFilter>("source", "all", { allowed: SOURCE_FILTERS });
  const [openId, setOpenId] = useUrlState("open", "", { history: "push" });
  const [focusStage] = useUrlState<PipelineStageId | "">("stage", "", { allowed: STAGE_IDS });
  const [addStage, setAddStage] = useState<PipelineStageId | null>(null);
  const [dragOver, setDragOver] = useState<PipelineStageId | null>(null);
  const columnRefs = useRef<Partial<Record<PipelineStageId, HTMLDivElement | null>>>({});

  // Arriving from the dashboard funnel (?stage=…) scrolls that column into view.
  useEffect(() => {
    if (focusStage) columnRefs.current[focusStage]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focusStage]);

  const needle = q.trim().toLowerCase();
  const visible = prospects.filter(
    (p) =>
      (source === "all" || p.source === source) &&
      (!needle || `${p.name} ${p.business} ${p.connectedVia} ${p.phone}`.toLowerCase().includes(needle))
  );
  const stats = computeStats(meetings, prospects);
  const openProspect = prospects.find((p) => p.id === openId) ?? null;

  const onDrop = (stage: PipelineStageId, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/prospect-id");
    const p = prospects.find((x) => x.id === id);
    if (!p || p.stage === stage) return;
    moveProspect(id, stage);
    toast.success(`${p.name} → ${STAGE_BY_ID[stage].label}`);
  };

  return (
    <SetuPage
      icon={SquareKanban}
      title="Sales Pipeline"
      description="Prospects enter from 121 Meetings (converted referrals) or the WhatsApp bot (visiting cards). Drag cards between stages."
      className="max-w-none"
      actions={
        <SetuButton variant="primary" onClick={() => setAddStage("PROSPECT")}>
          <Plus /> Add Prospect
        </SetuButton>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search prospects…" />
        <FilterChips
          value={source}
          onChange={setSource}
          options={[
            { value: "all", label: "All sources" },
            { value: "MEETING_121", label: "121 Meetings" },
            { value: "WHATSAPP_BOT", label: "WhatsApp Bot" },
            { value: "MANUAL", label: "Manual" },
          ]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Pill>
            <span className="font-semibold text-[var(--setu-text)]">{stats.prospects}</span> prospects
          </Pill>
          <Pill>
            <span className="font-semibold text-[var(--setu-text)]">{formatInrShort(openPipelineValue(prospects))}</span> open value
          </Pill>
          <Pill dot="bg-emerald-500">
            <span className="font-semibold text-[var(--setu-text)]">{stats.pipelineHealth}%</span> health
          </Pill>
        </div>
      </div>

      <div className="dsm-columns-scrollbar -mx-6 overflow-x-auto px-6 pb-4">
        <div className="flex min-w-max gap-3">
          {PIPELINE_STAGES.map((stage) => {
            const cards = visible.filter((p) => p.stage === stage.id);
            const value = cards.reduce((n, p) => n + (p.value ?? 0), 0);
            return (
              <div
                key={stage.id}
                ref={(el) => {
                  columnRefs.current[stage.id] = el;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(stage.id);
                }}
                onDragLeave={() => setDragOver((s) => (s === stage.id ? null : s))}
                onDrop={(e) => onDrop(stage.id, e)}
                className={cn(
                  "setu-well flex w-72 shrink-0 flex-col transition-[border-color,box-shadow]",
                  dragOver === stage.id && "border-[var(--setu-accent)] shadow-[0_0_0_3px_var(--setu-accent-glow)]",
                  focusStage === stage.id && "border-[var(--setu-accent)]"
                )}
              >
                <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full ring-4 ring-[var(--setu-line)]", stage.dot)} />
                  <span className="truncate text-[13px] font-semibold tracking-tight">{stage.label}</span>
                  <span className="setu-chip setu-text-2 ml-auto px-2 py-0.5 text-[10px] font-semibold tabular-nums">{cards.length}</span>
                </div>
                {value > 0 && <div className="setu-text-3 -mt-2 px-4 pb-3 text-[11px] tabular-nums">{formatInrShort(value)}</div>}

                <div className="flex min-h-28 flex-1 flex-col gap-2.5 px-2.5 pb-2.5">
                  {cards.length === 0 ? (
                    <div className="setu-text-3 flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--setu-line-strong)] text-[11px]">
                      Drop here
                    </div>
                  ) : (
                    cards.map((p) => <ProspectCard key={p.id} prospect={p} onOpen={() => setOpenId(p.id)} />)
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setAddStage(stage.id)}
                  className="setu-text-3 mx-2.5 mb-2.5 flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--setu-line-strong)] py-2 text-[11px] font-medium transition-colors hover:border-[var(--setu-accent)] hover:text-[var(--setu-text)]"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <ProspectDetailDialog prospect={openProspect} onClose={() => setOpenId("")} />
      <AddProspectDialog stage={addStage} onClose={() => setAddStage(null)} />
    </SetuPage>
  );
}
