"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { NavModuleId } from "@/lib/navigation/modules";

// Global navigation state, one slice per module. Saved to the tab's sessionStorage, so a full
// page refresh (F5) brings back the same screen — scroll, expanded/collapsed sections, open
// panels and form drafts — while a new tab or browser restart starts fresh. Values must be
// JSON-safe (no Dates / Sets / functions): store ids and arrays, not objects with methods.
// Hydration is manual (`skipHydration`), done by NavigationStateTracker after mount, so the
// server-rendered HTML and the first client render match.
//
// The URL is the source of truth for anything shareable (open record → path segment; tab,
// filters, search → query params via useUrlState), so a module slice only needs to remember
// *which* URL the user was last on. Scroll offsets and ephemeral UI (expanded panels,
// collapsed groups — via useModuleViewState) don't belong in the URL and live here instead.

export interface ScrollEntry {
  /** `data-scroll-key` of the container, or a structural path from <main> (see scroll-restore). */
  key: string;
  top: number;
  /** Horizontal offset — the DSM / Report team boards scroll sideways. */
  left: number;
}

export interface ModuleNavState {
  /** pathname + search the user was last on inside this module. */
  lastUrl: string | null;
  /** Scroll offsets per URL inside this module. */
  scroll: Record<string, ScrollEntry[]>;
  /** Ephemeral, non-URL view state (expanded panels etc.), namespaced by caller-chosen key. */
  view: Record<string, unknown>;
}

const MAX_SCROLL_URLS_PER_MODULE = 30;

const emptyModule = (): ModuleNavState => ({ lastUrl: null, scroll: {}, view: {} });

interface NavigationStore {
  modules: Partial<Record<NavModuleId, ModuleNavState>>;
  recordUrl: (module: NavModuleId, url: string) => void;
  saveScroll: (module: NavModuleId, url: string, entries: ScrollEntry[]) => void;
  setView: (module: NavModuleId, key: string, value: unknown) => void;
  /** Forget every view key in a module that starts with `prefix` (e.g. a form's draft fields). */
  clearViewPrefix: (module: NavModuleId, prefix: string) => void;
  /** Forget everything remembered for a module (Home / Reset view). */
  resetModule: (module: NavModuleId) => void;
}

/** Hydrated state is merged module by module; anything set since page load (newer) wins. */
function mergeModules(
  persisted: Partial<Record<NavModuleId, ModuleNavState>> | undefined,
  current: Partial<Record<NavModuleId, ModuleNavState>>
): Partial<Record<NavModuleId, ModuleNavState>> {
  const out: Partial<Record<NavModuleId, ModuleNavState>> = { ...(persisted ?? {}) };
  for (const [id, cur] of Object.entries(current) as [NavModuleId, ModuleNavState][]) {
    const old = out[id];
    out[id] = old
      ? {
          lastUrl: cur.lastUrl ?? old.lastUrl,
          scroll: { ...old.scroll, ...cur.scroll },
          view: { ...old.view, ...cur.view },
        }
      : cur;
  }
  return out;
}

export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set) => ({
  modules: {},

  recordUrl: (module, url) =>
    set((s) => {
      const current = s.modules[module] ?? emptyModule();
      if (current.lastUrl === url) return s;
      return { modules: { ...s.modules, [module]: { ...current, lastUrl: url } } };
    }),

  saveScroll: (module, url, entries) =>
    set((s) => {
      const current = s.modules[module] ?? emptyModule();
      const rest = { ...current.scroll };
      delete rest[url];
      const urls = Object.keys(rest);
      // Re-insert at the end so the oldest URL is evicted first.
      const trimmed =
        urls.length >= MAX_SCROLL_URLS_PER_MODULE
          ? Object.fromEntries(urls.slice(urls.length - MAX_SCROLL_URLS_PER_MODULE + 1).map((u) => [u, rest[u]]))
          : rest;
      const scroll = entries.length ? { ...trimmed, [url]: entries } : trimmed;
      return { modules: { ...s.modules, [module]: { ...current, scroll } } };
    }),

  setView: (module, key, value) =>
    set((s) => {
      const current = s.modules[module] ?? emptyModule();
      if (Object.is(current.view[key], value)) return s;
      return { modules: { ...s.modules, [module]: { ...current, view: { ...current.view, [key]: value } } } };
    }),

  clearViewPrefix: (module, prefix) =>
    set((s) => {
      const current = s.modules[module];
      if (!current) return s;
      const keys = Object.keys(current.view).filter((k) => k.startsWith(prefix));
      if (keys.length === 0) return s;
      const view = { ...current.view };
      for (const k of keys) delete view[k];
      return { modules: { ...s.modules, [module]: { ...current, view } } };
    }),

  resetModule: (module) =>
    set((s) => ({ modules: { ...s.modules, [module]: emptyModule() } })),
    }),
    {
      name: "winos:navigation",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ modules: s.modules }),
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        modules: mergeModules((persisted as { modules?: NavigationStore["modules"] } | undefined)?.modules, current.modules),
      }),
    }
  )
);
