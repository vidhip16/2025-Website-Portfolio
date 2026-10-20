import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// React needs 'unsafe-eval' in development only.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), gyroscope=(self), accelerometer=(self)",
  },
];

const nextConfig: NextConfig = {
  // QA builds (NEXT_PUBLIC_QA=1, window.__gaze/__dots probes) go to a separate dir.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Tailwind processes plain stylesheets only; CSS Modules (which use
      // :global()) go through Next's own CSS Modules pipeline.
      "*.css": {
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Small shared modules (Lenis, web-vitals) were being merged into every lazy
    // chunk group and downloaded several times. A lower threshold keeps them shared.
    turbopackChunking: { minChunkSize: 15000 },
    // Refuse oversized posts before parsing; the contact action's own 8 KB check is the second layer.
    serverActions: { bodySizeLimit: "64kb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 80],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
