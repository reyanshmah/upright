"use client";

import { useId, type ReactNode } from "react";
import { STRINGS, type Lang } from "../lib/i18n";

/**
 * Setup diagrams, drawn from the theme tokens so every color theme works.
 *
 *  measure: top view of a tape measure laid 3 m out from the chair seat to the tape mark.
 *  tug:     top view of the whole Timed Up and Go layout: seated person, the route out,
 *           the turn at the mark and back (numbered like the instruction list), and the
 *           phone on a stand to the side with its camera view covering chair and mark.
 *  chair:   top view of chair + phone, plus a side view: arms crossed, 17 in seat
 *           (CDC form), phone at hip height.
 *
 * Plan drawings are not to scale; the numbers are.
 */
export function SetupDiagram({ kind, lang }: { kind: "tug" | "chair" | "measure"; lang: Lang }) {
  const t = STRINGS[lang];
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = { hatch: `${uid}-hatch`, ink: `${uid}-arrow-ink`, act: `${uid}-arrow-act` };
  const H = kind === "measure" ? 200 : 280;
  const alt = kind === "tug" ? t.diaAltTug : kind === "chair" ? t.diaAltChair : t.diaAltMeasure;

  return (
    <svg className="diagram" viewBox={`0 0 360 ${H}`} role="img" aria-label={alt} fontFamily="inherit">
      <defs>
        <pattern id={ids.hatch} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" style={{ fill: "var(--line)" }} />
          <line x1="0" y1="0" x2="0" y2="8" style={{ stroke: "var(--ink-2)" }} strokeWidth="2" opacity="0.45" />
        </pattern>
        <marker id={ids.ink} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 1 L10 5 L0 9 z" style={{ fill: "var(--ink)" }} />
        </marker>
        <marker id={ids.act} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" style={{ fill: "var(--act)" }} />
        </marker>
      </defs>

      <Floor h={H} />

      {kind === "tug" && <CameraView apex={[194, 222]} left={[6, 48]} right={[354, 48]} />}
      {kind === "chair" && <CameraView apex={[70, 222]} left={[0, 56]} right={[150, 56]} />}

      {/* wall */}
      <rect x="0" y="0" width="16" height={H} fill={`url(#${ids.hatch})`} />
      <Label x={9} y={kind === "measure" ? 186 : 266} size={12} anchor="start" rotate muted>
        {t.diaWall}
      </Label>

      <Chair />
      {kind !== "measure" && <SeatedPerson />}
      <Label x={46} y={172} size={14}>
        {t.diaChair}
      </Label>

      {(kind === "tug" || kind === "measure") && (
        <>
          {/* 3 m from the front edge of the seat to the mark */}
          <Dimension x1={74} x2={314} y={kind === "measure" ? 50 : 52} from={88} marker={ids.ink} label="3 m (10 ft)" />
          <TapeMark x={309} />
          <Label x={314} y={172} size={14} weight={700}>
            {t.diaMark}
          </Label>
        </>
      )}

      {kind === "measure" && <TapeMeasure label={t.diaTape} />}

      {kind === "tug" && (
        <>
          {/* the route: out to the mark, turn, back to the chair */}
          <path d="M96 108 H270" style={{ stroke: "var(--act)" }} strokeWidth="3" strokeDasharray="8 6" fill="none" markerEnd={`url(#${ids.act})`} />
          <path
            d="M276 108 H290 A12 12 0 0 1 290 132 H104"
            style={{ stroke: "var(--act)" }}
            strokeWidth="3"
            strokeDasharray="8 6"
            fill="none"
            markerEnd={`url(#${ids.act})`}
          />
          {/* numbers match the instruction list under the diagram */}
          <StepDot x={46} y={196} n={1} />
          <StepDot x={102} y={86} n={2} />
          <StepDot x={190} y={86} n={3} />
          <StepDot x={278} y={86} n={4} />
          <StepDot x={190} y={154} n={5} />
          <VerticalDimension x={250} y1={140} y2={214} marker={ids.ink} label="2–3 m" side="left" />
          <PhoneOnStand x={194} y={226} />
          <Label x={194} y={272} size={14} weight={700}>
            {t.diaPhone}
          </Label>
          <Label x={128} y={206} size={13} muted>
            {t.diaView}
          </Label>
        </>
      )}

      {kind === "chair" && (
        <>
          <VerticalDimension x={124} y1={150} y2={214} marker={ids.ink} label="1–2 m" />
          <PhoneOnStand x={70} y={226} />
          <Label x={70} y={272} size={14} weight={700}>
            {t.diaPhoneShort}
          </Label>
          <SideView t={t} hatch={ids.hatch} marker={ids.ink} />
        </>
      )}
    </svg>
  );
}

