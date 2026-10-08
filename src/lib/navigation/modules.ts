// Single registry of top-level WinOS modules (the pills in the header ModuleSwitcher).
// Adding a module here is all that's needed for it to get per-module navigation-state
// persistence (last URL, scroll restore, reset) — see NavigationStateTracker.

export type NavModuleId = "standup" | "people" | "projects" | "users" | "sales";

export interface NavModule {
  id: NavModuleId;
  /** UI label (product name). */
  label: string;
  /** Default landing route — the module's "home" view. */
  homeHref: string;
  /** Key checked against the module-access matrix (see getMyModuleAccessAction). */
  moduleKey: string;
  /** Path prefixes owned by this module. */
  prefixes: readonly string[];
  /** Values of the `?module=` query param that pin a shared route (e.g. /calendar) to this module. */
  moduleParams: readonly string[];
}

export const NAV_MODULES: readonly NavModule[] = [
  {
    id: "standup",
    label: "Standup",
    homeHref: "/dashboard",
    moduleKey: "STANDUP",
    // Everything not claimed by another module also falls back to Standup (see resolveNavModule).
    prefixes: ["/dashboard", "/dsm", "/report", "/notes", "/calendar", "/blockers", "/support", "/needs-help"],
    moduleParams: ["standup"],
  },
  {
    id: "people",
    label: "Pulse",
    homeHref: "/pulse/leave",
    moduleKey: "PEOPLE",
    prefixes: ["/pulse", "/people", "/leave"],
    moduleParams: ["people", "pulse"],
  },
  {
    id: "projects",
    label: "Srijan",
    homeHref: "/projects",
    moduleKey: "PROJECTS",
    prefixes: ["/projects"],
    moduleParams: ["projects"],
  },
  {
    id: "users",
    label: "User Management",
    homeHref: "/settings/users",
    moduleKey: "USER_MANAGEMENT",
    prefixes: ["/settings"],
    moduleParams: ["users", "settings"],
  },
];

/** Modules shown in the header switcher (Sales is registered for routing but not yet exposed). */
export const SWITCHER_MODULE_IDS: readonly NavModuleId[] = ["standup", "people", "projects", "users"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Which module a URL belongs to. An explicit `?module=` wins (shared routes like /calendar are
 * linked from several modules); otherwise the path prefix decides; unknown paths are Standup.
 */
export function resolveNavModule(pathname: string, search: string | URLSearchParams = ""): NavModuleId {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const moduleParam = params.get("module");
  if (moduleParam) {
    const pinned = NAV_MODULES.find((m) => m.moduleParams.includes(moduleParam));
    if (pinned) return pinned.id;
  }
  if (matchesPrefix(pathname, "/sales")) return "sales";
  const owner = NAV_MODULES.find((m) => m.id !== "standup" && m.prefixes.some((p) => matchesPrefix(pathname, p)));
  return owner?.id ?? "standup";
}

export function getNavModule(id: NavModuleId): NavModule | undefined {
  return NAV_MODULES.find((m) => m.id === id);
}

/** pathname + search (without a trailing "?"), the key used for per-URL state like scroll. */
export function toUrlKey(pathname: string, search: string | URLSearchParams = ""): string {
  const s = typeof search === "string" ? search.replace(/^\?/, "") : search.toString();
  return s ? `${pathname}?${s}` : pathname;
}
