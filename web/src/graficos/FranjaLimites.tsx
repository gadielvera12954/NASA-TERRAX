import React from 'react';

export interface FranjaLimitesProps {
  c: number;          // Compatibility (e.g. 0.82)
  e: number;          // Evidence (e.g. 0.70)
  l: number;          // Lower bound (e.g. 0.574)
  u: number;          // Upper bound (e.g. 0.874)
  umbral?: number;    // Decision threshold (default 0.70)
  ancho?: number;
  alto?: number;
  etiqueta?: string;
}

export const FranjaLimites: React.FC<FranjaLimitesProps> = ({
  c = 0.82,
  e = 0.70,
  l = 0.574,
  u = 0.874,
  umbral = 0.70,
  ancho = 320,
  alto = 74,
  etiqueta = 'Bounds interval [L, U] vs Threshold 0.70',
}) => {
  const paddingX = 30;
  const graphW = ancho - paddingX * 2;
  const barY = 32;
  const barHeight = 12;

  // Scale [0.0 -> 1.0] to X coordinates
  const scaleX = (val: number) => paddingX + Math.max(0, Math.min(1, val)) * graphW;

  const xL = scaleX(l);
  const xU = scaleX(u);
  const xUmbral = scaleX(umbral);
  const xC = scaleX(c);
  const xE = scaleX(e);

  return (
    <div style={{ width: ancho, fontFamily: 'var(--txt)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '4px',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--sec-dark)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <span>{etiqueta}</span>
        <span style={{ fontFamily: 'var(--mono)', color: 'var(--sol)' }}>
          C: {c.toFixed(2)} · E: {e.toFixed(2)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={`Bounds from ${l} to ${u} with threshold ${umbral}`}
      >
        {/* Background track (0.0 to 1.0) */}
        <rect
          x={paddingX}
          y={barY}
          width={graphW}
          height={barHeight}
          fill="#0C1E4D"
          stroke="#1E3160"
          strokeWidth="1"
          rx="2"
        />

        {/* Interval [L, U] filled bar */}
        <rect
          x={xL}
          y={barY + 1}
          width={Math.max(2, xU - xL)}
          height={barHeight - 2}
          fill="rgba(231, 244, 52, 0.35)"
          stroke="var(--sol)"
          strokeWidth="1"
          rx="1"
        />

        {/* Threshold dashed vertical line */}
        <line
          x1={xUmbral}
          y1={barY - 8}
          x2={xUmbral}
          y2={barY + barHeight + 8}
          stroke="#EF4444"
          strokeWidth="1.5"
          strokeDasharray="3,3"
        />
        <text
          x={xUmbral}
          y={barY - 11}
          fill="#EF4444"
          fontSize="9"
          fontFamily="var(--mono)"
          fontWeight="700"
          textAnchor="middle"
        >
          0.70
        </text>

        {/* Marker for Compatibility C */}
        <circle cx={xC} cy={barY + barHeight / 2} r="4.5" fill="var(--sol)" stroke="#07173F" strokeWidth="1.5" />

        {/* Marker for Evidence E */}
        <polygon
          points={`${xE},${barY + barHeight + 4} ${xE - 4},${barY + barHeight + 10} ${xE + 4},${barY + barHeight + 10}`}
          fill="#2491FF"
        />

        {/* Axis Ticks and Labels */}
        <text x={paddingX} y={barY + barHeight + 18} fill="var(--sec-dark)" fontSize="10" fontFamily="var(--mono)" textAnchor="start">
          0.00
        </text>
        <text x={xL} y={barY + barHeight + 18} fill="var(--sol)" fontSize="10" fontFamily="var(--mono)" textAnchor="middle">
          L: {l.toFixed(2)}
        </text>
        <text x={xU} y={barY + barHeight + 18} fill="var(--sol)" fontSize="10" fontFamily="var(--mono)" textAnchor="middle">
          U: {u.toFixed(2)}
        </text>
        <text x={ancho - paddingX} y={barY + barHeight + 18} fill="var(--sec-dark)" fontSize="10" fontFamily="var(--mono)" textAnchor="end">
          1.00
        </text>
      </svg>
    </div>
  );
};
