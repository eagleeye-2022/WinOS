"use client";

import { useCallback } from "react";
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
 * Stored in the current module's slice of the in-memory navigation store, so it survives
 * switching modules and coming back, but resets on full refresh or Reset view. Pick a `key`
 * that's unique within the module (include record ids where relevant).
 */
export function useModuleViewState<T>(key: string, defaultValue: T): [T, (next: Updater<T>) => void] {
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
