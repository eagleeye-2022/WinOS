// Result shape for the leave server actions. They return failures instead of throwing, because
// Next.js replaces a thrown Server Action error's message with a generic one in production builds —
// the user would never see "Insufficient balance" etc.

export type ActionResult<T = object> = ({ success: true } & T) | { success: false; message: string };

/** A failure whose message is safe and meant to be shown to the user. */
export class LeaveActionError extends Error {}

/**
 * Client-side: turns a failed result back into a thrown Error carrying the real message, so callers
 * can keep their existing try/catch.
 */
export function unwrap<T>(res: ActionResult<T>): { success: true } & T {
  if (!res.success) throw new Error(res.message);
  return res;
}

/** The message to show for something caught around `unwrap`. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
