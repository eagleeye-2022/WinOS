import type { NextConfig } from "next";

/** One redirect per old `<source>?tab=<value>` link to that tab's own path. */
function pulseTabRedirect(source: string, tabs: Record<string, string>) {
  return Object.entries(tabs).map(([tab, destination]) => ({
    source,
    has: [{ type: "query" as const, key: "tab", value: tab }],
    destination,
    permanent: false,
  }));
}

const nextConfig: NextConfig = {
  // The flag route reads SVG files at runtime (fs), which the tracer can't see — ship them.
  outputFileTracingIncludes: {
    "/api/flags/*": ["./scripts/data/locations/flags/**/*"],
  },
  async redirects() {
    return [
      {
        source: "/calander",
        destination: "/calendar",
        permanent: true,
      },
      {
        source: "/calender",
        destination: "/calendar",
        permanent: true,
      },
      // End-of-day DSR was renamed to Reporting — keep old links/bookmarks working.
      { source: "/dsr", destination: "/report", permanent: false },
      { source: "/dsr/manage", destination: "/report/all", permanent: false },
      { source: "/dsr/:path*", destination: "/report/:path*", permanent: false },
      // The "Sales" placeholder module became Setu (BNI networking).
      { source: "/sales", destination: "/setu/121-meetings", permanent: false },
      // The sales-CRM list pages Setu had before the BNI restructure.
      { source: "/setu/tasks", destination: "/setu/pipeline", permanent: false },
      { source: "/setu/leads", destination: "/setu/pipeline", permanent: false },
      { source: "/setu/deals", destination: "/setu/pipeline", permanent: false },
      { source: "/setu/dashboard", destination: "/setu/pipeline", permanent: false },
      { source: "/setu/forecast", destination: "/setu/pipeline", permanent: false },
      { source: "/setu/activities", destination: "/setu/121-meetings", permanent: false },
      { source: "/setu/calls", destination: "/setu/121-meetings", permanent: false },
      { source: "/setu/meetings", destination: "/setu/121-meetings", permanent: false },
      // Pulse opens on its Home page, which moved from /people/home.
      { source: "/pulse", destination: "/pulse/home", permanent: false },
      { source: "/people/home", destination: "/pulse/home", permanent: false },
      // Pulse split into personal (/pulse/my/…) and team (/pulse/team/…) pages, each tab its own
      // path. Old links (bookmarks, notifications already sent) land on the same view. Rules with a
      // `?tab=` come first; the catch-alls (`:path*` also matches nothing) last.
      ...pulseTabRedirect("/pulse/leave/team", {
        "leave-requests": "/pulse/team/leaves/requests",
        "employee-leave": "/pulse/team/leaves/employee",
        "compensatory-requests": "/pulse/team/leaves/compensatory",
        "team-calendar": "/pulse/team/leaves/calendar",
        holidays: "/pulse/team/leaves/holidays",
        "leave-policy": "/pulse/team/leaves/policy",
      }),
      ...pulseTabRedirect("/pulse/leave", {
        overview: "/pulse/my/leaves",
        requests: "/pulse/my/leaves/requests",
        compensatory: "/pulse/my/leaves/compensatory",
        holidays: "/pulse/my/leaves/holidays",
      }),
      ...pulseTabRedirect("/pulse/attendance", {
        "my-attendance": "/pulse/my/attendance",
        regularization: "/pulse/my/attendance/regularization",
        "team-attendance": "/pulse/team/attendance",
      }),
      ...pulseTabRedirect("/pulse/team-attendance", {
        "team-attendance": "/pulse/team/attendance",
        regularization: "/pulse/team/attendance/regularization",
      }),
      { source: "/pulse/leave/team/:path*", destination: "/pulse/team/leaves/:path*", permanent: false },
      { source: "/pulse/leave/policy/:path*", destination: "/pulse/team/leaves/policy/:path*", permanent: false },
      { source: "/pulse/leave/adjust", destination: "/pulse/team/leaves/adjust", permanent: false },
      { source: "/pulse/leave/employee/:path*", destination: "/pulse/team/leaves/employee/:path*", permanent: false },
      { source: "/pulse/leave/:path*", destination: "/pulse/my/leaves/:path*", permanent: false },
      { source: "/pulse/regularization", destination: "/pulse/my/attendance/regularization", permanent: false },
      { source: "/pulse/attendance", destination: "/pulse/my/attendance", permanent: false },
      { source: "/pulse/team-attendance/:path*", destination: "/pulse/team/attendance/:path*", permanent: false },
    ];
  },
};

export default nextConfig;

