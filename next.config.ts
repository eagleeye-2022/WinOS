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
      // The "Sales" placeholder module became Setu (sales CRM).
      { source: "/sales", destination: "/setu/tasks", permanent: false },
      // Old Setu (BNI) tabs that no longer exist land on the Tasks board.
      { source: "/setu/pipeline", destination: "/setu/tasks", permanent: false },
      { source: "/setu/referrals", destination: "/setu/tasks", permanent: false },
      { source: "/setu/whatsapp-bot", destination: "/setu/tasks", permanent: false },
      // Pulse opens on its Home page, which moved from /people/home.
      { source: "/pulse", destination: "/pulse/home", permanent: false },
      { source: "/people/home", destination: "/pulse/home", permanent: false },
    ];
  },
};

export default nextConfig;

