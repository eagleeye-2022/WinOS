/**
 * Safety net for stopped timers. Stop deletes the DB ActiveTimer immediately, and the real
 * ProjectTimeLog is only created when the user confirms the "Timer stopped" modal — so a refresh,
 * closed tab, navigation, or failed save in between used to lose that time. Every Stop now parks
 * the stopped timer here (browser localStorage) until it's saved or explicitly discarded, and
 * <PendingTimerLogRecovery /> re-opens the modal for anything left behind.
 */

export interface PendingTimerLog {
  projectId: string;
  taskId: string;
  taskCode?: string;
  taskTitle?: string;
  startedAt: string;
  endedAt: string;
  elapsedSeconds: number;
  /** Who stopped it — so a different user on the same browser never sees/logs it. */
  userId?: string | null;
}

const PENDING_KEY = "winos:pendingTimerLog";
const USER_KEY = "winos:currentUserId";
/** Fired when a pending log needs the recovery modal right now (e.g. a save just failed). */
export const PENDING_TIMER_LOG_EVENT = "winos:pending-timer-log";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function setCurrentTimerUserId(userId: string) {
  try {
    storage()?.setItem(USER_KEY, userId);
  } catch {
    /* storage unavailable — recovery just won't work in this browser */
  }
}

export function savePendingTimerLog(log: Omit<PendingTimerLog, "userId">) {
  try {
    const userId = storage()?.getItem(USER_KEY) ?? null;
    storage()?.setItem(PENDING_KEY, JSON.stringify({ ...log, userId }));
  } catch {
    /* ignore */
  }
}

export function readPendingTimerLog(): PendingTimerLog | null {
  try {
    const raw = storage()?.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingTimerLog) : null;
  } catch {
    return null;
  }
}

export function clearPendingTimerLog() {
  try {
    storage()?.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** Asks the mounted <PendingTimerLogRecovery /> to show the modal for the parked log now. */
export function requestPendingTimerLogRecovery() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PENDING_TIMER_LOG_EVENT));
  }
}
