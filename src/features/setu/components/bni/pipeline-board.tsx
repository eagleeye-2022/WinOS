"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  BadgeCheck,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  CircleX,
  FileCheck2,
  FileText,
  GripVertical,
  Handshake,
  LayoutGrid,
  Lightbulb,
  PauseCircle,
  Phone,
  Plus,
  Signature,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";
import { usePageViewState, useUrlState } from "@/lib/navigation/use-url-state";
import { BNI_STAGES, BNI_STAGE_BY_ID, BNI_STAGE_IDS, bniStageOf, isOpportunity, isPipelineRecord, prospectSources, tagsOf, type BniOrigin, type BniStage } from "../../bni";
import { useBni } from "../../bni-client";
import { matchesText } from "../../insights";
import { useSetuStore } from "../../provider";
import type { Deal } from "../../types";
import { formatDateTime, formatInr, phoneDigits } from "../../utils";
import { FilterDropdown, SetuButton, attempt } from "../setu-ui";
import { ProspectDialog, type ProspectPreset } from "./bni-forms";
import { ChipPill, ClearFilters, FilterPanel, PanelSearch, SetuShell } from "./setu-shell";

type OriginFilter = "all" | "BOT" | "121" | "DIRECT";
const ORIGIN_VALUES: OriginFilter[] = ["all", "BOT", "121", "DIRECT"];
const ORIGIN_LABEL: Record<OriginFilter, string> = { all: "All Sources", BOT: "WhatsApp Bot", "121": "From 121s", DIRECT: "Direct" };

/** Column icon for each of the 12 stages. */
const STAGE_ICON: Record<BniStage, React.ElementType> = {
  PROSPECT: UserRoundSearch,
  DISCOVERY: CalendarDays,
  ESTIMATION: FileText,
  ESTIMATE_SENT: FileCheck2,
  CLIENT_MEET_1: UsersRound,
  CLIENT_MEET_2: CalendarCheck2,
  NEGOTIATION: Handshake,
  AGREEMENT: Signature,
  WON: BadgeCheck,
  ON_HOLD: PauseCircle,
  LOST: CircleX,
  OPPORTUNITY: Lightbulb,
};

