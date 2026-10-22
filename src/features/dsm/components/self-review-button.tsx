"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Loader2 } from "lucide-react";
import { toast } from "@/components/shared/toast";
import { selfReviewStandup } from "../actions/self-review-standup";

/**
 * "Self Review" on the member's own submitted DSM (next to ✎ Edit). One click adds a
 * "Self-Reviewed" step to the DSM's timeline; after that it shows as a done badge.
 */
export function SelfReviewButton({ entryId, selfReviewed }: { entryId: string; selfReviewed: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(selfReviewed);

  if (done) {
    return (
      <span
        className="flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success"
        title="You've reviewed this DSM yourself — your manager's review is still to come"
      >
        <CheckCircle2 size={13} />
        Self-Reviewed
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await selfReviewStandup(entryId);
          if (res.message !== "self-reviewed") {
            toast.error(res.message || "Couldn't self-review the DSM");
            return;
          }
          setDone(true);
          toast.success("DSM self-reviewed");
          router.refresh();
        })
      }
      title="Mark that you've reviewed your own DSM"
      className="flex cursor-pointer items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <ClipboardCheck size={13} />}
      {pending ? "Saving…" : "Self Review"}
    </button>
  );
}
