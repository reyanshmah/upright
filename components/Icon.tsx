/** Small line icons, drawn in currentColor so they follow every theme. Decorative unless labelled by the caller. */
import type { ReactElement } from "react";
export type IconName = "settings" | "info" | "speaker" | "back" | "lock" | "chair" | "floor" | "people" | "check" | "clock";

const PATHS: Record<IconName, ReactElement> = {
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 10v4h4l5 4V6L8 10H4z" />
      <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  chair: <path d="M7 3h10v8H7zM5 13.5h14M7 13.5V21M17 13.5V21" />,
  floor: <path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3M3 19h18" />,
  people: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 20v-1a6 6 0 0 1 12 0v1" />
      <circle cx="17.5" cy="8.5" r="2.3" />
      <path d="M16.5 14a5 5 0 0 1 5 5v1" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