/** Column header tiles are neutral; only the two outcomes carry colour. */
const NEUTRAL_TILE = "bg-[var(--setu-card)] text-[var(--setu-text-2)]";
const OUTCOME_TILE: Partial<Record<BniStage, string>> = {
  WON: "bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  LOST: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

/** Setu → Sales Pipeline: the BNI prospects board, 12 stages; drag a card (or use its menu) to move it. */
export function PipelineBoard() {
  const deals = useSetuStore((s) => s.deals);
  const notes = useSetuStore((s) => s.notes);
  const bni = useBni();
  const [q, setQ] = useUrlState("q", "");
  const [origin, setOrigin] = useUrlState<OriginFilter>("source", "all", { allowed: ORIGIN_VALUES });
  const [stageFilter, setStageFilter] = useUrlState<BniStage | "">("stage", "", { allowed: BNI_STAGE_IDS });
  const [create, setCreate] = usePageViewState<ProspectPreset | null>("Pipeline:create", null);
  const [dragOver, setDragOver] = useState<BniStage | null>(null);

  const sources = useMemo(() => prospectSources(deals, notes), [deals, notes]);
  const records = useMemo(
    () =>
      deals.filter(
        (d) =>
          isPipelineRecord(d) &&
          (origin === "all" || (!isOpportunity(d) && (origin === "121" ? tagsOf(d).origin === "121" || sources.has(d.id) : tagsOf(d).origin === origin))) &&
          matchesText(q, d.contactName, d.company, d.source, d.phone, d.title, d.remark, d.leadCode)
      ),
    [deals, origin, q, sources]
  );
  const byStage = useMemo(() => {
    const map = new Map<BniStage, Deal[]>(BNI_STAGES.map((s) => [s.id, []]));
    for (const d of records) map.get(bniStageOf(d))?.push(d);
    return map;
  }, [records]);
  const columns = stageFilter ? BNI_STAGES.filter((s) => s.id === stageFilter) : BNI_STAGES;

  const move = (id: string, stage: BniStage) => {
    const d = deals.find((x) => x.id === id);
    if (!d || bniStageOf(d) === stage) return;
    void attempt(bni.setStage(id, stage), `${d.contactName} → ${BNI_STAGE_BY_ID[stage].label}`);
  };
  const filtered = Boolean(q) || origin !== "all" || Boolean(stageFilter);

  return (
    <SetuShell
      tab="pipeline"
      title="Sales Pipeline"
      actions={
        <SetuButton variant="solid" onClick={() => setCreate({ stage: "PROSPECT" })}>
          <Plus /> Add Prospect
        </SetuButton>
      }
    >
      <FilterPanel
        chips={
          <>
            <ChipPill active={!stageFilter} onClick={() => setStageFilter("")} icon={LayoutGrid} label="All" count={records.length} />
            {BNI_STAGES.map((s) => (
              <ChipPill
                key={s.id}
                active={stageFilter === s.id}
                onClick={() => setStageFilter((cur) => (cur === s.id ? "" : s.id))}
                icon={STAGE_ICON[s.id]}
                label={s.label}
                count={byStage.get(s.id)?.length ?? 0}
              />
            ))}
          </>
        }
      >
        <PanelSearch value={q} onChange={setQ} placeholder="Search prospects by name, business, connector, phone, code…" />
        <FilterDropdown label="Source" value={origin} onChange={(v) => setOrigin(v as OriginFilter)} options={ORIGIN_VALUES.map((v) => ({ value: v, label: ORIGIN_LABEL[v] }))} className="h-10" />
        <ClearFilters
          show={filtered}
          onClick={() => {
            setQ("");
            setOrigin("all");
            setStageFilter("");
          }}
        />
      </FilterPanel>

      <div className="setu-scroll-x -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6" data-scroll-key="setu-pipeline-board">
        <div className="flex min-w-max items-start gap-4" onDragEnd={() => setDragOver(null)}>
          {columns.map((stage) => {
            const cards = byStage.get(stage.id) ?? [];
            const Icon = STAGE_ICON[stage.id];
            return (
              <section
                key={stage.id}
                aria-label={stage.label}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOver !== stage.id) setDragOver(stage.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver((s) => (s === stage.id ? null : s));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  move(e.dataTransfer.getData("text/setu-deal-id"), stage.id);
                }}
                className={cn(
                  "setu-well flex w-[300px] shrink-0 flex-col transition-[border-color,box-shadow]",
                  dragOver === stage.id && "border-[var(--setu-accent)] shadow-[0_0_0_2px_var(--setu-accent-ring)]"
                )}
              >
                <header className="flex items-center gap-2 px-3 py-3">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", OUTCOME_TILE[stage.id] ?? NEUTRAL_TILE)}>
                    <Icon size={14} />
                  </span>
                  <h3 className="min-w-0 truncate text-sm font-medium">{stage.label}</h3>
                  <span className="setu-text-3 text-xs tabular-nums">{cards.length}</span>
                  <button
                    type="button"
                    onClick={() => setCreate({ stage: stage.id })}
                    aria-label={`Add to ${stage.label}`}
                    className="setu-text-2 ml-auto flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--setu-card)] hover:text-[var(--setu-text)]"
                  >
                    <Plus size={15} />
                  </button>
                </header>
                <div className="flex min-h-32 flex-col gap-3 px-3 pb-3">
                  {cards.length === 0 ? (
                    <div
                      className={cn(
                        "flex min-h-24 flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-4 text-center text-xs text-[var(--setu-text-3)]",
                        dragOver === stage.id ? "border-[var(--setu-accent)] text-[var(--setu-accent)]" : "border-[var(--setu-line-strong)]"
                      )}
                    >
                      {dragOver === stage.id ? (
                        "Drop here"
                      ) : (
                        <>
                          <span>No prospects here</span>
                          <button type="button" onClick={() => setCreate({ stage: stage.id })} className="font-medium text-[var(--setu-accent)] hover:underline">
                            + Add one
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    cards.map((d) => <ProspectCard key={d.id} deal={d} stage={stage.id} fromMember={sources.get(d.id)} onMove={(s) => move(d.id, s)} />)
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <ProspectDialog open={create !== null} onClose={() => setCreate(null)} preset={create ?? undefined} />
    </SetuShell>
  );
}

const ORIGIN_TEXT: Record<BniOrigin, string> = { BOT: "Via WhatsApp Bot", "121": "From a 121", DIRECT: "" };

function ProspectCard({ deal, stage, fromMember, onMove }: { deal: Deal; stage: BniStage; fromMember?: Deal; onMove: (s: BniStage) => void }) {
  const router = useRouter();
  const opp = isOpportunity(deal);
  const origin = fromMember ? `From 121 ${fromMember.contactName.split(" ")[0]}` : ORIGIN_TEXT[tagsOf(deal).origin];
  const business = deal.company !== deal.contactName ? deal.company : opp ? "Opportunity" : "Prospect";
  const open = () => router.push(ROUTES.setuDeal(deal.id));

  return (
    <article
      role="link"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/setu-deal-id", deal.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
      className="setu-card group relative cursor-grab p-4 transition-colors hover:border-[var(--setu-line-strong)] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--setu-accent-ring)]"
    >
      <div className="absolute right-2 top-2 flex items-center">
        <StageMenu current={stage} onChange={onMove} />
        <GripVertical size={14} className="setu-text-3 opacity-50 group-hover:opacity-100" aria-hidden />
      </div>

      <h4 className="pr-12 text-sm font-semibold leading-snug group-hover:text-[var(--setu-accent)]">{deal.contactName}</h4>
      <p className="setu-text-2 mt-0.5 truncate text-xs">
        {business} • {deal.leadCode}
      </p>

      <div className="mt-3 space-y-2">
        {(stage === "WON" || stage === "LOST") && deal.value !== undefined ? (
          <div
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2",
              stage === "WON" ? "bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300" : "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300"
            )}
          >
            <span className="text-xs font-medium">{stage === "WON" ? "Closed deal" : "Deal value"}</span>
            <span className="text-sm font-semibold tabular-nums">{formatInr(deal.value)}</span>
          </div>
        ) : (
          !opp &&
          deal.phone && (
            <a
              href={`tel:+${phoneDigits(deal.phone)}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 rounded-lg bg-[var(--setu-accent-soft)] px-3 py-2 text-xs font-medium text-[var(--setu-accent)] hover:brightness-95"
            >
              <Phone size={13} /> {deal.phone}
            </a>
          )
        )}
        {(deal.remark || deal.source || deal.title) && (
          <p className="rounded-lg border-l-[3px] border-[var(--setu-accent)] bg-[var(--setu-well)] px-3 py-2 text-xs leading-snug text-[var(--setu-text)]">
            {deal.remark ? (
              <>
                <span className="font-medium">Note:</span> {deal.remark}
              </>
            ) : (
              [deal.source ? `Co ${deal.source}` : "", deal.title].filter(Boolean).join(" · ")
            )}
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
        {origin ? (
          <span className="inline-flex items-center gap-1 font-medium text-[var(--setu-accent)]">
            <ArrowUp size={11} /> {origin}
          </span>
        ) : (
          <span />
        )}
        <span className="setu-text-3 tabular-nums">Updated {formatDateTime(deal.updatedAt)}</span>
      </div>
    </article>
  );
}

/** Same move as a drag. Events are stopped so the card doesn't open. */
function StageMenu({ current, onChange }: { current: BniStage; onChange: (s: BniStage) => void }) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div onClick={stop} onKeyDown={stop} onPointerDown={stop} onDragStart={(e) => e.preventDefault()} draggable={false}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Move to stage" className="setu-text-3 flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--setu-well)] hover:text-[var(--setu-accent)]">
            <ChevronDown size={13} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44" onClick={stop}>
          <DropdownMenuLabel className="text-[11px]">Move to stage</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={current} onValueChange={(v) => onChange(v as BniStage)}>
            {BNI_STAGES.map((s) => (
              <DropdownMenuRadioItem key={s.id} value={s.id} className="text-xs">
                <span className={cn("mr-2 h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} />
                {s.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