/* ---------- parts ---------- */

/** Text with a halo in the card color, so it stays readable over lines. */
function Label({
  x,
  y,
  size = 14,
  weight = 400,
  anchor = "middle",
  muted,
  rotate,
  children,
}: {
  x: number;
  y: number;
  size?: number;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  muted?: boolean;
  rotate?: boolean;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      transform={rotate ? `rotate(-90 ${x} ${y})` : undefined}
      dominantBaseline={rotate ? "middle" : undefined}
      paintOrder="stroke"
      strokeWidth={4}
      strokeLinejoin="round"
      style={{ fill: muted ? "var(--ink-2)" : "var(--ink)", stroke: "var(--card)" }}
    >
      {children}
    </text>
  );
}

function Floor({ h }: { h: number }) {
  const boards = [];
  for (let y = 28; y < h; y += 28) boards.push(<line key={y} x1="16" y1={y} x2="360" y2={y} />);
  return (
    <g style={{ stroke: "var(--line)" }} strokeWidth="1" opacity="0.6">
      {boards}
    </g>
  );
}

/** Seat front edge is at x = 74; the backrest touches the wall. */
function Chair() {
  return (
    <g>
      <rect x="17" y="88" width="10" height="64" rx="3" style={{ fill: "var(--ink)" }} />
      <rect x="26" y="90" width="48" height="60" rx="8" strokeWidth="2.5" style={{ fill: "var(--card)", stroke: "var(--ink)" }} />
      <rect x="31" y="95" width="38" height="50" rx="5" strokeWidth="1" opacity="0.7" style={{ fill: "none", stroke: "var(--line)" }} />
    </g>
  );
}

/** Seen from above: head and shoulders by the backrest, thighs along the seat, feet on the floor. */
function SeatedPerson() {
  return (
    <g>
      <rect x="44" y="104" width="38" height="12" rx="6" style={{ fill: "var(--ink-2)" }} />
      <rect x="44" y="124" width="38" height="12" rx="6" style={{ fill: "var(--ink-2)" }} />
      <ellipse cx="88" cy="110" rx="6" ry="5" style={{ fill: "var(--ink-2)" }} />
      <ellipse cx="88" cy="130" rx="6" ry="5" style={{ fill: "var(--ink-2)" }} />
      <ellipse cx="38" cy="120" rx="10" ry="22" style={{ fill: "var(--ink-2)" }} />
      <circle cx="41" cy="120" r="10" style={{ fill: "var(--ink)" }} />
    </g>
  );
}

/** Strip of tape on the floor across the walking line. */
function TapeMark({ x }: { x: number }) {
  return (
    <g>
      <rect x={x} y="86" width="10" height="68" rx="1.5" strokeWidth="2" style={{ fill: "var(--total-bg)", stroke: "var(--total-bd)" }} />
      <path d={`M${x} 86 l2.5 -3 l2.5 3 l2.5 -3 l2.5 3`} strokeWidth="2" fill="none" style={{ stroke: "var(--total-bd)" }} />
      <path d={`M${x} 154 l2.5 3 l2.5 -3 l2.5 3 l2.5 -3`} strokeWidth="2" fill="none" style={{ stroke: "var(--total-bd)" }} />
    </g>
  );
}

