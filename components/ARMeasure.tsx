"use client";

/// <reference types="webxr" />
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/i18n";
import { cmToFtIn } from "@/lib/measure";

/**
 * Measures the 3 m line with the phone's AR (WebXR hit-test, backed by ARCore
 * on Android Chrome). ARCore finds the floor plane and returns real-world
 * points in meters, so no person, height or camera specs are needed.
 *
 * The hit-test ray comes from the center of the screen, so a fixed CSS
 * crosshair in the middle of the DOM overlay marks exactly where the floor
 * point is. Nothing is drawn in 3D.
 */

export const TARGET_M = 3;
const TOL_M = 0.03;

type ARState = "checking" | "unsupported" | "ready" | "running" | "error";
type Stage = "findFloor" | "setStart" | "walk";

const TXT = {
  en: {
    unsupportedTitle: "AR measuring isn't available on this phone/browser",
    unsupportedBody:
      "It needs Chrome on an Android phone with Google Play Services for AR. On an iPhone, open Apple's built-in Measure app, or use a tape measure: 3 m = 9 ft 10 in.",
    intro:
      "Your phone's AR finds the floor and measures it in meters, usually within a few centimeters. Good light and a floor with some texture help.",
    start: "Start AR measuring",
    findFloor: "Slowly move the phone side to side, pointing at the floor, until the crosshair turns green.",
    setStartHelp: "Point the crosshair at the floor right under the FRONT edge of the chair seat, then tap Set start.",
    setStart: "Set start",
    walk: "Walk away from the chair in a straight line, keeping the crosshair on the floor ahead of you.",
    atTarget: "3 m — mark this point on the floor with something",
    tooFar: "Too far — move back a little",
    done: "It's marked",
    redoStart: "Redo start",
    exit: "Exit",
    noFloor: "Looking for the floor…",
    error: "AR could not start:",
  },
  es: {
    unsupportedTitle: "La medición con realidad aumentada no está disponible en este teléfono/navegador",
    unsupportedBody:
      "Necesita Chrome en un teléfono Android con Servicios de Google Play para RA. En iPhone, abra la app Medidas de Apple, o use una cinta métrica: 3 m = 9 pies 10 pulgadas.",
    intro:
      "La realidad aumentada del teléfono encuentra el piso y lo mide en metros, normalmente con unos pocos centímetros de error. Ayuda tener buena luz y un piso con algo de textura.",
    start: "Empezar a medir con RA",
    findFloor: "Mueva el teléfono despacio de lado a lado, apuntando al piso, hasta que la mira se ponga verde.",
    setStartHelp: "Apunte la mira al piso justo debajo del borde DELANTERO del asiento y toque Fijar inicio.",
    setStart: "Fijar inicio",
    walk: "Aléjese de la silla en línea recta, manteniendo la mira en el piso delante de usted.",
    atTarget: "3 m — marque este punto en el piso con algo",
    tooFar: "Demasiado lejos — regrese un poco",
    done: "Ya lo marqué",
    redoStart: "Repetir inicio",
    exit: "Salir",
    noFloor: "Buscando el piso…",
    error: "No se pudo iniciar la RA:",
  },
};

