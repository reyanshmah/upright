"use client";

import { useEffect, useState, type CSSProperties, type RefObject, type ReactNode } from "react";

/**
 * The live camera with the skeleton drawn on top. The box always takes the
 * camera's own shape (read from the video each time it changes, e.g. after a
 * switch between the wide and normal lens), so the picture fills it exactly
 * and the skeleton lines up. Tall pictures are capped in height and centered.
 */
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
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const update = () => {
      if (v.videoWidth > 0 && v.videoHeight > 0) setRatio(v.videoWidth / v.videoHeight);
    };
    update();
    v.addEventListener("loadedmetadata", update);
    v.addEventListener("resize", update);
    return () => {
      v.removeEventListener("loadedmetadata", update);
      v.removeEventListener("resize", update);
    };
  }, [videoRef]);

  const style: CSSProperties | undefined = ratio
    ? { aspectRatio: String(ratio), width: `min(100%, calc(62dvh * ${ratio.toFixed(4)}))` }
    : undefined;

  return (
    <div className={mirror ? "stage stage--mirror" : "stage"} style={style}>
      <video ref={videoRef} playsInline muted />
      <canvas ref={canvasRef} />
      {overlay && <div className="stage-overlay">{overlay}</div>}
    </div>
  );
}
