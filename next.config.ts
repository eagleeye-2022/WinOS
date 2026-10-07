import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

