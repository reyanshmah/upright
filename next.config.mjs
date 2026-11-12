import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Extra hosts allowed to load the dev server, e.g. a phone on the same Wi-Fi.
// Set ALLOWED_DEV_ORIGINS="192.168.4.45,192.168.4.46" in .env.local (see .env.example).
const extraOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

// One id per build, so the service worker starts a fresh cache for every deploy.
const buildId = (process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)).slice(0, 12);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [...extraOrigins, "*.local"],
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version, NEXT_PUBLIC_BUILD_ID: buildId },
  // Camera app: never framed by another site; only this site may use the camera and AR.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), xr-spatial-tracking=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
