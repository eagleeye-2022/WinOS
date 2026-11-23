"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useStore } from "zustand";
import { setuApi } from "./api";
import { createSetuStore, snapshotState, type SetuState, type SetuStore } from "./store";
import type { SetuSnapshot, TeamMember } from "./types";

const SetuStoreContext = createContext<SetuStore | null>(null);

/**
 * One store per request / browser tab (not a module singleton, so server renders never share
 * data). When the layout re-renders with a fresh snapshot (after any Setu write), the data is
 * replaced with it.
 */
export function SetuStoreProvider({ snapshot, children }: { snapshot: SetuSnapshot; children: React.ReactNode }) {
  const [store] = useState(() => createSetuStore(snapshot, setuApi));
  useEffect(() => {
    store.setState(snapshotState(snapshot));
  }, [store, snapshot]);
  return <SetuStoreContext.Provider value={store}>{children}</SetuStoreContext.Provider>;
}

export function useSetuStore<T>(selector: (s: SetuState) => T): T {
  const store = useContext(SetuStoreContext);
  if (!store) throw new Error("useSetuStore must be used inside <SetuStoreProvider> (the Setu layout).");
  return useStore(store, selector);
}

/** The signed-in user. */
export function useSetuMe(): TeamMember {
  return useSetuStore((s) => s.me);
}