/** Horizontal dimension with extension lines down to the objects it measures. */
function Dimension({ x1, x2, y, from, marker, label }: { x1: number; x2: number; y: number; from: number; marker: string; label: string }) {
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <g style={{ stroke: "var(--ink-2)" }} strokeWidth="1.5" strokeDasharray="3 3">
        <line x1={x1} y1={y - 8} x2={x1} y2={from} />
        <line x1={x2} y1={y - 8} x2={x2} y2={from} />
      </g>
      <line x1={x1 + 1} y1={y} x2={x2 - 1} y2={y} strokeWidth="2" style={{ stroke: "var(--ink)" }} markerStart={`url(#${marker})`} markerEnd={`url(#${marker})`} />
      <rect x={mid - 52} y={y - 14} width="104" height="28" rx="14" strokeWidth="1.5" style={{ fill: "var(--card)", stroke: "var(--ink)" }} />
      <text x={mid} y={y + 5.5} textAnchor="middle" fontSize="15" fontWeight="700" style={{ fill: "var(--ink)" }}>
        {label}
      </text>
    </g>
  );
}

function VerticalDimension({
  x,
  y1,
  y2,
  marker,
  label,
  side = "right",
}: {
  x: number;
  y1: number;
  y2: number;
  marker: string;
  label: string;
  side?: "left" | "right";
}) {
  return (
    <g>
      <line x1={x} y1={y1 + 1} x2={x} y2={y2 - 1} strokeWidth="2" style={{ stroke: "var(--ink)" }} markerStart={`url(#${marker})`} markerEnd={`url(#${marker})`} />
      <Label x={side === "right" ? x + 8 : x - 8} y={(y1 + y2) / 2 + 5} size={15} weight={700} anchor={side === "right" ? "start" : "end"}>
        {label}
      </Label>
    </g>
  );
}

/** Wedge from the lens: everything inside it must be in the picture. */
function CameraView({ apex, left, right }: { apex: [number, number]; left: [number, number]; right: [number, number] }) {
  const pts = `${apex.join(",")} ${left.join(",")} ${right.join(",")}`;
  return (
    <g>
      <polygon points={pts} style={{ fill: "color-mix(in srgb, var(--act) 9%, transparent)" }} />
      <g style={{ stroke: "var(--act)" }} strokeWidth="1.5" strokeDasharray="6 5" opacity="0.7">
        <line x1={apex[0]} y1={apex[1]} x2={left[0]} y2={left[1]} />
        <line x1={apex[0]} y1={apex[1]} x2={right[0]} y2={right[1]} />
      </g>
    </g>
  );
}

/** Phone on its side on a small tripod, seen from above, lens facing the walking line. */
function PhoneOnStand({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <g style={{ stroke: "var(--ink-2)" }} strokeWidth="3" strokeLinecap="round">
        <line x1={x} y1={y + 8} x2={x - 20} y2={y + 26} />
        <line x1={x} y1={y + 8} x2={x + 20} y2={y + 26} />
        <line x1={x} y1={y + 8} x2={x} y2={y + 30} />
      </g>
      <rect x={x - 23} y={y - 1} width="46" height="18" rx="4" style={{ fill: "var(--ink)" }} />
      <rect x={x - 19} y={y + 2.5} width="38" height="11" rx="2" opacity="0.35" style={{ fill: "var(--card)" }} />
      <circle cx={x} cy={y - 1} r="4.5" strokeWidth="2" style={{ fill: "var(--act)", stroke: "var(--card)" }} />
    </g>
  );
}

function StepDot({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="11" strokeWidth="2" style={{ fill: "var(--card)", stroke: "var(--act)" }} />
      <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" style={{ fill: "var(--ink)" }}>
        {n}
      </text>
    </g>
  );
}

/** A tape measure hooked on the seat edge, laid out to the mark, 10 cm ticks. */
function TapeMeasure({ label }: { label: string }) {
  const ticks = [];
  for (let i = 0; i <= 30; i++) {
    const x = 74 + i * 8;
    const major = i % 10 === 0;
    const half = i % 5 === 0;
    ticks.push(<line key={i} x1={x} y1="113" x2={x} y2={113 + (major ? 13 : half ? 8 : 5)} strokeWidth={major ? 2 : 1} />);
  }
  return (
    <g>
      <rect x="74" y="113" width="242" height="14" strokeWidth="1.5" style={{ fill: "var(--total-bg)", stroke: "var(--total-bd)" }} />
      <g style={{ stroke: "var(--total-fg)" }}>{ticks}</g>
      <rect x="71" y="110" width="5" height="20" rx="1" style={{ fill: "var(--total-bd)" }} />
      {/* 1 m and 2 m only: 3 m is the mark, labelled by the dimension above */}
      {[1, 2].map((m) => (
        <Label key={m} x={74 + m * 80} y={146} size={13} weight={700}>
          {`${m} m`}
        </Label>
      ))}
      {/* the case at the far end */}
      <rect x="324" y="102" width="32" height="36" rx="8" style={{ fill: "var(--ink)" }} />
      <circle cx="340" cy="120" r="8" strokeWidth="2.5" style={{ fill: "none", stroke: "var(--card)" }} />
      <circle cx="340" cy="120" r="2" style={{ fill: "var(--card)" }} />
      <Label x={194} y={186} size={14} muted>
        {label}
      </Label>
    </g>
  );
}

