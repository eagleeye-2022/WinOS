"use client";

import { cn } from "@/lib/utils";
import { getAvatarColor, getInitials } from "@/lib/avatar";
import { UserAvatar } from "./user-avatar";

export type StackPerson = { id?: string | null; name: string; email?: string | null; image?: string | null };

/**
 * Overlapping avatar group: the first `max` people as profile photos (initials when they have
 * none), then a "+N" circle for the rest — e.g. 🧑🧑🧑(+99).
 */
export function AvatarStack({
  people,
  max = 3,
  size = "h-6 w-6",
  className,
}: {
  people: StackPerson[];
  max?: number;
  /** Tailwind size of each circle. */
  size?: string;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span className={cn("flex shrink-0 items-center", className)}>
      {shown.map((p, i) => (
        <UserAvatar
          key={p.id || `${p.name}-${i}`}
          userId={p.id}
          name={p.name}
          email={p.email}
          image={p.image}
          className={cn(
            size,
            "text-xs font-bold ring-2 ring-background shadow-2xs",
            i > 0 && "-ml-2",
            getAvatarColor(p.name)
          )}
        >
          {getInitials(p.name)}
        </UserAvatar>
      ))}
      {rest > 0 && (
        <span
          className={cn(
            size,
            "-ml-2 flex w-auto min-w-6 items-center justify-center rounded-full bg-slate-700 px-1 text-xs font-semibold leading-none text-white ring-2 ring-background dark:bg-slate-600"
          )}
          title={people
            .slice(max)
            .map((p) => p.name)
            .join(", ")}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
