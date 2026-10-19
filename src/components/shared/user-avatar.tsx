"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type AvatarUser = { id: string; name: string | null; email: string; image: string | null };

type ImageLookup = (who: { userId?: string | null; name?: string | null; email?: string | null }) => string | null;

const UserImageContext = createContext<ImageLookup>(() => null);

/**
 * Mounted once in the dashboard layout with every user that has a profile photo, so any avatar in
 * the app can show the photo from just an id, email or display name — most queries only carry the
 * owner's name, and threading `image` through each of them isn't worth it for ~40 users.
 */
export function UserAvatarProvider({ users, children }: { users: AvatarUser[]; children: React.ReactNode }) {
  const lookup = useMemo<ImageLookup>(() => {
    const byKey = new Map<string, string>();
    for (const u of users) {
      if (!u.image) continue;
      byKey.set(`id:${u.id}`, u.image);
      byKey.set(`email:${u.email.toLowerCase()}`, u.image);
      if (u.name) byKey.set(`name:${u.name.trim().toLowerCase()}`, u.image);
    }
    return ({ userId, name, email }) =>
      (userId && byKey.get(`id:${userId}`)) ||
      (email && byKey.get(`email:${email.toLowerCase()}`)) ||
      (name && byKey.get(`name:${name.trim().toLowerCase()}`)) ||
      null;
  }, [users]);
  return <UserImageContext.Provider value={lookup}>{children}</UserImageContext.Provider>;
}

/** The user's profile photo URL, or null when they have none. */
export function useUserImage(who: { userId?: string | null; name?: string | null; email?: string | null }) {
  return useContext(UserImageContext)(who);
}

/**
 * A user's avatar: their profile photo when they have one, otherwise `children` (the initials).
 * `className` styles the circle exactly like the initials badge it replaces — size, colors, ring —
 * and the photo is laid over it, so call sites keep their existing look as the fallback.
 */
export function UserAvatar({
  userId,
  name,
  email,
  image,
  className,
  title,
  children,
}: {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  /** Use this photo directly instead of looking one up. */
  image?: string | null;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const looked = useUserImage({ userId, name, email });
  const src = image || looked;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && src !== failedSrc;

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", className)}
      title={title ?? name ?? undefined}
    >
      {children}
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={name || "User"}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      )}
    </span>
  );
}
