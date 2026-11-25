import type { NextConfig } from "next";

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
    ];
  },
};

export default nextConfig;

