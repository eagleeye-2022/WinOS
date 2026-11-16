"use client";

// Phone / small-tablet navigation: below the `md` breakpoint the sidebar is hidden and opens as a
// slide-in drawer from the ☰ button in the top bar. At `md` and up nothing here renders and the
// sidebar sits in its usual column, so the desktop layout is unchanged.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MobileNavContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Following a link closes the drawer.
  useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams]);

  // Escape closes it; the page behind doesn't scroll while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return <MobileNavContext.Provider value={{ open, setOpen }}>{children}</MobileNavContext.Provider>;
}

/** ☰ button for the top bar (phones only). */
export function MobileNavToggle({ className }: { className?: string }) {
  const ctx = useContext(MobileNavContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      aria-label={ctx.open ? "Close menu" : "Open menu"}
      aria-expanded={ctx.open}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent md:hidden",
        className
      )}
    >
      {ctx.open ? <X size={20} /> : <Menu size={20} />}
    </button>
  );
}

/**
 * Holds the sidebar: a fixed column at `md` and up, a slide-in drawer (with a dimmed backdrop)
 * below it. The sidebar itself is rendered once.
 */
export function MobileNavDrawer({ children }: { children: ReactNode }) {
  const ctx = useContext(MobileNavContext);
  const open = Boolean(ctx?.open);
  return (
    <>
      {/* Backdrop (phones only) */}
      <div
        aria-hidden
        onClick={() => ctx?.setOpen(false)}
        className={cn(
          "fixed inset-0 top-14 z-40 bg-black/40 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <div
        className={cn(
          // Phones: off-canvas panel under the top bar.
          "fixed bottom-0 left-0 top-14 z-40 w-64 max-w-[85vw] shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          // md+: the usual sidebar column.
          "md:static md:z-auto md:h-full md:w-56 md:max-w-none md:shrink-0 md:translate-x-0 md:shadow-none md:transition-none",
          "[&>aside]:w-full"
        )}
      >
        {children}
      </div>
    </>
  );
}
