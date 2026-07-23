"use client";

import { useActionState } from "react";
import { Bell, BellRing, CheckCircle2 } from "lucide-react";
import { sendRemindersToTeam, type SendReminderState } from "@/features/notifications/actions/send-reminder";

type Props = {
  teamId: string;
  pendingCount: number;
};

export function SendRemindersButton({ teamId, pendingCount }: Props) {
  const [state, action, pending] = useActionState<SendReminderState, FormData>(
    sendRemindersToTeam,
    {}
  );

  // Derive display state from action result rather than using local flash state
  const wasSent = state.message === "sent" && state.sent && state.sent > 0;
  const wasSkipped =
    (state.message === "sent" && (!state.sent || state.sent === 0)) ||
    state.message === "all_reminded";

  if (wasSent) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
        <CheckCircle2 size={12} />
        {state.sent} Reminder{state.sent !== 1 ? "s" : ""} Sent
      </span>
    );
  }

  if (wasSkipped) {
    return (
      <span className="text-xs text-muted-foreground">
        Already Reminded Today
      </span>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="teamId" value={teamId} />
      <button
        type="submit"
        disabled={pending || pendingCount === 0}
        className="flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline disabled:text-muted-foreground disabled:no-underline"
      >
        {pending ? (
          <BellRing size={11} className="animate-pulse" />
        ) : (
          <Bell size={11} />
        )}
        {pending ? "Sending…" : "Send Reminders"}
      </button>
    </form>
  );
}
