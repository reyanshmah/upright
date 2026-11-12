import type { MetadataRoute } from "next";
import { THEMES } from "@/lib/themes";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Upright",
    short_name: "Upright",
    description: "Home fall-risk screening with a phone camera, based on CDC STEADI tests.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Not locked: the TUG and chair stand film with the phone on its side.
    orientation: "any",
    background_color: THEMES["clinic-light"].bg,
    theme_color: THEMES["clinic-light"].bg,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
