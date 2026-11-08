"use client";

import type { RefObject, ReactNode } from "react";
import type { Gates } from "@/lib/pose/usePoseCamera";
import type { Strings } from "@/lib/i18n";

export function CameraStage({
  videoRef,
  canvasRef,
  overlay,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  overlay?: ReactNode;
}) {
  return (
    <div className="stage">
      <video ref={videoRef} playsInline muted />
      <canvas ref={canvasRef} />
      {overlay && <div className="stage-overlay">{overlay}</div>}
    </div>
  );
}

/** Plain-language gate badges for the helper. */
export function GateBadges({ gates, t }: { gates: Gates; t: Strings }) {
  const items = [
    {
      ok: gates.bodyVisible,
      good: t.gateBodyOk,
      bad: gates.missing.length ? t.gateMissing(gates.missing.map((m) => t.parts[m])) : t.gateBodyBad,
    },
    { ok: gates.people === 1, good: t.gateOnePerson, bad: gates.people === 0 ? t.gateNoPerson : t.gateTwoPeople },
    { ok: gates.fps >= 15, good: t.gateFpsOk, bad: t.gateFpsBad },
  ];
  return (
    <ul className="gates">
      {items.map((it, i) => (
        <li key={i} className={it.ok ? "ok" : "bad"}>
          <span aria-hidden>{it.ok ? "✓" : "✗"}</span> {it.ok ? it.good : it.bad}
        </li>
      ))}
    </ul>
  );
}
