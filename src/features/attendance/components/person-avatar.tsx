"use client";

import { UserAvatar } from "@/components/shared/user-avatar";

function initialsOf(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

/** A person in a Pulse list: their profile photo, or their initials — never a stock photo. */
export function PersonAvatar({ name, image, userId }: { name?: string | null; image?: string | null; userId?: string }) {
  return (
    <UserAvatar
      userId={userId}
      name={name}
      image={image}
      className="w-8 h-8 border border-input bg-primary/15 text-primary text-xs font-bold"
    >
      {initialsOf(name)}
    </UserAvatar>
  );
}
