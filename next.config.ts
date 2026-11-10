import type { NextConfig } from "next";

// Classic (non-Cache-Components) model: every admin/report page reads live data per request.
const nextConfig: NextConfig = {
  // Let phones on the same Wi-Fi and HTTPS tunnels load the dev server.
  allowedDevOrigins: ["172.20.*.*", "192.168.*.*", "10.*.*.*", "*.trycloudflare.com"],
  experimental: {
    serverActions: { bodySizeLimit: "6mb" }, // photo uploads up to 5 MB
  },
};

export default nextConfig;
