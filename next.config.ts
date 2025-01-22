import { NextConfig } from "next";

export default {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.ygoprog.com" },
      { protocol: "https", hostname: "ygoprodeck.com" },
      { protocol: "https", hostname: "images.ygoprodeck.com" },
      { protocol: "https", hostname: "ms.yugipedia.com" },
    ],
  },
} satisfies NextConfig;
