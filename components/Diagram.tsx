/** Simple top-down setup diagram: chair, walking line, phone to the side. */
export function SetupDiagram({ kind }: { kind: "tug" | "chair" | "measure" }) {
  const lineLen = kind === "chair" ? 0 : 240;
  return (
    <svg className="diagram" viewBox="0 0 360 200" role="img" aria-label="Setup diagram: chair against wall, walking line, phone to the side">
      {/* wall */}
      <rect x="10" y="20" width="10" height="110" fill="#9aa5a1" />
      {/* chair */}
      <rect x="22" y="55" width="40" height="40" rx="4" fill="#0f3d3e" />
      <text x="42" y="112" textAnchor="middle" fontSize="12" fill="currentColor">chair</text>
      {lineLen > 0 && (
        <>
          <line x1="62" y1="75" x2={62 + lineLen} y2="75" stroke="#e07a2f" strokeWidth="3" strokeDasharray="8 6" />
          <rect x={62 + lineLen - 2} y="50" width="5" height="50" fill="#e07a2f" />
          <text x={62 + lineLen / 2} y="66" textAnchor="middle" fontSize="13" fill="currentColor">3 m (10 ft)</text>
          <text x={62 + lineLen} y="112" textAnchor="middle" fontSize="12" fill="currentColor">tape</text>
        </>
      )}
      {/* phone */}
      <g transform={`translate(${kind === "chair" ? 30 : 160}, 165)`}>
        <rect x="0" y="0" width="34" height="20" rx="4" fill="#1b1f1e" />
        <circle cx="17" cy="0" r="3" fill="#3ee08f" />
      </g>
      <line
        x1={kind === "chair" ? 47 : 177}
        y1="160"
        x2={kind === "chair" ? 47 : 177}
        y2="120"
        stroke="#5b625f"
        strokeWidth="1.5"
        strokeDasharray="3 4"
      />
      <text x={kind === "chair" ? 90 : 220} y="185" fontSize="12" fill="currentColor">
        {kind === "chair" ? "phone, 1–2 m to the side" : "phone, ~2 m (wide) or ~3 m to the side"}
      </text>
    </svg>
  );
}
