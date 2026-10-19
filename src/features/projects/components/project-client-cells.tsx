"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Filter, Loader2, Plus, Search, X } from "lucide-react";
import { Project } from "../types";
import {
  updateProjectIndustryAction,
  updateProjectLocationAction,
  type ProjectLocationLevel,
} from "../actions/project-actions";
import { getCityOptionsAction, getCountryOptionsAction } from "../actions/location-actions";
import type { LocationOption } from "../location-data";
import { INDUSTRY_SEPARATOR, PROJECT_INDUSTRIES, joinIndustries, parseIndustries } from "../data/industries";
import { AnchoredPopover } from "./popover-portal";
import { getAvatarColor, getInitials } from "./assignee-picker-popover";
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
                <p className="px-2.5 py-2 text-xs italic text-muted-foreground">
                  {query.trim() ? `No ${title.toLowerCase()} matches "${query.trim()}".` : `No ${title.toLowerCase()} list available.`}
                </p>
              ) : (
                !query.trim() && (
                  <p className="px-2.5 py-2 text-xs italic text-muted-foreground">
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
              <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
                Showing {filtered.length} of {totalMatches} — type to narrow down.
              </p>
            )}
          </div>

          {value && (
            <button
              type="button"
              onClick={() => void choose({ name: "", code: "" })}
              className="flex w-full items-center gap-1.5 border-t px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-destructive"
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

// ── Industry column header filter ────────────────────────────────────────────────────────────
/** Filter value for "projects with no industry set". */
export const NO_INDUSTRY_FILTER_KEY = "__no_industry__";

/**
 * Filter icon in the Industry column header. Tick one or more industries; a project shows when it
 * has ANY of them (projects can have several industries). `value` holds lower-cased names.
 */
export function IndustryColumnFilter({
  options,
  noneCount,
  value,
  onChange,
}: {
  /** Industries used by the projects, with how many projects use each. */
  options: { key: string; name: string; count: number }[];
  noneCount: number;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const active = value.length > 0;

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;

  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  const row = (key: string, label: string, count: number, italic = false) => {
    const isOn = value.includes(key);
    return (
      <label
        key={key}
        className={`flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-xs normal-case tracking-normal hover:bg-accent ${
          isOn ? "font-semibold text-primary" : "font-normal text-foreground"
        } ${italic ? "italic" : ""}`}
      >
        <input type="checkbox" checked={isOn} onChange={() => toggle(key)} className="h-3.5 w-3.5 shrink-0 accent-primary" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{count}</span>
      </label>
    );
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
        }}
        title={active ? `Filtering by ${value.length} industr${value.length === 1 ? "y" : "ies"} — click to change` : "Filter by industry"}
        aria-label="Filter by industry"
        className={`relative inline-flex shrink-0 items-center rounded p-0.5 transition-colors cursor-pointer ${
          active ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
        }`}
      >
        <Filter size={11} className={active ? "fill-primary/20" : ""} />
        {active && (
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-xs font-bold text-primary-foreground">
            {value.length}
          </span>
        )}
      </button>

      <AnchoredPopover anchorRef={anchorRef} isOpen={open} onClose={() => setOpen(false)} className="w-64">
        <div className="rounded-md border bg-popover text-left shadow-lg">
          <div className="border-b px-2.5 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Filter by industry
            <span className="mt-0.5 block font-normal normal-case tracking-normal">
              Shows projects with any of the ticked industries.
            </span>
          </div>
          {options.length > 6 && (
            <div className="flex items-center gap-1.5 border-b px-2.5 py-2">
              <Search size={12} className="shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search industries..."
                className="w-full bg-transparent text-xs font-normal normal-case outline-none"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map((o) => row(o.key, o.name, o.count))}
            {!q && noneCount > 0 && row(NO_INDUSTRY_FILTER_KEY, "No industry set", noneCount, true)}
            {filtered.length === 0 && (
              <p className="px-2.5 py-2 text-xs font-normal normal-case italic text-muted-foreground">
                {options.length === 0 ? "No industries set on any project yet." : `No industry matches "${query.trim()}".`}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between border-t px-2.5 py-1.5">
            <button
              type="button"
              disabled={!active}
              onClick={() => onChange([])}
              className="flex items-center gap-1 text-xs font-normal normal-case text-muted-foreground hover:text-destructive disabled:opacity-40"
            >
              <X size={11} /> Clear filter
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded bg-primary px-2.5 py-1 text-xs font-semibold normal-case text-primary-foreground hover:bg-primary/90"
            >
              Done
            </button>
          </div>
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

/**
 * Industry: several can be picked (checkbox list + search, or type your own). Saved after each
 * change as a comma-separated list in `Project.industry` — see parseIndustries.
 */
export function IndustryCell({ project, editable, onUpdated }: CellProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = parseIndustries(project.industry);
  const selectedKeys = new Set(selected.map((s) => s.toLowerCase()));
  const summary = selected.join(INDUSTRY_SEPARATOR);

  // Listed industries plus any custom ones already on this project.
  const allOptions = useMemo(() => {
    const listed = new Set(PROJECT_INDUSTRIES.map((n) => n.toLowerCase()));
    const custom = parseIndustries(project.industry).filter((n) => !listed.has(n.toLowerCase()));
    return [...custom, ...PROJECT_INDUSTRIES];
  }, [project.industry]);

  const q = query.trim().toLowerCase();
  const filtered = q ? allOptions.filter((n) => n.toLowerCase().includes(q)) : allOptions;
  const exactMatch = allOptions.some((n) => n.toLowerCase() === q);

  const save = async (next: string[]) => {
    const value = joinIndustries(next);
    const prev = project.industry;
    onUpdated({ industry: value || undefined });
    setSaving(true);
    try {
      const res = await updateProjectIndustryAction(project.id, value);
      if (!res.success) {
        onUpdated({ industry: prev });
        toast.error(res.error || "Failed to update industry.");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggle = (name: string) => {
    const key = name.toLowerCase();
    void save(selectedKeys.has(key) ? selected.filter((s) => s.toLowerCase() !== key) : [...selected, name]);
  };

  const addTyped = () => {
    const name = query.trim().replace(/,/g, " ").trim();
    if (!name) return;
    const listed = allOptions.find((n) => n.toLowerCase() === name.toLowerCase());
    if (!selectedKeys.has((listed || name).toLowerCase())) void save([...selected, listed || name]);
    setQuery("");
  };

  // Same look as the assignee cells: overlapping initials circles, then the name (one industry)
  // or "N industries" (several). Hover the cell for the full list.
  const chips = (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
      <span className="flex shrink-0 items-center -space-x-1.5">
        {selected.slice(0, 3).map((name) => (
          <span
            key={name}
            title={name}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-2 ring-background ${getAvatarColor(name)}`}
          >
            {getInitials(name)}
          </span>
        ))}
        {selected.length > 3 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground ring-2 ring-background">
            +{selected.length - 3}
          </span>
        )}
      </span>
      <span className="truncate font-medium text-foreground">
        {selected.length === 1 ? selected[0] : `${selected.length} industries`}
      </span>
    </span>
  );

  if (!editable) {
    return (
      <span className="flex min-w-0 items-center gap-1.5 px-1.5 py-1 text-xs" title={summary}>
        {selected.length > 0 ? chips : <span className="text-muted-foreground/60">—</span>}
      </span>
    );
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={saving}
        onClick={() => setOpen((v) => !v)}
        title={summary || "Set industry"}
        className={`group flex w-full min-w-0 items-center gap-1 rounded px-1.5 py-1 text-left text-xs transition-colors cursor-pointer hover:bg-accent ${
          selected.length > 0 ? "text-foreground" : "italic text-muted-foreground/60"
        }`}
      >
        {selected.length > 0 ? chips : <span className="min-w-0 flex-1 truncate">Add industry...</span>}
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
                  addTyped();
                }
              }}
              placeholder="Search or type industry..."
              className="w-full bg-transparent text-xs outline-none"
            />
          </div>

          <div className="flex items-center justify-between px-2.5 pt-2 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <span>Industries</span>
            {selected.length > 0 && <span className="normal-case font-semibold">{selected.length} selected</span>}
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {query.trim() && !exactMatch && (
              <button
                type="button"
                onClick={addTyped}
                className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs font-semibold text-primary hover:bg-accent"
              >
                <Plus size={12} className="shrink-0" />
                <span className="truncate">Add &quot;{query.trim()}&quot;</span>
              </button>
            )}
            {filtered.map((name) => {
              const isOn = selectedKeys.has(name.toLowerCase());
              return (
                <label
                  key={name}
                  className={`flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-accent ${
                    isOn ? "font-semibold text-primary" : "text-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggle(name)}
                    disabled={saving}
                    className="h-3.5 w-3.5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                </label>
              );
            })}
            {filtered.length === 0 && !query.trim() && (
              <p className="px-2.5 py-2 text-xs italic text-muted-foreground">No industries listed.</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t px-2.5 py-1.5">
            <button
              type="button"
              disabled={selected.length === 0 || saving}
              onClick={() => void save([])}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-40"
            >
              <X size={11} /> Clear all
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        </div>
      </AnchoredPopover>
    </>
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
