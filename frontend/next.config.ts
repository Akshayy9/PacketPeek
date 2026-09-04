import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16.
  // html5-qrcode is dynamically imported with ssr:false so no server-side
  // canvas polyfill is needed — an empty turbopack config is sufficient.
  turbopack: {},

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*", // Proxy to Backend
      },
    ];
  },
};

export default nextConfig;

