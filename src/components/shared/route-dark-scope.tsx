"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type RouteDarkScopeProps = {
  match: string;
  children: React.ReactNode;
};

// Applies `.dsm-scope` (see globals.css `.dark .dsm-scope`) to shared chrome —
// header, sidebar — only while the current route is under `match`. Uses
// `display: contents` so the wrapper never affects flex/box layout.
export function RouteDarkScope({ match, children }: RouteDarkScopeProps) {
  const pathname = usePathname();
  const active = !match || pathname.startsWith(match);

  return <div className={cn("contents", "dsm-scope")}>{children}</div>;
}
