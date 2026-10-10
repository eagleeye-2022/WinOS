"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Search, X } from "lucide-react";
import { Project } from "../types";
import {
  updateProjectIndustryAction,
  updateProjectLocationAction,
  type ProjectLocationLevel,
} from "../actions/project-actions";
import { getCityOptionsAction, getCountryOptionsAction } from "../actions/location-actions";
import type { LocationOption } from "../location-data";
import { PROJECT_INDUSTRIES } from "../data/industries";
import { AnchoredPopover } from "./popover-portal";
import { toast } from "@/components/shared/toast";

/** Max options rendered at once — a country can have 10,000+ cities; typing narrows the list. */
const MAX_VISIBLE_OPTIONS = 200;

// ── Option caches (shared by every row, so each list is fetched once per page) ───────────────
let countriesPromise: Promise<LocationOption[]> | null = null;
const citiesPromises = new Map<string, Promise<LocationOption[]>>();

/** All countries (cached). Also used by the table's Country filter. */
export function loadCountryOptions(): Promise<LocationOption[]> {
  if (!countriesPromise) {
    countriesPromise = getCountryOptionsAction().catch(() => {
      countriesPromise = null;
      return [];
    });
  }
  return countriesPromise;
}

function loadCityOptions(countryCode: string): Promise<LocationOption[]> {
  if (!citiesPromises.has(countryCode)) {
    citiesPromises.set(
      countryCode,
      getCityOptionsAction(countryCode).catch(() => {
        citiesPromises.delete(countryCode);
        return [];
      })
    );
  }
  return citiesPromises.get(countryCode)!;
}

/**
 * Country flag (SVG) for an ISO code, served by /api/flags/[code] — never stored in the DB.
 * Renders nothing for typed-in countries (no code) or if the flag fails to load.
 */
export function CountryFlag({ code, className = "" }: { code?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const iso = (code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso) || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny cached SVG; next/image adds nothing here
    <img
      src={`/api/flags/${iso}`}
      alt=""
      aria-hidden="true"
      width={18}
      height={12}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`h-3 w-[18px] shrink-0 rounded-[2px] object-cover ring-1 ring-black/10 ${className}`}
    />
  );
}

// ── Generic searchable dropdown, optionally with "type your own" ────────────────────────────
type ComboOption = { code: string; name: string; label?: string; icon?: React.ReactNode };

