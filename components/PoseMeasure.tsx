"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { STRINGS } from "@/lib/i18n";
import { usePoseCamera, type FrameInfo } from "@/lib/pose/usePoseCamera";
import { CameraStage } from "@/components/CameraStage";
import {
  cmToFtIn,
  distanceM,
  footX,
  measurable,
  median,
  pixelsPerMeter,
  TARGET_M,
  TOLERANCE_M,
} from "@/lib/measure";
import type { Landmark } from "@/lib/signal/types";

/**
 * Camera estimate of the 3 m line for phones without WebXR (iPhone, most
 * browsers). Uses the on-device pose model and the person's height from the
 * profile: the eye-to-heel length in pixels sets the scale, then the walked
 * distance is read from the mid-ankle position. Approximate by design.
 */

const TXT = {
  en: {
    needHeight: "Height is missing. Go back to the profile and add it, or use a tape measure.",
    start: "Start camera",
    stand: "Stand with your heels touching the front edge of the chair, facing sideways to the phone. Stand still.",
    setStart: "Set start",
    walk: "Walk slowly straight across the phone's view, sideways to the camera, away from the chair.",
    atTarget: "3 m — mark this point on the floor with something",
    tooFar: "Too far — step back slowly",
    waitBody: "Make sure the whole body, from head to heels, is in the picture and only one person is in view.",
    redo: "Redo start",
    done: "It's marked",
    exit: "Exit",
    approx: "This is a camera estimate, approximate within about 10–15 cm. A tape measure is more exact if you have one.",
    back: "←",
  },
  es: {
    needHeight: "Falta la estatura. Regrese al perfil y agréguela, o use una cinta métrica.",
    start: "Iniciar cámara",
    stand: "Párese con los talones tocando el borde delantero de la silla, de lado al teléfono. Quédese quieto/a.",
    setStart: "Fijar inicio",
    walk: "Camine despacio en línea recta de lado frente a la cámara, alejándose de la silla.",
    atTarget: "3 m — marque este punto en el piso con algo",
    tooFar: "Demasiado lejos — regrese un poco",
    waitBody: "Asegúrese de que todo el cuerpo, de la cabeza a los talones, se vea en la imagen y que solo haya una persona.",
    redo: "Repetir inicio",
    done: "Ya lo marqué",
    exit: "Salir",
    approx: "Esta es una estimación con cámara, aproximada, de unos 10–15 cm. Una cinta métrica es más exacta si la tiene.",
    back: "←",
  },
};

/** Height range the profile accepts (same as the start screen). */
const HEIGHT_MIN_CM = 120;
const HEIGHT_MAX_CM = 215;
const READOUT_MS = 150;
const SMOOTH_FRAMES = 5;

type Stage = "idle" | "stand" | "walk";

export function PoseMeasure({
  lang,
  heightCm,
  onDone,
  onBack,
}: {
  lang: Lang;
  heightCm: number;
  onDone: (measuredM: number) => void;
  onBack: () => void;
}) {
  const t = TXT[lang];
  const common = STRINGS[lang];
  const heightOk = heightCm >= HEIGHT_MIN_CM && heightCm <= HEIGHT_MAX_CM;

  const latest = useRef<FrameInfo | null>(null);
  const ppm = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const recent = useRef<number[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [ready, setReady] = useState(false);
  const [dist, setDist] = useState<number | null>(null);

  const cam = usePoseCamera((f) => {
    latest.current = f;
  });

  // Throttled UI update and distance readout while walking.
  useEffect(() => {
    if (stage === "idle") return;
    const id = window.setInterval(() => {
      const f = latest.current;
      const ok = !!f?.main && !!f && f.gatesOk && measurable(f.main);
      setReady(ok);
      if (stage === "walk" && f?.main && ppm.current && startX.current !== null) {
        recent.current.push(distanceM(startX.current, footX(f.main, f.w), ppm.current));
        if (recent.current.length > SMOOTH_FRAMES) recent.current.shift();
        setDist(median(recent.current));
      }
    }, READOUT_MS);
    return () => window.clearInterval(id);
  }, [stage]);

  // Always release the camera when leaving the screen.
  useEffect(() => () => cam.stop(), [cam.stop]);

  const begin = () => {
    setStage("stand");
    void cam.start("environment");
  };

  const setStart = () => {
    const f = latest.current;
    if (!f?.main || !measurable(f.main) || !heightOk) return;
    const lms: Landmark[] = f.main;
    const scale = pixelsPerMeter(lms, f.w, f.h, heightCm);
    if (!Number.isFinite(scale) || scale <= 0) return;
    ppm.current = scale;
    startX.current = footX(lms, f.w);
    recent.current = [];
    setDist(0);
    setStage("walk");
  };

  const redo = () => {
    ppm.current = null;
    startX.current = null;
    recent.current = [];
    setDist(null);
    setStage("stand");
  };

  const stopCamera = () => {
    cam.stop();
    ppm.current = null;
    startX.current = null;
    recent.current = [];
    setDist(null);
    setReady(false);
    setStage("idle");
  };

  const atTarget = dist !== null && Math.abs(dist - TARGET_M) <= TOLERANCE_M;
  const tooFar = dist !== null && dist > TARGET_M + TOLERANCE_M;

  if (!heightOk) {
    return (
      <section className="stack-sm">
        <div className="card card--risk">
          <p>{t.needHeight}</p>
        </div>
        <div className="row">
          <button className="btn btn--secondary" onClick={onBack}>{t.back}</button>
        </div>
      </section>
    );
  }

  const instruction =
    stage === "idle" ? t.waitBody : stage === "stand" ? t.stand : atTarget ? t.atTarget : tooFar ? t.tooFar : t.walk;

  return (
    <section className="stack-sm">
      <p className="note">{t.approx}</p>
      <p aria-live="polite">{instruction}</p>
      {cam.error && <p className="note bad">{common.camErrDenied}</p>}

      {/* Always mounted, so the camera has a video element to attach to. */}
      <CameraStage
        videoRef={cam.videoRef}
        canvasRef={cam.canvasRef}
        overlay={
          stage === "walk" && dist !== null ? (
            <p className={`ar-dist ${atTarget ? "ok" : tooFar ? "bad" : ""}`} style={{ color: atTarget ? undefined : "#fff", textShadow: "0 1px 6px #000" }}>
              {dist.toFixed(2)} m <span>({cmToFtIn(dist * 100)})</span>
            </p>
          ) : null
        }
      />

      <div className="row" style={{ flexWrap: "nowrap" }}>
        {stage === "idle" && (
          <>
            <button className="btn btn--secondary" style={{ flex: "0 0 auto" }} onClick={onBack}>{t.back}</button>
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={begin}>{t.start}</button>
          </>
        )}
        {stage === "stand" && (
          <>
            <button className="btn btn--secondary" style={{ flex: 1 }} onClick={stopCamera}>{t.exit}</button>
            <button className="btn btn--primary" style={{ flex: 1 }} disabled={!ready} onClick={setStart}>{t.setStart}</button>
          </>
        )}
        {stage === "walk" && (
          <>
            <button className="btn btn--secondary" style={{ flex: 1 }} onClick={redo}>{t.redo}</button>
            <button
              className="btn btn--primary"
              style={{ flex: 1 }}
              disabled={!atTarget}
              onClick={() => {
                const d = dist!;
                cam.stop();
                onDone(d);
              }}
            >
              {t.done}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
