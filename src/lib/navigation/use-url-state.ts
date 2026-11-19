"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { resolveNavModule, type NavModuleId } from "./modules";
import { useNavigationStore } from "@/stores/navigation-store";

type Updater<T> = T | ((prev: T) => T);

export interface UrlStateOptions<T extends string> {
  /** Values accepted from the URL; anything else falls back to the default. */
  allowed?: readonly NoInfer<T>[];
  /**
   * "push" adds a history entry (use for tabs / sub-views, so Back returns to the previous one);
   * "replace" (default) rewrites the current entry (use for filters and search-as-you-type).
   */
  history?: "push" | "replace";
}

/** Write one query param via the native History API (shallow: no server round-trip). */
export function writeSearchParam(key: string, value: string | null, mode: "push" | "replace" = "replace") {
  const params = new URLSearchParams(window.location.search);
  if (value === null || value === "") params.delete(key);
  else params.set(key, value);
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  if (mode === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}

/**
 * useState backed by a URL query param, so view state (tabs, filters, search) survives leaving
 * and returning to a module, works with Back/Forward, and can be shared as a link. The default
 * value is never written to the URL, keeping default views' URLs clean.
 */
// `NoInfer` so `useUrlState("q", "")` is a string state, not one narrowed to the literal "".
export function useUrlState<T extends string = string>(
  key: string,
  defaultValue: NoInfer<T>,
  options: UrlStateOptions<T> = {}
): [T, (next: Updater<T>) => void] {
  const searchParams = useSearchParams();
  const { allowed, history = "replace" } = options;

  const raw = searchParams.get(key);
  const value =
    raw === null || (allowed && !allowed.includes(raw as T)) ? defaultValue : (raw as T);

  const setValue = useCallback(
    (next: Updater<T>) => {
      const fromUrl = new URLSearchParams(window.location.search).get(key);
      const prev =
        fromUrl === null || (allowed && !allowed.includes(fromUrl as T)) ? defaultValue : (fromUrl as T);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeSearchParam(key, resolved === defaultValue ? null : resolved, history);
    },
    [key, defaultValue, allowed, history]
  );

  return [value, setValue];
}

/** Positive-integer variant of useUrlState (pagination). */
export function useUrlNumberState(key: string, defaultValue: number): [number, (next: Updater<number>) => void] {
  const [raw, setRaw] = useUrlState(key, String(defaultValue));
  const parsed = Number.parseInt(raw, 10);
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
  const setValue = useCallback(
    (next: Updater<number>) =>
      setRaw((prevRaw) => {
        const prevParsed = Number.parseInt(prevRaw, 10);
        const prev = Number.isFinite(prevParsed) && prevParsed > 0 ? prevParsed : defaultValue;
        return String(typeof next === "function" ? next(prev) : next);
      }),
    [setRaw, defaultValue]
  );
  return [value, setValue];
}

/**
 * The selected record of a master/detail list, in the URL. Absent → `fallbackId` (e.g. the first
 * item); explicitly closed → null. Selecting pushes a history entry so Back reselects the previous one.
 */
export function useUrlSelection(key: string, fallbackId: string | null): [string | null, (id: string | null) => void] {
  const [raw, setRaw] = useUrlState(key, "", { history: "push" });
  const selected = raw === CLOSED_SELECTION ? null : raw || fallbackId;
  const setSelected = useCallback((id: string | null) => setRaw(id ?? CLOSED_SELECTION), [setRaw]);
  return [selected, setSelected];
}

const CLOSED_SELECTION = "none";

/** The module the current route belongs to. */
export function useCurrentNavModule(): NavModuleId {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return resolveNavModule(pathname, searchParams);
}

/**
 * useState for ephemeral UI that shouldn't clutter the URL (expanded panels, collapsed groups).
 * Stored in the current module's slice of the navigation store (saved to the tab's
 * sessionStorage), so it survives leaving the page, switching modules and refreshing, and resets
 * on Reset view or in a new tab. Pick a `key` that's unique within the module (include record
 * ids where relevant) — or use usePageViewState, which scopes the key to the current page.
 * The value must be JSON-safe.
 */
export function useModuleViewState<T>(key: string, initialDefault: T): [T, (next: Updater<T>) => void] {
  // Like useState's initial value: the first default is kept, so a literal `{}` / `[]` passed on
  // every render doesn't hand out a new object (and re-run effects) each time.
  const [defaultValue] = useState(initialDefault);
  const moduleId = useCurrentNavModule();
  const stored = useNavigationStore((s) => s.modules[moduleId]?.view[key]);
  const setView = useNavigationStore((s) => s.setView);
  const value = stored === undefined ? defaultValue : (stored as T);

  const setValue = useCallback(
    (next: Updater<T>) => {
      const currentRaw = useNavigationStore.getState().modules[moduleId]?.view[key];
      const prev = currentRaw === undefined ? defaultValue : (currentRaw as T);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      setView(moduleId, key, resolved);
    },
    [moduleId, key, defaultValue, setView]
  );

  return [value, setValue];
}

/**
 * useModuleViewState scoped to the current page (pathname): a drop-in for useState on
 * expand/collapse toggles, open panels and modals, so the page looks the same when the user comes
 * back to it (after visiting another page, Back/Forward, or a refresh). The same component on two
 * pages (e.g. two different tasks) keeps separate state. The value must be JSON-safe.
 */
export function usePageViewState<T>(key: string, defaultValue: T): [T, (next: Updater<T>) => void] {
  const pathname = usePathname();
  return useModuleViewState<T>(`${pathname}::${key}`, defaultValue);
}

const NO_ITEMS: never[] = [];

/** usePageViewState for a Set (stored as an array): a drop-in for useState<Set<T>>. */
export function usePageViewSet<T extends string | number>(
  key: string
): [Set<T>, (next: Set<T> | ((prev: Set<T>) => Set<T>)) => void] {
  const [list, setList] = usePageViewState<T[]>(key, NO_ITEMS);
  const set = useMemo(() => new Set(list), [list]);
  const update = useCallback(
    (next: Set<T> | ((prev: Set<T>) => Set<T>)) =>
      setList((prev) => [...(typeof next === "function" ? next(new Set(prev)) : next)]),
    [setList]
  );
  return [set, update];
}

/**
 * A form's draft field (kept like usePageViewState under `draft:<form>:<field>`), so a half-filled
 * form modal comes back as it was left. Clear the whole draft with useClearPageDraft on submit /
 * cancel.
 */
export function usePageDraft<T>(form: string, field: string, defaultValue: T): [T, (next: Updater<T>) => void] {
  return usePageViewState<T>(`draft:${form}:${field}`, defaultValue);
}

/** Returns a function that forgets every draft field of `form` on the current page. */
export function useClearPageDraft(form: string): () => void {
  const pathname = usePathname();
  const moduleId = useCurrentNavModule();
  return useCallback(
    () => useNavigationStore.getState().clearViewPrefix(moduleId, `${pathname}::draft:${form}:`),
    [moduleId, pathname, form]
  );
}

/**
 * Whether `form` had a saved draft on this page when the component mounted — lets a form's
 * "reset the fields when it opens" effect skip its first run, so a restored draft isn't wiped.
 */
export function useHadPageDraftOnMount(form: string): boolean {
  const pathname = usePathname();
  const moduleId = useCurrentNavModule();
  const [had] = useState(() => {
    const prefix = `${pathname}::draft:${form}:`;
    const view = useNavigationStore.getState().modules[moduleId]?.view ?? {};
    return Object.keys(view).some((k) => k.startsWith(prefix));
  });
  return had;
}
