"use client";

/**
 * Shares one polled copy of the current user's DB ActiveTimer across every
 * TimerWidget mounted on a page. Without this, each task card's TimerWidget
 * polled getActiveTimerAction() independently, so a board with N visible
 * tasks fired N duplicate DB calls on mount and every 30s after.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getActiveTimerAction } from "../actions/active-timer-actions";

export interface ActiveTimerData {
  id: string;
  userId: string;
  projectId: string;
  phaseId: string;
  taskId: string;
  startedAt: string;
  elapsedSeconds: number;
  task?: { id: string; code: string; title: string } | null;
  [key: string]: unknown;
}

interface ActiveTimerContextValue {
  activeTimer: ActiveTimerData | null;
  /** Re-fetches the active timer from the DB immediately. */
  refresh: () => Promise<void>;
  /** Applies a known-good result locally (from a start/stop action's own
   * response) without waiting for the next poll, and fences off any
   * already-in-flight poll response so it can't overwrite this with stale data. */
  setLocalActiveTimer: (data: ActiveTimerData | null) => void;
}

export const ActiveTimerContext = createContext<ActiveTimerContextValue | null>(null);

export function ActiveTimerProvider({ children }: { children: React.ReactNode }) {
  const [activeTimer, setActiveTimer] = useState<ActiveTimerData | null>(null);
  const mutationIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = mutationIdRef.current;
    try {
      const res = await getActiveTimerAction();
      if (mutationIdRef.current !== requestId) return; // superseded by a local mutation
      if (res.success) {
        setActiveTimer((res.data as ActiveTimerData) || null);
      }
    } catch (err) {
      console.error("[ActiveTimerProvider] Failed to fetch active timer:", err);
    }
  }, []);

  const setLocalActiveTimer = useCallback((data: ActiveTimerData | null) => {
    mutationIdRef.current += 1;
    setActiveTimer(data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const value = React.useMemo(
    () => ({ activeTimer, refresh, setLocalActiveTimer }),
    [activeTimer, refresh, setLocalActiveTimer]
  );

  return <ActiveTimerContext.Provider value={value}>{children}</ActiveTimerContext.Provider>;
}

/** Returns null when rendered outside an ActiveTimerProvider — callers should
 * fall back to their own fetch/poll in that case. */
export function useActiveTimerContext(): ActiveTimerContextValue | null {
  return useContext(ActiveTimerContext);
}
