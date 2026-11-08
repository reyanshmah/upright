/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a phone on the same Wi-Fi load the dev server (npm run dev:https).
  // Add your laptop's current Wi-Fi IP here if it changes.
  allowedDevOrigins: ["192.168.4.45", "*.local"],
};

export default nextConfig;
