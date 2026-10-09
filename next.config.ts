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
    ];
  },
};

export default nextConfig;

