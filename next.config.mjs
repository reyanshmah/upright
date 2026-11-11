import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Extra hosts allowed to load the dev server, e.g. a phone on the same Wi-Fi.
// Set ALLOWED_DEV_ORIGINS="192.168.4.45,192.168.4.46" in .env.local (see .env.example).
const extraOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [...extraOrigins, "*.local"],
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
};

export default nextConfig;
