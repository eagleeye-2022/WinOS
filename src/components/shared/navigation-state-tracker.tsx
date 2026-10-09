"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { resolveNavModule, toUrlKey, type NavModuleId } from "@/lib/navigation/modules";
import { restoreScroll, snapshotScroll } from "@/lib/navigation/scroll-restore";
import { useNavigationStore } from "@/stores/navigation-store";

export const NAV_ROOT_ATTR = "data-nav-root";

/**
 * Layout-level half of global navigation-state persistence (mounted once in the dashboard
 * layout, so every module and every future sub-page gets it for free):
 *  - records the current URL as its module's `lastUrl` (the ModuleSwitcher returns there);
 *  - tracks scroll offsets of containers inside <main data-nav-root> per URL;
 *  - restores those offsets when re-entering a module from another one, or on Back/Forward.
 * View state itself (open record, tab, filters) is already in the URL, so returning to the
 * remembered URL restores it.
 */
export function NavigationStateTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const urlKey = toUrlKey(pathname, search);
  const moduleId = resolveNavModule(pathname, search);

  const recordUrl = useNavigationStore((s) => s.recordUrl);
  const saveScroll = useNavigationStore((s) => s.saveScroll);

  const prevModuleRef = useRef<NavModuleId | null>(null);
  const popRef = useRef(false);
  const restoringRef = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popRef.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Remember the URL and, when re-entering a module or going Back/Forward, restore scroll.
  useEffect(() => {
    recordUrl(moduleId, urlKey);

    const prevModule = prevModuleRef.current;
    const reEntered = prevModule !== null && prevModule !== moduleId;
    const viaHistory = popRef.current;
    prevModuleRef.current = moduleId;
    popRef.current = false;

    const root = document.querySelector(`[${NAV_ROOT_ATTR}]`);
    const saved = useNavigationStore.getState().modules[moduleId]?.scroll[urlKey];
    if (!root || !saved?.length || !(reEntered || viaHistory)) return;

    restoringRef.current = true;
    const cancel = restoreScroll(root, saved, {
      onDone: () => {
        restoringRef.current = false;
      },
    });
    return () => {
      cancel();
      restoringRef.current = false;
    };
  }, [moduleId, urlKey, recordUrl]);

  // Track scroll offsets for the current URL.
  useEffect(() => {
    const root = document.querySelector(`[${NAV_ROOT_ATTR}]`);
    if (!root) return;
    const scrolled = new Set<Element>();
    let frame = 0;

    const flush = () => {
      frame = 0;
      if (restoringRef.current) return; // don't overwrite the target with mid-restore offsets
      saveScroll(moduleId, urlKey, snapshotScroll(scrolled, root));
    };
    const onScroll = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Element) || !root.contains(target)) return;
      scrolled.add(target);
      if (!frame) frame = requestAnimationFrame(flush);
    };

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      cancelAnimationFrame(frame);
    };
  }, [moduleId, urlKey, saveScroll]);

  return null;
}
