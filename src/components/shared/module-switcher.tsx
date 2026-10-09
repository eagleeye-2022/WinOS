"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NAV_MODULES,
  SWITCHER_MODULE_IDS,
  resolveNavModule,
  toUrlKey,
  type NavModule,
} from "@/lib/navigation/modules";
import { useNavigationStore } from "@/stores/navigation-store";

const SWITCHER_MODULES = NAV_MODULES.filter((m) => SWITCHER_MODULE_IDS.includes(m.id));

interface ModuleSwitcherProps {
  access?: Record<string, boolean>;
  isManager?: boolean;
}

export function ModuleSwitcher({ access, isManager }: ModuleSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const lastUrls = useNavigationStore((s) => s.modules);
  const resetModule = useNavigationStore((s) => s.resetModule);

  const visibleModules = SWITCHER_MODULES.filter(
    (m) => isManager || !access || access[m.moduleKey] !== false
  );
  const activeModuleId = resolveNavModule(pathname, searchParams);
  const activeModule = NAV_MODULES.find((m) => m.id === activeModuleId);
  const currentUrl = toUrlKey(pathname, searchParams);

  const goHome = (m: NavModule) => {
    resetModule(m.id);
    router.push(m.homeHref);
  };

  const handleSelect = (m: NavModule) => {
    // Clicking the module you're already in acts as its "Home" — back to the default view.
    if (m.id === activeModuleId) {
      if (currentUrl !== m.homeHref) goHome(m);
      return;
    }
    // Otherwise return to wherever the user left off in that module (in-memory, this tab only).
    router.push(lastUrls[m.id]?.lastUrl ?? m.homeHref);
  };

  const canReset = Boolean(activeModule) && currentUrl !== activeModule?.homeHref;

  return (
    <div className="flex items-center gap-1">
      <nav className="flex items-center gap-1 bg-muted/65 p-1 rounded-full border shadow-2xs backdrop-blur-xs select-none">
        {visibleModules.map((m) => {
          const isActive = m.id === activeModuleId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSelect(m)}
              title={isActive ? `${m.label} home` : m.label}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none",
                isActive
                  ? "bg-background text-primary shadow-xs border-border/70"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              )}
            >
              <span>{m.label}</span>
            </button>
          );
        })}
      </nav>
      {canReset && activeModule && (
        <button
          type="button"
          onClick={() => goHome(activeModule)}
          aria-label="Reset view"
          title={`Reset view — back to ${activeModule.label} home`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
        >
          <RotateCcw size={13} />
        </button>
      )}
    </div>
  );
}