export function ARMeasure({
  lang,
  onDone,
  onBack,
}: {
  lang: Lang;
  onDone: (measuredM: number) => void;
  onBack: () => void;
}) {
  const t = TXT[lang];
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<XRSession | null>(null);
  const curPoint = useRef<DOMPointReadOnly | null>(null);
  const startPoint = useRef<DOMPointReadOnly | null>(null);
  const buzzed = useRef(false);
  const [ar, setAr] = useState<ARState>("checking");
  const [err, setErr] = useState<string | null>(null);
  const [hasFloor, setHasFloor] = useState(false);
  const [stage, setStage] = useState<Stage>("findFloor");
  const [dist, setDist] = useState<number | null>(null);
  const stageRef = useRef<Stage>("findFloor");
  stageRef.current = stage;

  useEffect(() => {
    const xr = typeof navigator !== "undefined" ? navigator.xr : undefined;
    if (!xr) {
      setAr("unsupported");
      return;
    }
    xr.isSessionSupported("immersive-ar")
      .then((ok) => setAr(ok ? "ready" : "unsupported"))
      .catch(() => setAr("unsupported"));
    return () => {
      void sessionRef.current?.end().catch(() => undefined);
    };
  }, []);

  const end = () => {
    void sessionRef.current?.end().catch(() => undefined);
  };

  const begin = async () => {
    setErr(null);
    try {
      const xr = navigator.xr!;
      const session = await xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test", "local"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: { root: overlayRef.current! },
      });
      sessionRef.current = session;
      if (!session.domOverlayState) {
        await session.end();
        throw new Error("this browser can't show the on-screen controls in AR");
      }

      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl", { xrCompatible: true, alpha: true }) as WebGLRenderingContext;
      await session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
      const refSpace = await session.requestReferenceSpace("local");
      const viewer = await session.requestReferenceSpace("viewer");
      const hitSource = await session.requestHitTestSource!({ space: viewer });

      // Taps on overlay buttons shouldn't also fire AR "select".
      overlayRef.current!.addEventListener("beforexrselect", (e) => e.preventDefault());

      setStage("findFloor");
      setDist(null);
      setHasFloor(false);
      startPoint.current = null;
      buzzed.current = false;
      setAr("running");

      let lastUi = 0;
      const onFrame: XRFrameRequestCallback = (time, frame) => {
        const layer = session.renderState.baseLayer!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const hits = hitSource ? frame.getHitTestResults(hitSource) : [];
        const pose = hits[0]?.getPose(refSpace);
        curPoint.current = pose ? pose.transform.position : null;

        if (time - lastUi > 66) {
          lastUi = time;
          setHasFloor(!!pose);
          if (pose && stageRef.current === "findFloor") setStage("setStart");
          const a = startPoint.current;
          const p = curPoint.current;
          if (a && p) {
            // Horizontal distance on the floor (y is up in WebXR).
            const d = Math.hypot(p.x - a.x, p.z - a.z);
            setDist(d);
            const at = Math.abs(d - TARGET_M) <= TOL_M;
            if (at && !buzzed.current) {
              buzzed.current = true;
              navigator.vibrate?.(200);
            }
            if (d < TARGET_M - 0.2) buzzed.current = false;
          }
        }
        session.requestAnimationFrame(onFrame);
      };
      session.requestAnimationFrame(onFrame);
      session.addEventListener("end", () => {
        hitSource?.cancel();
        sessionRef.current = null;
        setAr("ready");
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setAr("error");
    }
  };

  const setStart = () => {
    if (!curPoint.current) return;
    startPoint.current = curPoint.current;
    buzzed.current = false;
    setDist(0);
    setStage("walk");
  };

  const atTarget = dist !== null && Math.abs(dist - TARGET_M) <= TOL_M;
  const tooFar = dist !== null && dist > TARGET_M + TOL_M;

  return (
    <section>
      {ar === "unsupported" && (
        <div className="card card--risk">
          <p className="big">{t.unsupportedTitle}</p>
          <p>{t.unsupportedBody}</p>
        </div>
      )}
      {(ar === "ready" || ar === "error" || ar === "checking") && (
        <>
          <p>{t.intro}</p>
          {err && <p className="note bad">{t.error} {err}</p>}
          <button className="btn btn--primary" disabled={ar === "checking"} onClick={begin}>{t.start}</button>
        </>
      )}
      <div className="row nav">
        <button className="btn btn--secondary" onClick={onBack}>←</button>
      </div>

      {/* DOM overlay shown on top of the AR camera view */}
      <div ref={overlayRef} className={`ar-overlay ${ar === "running" ? "on" : ""}`}>
        <div className={`ar-cross ${hasFloor ? (atTarget ? "target" : "floor") : ""}`} />
        <div className="ar-top">
          {stage === "findFloor" && <p>{hasFloor ? "" : t.noFloor} {t.findFloor}</p>}
          {stage === "setStart" && <p>{t.setStartHelp}</p>}
          {stage === "walk" && <p>{atTarget ? t.atTarget : tooFar ? t.tooFar : t.walk}</p>}
          {stage === "walk" && dist !== null && (
            <p className={`ar-dist ${atTarget ? "ok" : tooFar ? "bad" : ""}`}>
              {dist.toFixed(2)} m <span>({cmToFtIn(dist * 100)})</span>
            </p>
          )}
        </div>
        <div className="ar-bottom">
          <button className="btn btn--secondary" onClick={end}>{t.exit}</button>
          {stage !== "walk" ? (
            <button className="btn btn--primary" disabled={!hasFloor} onClick={setStart}>{t.setStart}</button>
          ) : (
            <>
              <button className="btn btn--secondary" onClick={() => { startPoint.current = null; setDist(null); setStage("setStart"); }}>
                {t.redoStart}
              </button>
              <button
                className="btn btn--primary"
                disabled={!atTarget}
                onClick={() => {
                  const d = dist!;
                  end();
                  onDone(d);
                }}
              >
                {t.done}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
