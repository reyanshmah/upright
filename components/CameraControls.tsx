"use client";

import { STRINGS, type Lang } from "@/lib/i18n";
import type { usePoseCamera } from "@/lib/pose/usePoseCamera";

/**
 * Which camera is in use, and how to change it: flip between the back and the
 * front (selfie) camera, or cycle back lenses (wide) when the phone lists them.
 * The front camera is shown like a mirror so people testing alone can check
 * themselves on their own screen.
 */
export function CameraControls({
  cam,
  lang,
  onChange,
}: {
  cam: ReturnType<typeof usePoseCamera>;
  lang: Lang;
  /** Called before the camera changes (the caller resets anything tied to the old picture). */
  onChange?: () => void;
}) {
  const t = STRINGS[lang];
  const front = cam.facing === "user";
  return (
    <div className="stack-sm">
      <p className="camline">{front ? t.camFront : cam.camera?.wide ? t.camWide : t.camNormal}</p>
      <div className="row">
        <button
          type="button"
          className="linkish"
          onClick={() => {
            onChange?.();
            void cam.flipCamera();
          }}
        >
          {front ? t.camUseBack : t.camUseFront}
        </button>
        {!front && (
          <button
            type="button"
            className="linkish"
            onClick={() => {
              onChange?.();
              void cam.switchCamera();
            }}
          >
            {t.camSwitch}
          </button>
        )}
      </div>
    </div>
  );
}
