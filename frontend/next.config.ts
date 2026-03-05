import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL || "http://localhost:3001"}/api/:path*`,
      },
      {
        source: "/healthz",
        destination: `${process.env.API_URL || "http://localhost:3001"}/healthz`,
      },
      {
        source: "/readyz",
        destination: `${process.env.API_URL || "http://localhost:3001"}/readyz`,
      },
    ];
  },
};

export default nextConfig;
