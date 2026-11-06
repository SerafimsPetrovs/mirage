import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// HTTPS-only headers (upgrade-insecure-requests, HSTS) only when the public site really is https —
// otherwise a local `npm start` over http (e.g. by LAN IP) would break.
const isProd = process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https://");

/**
 * Content-Security-Policy without nonces (pages stay static-friendly).
 * - scripts/styles only from our origin (+ inline that Next.js emits); eval only in dev
 * - media/images: our origin, blobs, data URIs and https (episodes may live on an external CDN)
 * - no plugins, no framing by other sites, forms only post back to us
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR lets a verification build run next to a live `npm start` without replacing its files.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
