export const ROUTES = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  dsm: "/dsm",
  dsmMy: "/dsm/my",
  dsmAll: "/dsm/all",
  dsmMember: (userId: string) => `/dsm/member/${userId}` as const,
  dsr: "/dsr",
  dsrMy: "/dsr/my",
  dsrManage: "/dsr/manage",
  dsrMember: (userId: string) => `/dsr/member/${userId}` as const,
  notes: "/notes",
  calendar: "/calendar",
  zohoCalendar: "/calendar",
  blockers: "/blockers",
  support: "/support",
  needsHelp: "/needs-help",
  settingsUsers: "/settings/users",
  settingsProfileAccess: "/settings/profile-access",
} as const;

export const PUBLIC_ROUTES: string[] = [ROUTES.login];