function ComboCell({
  value,
  valueIcon,
  placeholder,
  editable,
  disabledReason,
  loadOptions,
  onSelect,
  title,
  allowCustom = true,
}: {
  /** When false, only listed options can be picked — no `Use "…"` row for typed text. */
  allowCustom?: boolean;
  /** Text shown in the cell. */
  value: string;
  /** Optional icon before the value (e.g. a country flag). */
  valueIcon?: React.ReactNode;
  placeholder: string;
  editable: boolean;
  /** When set, the cell can't be edited yet (e.g. "Pick a country first"). */
  disabledReason?: string;
  /** Called when the dropdown opens; may return [] (then only typing is offered). */
  loadOptions: () => Promise<ComboOption[]>;
  /** code is empty for typed-in values; name is "" to clear. */
  onSelect: (option: { name: string; code: string }) => Promise<void>;
  title: string;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ComboOption[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadOptions().then((opts) => {
      if (!cancelled) setOptions(opts);
    });
    return () => {
      cancelled = true;
    };
    // Re-load when the parent value (e.g. selected country) changes the list.
  }, [open, loadOptions]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = options || [];
    const matches = q
      ? list.filter((o) => `${o.label || o.name} ${o.code}`.toLowerCase().includes(q))
      : list;
    return matches.slice(0, MAX_VISIBLE_OPTIONS);
  }, [options, q]);
  const totalMatches = useMemo(() => {
    const list = options || [];
    return q ? list.filter((o) => `${o.label || o.name} ${o.code}`.toLowerCase().includes(q)).length : list.length;
  }, [options, q]);
  const exactMatch = (options || []).some((o) => o.name.toLowerCase() === q);

  const choose = async (option: { name: string; code: string }) => {
    setSaving(true);
    try {
      await onSelect(option);
      setOpen(false);
      setQuery("");
    } finally {
      setSaving(false);
    }
  };

  if (!editable) {
    return (
      <span
        className={`flex min-w-0 items-center gap-1.5 px-1.5 py-1 text-xs ${value ? "text-foreground" : "text-muted-foreground/60"}`}
        title={value}
      >
        {value && valueIcon}
        <span className="truncate">{value || "—"}</span>
      </span>
    );
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={!!disabledReason || saving}
        onClick={() => setOpen((v) => !v)}
        title={disabledReason || value || `Set ${title}`}
        className={`group flex w-full min-w-0 items-center gap-1 rounded px-1.5 py-1 text-left text-xs transition-colors ${disabledReason ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"
          } ${value ? "font-medium text-foreground" : "italic text-muted-foreground/60"}`}
      >
        {value && valueIcon}
        <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
        {saving ? (
          <Loader2 size={11} className="shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown size={11} className="shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </button>

      <AnchoredPopover anchorRef={anchorRef} isOpen={open} onClose={() => setOpen(false)} className="w-64">
        <div className="rounded-md border bg-popover shadow-lg">
          <div className="flex items-center gap-1.5 border-b px-2.5 py-2">
            <Search size={12} className="shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  e.preventDefault();
                  const exact = (options || []).find((o) => o.name.toLowerCase() === q);
                  // Without custom values, Enter picks the exact match or else the only match.
                  const pick = exact ?? (!allowCustom && filtered.length === 1 ? filtered[0] : undefined);
                  if (pick) void choose({ name: pick.name, code: pick.code });
                  else if (allowCustom) void choose({ name: query.trim(), code: "" });
                }
              }}
              placeholder={allowCustom ? `Search or type ${title.toLowerCase()}...` : `Search ${title.toLowerCase()}...`}
              className="w-full bg-transparent text-xs outline-none"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {allowCustom && query.trim() && !exactMatch && (
              <button
                type="button"
                onClick={() => void choose({ name: query.trim(), code: "" })}
                className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs font-semibold text-primary hover:bg-accent"
              >
                <Plus size={12} className="shrink-0" />
                <span className="truncate">Use &quot;{query.trim()}&quot;</span>
              </button>
            )}

            {options === null ? (
              <div className="flex justify-center py-3">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              !allowCustom ? (
                <p className="px-2.5 py-2 text-[11px] italic text-muted-foreground">
                  {query.trim() ? `No ${title.toLowerCase()} matches "${query.trim()}".` : `No ${title.toLowerCase()} list available.`}
                </p>
              ) : (
                !query.trim() && (
                  <p className="px-2.5 py-2 text-[11px] italic text-muted-foreground">
                    No list available — type a {title.toLowerCase()} above.
                  </p>
                )
              )
            ) : (
              filtered.map((o) => {
                const label = o.label || o.name;
                const selected = value === label || value === o.name;
                return (
                  <button
                    key={`${o.code}-${o.name}`}
                    type="button"
                    onClick={() => void choose({ name: o.name, code: o.code })}
                    className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs hover:bg-accent ${selected ? "font-semibold text-primary" : "text-foreground"
                      }`}
                  >
                    {o.icon}
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {selected && <Check size={12} className="shrink-0" />}
                  </button>
                );
              })
            )}

            {options !== null && totalMatches > filtered.length && (
              <p className="px-2.5 py-1.5 text-[10px] text-muted-foreground">
                Showing {filtered.length} of {totalMatches} — type to narrow down.
              </p>
            )}
          </div>

          {value && (
            <button
              type="button"
              onClick={() => void choose({ name: "", code: "" })}
              className="flex w-full items-center gap-1.5 border-t px-2.5 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-accent hover:text-destructive"
            >
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </AnchoredPopover>
    </>
  );
}

// ── Toolbar: Country filter (custom dropdown so it can show flags) ───────────────────────────
/** value: "ALL", "NONE" (no country set) or a country name. */
export function CountryFilterDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  /** Countries actually used by projects, with their ISO code when known. */
  options: { name: string; code: string }[];
  onChange: (value: string) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const active = options.find((o) => o.name === value);
  const label = value === "ALL" ? "All countries" : value === "NONE" ? "No country set" : value;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const item = (v: string, text: string, code?: string) => (
    <button
      key={v}
      type="button"
      onClick={() => pick(v)}
      className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs hover:bg-accent ${value === v ? "font-semibold text-primary" : "text-foreground"
        }`}
    >
      {code !== undefined && <CountryFlag code={code} />}
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {value === v && <Check size={12} className="shrink-0" />}
    </button>
  );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Filter by client country"
        className={`inline-flex max-w-44 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs transition-colors hover:bg-accent ${value !== "ALL" ? "font-semibold text-primary" : "text-foreground"
          }`}
      >
        {active ? <CountryFlag code={active.code} /> : null}
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
      </button>

      <AnchoredPopover anchorRef={anchorRef} isOpen={open} onClose={() => setOpen(false)} className="w-56">
        <div className="max-h-72 overflow-y-auto rounded-md border bg-popover py-1 shadow-lg">
          {item("ALL", "All countries")}
          {options.map((o) => item(o.name, o.name, o.code))}
          {item("NONE", "No country set")}
        </div>
      </AnchoredPopover>
    </>
  );
}

// ── Column cells ─────────────────────────────────────────────────────────────────────────────
type CellProps = {
  project: Project;
  editable: boolean;
  onUpdated: (patch: Partial<Project>) => void;
};

const INDUSTRY_OPTIONS: ComboOption[] = PROJECT_INDUSTRIES.map((name) => ({ code: name, name }));

export function IndustryCell({ project, editable, onUpdated }: CellProps) {
  const loadOptions = useMemo(() => () => Promise.resolve(INDUSTRY_OPTIONS), []);
  return (
    <ComboCell
      title="Industry"
      value={project.industry || ""}
      placeholder="Add industry..."
      editable={editable}
      loadOptions={loadOptions}
      onSelect={async ({ name }) => {
        const prev = project.industry;
        onUpdated({ industry: name || undefined });
        const res = await updateProjectIndustryAction(project.id, name);
        if (!res.success) {
          onUpdated({ industry: prev });
          toast.error(res.error || "Failed to update industry.");
        }
      }}
    />
  );
}

/** Shared save path for Country and City (server clears the city when the country changes). */
async function saveLocation(
  project: Project,
  level: ProjectLocationLevel,
  value: { name: string; code: string },
  onUpdated: (patch: Partial<Project>) => void
) {
  const res = await updateProjectLocationAction(project.id, level, value);
  if (res.success && res.patch) {
    onUpdated({
      clientCountry: res.patch.clientCountry,
      clientCountryCode: res.patch.clientCountryCode,
      clientState: undefined,
      clientStateCode: undefined,
      clientCity: res.patch.clientCity,
    });
  } else {
    toast.error(res.error || "Failed to update location.");
  }
}

export function CountryCell({ project, editable, onUpdated }: CellProps) {
  // Flag instead of the "(IN)" code; the code still matches when searching ("in", "gb" ...).
  const loadOptions = useMemo(
    () => () =>
      loadCountryOptions().then((list) =>
        list.map((c) => ({ code: c.code, name: c.name, icon: <CountryFlag code={c.code} /> }))
      ),
    []
  );
  return (
    <ComboCell
      title="Country"
      value={project.clientCountry || ""}
      valueIcon={<CountryFlag code={project.clientCountryCode} />}
      placeholder="Add country..."
      editable={editable}
      allowCustom={false}
      loadOptions={loadOptions}
      onSelect={(v) => saveLocation(project, "country", v, onUpdated)}
    />
  );
}

/** Cities of the project's country only (needs a country picked from the list). */
export function CityCell({ project, editable, onUpdated }: CellProps) {
  const countryCode = project.clientCountryCode || "";
  const loadOptions = useMemo(
    () => () => (countryCode ? loadCityOptions(countryCode) : Promise.resolve([])),
    [countryCode]
  );
  return (
    <ComboCell
      title="City"
      value={project.clientCity || ""}
      placeholder="Add city..."
      editable={editable}
      allowCustom={false}
      disabledReason={countryCode ? undefined : "Pick a country from the list first"}
      loadOptions={loadOptions}
      onSelect={(v) => saveLocation(project, "city", v, onUpdated)}
    />
  );
}
