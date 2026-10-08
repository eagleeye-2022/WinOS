"use client";

import { create } from "zustand";
import type { NavModuleId } from "@/lib/navigation/modules";

// Global navigation state, one slice per module. Deliberately in-memory only (no `persist`
// middleware): a full page refresh resets every module back to its default view.
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
  /** Forget everything remembered for a module (Home / Reset view). */
  resetModule: (module: NavModuleId) => void;
}

export const useNavigationStore = create<NavigationStore>()((set) => ({
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

  resetModule: (module) =>
    set((s) => ({ modules: { ...s.modules, [module]: emptyModule() } })),
}));
