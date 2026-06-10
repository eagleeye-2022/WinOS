export const ROUTES = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  dsm: "/dsm",
  dsmMy: "/dsm/my",
  dsmAll: "/dsm/all",
  dsmMember: (userId: string) => `/dsm/member/${userId}` as const,
  dsr: "/dsr",
  dsrManage: "/dsr/manage",
  dsrMember: (userId: string) => `/dsr/member/${userId}` as const,
  notes: "/notes",
  blockers: "/blockers",
  support: "/support",
  needsHelp: "/needs-help",
} as const;

export const PUBLIC_ROUTES: string[] = [ROUTES.login];