/** Chair stand, seen from the side: arms crossed, 17 in seat, phone at hip height. */
function SideView({ t, hatch, marker }: { t: (typeof STRINGS)["en"]; hatch: string; marker: string }) {
  const floor = 236;
  const seat = 176; // 17 in drawn at this height
  const hip = 168;
  return (
    <g>
      <rect x="180" y="12" width="176" height="256" rx="10" strokeWidth="1.5" style={{ fill: "var(--card)", stroke: "var(--line)" }} />
      <Label x={268} y={34} size={13} weight={700} muted>
        {t.diaSide}
      </Label>
      {/* wall and floor */}
      <rect x="182" y="48" width="8" height={floor - 48} fill={`url(#${hatch})`} />
      <line x1="182" y1={floor} x2="354" y2={floor} strokeWidth="2" style={{ stroke: "var(--ink-2)" }} />
      {/* chair */}
      <g style={{ stroke: "var(--ink)" }} strokeWidth="4" strokeLinecap="round">
        <line x1="196" y1={floor} x2="196" y2="112" />
        <line x1="196" y1={seat} x2="244" y2={seat} strokeWidth="6" />
        <line x1="242" y1={seat} x2="242" y2={floor} />
      </g>
      {/* seated person, arms crossed on the chest */}
      <g style={{ stroke: "var(--ink-2)" }} strokeLinecap="round" fill="none">
        <line x1="210" y1="124" x2="208" y2={hip} strokeWidth="13" />
        <line x1="210" y1={hip} x2="250" y2={hip} strokeWidth="12" />
        <line x1="252" y1={hip + 2} x2="256" y2={floor - 6} strokeWidth="10" />
        <line x1="256" y1={floor - 4} x2="272" y2={floor - 4} strokeWidth="7" />
      </g>
      {/* arm folded across the chest: shoulder down to the elbow, forearm back up to the other shoulder */}
      <path d="M211 128 L224 148 L213 134" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" style={{ stroke: "var(--ink)" }} />
      <circle cx="212" cy="108" r="12" style={{ fill: "var(--ink)" }} />
      {/* seat height */}
      <line x1="226" y1={seat + 6} x2="226" y2={floor - 2} strokeWidth="1.5" style={{ stroke: "var(--ink)" }} markerStart={`url(#${marker})`} markerEnd={`url(#${marker})`} />
      <Label x={268} y={258} size={13} weight={700}>
        {t.diaSeat}
      </Label>
      {/* phone on a tripod, lens level with the hip */}
      <g style={{ stroke: "var(--ink-2)" }} strokeWidth="3" strokeLinecap="round">
        <line x1="334" y1={hip + 10} x2="320" y2={floor} />
        <line x1="334" y1={hip + 10} x2="348" y2={floor} />
        <line x1="334" y1={hip + 10} x2="334" y2={floor} />
      </g>
      <rect x="328" y={hip - 14} width="12" height="26" rx="3" style={{ fill: "var(--ink)" }} />
      <circle cx="328" cy={hip} r="4" strokeWidth="2" style={{ fill: "var(--act)", stroke: "var(--card)" }} />
      <line x1="322" y1={hip} x2="258" y2={hip} strokeWidth="2" strokeDasharray="5 4" style={{ stroke: "var(--act)" }} />
      <Label x={320} y={hip - 10} size={12} weight={700} anchor="end">
        {t.diaHip}
      </Label>
    </g>
  );
}
