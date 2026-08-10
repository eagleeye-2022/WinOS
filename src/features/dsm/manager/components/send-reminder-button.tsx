"use client";

import { useActionState } from "react";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { sendReminderToUser, type SendReminderState } from "@/features/notifications/actions/send-reminder";

type Props = {
  userId: string;
  teamId: string;
};

export function SendReminderButton({ userId, teamId }: Props) {
  const [state, action, pending] = useActionState<SendReminderState, FormData>(
    sendReminderToUser,
    {}
  );

  const wasSent = state.message === "sent" && (state.sent ?? 0) > 0;
  const wasSkipped = state.message === "already_reminded" || state.message === "already_submitted";

  if (wasSent) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-success">
        <CheckCircle2 size={12} />
        Reminder Sent
      </span>
    );
  }

  if (wasSkipped) {
    return (
      <span className="text-xs text-muted-foreground">
        {state.message === "already_submitted" ? "Just Submitted" : "Already Reminded"}
      </span>
    );
  }

  return (
    <form action={action} onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="teamId" value={teamId} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning transition-colors hover:bg-warning/20 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <Bell size={11} />
        )}
        {pending ? "Sending…" : "Send Reminder"}
      </button>
    </form>
  );
}
