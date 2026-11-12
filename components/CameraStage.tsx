"use client";

import type { RefObject, ReactNode } from "react";

export function CameraStage({
  videoRef,
  canvasRef,
  overlay,
  mirror = false,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  overlay?: ReactNode;
  /** Front camera: show it like a mirror (video and skeleton together). */
  mirror?: boolean;
}) {
  return (
    <div className={mirror ? "stage stage--mirror" : "stage"}>
      <video ref={videoRef} playsInline muted />
      <canvas ref={canvasRef} />
      {overlay && <div className="stage-overlay">{overlay}</div>}
    </div>
  );
}
