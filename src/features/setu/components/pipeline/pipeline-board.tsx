"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, SlidersHorizontal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/shared/toast";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { PIPELINE_STAGES, STAGE_BY_ID } from "../../constants";
import { useSetuStore } from "../../store";
import type { PipelineStageId, ProspectSource } from "../../types";
import { FilterChips, SearchInput, SetuButton, SetuSection } from "../setu-ui";
import { ProspectCard } from "./prospect-card";
import { AddProspectDialog, ProspectDetailDialog } from "./prospect-dialogs";

type SourceFilter = "all" | ProspectSource;
const SOURCE_FILTERS: readonly SourceFilter[] = ["all", "MEETING_121", "WHATSAPP_BOT", "MANUAL"];
const STAGE_IDS = PIPELINE_STAGES.map((s) => s.id);

export function PipelineBoard() {
  const prospects = useSetuStore((s) => s.prospects);
  const moveProspect = useSetuStore((s) => s.moveProspect);
  const [q, setQ] = useUrlState("q", "");
  const [source, setSource] = useUrlState<SourceFilter>("source", "all", { allowed: SOURCE_FILTERS });
  const [openId, setOpenId] = useUrlState("open", "", { history: "push" });
  const [focusStage] = useUrlState<PipelineStageId | "">("stage", "", { allowed: STAGE_IDS });
  const [filterOpen, setFilterOpen] = useState(() => q !== "" || source !== "all");
  const [addStage, setAddStage] = useState<PipelineStageId | null>(null);
  const [dragOver, setDragOver] = useState<PipelineStageId | null>(null);
  const columnRefs = useRef<Partial<Record<PipelineStageId, HTMLDivElement | null>>>({});

  // A ?stage=… link scrolls that column into view.
  useEffect(() => {
    if (focusStage) columnRefs.current[focusStage]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [focusStage]);

  const needle = q.trim().toLowerCase();
  const visible = prospects.filter(
    (p) =>
      (source === "all" || p.source === source) &&
      (!needle || `${p.name} ${p.business} ${p.connectedVia} ${p.phone}`.toLowerCase().includes(needle))
  );
  const openProspect = prospects.find((p) => p.id === openId) ?? null;
  const filtered = needle !== "" || source !== "all";

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
    <div className="space-y-6">
      <SetuSection
        title="Sales Pipeline — BNI Prospects Board"
        actions={
          <>
            <SetuButton onClick={() => setFilterOpen((o) => !o)} className={cn(filtered && "border-[var(--setu-accent)]")}>
              <SlidersHorizontal /> Filter
            </SetuButton>
            <SetuButton variant="primary" onClick={() => setAddStage("PROSPECT")}>
              <Plus /> Add Prospect
            </SetuButton>
          </>
        }
      >
        {filterOpen && (
          <div className="setu-card flex flex-wrap items-center gap-3 rounded-2xl p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search prospects…" className="max-w-xs" />
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
          </div>
        )}

        <div className="dsm-columns-scrollbar -mx-6 overflow-x-auto px-6 pb-4">
          <div className="flex min-w-max items-start gap-3">
            {PIPELINE_STAGES.map((stage) => {
              const cards = visible.filter((p) => p.stage === stage.id);
              const canAdd = !stage.closed && stage.id !== "OPPORTUNITY";
              const highlight = stage.id === "PROSPECT" || stage.id === "WON";
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
                    "setu-well flex w-64 shrink-0 flex-col overflow-hidden transition-[border-color,box-shadow]",
                    dragOver === stage.id && "border-[var(--setu-accent)] shadow-[0_0_0_3px_var(--setu-accent-glow)]",
                    focusStage === stage.id && "border-[var(--setu-accent)]"
                  )}
                >
                  {/* Column header */}
                  <div
                    className={cn(
                      "flex items-center gap-2.5 border-b border-[var(--setu-line)] px-4 py-3",
                      stage.id === "PROSPECT" && "bg-[var(--setu-accent-glow)]",
                      stage.id === "WON" && "bg-green-500/10"
                    )}
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full ring-4 ring-[var(--setu-line)]", stage.dot)} />
                    <span className="flex min-w-0 items-center gap-1 truncate text-[13px] font-semibold tracking-tight">
                      {stage.id === "WON" && <Trophy size={13} className="shrink-0 text-amber-500" />}
                      {stage.label}
                    </span>
                    <span
                      className={cn(
                        "setu-chip ml-auto px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                        highlight ? (stage.id === "WON" ? "text-green-500" : "setu-accent-text") : "setu-text-2"
                      )}
                    >
                      {cards.length}
                    </span>
                  </div>

                  {/* Column body */}
                  <div className="flex min-h-28 flex-col gap-2 p-2.5">
                    {cards.length === 0 ? (
                      <div className="setu-text-3 flex min-h-20 flex-1 items-center justify-center text-[11px]">Empty</div>
                    ) : (
                      cards.map((p) => <ProspectCard key={p.id} prospect={p} onOpen={() => setOpenId(p.id)} />)
                    )}
                  </div>

                  {canAdd && (
                    <div className="border-t border-[var(--setu-line)] p-2.5">
                      <button
                        type="button"
                        onClick={() => setAddStage(stage.id)}
                        className="setu-text-3 flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--setu-line-strong)] py-1.5 text-[11px] font-medium transition-colors hover:border-[var(--setu-accent)] hover:text-[var(--setu-text)]"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </SetuSection>

      <ProspectDetailDialog prospect={openProspect} onClose={() => setOpenId("")} />
      <AddProspectDialog stage={addStage} onClose={() => setAddStage(null)} />
    </div>
  );
}
