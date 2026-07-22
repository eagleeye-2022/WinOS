"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const MODULES = [
  {
    id: "standup",
    label: "Standup",
    href: "/dashboard",
    icon: ClipboardList,
  },
  // {
  //   id: "people",
  //   label: "People",
  //   href: "/people",
  //   icon: Users,
  // },
  // {
  //   id: "projects",
  //   label: "Projects",
  //   href: "/projects",
  //   icon: Briefcase,
  // },
  // {
  //   id: "sales",
  //   label: "Sales",
  //   href: "/sales",
  //   icon: TrendingUp,
  // },
 ] as const;

export function ModuleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  const [activeModule, setActiveModule] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mod = params.get("module");
    setTimeout(() => {
      setActiveModule(mod);
    }, 0);
  }, [pathname]);

  // Determine active module based on path or query parameter (Standup includes /notes, /dsm, /dsr, /blockers, etc.)
  let activeModuleId = "standup"; // default to standup
  if (pathname.startsWith("/people") || activeModule === "people") {
    activeModuleId = "people";
  } else if (pathname.startsWith("/projects") || activeModule === "projects") {
    activeModuleId = "projects";
  } else if (pathname.startsWith("/sales") || activeModule === "sales") {
    activeModuleId = "sales";
  }

  const handleSelect = (href: string) => {
    router.push(href);
  };

  return (
    <nav className="flex items-center gap-1 bg-muted/65 p-1 rounded-full border shadow-2xs backdrop-blur-xs select-none">
      {MODULES.map((m) => {
        const Icon = m.icon;
        const isActive = m.id === activeModuleId;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => handleSelect(m.href)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer select-none",
              isActive
                ? "bg-background text-primary shadow-xs border-border/70"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            <Icon size={13} className={isActive ? "text-primary animate-pulse" : "text-muted-foreground/60"} />
            <span>{m.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
