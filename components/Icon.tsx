/** Small line icons, drawn in currentColor so they follow every theme. Decorative unless labelled by the caller. */
import type { ReactElement } from "react";
export type IconName =
  | "settings" | "info" | "speaker" | "back" | "lock" | "chair" | "floor" | "people" | "check" | "clock"
  | "camera" | "shield" | "doc" | "ruler" | "alert" | "plus" | "minus" | "stop";

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
  camera: (
    <>
      <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  ruler: (
    <>
      <path d="M3 15.5L15.5 3 21 8.5 8.5 21z" />
      <path d="M7 12l2 2M10 9l1.5 1.5M13 6l2 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5L21.5 20h-19z" />
      <path d="M12 10v4.5M12 17.5v.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  stop: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
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
