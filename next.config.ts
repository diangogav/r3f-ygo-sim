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
  outputFileTracingIncludes: {
    "/api/loadDeck": [
      "./ignisdata/scripts/*.lua",
      "./ignisdata/scripts/official/*.lua",
      "./ignisdata/cdb/cards.lua",
      "./ignisdata/dist/config/strings.conf",
      "./ignisdata/delta/strings.conf",
    ],
  },
} satisfies NextConfig;
