"use client";

import type { RefObject, ReactNode } from "react";

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
