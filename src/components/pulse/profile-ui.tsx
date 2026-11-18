// Shared look of the member profile (Pulse › Profile, User Management) and the Add Member page,
// so both read as the same screen.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Cover photo strip (public/images/profile-cover.jpg); the orange fallback shows while it loads. */
export function ProfileCover({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("relative h-32 bg-orange-700 bg-[url('/images/profile-cover.jpg')] bg-cover bg-[center_45%] sm:h-40", className)}>
      {/* Light tint at the top so buttons on the cover stay readable. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent" />
      {children}
    </div>
  );
}

/** Button style for actions sitting on the cover photo. */
export const PROFILE_COVER_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-md bg-black/30 px-3 text-xs font-semibold text-white backdrop-blur-xs transition-colors hover:bg-black/45";

/** White card used for every profile section. */
export const PROFILE_CARD = "rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/** Card with a "Title ———" heading. */
export function ProfileSectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={cn(PROFILE_CARD, "px-6 py-5")}>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="shrink-0 text-base font-semibold text-foreground">{title}</h2>
        <span className="h-px flex-1 bg-border" />
        {action}
      </div>
      {children}
    </section>
  );
}
