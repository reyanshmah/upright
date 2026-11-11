import type { ReactNode } from "react";

export type StatusKind = "ok" | "risk" | "total" | "none";

/**
 * Every status shows an icon, a word and a color (never color alone).
 * ok: check · risk: exclamation in a triangle · total: half-filled circle · none: crossed circle.
 */
export function StatusBadge({ kind, children }: { kind: StatusKind; children: ReactNode }) {
  return (
    <div className={`badge badge--${kind}`}>
      <StatusIcon kind={kind} />
      <span>{children}</span>
    </div>
  );
}

function StatusIcon({ kind }: { kind: StatusKind }) {
  const common = {
    className: "badge__icon",
    width: "1em",
    height: "1em",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };
  switch (kind) {
    case "ok":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M7 12.5l3.2 3.2L17 9" />
        </svg>
      );
    case "risk":
      return (
        <svg {...common}>
          <path d="M12 3L2.5 20h19L12 3z" />
          <path d="M12 10v4.5" />
          <circle cx="12" cy="17.3" r="0.6" fill="currentColor" />
        </svg>
      );
    case "total":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" />
        </svg>
      );
    case "none":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
        </svg>
      );
  }
}
